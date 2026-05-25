from app.providers.eis223.fixture import FixtureEIS223Provider
from app.providers.eis223.live import LiveEIS223Provider
from app.providers.eis223.protocol import EIS223Provider
from app.providers.errors import ProviderNotConfiguredError
from app.settings import Settings


def build_eis223_provider(settings: Settings) -> EIS223Provider:
    if settings.eis_provider_mode == "fixture":
        return FixtureEIS223Provider()

    if not settings.eis_provider_base_url or not settings.eis_provider_api_key:
        raise ProviderNotConfiguredError(
            "Live EIS 223-FZ provider requires EIS_PROVIDER_BASE_URL and EIS_PROVIDER_API_KEY.",
        )

    return LiveEIS223Provider(
        base_url=settings.eis_provider_base_url,
        api_key=settings.eis_provider_api_key,
        timeout_seconds=settings.eis_provider_timeout_seconds,
    )
