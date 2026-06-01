from typing import Literal

from app.schemas import ProviderErrorCode, ProviderErrorResponse

ProviderName = Literal["eis223", "ai"]


class ProviderError(Exception):
    code: ProviderErrorCode
    status_code: int = 502

    def __init__(self, message: str, *, provider: ProviderName = "eis223") -> None:
        super().__init__(message)
        self.message = message
        self.provider = provider

    def to_response(self) -> ProviderErrorResponse:
        return ProviderErrorResponse(
            error=self.code,
            message=self.message,
            provider=self.provider,
        )


class UpstreamUnavailableError(ProviderError):
    code = "upstream_unavailable"
    status_code = 503


class UpstreamRateLimitedError(ProviderError):
    code = "upstream_rate_limited"
    status_code = 429


class InvalidProviderResponseError(ProviderError):
    code = "invalid_provider_response"
    status_code = 502


class ProviderNotConfiguredError(ProviderError):
    code = "provider_not_configured"
    status_code = 503


class PurchaseNotFoundError(ProviderError):
    code = "purchase_not_found"
    status_code = 404
