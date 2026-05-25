from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


ProviderErrorCode = Literal[
    "upstream_unavailable",
    "upstream_rate_limited",
    "invalid_provider_response",
    "provider_not_configured",
]


class SavedFilterExecutionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    filter_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("filterId", "filter_id", "saved_filter_id"),
        serialization_alias="filterId",
    )
    search_query: str | None = Field(
        default=None,
        validation_alias=AliasChoices("searchQuery", "search_query", "query"),
        serialization_alias="searchQuery",
    )
    include_keywords: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("includeKeywords", "include_keywords"),
        serialization_alias="includeKeywords",
    )
    exclude_keywords: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("excludeKeywords", "exclude_keywords"),
        serialization_alias="excludeKeywords",
    )
    okpd2_prefixes: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("okpd2Prefixes", "okpd2_prefixes", "okpd2_codes"),
        serialization_alias="okpd2Prefixes",
    )
    region_codes: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("regionCodes", "region_codes", "regions"),
        serialization_alias="regionCodes",
    )
    method_allow_list: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("methodAllowList", "method_allow_list"),
        serialization_alias="methodAllowList",
    )
    customer_inn_allow_list: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "customerInnAllowList",
            "customer_inn_allow_list",
            "customer_inns",
        ),
        serialization_alias="customerInnAllowList",
    )
    customer_inn_block_list: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("customerInnBlockList", "customer_inn_block_list"),
        serialization_alias="customerInnBlockList",
    )
    min_price: Decimal | None = Field(
        default=None,
        validation_alias=AliasChoices("minPrice", "min_price", "min_initial_price"),
        serialization_alias="minPrice",
    )
    max_price: Decimal | None = Field(
        default=None,
        validation_alias=AliasChoices("maxPrice", "max_price", "max_initial_price"),
        serialization_alias="maxPrice",
    )
    days_ahead: int | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("daysAhead", "days_ahead"),
        serialization_alias="daysAhead",
    )
    cursor: str | None = None
    limit: int = Field(default=20, ge=1, le=100)
    source_stages: list[str] = Field(default_factory=list)
    publish_date_from: date | None = None
    publish_date_to: date | None = None

    @field_validator("search_query", "cursor", mode="before")
    @classmethod
    def empty_string_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator(
        "include_keywords",
        "exclude_keywords",
        "okpd2_prefixes",
        "region_codes",
        "method_allow_list",
        "customer_inn_allow_list",
        "customer_inn_block_list",
        "source_stages",
        mode="before",
    )
    @classmethod
    def clean_string_list(cls, value: object) -> object:
        if value is None:
            return []
        if not isinstance(value, list):
            return value
        cleaned: list[Any] = []
        for item in value:
            if isinstance(item, str):
                text = item.strip()
                if text:
                    cleaned.append(text)
            else:
                cleaned.append(item)
        return cleaned


class NormalizedTenderHit(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    provider: Literal["eis223"] = "eis223"
    law: Literal["223-FZ"] = "223-FZ"
    external_id: str = Field(serialization_alias="externalId")
    registry_number: str = Field(serialization_alias="registryNumber")
    title: str
    source_stage: str = Field(serialization_alias="sourceStage")
    customer_name: str = Field(serialization_alias="customerName")
    customer_inn: str | None = Field(default=None, serialization_alias="customerInn")
    procurement_method: str | None = Field(default=None, serialization_alias="procurementMethod")
    region: str | None = None
    okpd2_codes: list[str] = Field(default_factory=list, serialization_alias="okpd2Codes")
    initial_price: Decimal | None = Field(default=None, serialization_alias="initialPrice")
    currency: str = "RUB"
    publish_date: date | None = Field(default=None, serialization_alias="publishDate")
    submission_deadline: datetime | None = Field(
        default=None,
        serialization_alias="applicationDeadlineAt",
    )
    detail_url: str | None = Field(default=None, serialization_alias="detailUrl")


class EIS223SearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    hits: list[NormalizedTenderHit]
    next_cursor: str | None = Field(default=None, serialization_alias="nextCursor")
    provider_mode: Literal["fixture", "live"] = Field(serialization_alias="providerMode")
    source_freshness: str | dict[str, Any] = Field(serialization_alias="sourceFreshness")


class ProviderErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: ProviderErrorCode
    message: str
    provider: Literal["eis223"] = "eis223"
