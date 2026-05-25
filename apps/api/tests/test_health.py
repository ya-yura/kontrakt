from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.settings import get_settings


def test_healthz_returns_healthy_json() -> None:
    get_settings.cache_clear()
    client = TestClient(app)

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "api",
        "provider": {
            "name": "eis223",
            "mode": "fixture",
            "configured": True,
        },
    }


def test_healthz_does_not_expose_provider_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EIS_PROVIDER_MODE", "live")
    monkeypatch.setenv("EIS_PROVIDER_BASE_URL", "https://example.test/eis")
    monkeypatch.setenv("EIS_PROVIDER_API_KEY", "super-secret-token")
    get_settings.cache_clear()
    client = TestClient(app)

    response = client.get("/healthz")

    assert response.status_code == 200
    response_text = response.text
    assert "super-secret-token" not in response_text
    assert "EIS_PROVIDER_API_KEY" not in response_text
    assert response.json()["provider"] == {
        "name": "eis223",
        "mode": "live",
        "configured": True,
    }
    get_settings.cache_clear()
