import pytest
from pydantic import ValidationError

from app.providers.eis223.factory import build_eis223_provider
from app.providers.eis223.fixture import FixtureEIS223Provider
from app.providers.eis223.live import LiveEIS223Provider
from app.providers.errors import ProviderNotConfiguredError
from app.settings import Settings


def test_settings_default_to_fixture_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EIS_PROVIDER_MODE", raising=False)
    monkeypatch.delenv("EIS_PROVIDER_BASE_URL", raising=False)
    monkeypatch.delenv("EIS_PROVIDER_API_KEY", raising=False)
    monkeypatch.delenv("EIS_PROVIDER_TIMEOUT_SECONDS", raising=False)

    settings = Settings.from_env()

    assert settings.eis_provider_mode == "fixture"
    assert settings.is_provider_configured is True
    assert settings.eis_provider_base_url is None
    assert settings.eis_provider_api_key is None


def test_settings_parse_live_provider_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EIS_PROVIDER_MODE", "LIVE")
    monkeypatch.setenv("EIS_PROVIDER_BASE_URL", " https://example.test/eis ")
    monkeypatch.setenv("EIS_PROVIDER_API_KEY", " secret-token ")
    monkeypatch.setenv("EIS_PROVIDER_TIMEOUT_SECONDS", "2.5")

    settings = Settings.from_env()

    assert settings.eis_provider_mode == "live"
    assert settings.eis_provider_base_url == "https://example.test/eis"
    assert settings.eis_provider_api_key == "secret-token"
    assert settings.eis_provider_timeout_seconds == 2.5
    assert settings.is_provider_configured is True


def test_settings_reject_unknown_provider_mode() -> None:
    with pytest.raises(ValidationError):
        Settings.model_validate({"eis_provider_mode": "mock"})


def test_provider_factory_builds_fixture_provider() -> None:
    provider = build_eis223_provider(Settings(eis_provider_mode="fixture"))

    assert isinstance(provider, FixtureEIS223Provider)


def test_live_provider_missing_required_env_returns_provider_not_configured() -> None:
    settings = Settings(eis_provider_mode="live")

    with pytest.raises(ProviderNotConfiguredError) as exc_info:
        build_eis223_provider(settings)

    assert exc_info.value.code == "provider_not_configured"
    assert "EIS_PROVIDER_BASE_URL" in exc_info.value.message
    assert "EIS_PROVIDER_API_KEY" in exc_info.value.message


def test_provider_factory_builds_live_provider_when_configured() -> None:
    settings = Settings(
        eis_provider_mode="live",
        eis_provider_base_url="https://example.test/eis",
        eis_provider_api_key="secret-token",
    )

    provider = build_eis223_provider(settings)

    assert isinstance(provider, LiveEIS223Provider)
