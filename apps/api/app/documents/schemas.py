from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


DocumentTextExtractionStatus = Literal["TEXT_READY", "OCR_REQUIRED", "FAILED"]


class DocumentTextExtractionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    document_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("documentId", "document_id"),
        serialization_alias="documentId",
    )
    external_document_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("externalDocumentId", "external_document_id"),
        serialization_alias="externalDocumentId",
    )
    file_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("fileUrl", "file_url"),
        serialization_alias="fileUrl",
    )
    storage_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("storageKey", "storage_key"),
        serialization_alias="storageKey",
    )
    signed_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("signedUrl", "signed_url"),
        serialization_alias="signedUrl",
    )
    file_name: str = Field(
        validation_alias=AliasChoices("fileName", "file_name"),
        serialization_alias="fileName",
    )
    mime_type: str = Field(
        validation_alias=AliasChoices("mimeType", "mime_type"),
        serialization_alias="mimeType",
    )
    max_pages: int | None = Field(
        default=None,
        ge=1,
        validation_alias=AliasChoices("maxPages", "max_pages"),
        serialization_alias="maxPages",
    )

    @field_validator(
        "document_id",
        "external_document_id",
        "file_url",
        "storage_key",
        "signed_url",
        "file_name",
        "mime_type",
        mode="before",
    )
    @classmethod
    def clean_string(cls, value: object) -> object:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @model_validator(mode="after")
    def require_trace_and_locator(self) -> "DocumentTextExtractionRequest":
        if not self.document_id and not self.external_document_id:
            raise ValueError("documentId or externalDocumentId is required.")

        if not self.file_url and not self.storage_key and not self.signed_url:
            raise ValueError("fileUrl, storageKey, or signedUrl is required.")

        if not self.file_name:
            raise ValueError("fileName is required.")

        if not self.mime_type:
            raise ValueError("mimeType is required.")

        return self


class DocumentTextExtractionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    status: DocumentTextExtractionStatus
    text: str | None = None
    text_checksum: str | None = Field(default=None, serialization_alias="textChecksum")
    page_count: int | None = Field(default=None, serialization_alias="pageCount")
    has_text_layer: bool | None = Field(default=None, serialization_alias="hasTextLayer")
    metadata: dict[str, Any] = Field(default_factory=dict)
    error_message: str | None = Field(default=None, serialization_alias="errorMessage")
