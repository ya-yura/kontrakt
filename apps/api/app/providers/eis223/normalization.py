from collections.abc import Mapping, Sequence
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from app.providers.errors import InvalidProviderResponseError
from app.schemas import NormalizedTenderHit


def normalize_eis223_tender(item: Mapping[str, Any]) -> NormalizedTenderHit:
    purchase = _mapping(item.get("purchase", item))
    customer = _mapping(purchase.get("customer"))
    placing_way = _mapping(purchase.get("placingWay"))
    lot = _first_mapping(purchase.get("lots"))

    registry_number = _required_str(purchase, "purchaseNumber")
    title = _string(purchase.get("purchaseName")) or _string(lot.get("subject"))
    if title is None:
        raise InvalidProviderResponseError("Provider response is missing purchase title.")

    customer_name = _required_str(customer, "fullName")

    return NormalizedTenderHit(
        external_id=registry_number,
        registry_number=registry_number,
        title=title,
        source_stage=_required_str(purchase, "purchaseStage"),
        customer_name=customer_name,
        customer_inn=_string(customer.get("inn")),
        procurement_method=_string(placing_way.get("name")),
        region=_string(customer.get("regionName")),
        okpd2_codes=_okpd2_codes(lot.get("okpd2")),
        initial_price=_decimal(lot.get("initialMaxPrice")),
        currency=_string(lot.get("currency")) or "RUB",
        publish_date=_date(purchase.get("publicationDate")),
        submission_deadline=_datetime(purchase.get("submissionCloseDateTime")),
        detail_url=_string(purchase.get("href")),
    )


def _mapping(value: object) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    return {}


def _first_mapping(value: object) -> Mapping[str, Any]:
    if isinstance(value, Sequence) and not isinstance(value, str):
        for item in value:
            if isinstance(item, Mapping):
                return item
    return {}


def _required_str(source: Mapping[str, Any], key: str) -> str:
    value = _string(source.get(key))
    if value is None:
        raise InvalidProviderResponseError(f"Provider response is missing {key}.")
    return value


def _string(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _decimal(value: object) -> Decimal | None:
    text = _string(value)
    if text is None:
        return None
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise InvalidProviderResponseError("Provider response has invalid price.") from exc


def _date(value: object) -> date | None:
    text = _string(value)
    if text is None:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise InvalidProviderResponseError("Provider response has invalid publication date.") from exc


def _datetime(value: object) -> datetime | None:
    text = _string(value)
    if text is None:
        return None
    try:
        return datetime.fromisoformat(text)
    except ValueError as exc:
        raise InvalidProviderResponseError("Provider response has invalid deadline.") from exc


def _okpd2_codes(value: object) -> list[str]:
    if not isinstance(value, Sequence) or isinstance(value, str):
        return []

    codes: list[str] = []
    for item in value:
        if isinstance(item, Mapping):
            code = _string(item.get("code"))
            if code is not None:
                codes.append(code)
    return codes
