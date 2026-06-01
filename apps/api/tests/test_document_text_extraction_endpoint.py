from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.settings import get_settings


def _client() -> TestClient:
    get_settings.cache_clear()
    return TestClient(app)


def _write_fixture(path: Path, content: bytes) -> str:
    path.write_bytes(content)
    return path.as_uri()


def _text_pdf_bytes(text: str) -> bytes:
    stream = f"BT\n/F1 12 Tf\n72 720 Td\n({text}) Tj\nET".encode("ascii")
    return (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
        b"4 0 obj << /Length "
        + str(len(stream)).encode("ascii")
        + b" >> stream\n"
        + stream
        + b"\nendstream endobj\n"
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
        b"trailer << /Root 1 0 R >>\n%%EOF"
    )


def _empty_pdf_bytes() -> bytes:
    return (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\n"
        b"trailer << /Root 1 0 R >>\n%%EOF"
    )


def test_extract_text_pdf_with_text_layer_returns_text_ready(tmp_path: Path) -> None:
    client = _client()
    file_url = _write_fixture(tmp_path / "text-layer.pdf", _text_pdf_bytes("Tender terms"))

    response = client.post(
        "/v1/documents/extract-text",
        json={
            "documentId": "document-1",
            "fileUrl": file_url,
            "fileName": "text-layer.pdf",
            "mimeType": "application/pdf",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "TEXT_READY"
    assert payload["text"] == "Tender terms"
    assert len(payload["textChecksum"]) == 64
    assert payload["pageCount"] == 1
    assert payload["hasTextLayer"] is True
    assert payload["errorMessage"] is None


def test_extract_text_empty_pdf_requires_ocr(tmp_path: Path) -> None:
    client = _client()
    file_url = _write_fixture(tmp_path / "empty.pdf", _empty_pdf_bytes())

    response = client.post(
        "/v1/documents/extract-text",
        json={
            "externalDocumentId": "external-document-1",
            "fileUrl": file_url,
            "fileName": "empty.pdf",
            "mimeType": "application/pdf",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "OCR_REQUIRED"
    assert payload["text"] is None
    assert payload["textChecksum"] is None
    assert payload["pageCount"] == 1
    assert payload["hasTextLayer"] is False
    assert payload["metadata"]["ocr"]["available"] is False


def test_extract_text_unsupported_document_fails_safely(tmp_path: Path) -> None:
    client = _client()
    file_url = _write_fixture(tmp_path / "unsupported.txt", b"plain text is not supported")

    response = client.post(
        "/v1/documents/extract-text",
        json={
            "documentId": "document-unsupported",
            "fileUrl": file_url,
            "fileName": "unsupported.txt",
            "mimeType": "text/plain",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "FAILED"
    assert payload["text"] is None
    assert payload["textChecksum"] is None
    assert payload["pageCount"] is None
    assert payload["hasTextLayer"] is None
    assert payload["errorMessage"] == "Unsupported document type."
    assert str(tmp_path) not in payload["errorMessage"]
