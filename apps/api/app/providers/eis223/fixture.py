import json
from collections.abc import Mapping
from decimal import Decimal
from pathlib import Path
from typing import Any

from app.providers.eis223.normalization import normalize_eis223_tender
from app.providers.errors import InvalidProviderResponseError
from app.schemas import NormalizedTenderHit, SavedFilterExecutionRequest
from app.settings import ProviderMode


class FixtureEIS223Provider:
    mode: ProviderMode = "fixture"

    def __init__(self, fixture_path: Path | None = None) -> None:
        self._fixture_path = fixture_path or Path(__file__).parent / "fixtures" / "tenders_223fz.json"

    def execute_saved_filter(
        self,
        request: SavedFilterExecutionRequest,
    ) -> list[NormalizedTenderHit]:
        hits = [normalize_eis223_tender(item) for item in self._load_items()]
        filtered_hits = [hit for hit in hits if _matches_request(hit, request)]
        return filtered_hits[: request.limit]

    def _load_items(self) -> list[Mapping[str, Any]]:
        try:
            payload = json.loads(self._fixture_path.read_text(encoding="utf-8"))
        except OSError as exc:
            raise InvalidProviderResponseError("Fixture provider dataset is unavailable.") from exc
        except json.JSONDecodeError as exc:
            raise InvalidProviderResponseError("Fixture provider dataset is invalid JSON.") from exc

        if not isinstance(payload, Mapping):
            raise InvalidProviderResponseError("Fixture provider dataset must be a JSON object.")

        items = payload.get("items")
        if not isinstance(items, list):
            raise InvalidProviderResponseError("Fixture provider dataset must contain an items array.")

        typed_items: list[Mapping[str, Any]] = []
        for item in items:
            if not isinstance(item, Mapping):
                raise InvalidProviderResponseError("Fixture provider item must be an object.")
            typed_items.append(item)
        return typed_items


def _matches_request(hit: NormalizedTenderHit, request: SavedFilterExecutionRequest) -> bool:
    if request.query and request.query.casefold() not in hit.title.casefold():
        return False
    if request.regions and hit.region not in request.regions:
        return False
    if request.customer_inns and hit.customer_inn not in request.customer_inns:
        return False
    if request.source_stages and hit.source_stage not in request.source_stages:
        return False
    if request.okpd2_codes and not set(request.okpd2_codes).intersection(hit.okpd2_codes):
        return False
    if request.min_initial_price is not None and not _price_at_least(
        hit.initial_price,
        request.min_initial_price,
    ):
        return False
    if request.max_initial_price is not None and not _price_at_most(
        hit.initial_price,
        request.max_initial_price,
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


def _price_at_least(value: Decimal | None, minimum: Decimal) -> bool:
    return value is not None and value >= minimum


def _price_at_most(value: Decimal | None, maximum: Decimal) -> bool:
    return value is not None and value <= maximum
