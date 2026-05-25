import os
from functools import lru_cache
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator


ProviderMode = Literal["fixture", "live"]


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    eis_provider_mode: ProviderMode = "fixture"
    eis_provider_base_url: str | None = None
    eis_provider_api_key: str | None = None
    eis_provider_timeout_seconds: float = Field(default=10.0, gt=0)

    @classmethod
    def from_env(cls) -> Self:
        values: dict[str, object] = {
            "eis_provider_mode": os.getenv("EIS_PROVIDER_MODE", "fixture"),
            "eis_provider_base_url": os.getenv("EIS_PROVIDER_BASE_URL"),
            "eis_provider_api_key": os.getenv("EIS_PROVIDER_API_KEY"),
        }
        timeout_seconds = os.getenv("EIS_PROVIDER_TIMEOUT_SECONDS")
        if timeout_seconds is not None:
            values["eis_provider_timeout_seconds"] = timeout_seconds
        return cls.model_validate(values)

    @field_validator("eis_provider_mode", mode="before")
    @classmethod
    def normalize_provider_mode(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("eis_provider_base_url", "eis_provider_api_key", mode="before")
    @classmethod
    def empty_string_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        if isinstance(value, str):
            return value.strip()
        return value

    @property
    def is_live_provider_configured(self) -> bool:
        return bool(self.eis_provider_base_url and self.eis_provider_api_key)

    @property
    def is_provider_configured(self) -> bool:
        if self.eis_provider_mode == "fixture":
            return True
        return self.is_live_provider_configured


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings.from_env()
