import json
from collections.abc import Mapping
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from app.providers.eis223.normalization import normalize_eis223_purchase, normalize_eis223_tender
from app.providers.eis223.protocol import EIS223SearchResult
from app.providers.errors import InvalidProviderResponseError, PurchaseNotFoundError
from app.schemas import (
    EIS223NormalizeRequest,
    NormalizedTenderDTO,
    NormalizedTenderHit,
    SavedFilterExecutionRequest,
)
from app.settings import ProviderMode


class FixtureEIS223Provider:
    mode: ProviderMode = "fixture"

    def __init__(self, fixture_path: Path | None = None) -> None:
        self._fixture_path = fixture_path or Path(__file__).parent / "fixtures" / "tenders_223fz.json"

    def search(
        self,
        request: SavedFilterExecutionRequest,
    ) -> EIS223SearchResult:
        payload = self._load_payload()
        response_meta = _mapping(payload.get("responseMeta"))
        today = _fixture_today(response_meta)

        hits: list[NormalizedTenderHit] = []
        for item in _items_from_payload(payload):
            hit = normalize_eis223_tender(item)
            if _matches_request(hit, item, request, today):
                hits.append(hit)

        offset = _cursor_offset(request.cursor)
        window = hits[offset : offset + request.limit]
        next_offset = offset + request.limit
        next_cursor = str(next_offset) if next_offset < len(hits) else None

        return EIS223SearchResult(
            hits=window,
            next_cursor=next_cursor,
            source_freshness=_source_freshness(response_meta),
        )

    def execute_saved_filter(
        self,
        request: SavedFilterExecutionRequest,
    ) -> list[NormalizedTenderHit]:
        return self.search(request).hits

    def normalize_purchase(
        self,
        external_purchase_id: str,
        request: EIS223NormalizeRequest,
    ) -> NormalizedTenderDTO:
        for item in self._load_items():
            purchase = _mapping(item.get("purchase", item))
            if external_purchase_id in _purchase_ids(purchase):
                return normalize_eis223_purchase(
                    item,
                    external_purchase_id=external_purchase_id,
                    lot_number=request.lot_number,
                    include_raw_payload=request.include_raw_payload,
                )

        raise PurchaseNotFoundError("EIS 223-FZ purchase was not found.")

    def _load_payload(self) -> Mapping[str, Any]:
        try:
            payload = json.loads(self._fixture_path.read_text(encoding="utf-8"))
        except OSError as exc:
            raise InvalidProviderResponseError("Fixture provider dataset is unavailable.") from exc
        except json.JSONDecodeError as exc:
            raise InvalidProviderResponseError("Fixture provider dataset is invalid JSON.") from exc

        if not isinstance(payload, Mapping):
            raise InvalidProviderResponseError("Fixture provider dataset must be a JSON object.")

        return payload

    def _load_items(self) -> list[Mapping[str, Any]]:
        return _items_from_payload(self._load_payload())


def _items_from_payload(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    items = payload.get("items")
    if not isinstance(items, list):
        raise InvalidProviderResponseError("Fixture provider dataset must contain an items array.")

    typed_items: list[Mapping[str, Any]] = []
    for item in items:
        if not isinstance(item, Mapping):
            raise InvalidProviderResponseError("Fixture provider item must be an object.")
        typed_items.append(item)
    return typed_items


def _matches_request(
    hit: NormalizedTenderHit,
    raw_item: Mapping[str, Any],
    request: SavedFilterExecutionRequest,
    today: date,
) -> bool:
    haystack = _search_haystack(hit)
    if request.search_query and request.search_query.casefold() not in haystack:
        return False
    if request.include_keywords and not all(
        keyword.casefold() in haystack for keyword in request.include_keywords
    ):
        return False
    if request.exclude_keywords and any(
        keyword.casefold() in haystack for keyword in request.exclude_keywords
    ):
        return False
    if request.region_codes and not _matches_region(hit.region, request.region_codes):
        return False
    if request.method_allow_list and not _matches_method(raw_item, hit, request.method_allow_list):
        return False
    if request.customer_inn_allow_list and hit.customer_inn not in request.customer_inn_allow_list:
        return False
    if request.customer_inn_block_list and hit.customer_inn in request.customer_inn_block_list:
        return False
    if request.source_stages and hit.source_stage not in request.source_stages:
        return False
    if request.okpd2_prefixes and not _matches_okpd2_prefix(hit.okpd2_codes, request.okpd2_prefixes):
        return False
    if request.min_price is not None and not _price_at_least(
        hit.initial_price,
        request.min_price,
    ):
        return False
    if request.max_price is not None and not _price_at_most(
        hit.initial_price,
        request.max_price,
    ):
        return False
    if request.days_ahead is not None and not _deadline_within_days(
        hit.submission_deadline,
        today,
        request.days_ahead,
    ):
        return False
    if request.publish_date_from is not None and (
        hit.publish_date is None or hit.publish_date < request.publish_date_from
    ):
        return False
    if request.publish_date_to is not None and (
        hit.publish_date is None or hit.publish_date > request.publish_date_to
    ):
        return False
    return True


def _search_haystack(hit: NormalizedTenderHit) -> str:
    parts = [
        hit.title,
        hit.customer_name,
        hit.procurement_method or "",
        hit.region or "",
        " ".join(hit.okpd2_codes),
    ]
    return " ".join(parts).casefold()


def _matches_okpd2_prefix(codes: list[str], prefixes: list[str]) -> bool:
    return any(code.startswith(prefix) for code in codes for prefix in prefixes)


def _matches_region(region: str | None, requested_regions: list[str]) -> bool:
    if region is None:
        return False
    region_code = _FIXTURE_REGION_CODES_BY_NAME.get(region.casefold())
    candidates = {region.casefold()}
    if region_code is not None:
        candidates.add(region_code)
    return any(requested.casefold() in candidates for requested in requested_regions)


def _matches_method(
    raw_item: Mapping[str, Any],
    hit: NormalizedTenderHit,
    allowed_methods: list[str],
) -> bool:
    purchase = _mapping(raw_item.get("purchase", raw_item))
    placing_way = _mapping(purchase.get("placingWay"))
    method_code = _string(placing_way.get("code"))
    candidates = {allowed.casefold() for allowed in allowed_methods}
    if method_code is not None and method_code.casefold() in candidates:
        return True
    return hit.procurement_method is not None and hit.procurement_method.casefold() in candidates


def _deadline_within_days(
    deadline: datetime | None,
    today: date,
    days_ahead: int,
) -> bool:
    if deadline is None:
        return False
    deadline_date = deadline.date()
    return today <= deadline_date <= today + timedelta(days=days_ahead)


def _price_at_least(value: Decimal | None, minimum: Decimal) -> bool:
    return value is not None and value >= minimum


def _price_at_most(value: Decimal | None, maximum: Decimal) -> bool:
    return value is not None and value <= maximum


def _cursor_offset(cursor: str | None) -> int:
    if cursor is None:
        return 0
    try:
        offset = int(cursor)
    except ValueError as exc:
        raise InvalidProviderResponseError("Fixture provider cursor is invalid.") from exc
    return max(offset, 0)


def _source_freshness(response_meta: Mapping[str, Any]) -> dict[str, str]:
    return {
        "mode": "fixture",
        "source": _string(response_meta.get("source")) or "eis223_fixture",
        "generatedAt": _string(response_meta.get("generatedAt")) or "unknown",
        "note": "Local deterministic fixture dataset; not live EIS data.",
    }


def _fixture_today(response_meta: Mapping[str, Any]) -> date:
    generated_at = _string(response_meta.get("generatedAt"))
    if generated_at is not None:
        try:
            return datetime.fromisoformat(generated_at).date()
        except ValueError:
            pass
    return date.today()


def _mapping(value: object) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    return {}


def _purchase_ids(purchase: Mapping[str, Any]) -> set[str]:
    ids: set[str] = set()
    for key in ["externalPurchaseId", "externalId", "purchaseId", "guid", "purchaseNumber"]:
        value = _string(purchase.get(key))
        if value is not None:
            ids.add(value)
    return ids


def _string(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


_FIXTURE_REGION_CODES_BY_NAME = {
    "москва": "77",
    "пермский край": "59",
    "санкт-петербург": "78",
}
