from __future__ import annotations

import hashlib
import re
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse
from urllib.request import urlopen

from app.documents.schemas import DocumentTextExtractionRequest, DocumentTextExtractionResponse


PDF_MIME_TYPES = {"application/pdf", "application/x-pdf"}
HTTP_TIMEOUT_SECONDS = 15


class DocumentReadError(Exception):
    pass


class DocumentExtractionError(Exception):
    pass


@dataclass(frozen=True)
class DocumentBytes:
    content: bytes
    source_kind: str


@dataclass(frozen=True)
class PdfTextResult:
    text: str
    page_count: int | None
    has_text_layer: bool
    extractor: str


def extract_document_text(
    request: DocumentTextExtractionRequest,
) -> DocumentTextExtractionResponse:
    metadata = _base_metadata(request)

    if not _is_pdf(request):
        return _failed_response(
            metadata | {"reason": "unsupported_mime_type"},
            error_message="Unsupported document type.",
        )

    try:
        document = _read_document_bytes(request)
        metadata["sourceKind"] = document.source_kind
        result = _extract_pdf_text(document.content, request.max_pages)
    except DocumentReadError:
        return _failed_response(metadata, error_message="Unable to read document content.")
    except DocumentExtractionError:
        return _failed_response(metadata, error_message="Unable to extract text safely.")

    metadata["extractor"] = result.extractor
    metadata["ocr"] = {"available": False, "reason": "future_path"}

    if not result.has_text_layer:
        return DocumentTextExtractionResponse(
            status="OCR_REQUIRED",
            text=None,
            text_checksum=None,
            page_count=result.page_count,
            has_text_layer=False,
            metadata=metadata | {"reason": "empty_text_layer"},
            error_message=None,
        )

    checksum = hashlib.sha256(result.text.encode("utf-8")).hexdigest()
    return DocumentTextExtractionResponse(
        status="TEXT_READY",
        text=result.text,
        text_checksum=checksum,
        page_count=result.page_count,
        has_text_layer=True,
        metadata=metadata,
        error_message=None,
    )


def _base_metadata(request: DocumentTextExtractionRequest) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "documentId": request.document_id,
        "externalDocumentId": request.external_document_id,
        "fileName": request.file_name,
        "mimeType": request.mime_type,
    }

    if request.max_pages is not None:
        metadata["maxPages"] = request.max_pages

    return metadata


def _failed_response(
    metadata: dict[str, Any],
    *,
    error_message: str,
    page_count: int | None = None,
    has_text_layer: bool | None = None,
) -> DocumentTextExtractionResponse:
    return DocumentTextExtractionResponse(
        status="FAILED",
        text=None,
        text_checksum=None,
        page_count=page_count,
        has_text_layer=has_text_layer,
        metadata=metadata,
        error_message=error_message,
    )


def _is_pdf(request: DocumentTextExtractionRequest) -> bool:
    mime_type = request.mime_type.lower()
    file_name = request.file_name.lower()
    return mime_type in PDF_MIME_TYPES or file_name.endswith(".pdf")


def _read_document_bytes(request: DocumentTextExtractionRequest) -> DocumentBytes:
    locator = request.file_url or request.signed_url or request.storage_key

    if not locator:
        raise DocumentReadError()

    parsed = urlparse(locator)

    if parsed.scheme in {"http", "https"}:
        try:
            with urlopen(locator, timeout=HTTP_TIMEOUT_SECONDS) as response:
                return DocumentBytes(content=response.read(), source_kind=parsed.scheme)
        except Exception as exc:
            raise DocumentReadError() from exc

    path = _path_from_locator(locator, parsed.scheme)

    if not path.is_file():
        raise DocumentReadError()

    try:
        return DocumentBytes(content=path.read_bytes(), source_kind="local_file")
    except OSError as exc:
        raise DocumentReadError() from exc


def _path_from_locator(locator: str, scheme: str) -> Path:
    if scheme == "file":
        parsed = urlparse(locator)
        path_text = unquote(parsed.path)
        if parsed.netloc:
            path_text = f"//{parsed.netloc}{path_text}"
        if len(path_text) >= 3 and path_text[0] == "/" and path_text[2] == ":":
            path_text = path_text[1:]
        return Path(path_text)

    return Path(locator)


def _extract_pdf_text(content: bytes, max_pages: int | None) -> PdfTextResult:
    if not content.startswith(b"%PDF"):
        raise DocumentExtractionError()

    page_count = _count_pdf_pages(content)
    text_chunks = _extract_text_chunks_from_pdf_streams(content, max_pages)
    text = _clean_text("\n".join(text_chunks))

    if not text:
        return PdfTextResult(
            text="",
            page_count=page_count,
            has_text_layer=False,
            extractor="pdf-content-stream-v1",
        )

    return PdfTextResult(
        text=text,
        page_count=page_count,
        has_text_layer=True,
        extractor="pdf-content-stream-v1",
    )


def _count_pdf_pages(content: bytes) -> int | None:
    try:
        matches = re.findall(rb"/Type\s*/Page\b", content)
    except re.error:
        return None
    return len(matches) or None


def _extract_text_chunks_from_pdf_streams(content: bytes, max_pages: int | None) -> list[str]:
    chunks: list[str] = []
    pages_seen = 0

    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", content, re.DOTALL):
        raw_stream = match.group(1)
        dictionary_prefix = content[max(0, match.start() - 512) : match.start()]
        stream = _decode_pdf_stream(raw_stream, dictionary_prefix)
        decoded = stream.decode("latin-1", errors="ignore")

        for text_object in re.findall(r"\bBT\b(.*?)\bET\b", decoded, re.DOTALL):
            text = _extract_text_from_pdf_text_object(text_object)
            if text:
                chunks.append(text)

        if b"/Type /Page" in dictionary_prefix or b"/Type/Page" in dictionary_prefix:
            pages_seen += 1
            if max_pages is not None and pages_seen >= max_pages:
                break

    return chunks


def _decode_pdf_stream(raw_stream: bytes, dictionary_prefix: bytes) -> bytes:
    if b"/FlateDecode" not in dictionary_prefix:
        return raw_stream

    try:
        return zlib.decompress(raw_stream)
    except zlib.error:
        return raw_stream


def _extract_text_from_pdf_text_object(text_object: str) -> str:
    parts: list[str] = []
    index = 0

    while index < len(text_object):
        char = text_object[index]
        if char == "(":
            literal, index = _read_pdf_literal_string(text_object, index)
            if literal:
                parts.append(literal)
            continue

        if char == "<" and index + 1 < len(text_object) and text_object[index + 1] != "<":
            end = text_object.find(">", index + 1)
            if end != -1:
                hex_text = text_object[index + 1 : end]
                decoded = _decode_pdf_hex_string(hex_text)
                if decoded:
                    parts.append(decoded)
                index = end + 1
                continue

        index += 1

    return " ".join(part for part in parts if part.strip())


def _read_pdf_literal_string(source: str, start: int) -> tuple[str, int]:
    depth = 1
    index = start + 1
    buffer = bytearray()

    while index < len(source) and depth > 0:
        char = source[index]

        if char == "\\":
            index = _append_pdf_escape(source, index, buffer)
            continue

        if char == "(":
            depth += 1
            buffer.extend(char.encode("latin-1", errors="ignore"))
            index += 1
            continue

        if char == ")":
            depth -= 1
            if depth == 0:
                index += 1
                break
            buffer.extend(char.encode("latin-1", errors="ignore"))
            index += 1
            continue

        buffer.extend(char.encode("latin-1", errors="ignore"))
        index += 1

    return _decode_pdf_string_bytes(bytes(buffer)), index


def _append_pdf_escape(source: str, index: int, buffer: bytearray) -> int:
    index += 1

    if index >= len(source):
        return index

    char = source[index]
    escape_map = {
        "n": b"\n",
        "r": b"\r",
        "t": b"\t",
        "b": b"\b",
        "f": b"\f",
        "(": b"(",
        ")": b")",
        "\\": b"\\",
    }

    if char in escape_map:
        buffer.extend(escape_map[char])
        return index + 1

    if char in "\r\n":
        if char == "\r" and index + 1 < len(source) and source[index + 1] == "\n":
            return index + 2
        return index + 1

    if char in "01234567":
        end = index + 1
        while end < len(source) and end - index < 3 and source[end] in "01234567":
            end += 1
        buffer.append(int(source[index:end], 8))
        return end

    buffer.extend(char.encode("latin-1", errors="ignore"))
    return index + 1


def _decode_pdf_hex_string(value: str) -> str:
    compact = re.sub(r"\s+", "", value)

    if not compact or re.search(r"[^0-9a-fA-F]", compact):
        return ""

    if len(compact) % 2 == 1:
        compact += "0"

    try:
        return _decode_pdf_string_bytes(bytes.fromhex(compact))
    except ValueError:
        return ""


def _decode_pdf_string_bytes(value: bytes) -> str:
    if value.startswith(b"\xfe\xff"):
        return value[2:].decode("utf-16-be", errors="ignore")

    if value.startswith(b"\xff\xfe"):
        return value[2:].decode("utf-16-le", errors="ignore")

    try:
        return value.decode("utf-8")
    except UnicodeDecodeError:
        return value.decode("latin-1", errors="ignore")


def _clean_text(value: str) -> str:
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line)
