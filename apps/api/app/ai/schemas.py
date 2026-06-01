from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


AIProviderMode = Literal["mock", "live"]
AILanguage = Literal["ru"]


class AITextChunk(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    chunk_id: str = Field(
        validation_alias=AliasChoices("chunkId", "chunk_id"),
        serialization_alias="chunkId",
    )
    text: str = Field(min_length=1)
    start_offset: int = Field(
        default=0,
        ge=0,
        validation_alias=AliasChoices("startOffset", "start_offset"),
        serialization_alias="startOffset",
    )

    @field_validator("chunk_id", "text", mode="before")
    @classmethod
    def clean_required_string(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class AIAnalysisDocumentInput(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    document_id: str = Field(
        validation_alias=AliasChoices("documentId", "document_id"),
        serialization_alias="documentId",
    )
    external_document_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("externalDocumentId", "external_document_id"),
        serialization_alias="externalDocumentId",
    )
    title: str = Field(min_length=1)
    text: str | None = None
    chunks: list[AITextChunk] = Field(default_factory=list)
    text_checksum: str | None = Field(
        default=None,
        validation_alias=AliasChoices("textChecksum", "text_checksum"),
        serialization_alias="textChecksum",
    )

    @field_validator(
        "document_id",
        "external_document_id",
        "title",
        "text",
        "text_checksum",
        mode="before",
    )
    @classmethod
    def clean_optional_string(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            text = value.strip()
            return text or None
        return value

    @model_validator(mode="after")
    def require_text_or_chunks(self) -> "AIAnalysisDocumentInput":
        if self.text and self.text.strip():
            return self
        if self.chunks:
            return self
        raise ValueError("text or chunks is required.")


class SourceSpan(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    document_id: str = Field(
        validation_alias=AliasChoices("documentId", "document_id"),
        serialization_alias="documentId",
    )
    document_title: str | None = Field(
        default=None,
        validation_alias=AliasChoices("documentTitle", "document_title"),
        serialization_alias="documentTitle",
    )
    chunk_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("chunkId", "chunk_id"),
        serialization_alias="chunkId",
    )
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    quote: str = Field(min_length=1)

    @field_validator("document_id", "document_title", "chunk_id", "quote", mode="before")
    @classmethod
    def clean_string(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            text = value.strip()
            return text or None
        return value

    @model_validator(mode="after")
    def validate_offsets(self) -> "SourceSpan":
        if self.end <= self.start:
            raise ValueError("source span end must be greater than start.")
        return self


class ExtractedFact(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    label: str = Field(min_length=1)
    text: str = Field(min_length=1)
    value: str | None = None
    source_spans: list[SourceSpan] = Field(
        min_length=1,
        validation_alias=AliasChoices("sourceSpans", "source_spans"),
        serialization_alias="sourceSpans",
    )
    confidence: int = Field(ge=0, le=100)

    @field_validator("label", "text", "value", mode="before")
    @classmethod
    def clean_string(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            text = value.strip()
            return text or None
        return value


class SummaryItem(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    text: str = Field(min_length=1)
    source_spans: list[SourceSpan] = Field(
        min_length=1,
        validation_alias=AliasChoices("sourceSpans", "source_spans"),
        serialization_alias="sourceSpans",
    )

    @field_validator("text", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def require_extractive_text(self) -> "SummaryItem":
        if not any(self.text == span.quote for span in self.source_spans):
            raise ValueError("summary item text must match one of its source span quotes.")
        return self


class DeadlineFact(ExtractedFact):
    deadline_type: str = Field(
        validation_alias=AliasChoices("deadlineType", "deadline_type"),
        serialization_alias="deadlineType",
    )

    @field_validator("deadline_type", mode="before")
    @classmethod
    def clean_deadline_type(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class UnknownField(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    field: str = Field(min_length=1)
    reason: str = Field(min_length=1)

    @field_validator("field", "reason", mode="before")
    @classmethod
    def clean_string(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class AIAnalysisRequestBase(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    tender_id: str = Field(
        validation_alias=AliasChoices("tenderId", "tender_id"),
        serialization_alias="tenderId",
    )
    registry_number: str | None = Field(
        default=None,
        validation_alias=AliasChoices("registryNumber", "registry_number"),
        serialization_alias="registryNumber",
    )
    tender_title: str | None = Field(
        default=None,
        validation_alias=AliasChoices("tenderTitle", "tender_title"),
        serialization_alias="tenderTitle",
    )
    customer_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("customerName", "customer_name"),
        serialization_alias="customerName",
    )
    prompt_version: str = Field(
        validation_alias=AliasChoices("promptVersion", "prompt_version"),
        serialization_alias="promptVersion",
        min_length=1,
    )
    language: AILanguage = "ru"
    mode: AIProviderMode | None = Field(
        default=None,
        validation_alias=AliasChoices("mode", "providerMode", "provider_mode"),
        serialization_alias="mode",
    )
    model: str | None = None
    include_raw_response: bool = Field(
        default=False,
        validation_alias=AliasChoices("includeRawResponse", "include_raw_response"),
        serialization_alias="includeRawResponse",
    )

    @field_validator(
        "tender_id",
        "registry_number",
        "tender_title",
        "customer_name",
        "prompt_version",
        "model",
        mode="before",
    )
    @classmethod
    def clean_string(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            text = value.strip()
            return text or None
        return value

    @field_validator("mode", mode="before")
    @classmethod
    def clean_mode(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value


class SummarizeDocumentRequest(AIAnalysisRequestBase):
    document_id: str = Field(
        validation_alias=AliasChoices("documentId", "document_id"),
        serialization_alias="documentId",
    )
    documents: list[AIAnalysisDocumentInput] = Field(min_length=1)

    @field_validator("document_id", mode="before")
    @classmethod
    def clean_document_id(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def require_target_document(self) -> "SummarizeDocumentRequest":
        if not any(document.document_id == self.document_id for document in self.documents):
            raise ValueError("documents must contain documentId.")
        return self


class SummarizeTenderRequest(AIAnalysisRequestBase):
    documents: list[AIAnalysisDocumentInput] = Field(min_length=1)


class DiffDocumentRequest(AIAnalysisRequestBase):
    base_document: AIAnalysisDocumentInput = Field(
        validation_alias=AliasChoices("baseDocument", "base_document"),
        serialization_alias="baseDocument",
    )
    changed_document: AIAnalysisDocumentInput = Field(
        validation_alias=AliasChoices("changedDocument", "changed_document"),
        serialization_alias="changedDocument",
    )


class AIAnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    provider: AIProviderMode
    model: str = Field(min_length=1)
    prompt_version: str = Field(
        validation_alias=AliasChoices("promptVersion", "prompt_version"),
        serialization_alias="promptVersion",
        min_length=1,
    )
    language: AILanguage = "ru"
    summary_md: str | None = Field(
        default=None,
        validation_alias=AliasChoices("summaryMd", "summary_md"),
        serialization_alias="summaryMd",
    )
    summary_items: list[SummaryItem] = Field(
        default_factory=list,
        validation_alias=AliasChoices("summaryItems", "summary_items"),
        serialization_alias="summaryItems",
    )
    requirements: list[ExtractedFact] = Field(default_factory=list)
    risks: list[ExtractedFact] = Field(default_factory=list)
    deadlines: list[DeadlineFact] = Field(default_factory=list)
    requested_documents: list[ExtractedFact] = Field(
        default_factory=list,
        validation_alias=AliasChoices("requestedDocuments", "requested_documents"),
        serialization_alias="requestedDocuments",
    )
    evaluation_criteria: list[ExtractedFact] = Field(
        default_factory=list,
        validation_alias=AliasChoices("evaluationCriteria", "evaluation_criteria"),
        serialization_alias="evaluationCriteria",
    )
    fields_extracted: dict[str, bool] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("fieldsExtracted", "fields_extracted"),
        serialization_alias="fieldsExtracted",
    )
    citations: list[SourceSpan] = Field(default_factory=list)
    confidence: int = Field(ge=0, le=100)
    unknowns: list[UnknownField] = Field(default_factory=list)
    raw_response: Any | None = Field(
        default=None,
        validation_alias=AliasChoices("rawResponse", "raw_response"),
        serialization_alias="rawResponse",
    )

    @field_validator("summary_md", mode="before")
    @classmethod
    def clean_summary(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            text = value.strip()
            return text or None
        return value

    @model_validator(mode="after")
    def derive_summary_markdown(self) -> "AIAnalysisResponse":
        if self.summary_items:
            self.summary_md = "\n".join(f"- {item.text}" for item in self.summary_items)
            self.citations = [
                span
                for item in self.summary_items
                for span in item.source_spans
            ]
            return self

        if self.summary_md:
            raise ValueError("summaryMd requires source-backed summaryItems.")

        self.summary_md = None
        self.citations = []
        return self
