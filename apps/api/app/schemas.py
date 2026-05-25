from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ProviderErrorCode = Literal[
    "upstream_unavailable",
    "upstream_rate_limited",
    "invalid_provider_response",
    "provider_not_configured",
]


class SavedFilterExecutionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    saved_filter_id: str | None = None
    query: str | None = None
    regions: list[str] = Field(default_factory=list)
    okpd2_codes: list[str] = Field(default_factory=list)
    customer_inns: list[str] = Field(default_factory=list)
    source_stages: list[str] = Field(default_factory=list)
    min_initial_price: Decimal | None = None
    max_initial_price: Decimal | None = None
    publish_date_from: date | None = None
    publish_date_to: date | None = None
    limit: int = Field(default=20, ge=1, le=100)

    @field_validator("query", mode="before")
    @classmethod
    def empty_query_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        if isinstance(value, str):
            return value.strip()
        return value


class NormalizedTenderHit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Literal["eis223"] = "eis223"
    law: Literal["223-FZ"] = "223-FZ"
    external_id: str
    registry_number: str
    title: str
    source_stage: str
    customer_name: str
    customer_inn: str | None = None
    procurement_method: str | None = None
    region: str | None = None
    okpd2_codes: list[str] = Field(default_factory=list)
    initial_price: Decimal | None = None
    currency: str = "RUB"
    publish_date: date | None = None
    submission_deadline: datetime | None = None
    detail_url: str | None = None


class ProviderErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: ProviderErrorCode
    message: str
    provider: Literal["eis223"] = "eis223"
