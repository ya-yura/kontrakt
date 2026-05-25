import json
from collections.abc import Mapping
from datetime import date, timedelta
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

from app.providers.eis223.normalization import normalize_eis223_purchase, normalize_eis223_tender
from app.providers.eis223.protocol import EIS223SearchResult
from app.providers.errors import (
    InvalidProviderResponseError,
    PurchaseNotFoundError,
    UpstreamRateLimitedError,
    UpstreamUnavailableError,
)
from app.schemas import (
    EIS223NormalizeRequest,
    NormalizedTenderDTO,
    NormalizedTenderHit,
    SavedFilterExecutionRequest,
)
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
        return self.search(request).hits

    def search(
        self,
        request: SavedFilterExecutionRequest,
    ) -> EIS223SearchResult:
        url = urljoin(self._base_url, "tenders/search")
        body = json.dumps(_upstream_search_query(request)).encode("utf-8")
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

        return EIS223SearchResult(
            hits=normalized,
            next_cursor=_optional_string(payload.get("nextCursor")),
            source_freshness=_live_source_freshness(payload),
        )

    def normalize_purchase(
        self,
        external_purchase_id: str,
        request: EIS223NormalizeRequest,
    ) -> NormalizedTenderDTO:
        query = urlencode({"lotNumber": request.lot_number}) if request.lot_number else ""
        url = urljoin(self._base_url, f"tenders/{quote(external_purchase_id)}")
        if query:
            url = url + "?" + query
        upstream_request = Request(
            url,
            headers={
                "Authorization": "Bearer " + self._api_key,
                "Accept": "application/json",
            },
            method="GET",
        )

        try:
            with urlopen(upstream_request, timeout=self._timeout_seconds) as response:
                response_body = response.read()
        except HTTPError as exc:
            if exc.code == 404:
                raise PurchaseNotFoundError("EIS 223-FZ purchase was not found.") from exc
            if exc.code == 429:
                raise UpstreamRateLimitedError("EIS 223-FZ provider rate limit was reached.") from exc
            raise UpstreamUnavailableError("EIS 223-FZ provider returned an upstream error.") from exc
        except URLError as exc:
            raise UpstreamUnavailableError("EIS 223-FZ provider is unavailable.") from exc
        except TimeoutError as exc:
            raise UpstreamUnavailableError("EIS 223-FZ provider request timed out.") from exc

        payload = _json_object(response_body)
        item = _purchase_item(payload)
        return normalize_eis223_purchase(
            item,
            external_purchase_id=external_purchase_id,
            lot_number=request.lot_number,
            include_raw_payload=request.include_raw_payload,
        )


def _upstream_search_query(request: SavedFilterExecutionRequest) -> dict[str, Any]:
    query: dict[str, Any] = {
        "limit": request.limit,
    }
    _put_if_present(query, "filterId", request.filter_id)
    _put_if_present(query, "searchQuery", request.search_query)
    _put_if_present(query, "includeKeywords", request.include_keywords)
    _put_if_present(query, "excludeKeywords", request.exclude_keywords)
    _put_if_present(query, "okpd2Prefixes", request.okpd2_prefixes)
    _put_if_present(query, "regionCodes", request.region_codes)
    _put_if_present(query, "methodAllowList", request.method_allow_list)
    _put_if_present(query, "customerInnAllowList", request.customer_inn_allow_list)
    _put_if_present(query, "customerInnBlockList", request.customer_inn_block_list)
    _put_if_present(query, "minPrice", _decimal_string(request.min_price))
    _put_if_present(query, "maxPrice", _decimal_string(request.max_price))
    _put_if_present(query, "cursor", request.cursor)

    if request.days_ahead is not None:
        today = date.today()
        query["applicationDeadlineFrom"] = today.isoformat()
        query["applicationDeadlineTo"] = (today + timedelta(days=request.days_ahead)).isoformat()

    return query


def _put_if_present(query: dict[str, Any], key: str, value: object) -> None:
    if value is None:
        return
    if isinstance(value, list) and not value:
        return
    query[key] = value


def _decimal_string(value: object) -> str | None:
    if value is None:
        return None
    return str(value)


def _live_source_freshness(payload: Mapping[str, Any]) -> dict[str, str]:
    response_meta = payload.get("responseMeta")
    if isinstance(response_meta, Mapping):
        generated_at = _optional_string(response_meta.get("generatedAt"))
        source = _optional_string(response_meta.get("source"))
    else:
        generated_at = None
        source = None

    freshness = {
        "mode": "live",
        "source": source or "configured_upstream",
        "note": "Freshness is reported by the configured upstream when available; no real-time guarantee.",
    }
    if generated_at is not None:
        freshness["generatedAt"] = generated_at
    return freshness


def _json_object(response_body: bytes) -> Mapping[str, Any]:
    try:
        payload = json.loads(response_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InvalidProviderResponseError("Provider response is not valid JSON.") from exc

    if not isinstance(payload, Mapping):
        raise InvalidProviderResponseError("Provider response must be a JSON object.")
    return payload


def _purchase_item(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    item = payload.get("item") or payload.get("purchase") or payload
    if not isinstance(item, Mapping):
        raise InvalidProviderResponseError("Provider purchase response must be a JSON object.")
    if "purchase" in item:
        return item
    return {"purchase": item}


def _optional_string(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
