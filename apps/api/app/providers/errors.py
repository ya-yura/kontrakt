from app.schemas import ProviderErrorCode, ProviderErrorResponse


class ProviderError(Exception):
    code: ProviderErrorCode
    status_code: int = 502

    def __init__(self, message: str, *, provider: str = "eis223") -> None:
        super().__init__(message)
        self.message = message
        self.provider = provider

    def to_response(self) -> ProviderErrorResponse:
        return ProviderErrorResponse(
            error=self.code,
            message=self.message,
            provider="eis223",
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
