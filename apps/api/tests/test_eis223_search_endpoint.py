from urllib.error import HTTPError

from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.settings import get_settings


def _client() -> TestClient:
    get_settings.cache_clear()
    return TestClient(app)


def test_search_endpoint_fixture_happy_path() -> None:
    client = _client()

    response = client.post("/v1/eis223/search", json={})

    assert response.status_code == 200
    payload = response.json()
    assert payload["providerMode"] == "fixture"
    assert payload["nextCursor"] is None
    assert payload["sourceFreshness"]["mode"] == "fixture"
    assert "not live EIS data" in payload["sourceFreshness"]["note"]
    assert [hit["registryNumber"] for hit in payload["hits"]] == [
        "32413500001",
        "32413500002",
        "32413500003",
    ]
    assert payload["hits"][0]["externalId"] == "32413500001"
    assert payload["hits"][0]["applicationDeadlineAt"] == "2026-06-03T10:00:00+03:00"
    assert "registry_number" not in payload["hits"][0]


def test_search_endpoint_fixture_empty_result() -> None:
    client = _client()

    response = client.post("/v1/eis223/search", json={"searchQuery": "нет такого предмета"})

    assert response.status_code == 200
    assert response.json()["hits"] == []


def test_search_endpoint_fixture_include_and_exclude_keywords() -> None:
    client = _client()

    include_response = client.post(
        "/v1/eis223/search",
        json={"includeKeywords": ["оборудования"]},
    )
    exclude_response = client.post(
        "/v1/eis223/search",
        json={"includeKeywords": ["оборудования"], "excludeKeywords": ["техническому"]},
    )

    assert include_response.status_code == 200
    assert [hit["registryNumber"] for hit in include_response.json()["hits"]] == ["32413500002"]
    assert exclude_response.status_code == 200
    assert exclude_response.json()["hits"] == []


def test_search_endpoint_fixture_price_range() -> None:
    client = _client()

    response = client.post(
        "/v1/eis223/search",
        json={"minPrice": "2000000", "maxPrice": "3000000"},
    )

    assert response.status_code == 200
    assert [hit["registryNumber"] for hit in response.json()["hits"]] == ["32413500003"]


def test_search_endpoint_fixture_days_ahead() -> None:
    client = _client()

    response = client.post("/v1/eis223/search", json={"daysAhead": 6})

    assert response.status_code == 200
    assert [hit["registryNumber"] for hit in response.json()["hits"]] == ["32413500002"]


def test_search_endpoint_live_missing_config_returns_typed_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EIS_PROVIDER_MODE", "live")
    monkeypatch.delenv("EIS_PROVIDER_BASE_URL", raising=False)
    monkeypatch.delenv("EIS_PROVIDER_API_KEY", raising=False)
    client = _client()

    response = client.post("/v1/eis223/search", json={})

    assert response.status_code == 503
    assert response.json() == {
        "error": "provider_not_configured",
        "message": "Live EIS 223-FZ provider requires EIS_PROVIDER_BASE_URL and EIS_PROVIDER_API_KEY.",
        "provider": "eis223",
    }
    get_settings.cache_clear()


def test_search_endpoint_live_rate_limit_returns_typed_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_urlopen(*_args: object, **_kwargs: object) -> object:
        raise HTTPError(
            url="https://example.test/eis/tenders/search",
            code=429,
            msg="Too Many Requests",
            hdrs=None,
            fp=None,
        )

    monkeypatch.setenv("EIS_PROVIDER_MODE", "live")
    monkeypatch.setenv("EIS_PROVIDER_BASE_URL", "https://example.test/eis")
    monkeypatch.setenv("EIS_PROVIDER_API_KEY", "test-token")
    monkeypatch.setattr("app.providers.eis223.live.urlopen", fake_urlopen)
    client = _client()

    response = client.post("/v1/eis223/search", json={"limit": 1})

    assert response.status_code == 429
    assert response.json() == {
        "error": "upstream_rate_limited",
        "message": "EIS 223-FZ provider rate limit was reached.",
        "provider": "eis223",
    }
    get_settings.cache_clear()
