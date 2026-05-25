import hashlib
import json
from collections.abc import Mapping, Sequence
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from app.providers.errors import InvalidProviderResponseError, PurchaseNotFoundError
from app.schemas import (
    NormalizedChangeDTO,
    NormalizedCustomerDTO,
    NormalizedDeadlinesDTO,
    NormalizedDeliveryDTO,
    NormalizedDocumentDTO,
    NormalizedDocumentType,
    NormalizedPriceDTO,
    NormalizedRegionDTO,
    NormalizedSecurityDTO,
    NormalizedTenderDTO,
    NormalizedTenderHit,
)


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


def normalize_eis223_purchase(
    item: Mapping[str, Any],
    *,
    external_purchase_id: str | None = None,
    lot_number: str | None = None,
    include_raw_payload: bool = True,
) -> NormalizedTenderDTO:
    purchase = _mapping(item.get("purchase", item))
    customer = _first_mapping_value(
        purchase.get("customer"),
        purchase.get("customerInfo"),
        item.get("customer"),
    )
    placing_way = _first_mapping_value(
        purchase.get("placingWay"),
        purchase.get("placing_way"),
        purchase.get("purchaseMethod"),
        purchase.get("method"),
    )
    lot = _select_lot(purchase, lot_number)
    platform = _first_mapping_value(
        purchase.get("platform"),
        purchase.get("electronicPlace"),
        purchase.get("tradePlatform"),
        purchase.get("etp"),
    )

    registry_number = _first_string(purchase, ["registryNumber", "regNumber", "purchaseNumber"])
    purchase_number = _first_string(purchase, ["purchaseNumber", "number"]) or registry_number
    output_external_id = (
        _string(external_purchase_id)
        or _first_string(
            purchase,
            ["externalPurchaseId", "externalId", "purchaseId", "guid", "purchaseNumber"],
        )
        or registry_number
    )
    if output_external_id is None:
        raise InvalidProviderResponseError("Provider response is missing external purchase id.")

    title = (
        _first_string(purchase, ["purchaseName", "title", "name"])
        or _first_string(lot, ["subject", "title", "name"])
    )
    if title is None:
        raise InvalidProviderResponseError("Provider response is missing purchase title.")

    selected_lot_number = _string(lot_number) or _first_string(lot, ["lotNumber", "number"])
    region_name = _first_string(customer, ["regionName", "region", "subjectName"])
    region_code = (
        _first_string(customer, ["regionCode", "oktmoRegionCode", "subjectCode"])
        or _region_code_for_name(region_name)
    )

    source_payload = _jsonable(item) if include_raw_payload else None

    return NormalizedTenderDTO(
        external_purchase_id=output_external_id,
        registry_number=registry_number,
        purchase_number=purchase_number,
        lot_number=selected_lot_number,
        source_hash=_stable_hash(item),
        source_url=_first_string(purchase, ["href", "sourceUrl", "url", "detailUrl"]),
        platform_name=(
            _first_string(purchase, ["platformName", "electronicPlaceName", "tradePlatformName"])
            or _first_string(platform, ["name", "fullName", "title"])
        ),
        title=title,
        subject_description=(
            _first_string(lot, ["subject", "subjectDescription", "description"])
            or _first_string(purchase, ["subjectDescription", "subject", "description"])
        ),
        method_name=(
            _first_string(purchase, ["methodName", "purchaseMethodName"])
            or _first_string(placing_way, ["name", "title"])
            or _string(purchase.get("purchaseMethod"))
        ),
        status_name=_first_string(purchase, ["statusName", "stateName", "purchaseStage"]),
        customer=NormalizedCustomerDTO(
            name=_first_string(customer, ["fullName", "name", "shortName"]),
            inn=_first_string(customer, ["inn", "INN"]),
            kpp=_first_string(customer, ["kpp", "KPP"]),
            address=_first_string(customer, ["address", "legalAddress", "postalAddress"]),
        ),
        price=NormalizedPriceDTO(
            max_price=_decimal(_first_value(lot, ["initialMaxPrice", "maxPrice", "price"])),
            price_formula=_first_string(lot, ["priceFormula", "formula"]),
            currency_code=(
                _first_string(lot, ["currency", "currencyCode"])
                or _first_string(purchase, ["currency", "currencyCode"])
            ),
        ),
        security=NormalizedSecurityDTO(
            application_security_amount=_decimal(
                _first_value(
                    lot,
                    ["applicationSecurityAmount", "bidSecurityAmount", "requestSecurityAmount"],
                ),
            ),
            contract_security_amount=_decimal(
                _first_value(lot, ["contractSecurityAmount", "contractGuaranteeAmount"]),
            ),
        ),
        deadlines=NormalizedDeadlinesDTO(
            application_start_at=_datetime(
                _first_value(
                    purchase,
                    ["applicationStartAt", "applicationStartDateTime", "submissionOpenDateTime"],
                )
                or _first_value(lot, ["applicationStartAt", "submissionOpenDateTime"]),
            ),
            application_deadline_at=_datetime(
                _first_value(
                    purchase,
                    ["applicationDeadlineAt", "submissionCloseDateTime", "submissionDeadline"],
                )
                or _first_value(lot, ["applicationDeadlineAt", "submissionCloseDateTime"]),
            ),
            clarification_deadline_at=_datetime(
                _first_value(
                    purchase,
                    [
                        "clarificationDeadlineAt",
                        "clarificationEndDateTime",
                        "clarificationCloseDateTime",
                    ],
                )
                or _first_value(lot, ["clarificationDeadlineAt", "clarificationEndDateTime"]),
            ),
            result_at=_datetime(
                _first_value(
                    purchase,
                    ["resultAt", "resultsPublicationDateTime", "summarizingDateTime"],
                )
                or _first_value(lot, ["resultAt", "summarizingDateTime"]),
            ),
            published_at=_datetime(_first_value(purchase, ["publishedAt", "publicationDate"])),
            updated_from_source_at=_datetime(
                _first_value(
                    purchase,
                    ["updatedFromSourceAt", "lastUpdateDateTime", "updateDateTime", "modifiedAt"],
                ),
            ),
        ),
        delivery=NormalizedDeliveryDTO(
            delivery_place=(
                _first_string(lot, ["deliveryPlace", "placeOfDelivery"])
                or _first_string(purchase, ["deliveryPlace", "placeOfDelivery"])
            ),
            delivery_period_text=(
                _first_string(lot, ["deliveryPeriodText", "deliveryPeriod"])
                or _first_string(purchase, ["deliveryPeriodText", "deliveryPeriod"])
            ),
        ),
        region=NormalizedRegionDTO(region_code=region_code, region_name=region_name),
        okpd2_codes=_okpd2_codes(lot.get("okpd2") or purchase.get("okpd2")),
        documents=_documents(item, purchase, lot, purchase_number, selected_lot_number),
        requirements=_string_list_from_sources(
            lot,
            purchase,
            keys=["requirements", "participantRequirements", "participationRequirements"],
        ),
        criteria=_string_list_from_sources(
            lot,
            purchase,
            keys=["criteria", "evaluationCriteria", "evaluationCriterias"],
        ),
        changes_feed=_changes_feed(item, purchase),
        source_payload=source_payload,
    )


def normalize_eis223_document_type(value: object) -> NormalizedDocumentType:
    text = (_string(value) or "").casefold()
    normalized = text.replace("-", "_").replace(" ", "_")

    if normalized in {"notice", "извещение", "извещение_о_закупке"} or "извещ" in text:
        return "NOTICE"
    if normalized in {
        "contract_draft",
        "draft_contract",
        "project_contract",
        "проект_договора",
    } or "проект договор" in text:
        return "CONTRACT_DRAFT"
    if normalized in {"documentation", "procurement_documentation"} or "документац" in text:
        return "DOCUMENTATION"
    if normalized == "change" or "изменен" in text:
        return "CHANGE"
    if normalized == "clarification" or "разъяснен" in text:
        return "CLARIFICATION"
    if normalized == "protocol" or "протокол" in text:
        return "PROTOCOL"
    if normalized == "result" or "результ" in text or "итог" in text:
        return "RESULT"
    return "OTHER"


def _documents(
    item: Mapping[str, Any],
    purchase: Mapping[str, Any],
    lot: Mapping[str, Any],
    purchase_number: str | None,
    lot_number: str | None,
) -> list[NormalizedDocumentDTO]:
    documents: list[NormalizedDocumentDTO] = []
    for raw_document in _document_mappings(item, purchase, lot):
        source_hash = _stable_hash(raw_document)
        title = _first_string(
            raw_document,
            ["title", "name", "documentName", "fileName", "typeName"],
        )
        if title is None:
            title = "Purchase document"

        source_url = _first_string(raw_document, ["sourceUrl", "href", "url", "downloadUrl"])
        explicit_document_id = _first_string(
            raw_document,
            ["externalDocumentId", "externalId", "documentId", "id", "guid"],
        )
        external_document_id = explicit_document_id or _generated_document_id(
            purchase_number,
            lot_number,
            len(documents),
            source_hash,
        )
        type_value = (
            _first_value(raw_document, ["type", "documentType", "kind", "code", "typeName"])
            or title
        )

        documents.append(
            NormalizedDocumentDTO(
                external_document_id=external_document_id,
                type=normalize_eis223_document_type(type_value),
                title=title,
                file_name=_first_string(raw_document, ["fileName", "filename", "name"]),
                source_url=source_url,
                source_hash=source_hash,
                published_at=_datetime(
                    _first_value(raw_document, ["publishedAt", "publicationDate", "createdAt"]),
                ),
            ),
        )
    return documents


def _document_mappings(
    item: Mapping[str, Any],
    purchase: Mapping[str, Any],
    lot: Mapping[str, Any],
) -> list[Mapping[str, Any]]:
    documents: list[Mapping[str, Any]] = []
    for container in [
        purchase.get("documents"),
        purchase.get("documentation"),
        purchase.get("attachments"),
        lot.get("documents"),
        lot.get("documentation"),
        lot.get("attachments"),
        item.get("documents"),
    ]:
        documents.extend(_mappings_from_container(container))
    return documents


def _mappings_from_container(value: object) -> list[Mapping[str, Any]]:
    if isinstance(value, Mapping):
        nested: list[Mapping[str, Any]] = []
        for key in ["items", "documents", "files", "attachments"]:
            nested.extend(_mappings_from_container(value.get(key)))
        if nested:
            return nested
        return [value]
    if isinstance(value, Sequence) and not isinstance(value, str):
        return [item for item in value if isinstance(item, Mapping)]
    return []


def _changes_feed(item: Mapping[str, Any], purchase: Mapping[str, Any]) -> list[NormalizedChangeDTO]:
    changes: list[NormalizedChangeDTO] = []
    for raw_change in _mappings_from_container(
        purchase.get("changesFeed") or purchase.get("changes") or item.get("changesFeed"),
    ):
        title = _first_string(raw_change, ["title", "name", "eventType"])
        if title is None:
            title = "Source change"
        changes.append(
            NormalizedChangeDTO(
                at=_datetime(_first_value(raw_change, ["at", "date", "publishedAt"])),
                title=title,
                description=_first_string(raw_change, ["description", "comment", "text"]),
                source_hash=_stable_hash(raw_change),
            ),
        )
    return changes


def _string_list_from_sources(
    primary: Mapping[str, Any],
    secondary: Mapping[str, Any],
    *,
    keys: list[str],
) -> list[str]:
    for source in [primary, secondary]:
        for key in keys:
            values = _string_list(source.get(key))
            if values:
                return values
    return []


def _string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if isinstance(value, Sequence) and not isinstance(value, str):
        values: list[str] = []
        for item in value:
            item_text: str | None
            if isinstance(item, Mapping):
                item_text = (
                    _first_string(item, ["name", "title", "description", "text", "value"])
                    or _string(item)
                )
            else:
                item_text = _string(item)
            if item_text is not None:
                values.append(item_text)
        return values
    return []


def _select_lot(purchase: Mapping[str, Any], lot_number: str | None) -> Mapping[str, Any]:
    lots = _mappings_from_container(purchase.get("lots"))
    if lot_number is None:
        return lots[0] if lots else {}

    normalized_lot_number = _string(lot_number)
    for lot in lots:
        if _first_string(lot, ["lotNumber", "number"]) == normalized_lot_number:
            return lot

    raise PurchaseNotFoundError("EIS 223-FZ purchase lot was not found.")


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


def _first_mapping_value(*values: object) -> Mapping[str, Any]:
    for value in values:
        if isinstance(value, Mapping):
            return value
    return {}


def _required_str(source: Mapping[str, Any], key: str) -> str:
    value = _string(source.get(key))
    if value is None:
        raise InvalidProviderResponseError(f"Provider response is missing {key}.")
    return value


def _first_value(source: Mapping[str, Any], keys: Sequence[str]) -> object | None:
    for key in keys:
        value: object | None = source.get(key)
        if value is None:
            continue
        if isinstance(value, str):
            if value.strip():
                return value
            continue
        if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
            if len(value) > 0:
                return value
            continue
        if isinstance(value, Mapping):
            if value:
                return value
            continue
        if _string(value) is not None:
            return value
    return None


def _first_string(source: Mapping[str, Any], keys: Sequence[str]) -> str | None:
    for key in keys:
        value = _string(source.get(key))
        if value is not None:
            return value
    return None


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
    normalized = text.removesuffix("Z") + "+00:00" if text.endswith("Z") else text
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        try:
            return datetime.combine(date.fromisoformat(normalized), datetime.min.time())
        except ValueError as exc:
            raise InvalidProviderResponseError("Provider response has invalid datetime.") from exc


def _okpd2_codes(value: object) -> list[str]:
    if not isinstance(value, Sequence) or isinstance(value, str):
        return []

    codes: list[str] = []
    for item in value:
        if isinstance(item, Mapping):
            code = _string(item.get("code"))
            if code is not None:
                codes.append(code)
        else:
            code = _string(item)
            if code is not None:
                codes.append(code)
    return codes


def _region_code_for_name(region_name: str | None) -> str | None:
    if region_name is None:
        return None
    return _FIXTURE_REGION_CODES_BY_NAME.get(region_name.casefold())


def _generated_document_id(
    purchase_number: str | None,
    lot_number: str | None,
    index: int,
    source_hash: str,
) -> str:
    purchase_part = purchase_number or "unknown-purchase"
    lot_part = lot_number or "all-lots"
    return f"{purchase_part}:{lot_part}:{index}:{source_hash[:12]}"


def _stable_hash(value: object) -> str:
    canonical = json.dumps(
        _jsonable(value),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _jsonable(value: object) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _jsonable(raw_value) for key, raw_value in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_jsonable(item) for item in value]
    if isinstance(value, (datetime, date, Decimal)):
        return str(value)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


_FIXTURE_REGION_CODES_BY_NAME = {
    "москва": "77",
    "пермский край": "59",
    "санкт-петербург": "78",
}
