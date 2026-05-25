import json
from collections.abc import Mapping
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from app.providers.eis223.normalization import normalize_eis223_tender
from app.providers.errors import (
    InvalidProviderResponseError,
    UpstreamRateLimitedError,
    UpstreamUnavailableError,
)
from app.schemas import NormalizedTenderHit, SavedFilterExecutionRequest
from app.settings import ProviderMode


class LiveEIS223Provider:
    mode: ProviderMode = "live"

    def __init__(self, *, base_url: str, api_key: str, timeout_seconds: float) -> None:
        self._base_url = base_url.rstrip("/") + "/"
        self._api_key = api_key
        self._timeout_seconds = timeout_seconds

    def execute_saved_filter(
        self,
        request: SavedFilterExecutionRequest,
    ) -> list[NormalizedTenderHit]:
        url = urljoin(self._base_url, "tenders/search")
        body = json.dumps(request.model_dump(mode="json")).encode("utf-8")
        upstream_request = Request(
            url,
            data=body,
            headers={
                "Authorization": "Bearer " + self._api_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(upstream_request, timeout=self._timeout_seconds) as response:
                response_body = response.read()
        except HTTPError as exc:
            if exc.code == 429:
                raise UpstreamRateLimitedError("EIS 223-FZ provider rate limit was reached.") from exc
            raise UpstreamUnavailableError("EIS 223-FZ provider returned an upstream error.") from exc
        except URLError as exc:
            raise UpstreamUnavailableError("EIS 223-FZ provider is unavailable.") from exc
        except TimeoutError as exc:
            raise UpstreamUnavailableError("EIS 223-FZ provider request timed out.") from exc

        payload = _json_object(response_body)
        items = payload.get("items")
        if not isinstance(items, list):
            raise InvalidProviderResponseError("Provider response must contain an items array.")

        normalized: list[NormalizedTenderHit] = []
        for item in items:
            if not isinstance(item, Mapping):
                raise InvalidProviderResponseError("Provider response item must be an object.")
            normalized.append(normalize_eis223_tender(item))
        return normalized


def _json_object(response_body: bytes) -> Mapping[str, Any]:
    try:
        payload = json.loads(response_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InvalidProviderResponseError("Provider response is not valid JSON.") from exc

    if not isinstance(payload, Mapping):
        raise InvalidProviderResponseError("Provider response must be a JSON object.")
    return payload
