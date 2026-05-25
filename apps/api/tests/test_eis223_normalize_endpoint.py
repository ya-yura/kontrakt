from fastapi.testclient import TestClient

from app.main import app
from app.settings import get_settings


def _client() -> TestClient:
    get_settings.cache_clear()
    return TestClient(app)


def test_normalize_endpoint_fixture_success() -> None:
    client = _client()

    response = client.post("/v1/eis223/purchase/32413500001/normalize", json={})

    assert response.status_code == 200
    payload = response.json()
    assert payload["externalPurchaseId"] == "32413500001"
    assert payload["registryNumber"] == "32413500001"
    assert payload["purchaseNumber"] == "32413500001"
    assert payload["lotNumber"] == "1"
    assert payload["platformName"] == "РТС-тендер"
    assert payload["title"] == "Поставка медицинских расходных материалов для стоматологической клиники"
    assert payload["subjectDescription"] == (
        "Расходные материалы и инструменты для терапевтической стоматологии"
    )
    assert payload["methodName"] == "Запрос котировок в электронной форме"
    assert payload["statusName"] == "APPLICATION_SUBMISSION"
    assert payload["customer"] == {
        "name": 'АО "Городская стоматология"',
        "inn": "7701234567",
        "kpp": "770101001",
        "address": "101000, г. Москва, ул. Тестовая, д. 1",
    }
    assert payload["price"] == {
        "maxPrice": "1850000.00",
        "priceFormula": None,
        "currencyCode": "RUB",
    }
    assert payload["security"] == {
        "applicationSecurityAmount": "18500.00",
        "contractSecurityAmount": "92500.00",
    }
    assert payload["deadlines"]["applicationStartAt"] == "2026-05-20T10:00:00+03:00"
    assert payload["deadlines"]["applicationDeadlineAt"] == "2026-06-03T10:00:00+03:00"
    assert payload["delivery"]["deliveryPlace"] == "г. Москва, склад заказчика"
    assert payload["region"] == {"regionCode": "77", "regionName": "Москва"}
    assert payload["okpd2Codes"] == ["32.50.11.000", "21.20.24.160"]
    assert payload["requirements"] == [
        "Наличие регистрационных удостоверений на медицинские изделия",
        "Отсутствие в реестре недобросовестных поставщиков",
    ]
    assert payload["criteria"] == ["Цена договора", "Срок поставки"]
    assert payload["changesFeed"][0]["title"] == "Опубликовано изменение"
    assert payload["sourcePayload"]["purchase"]["purchaseNumber"] == "32413500001"
    assert len(payload["sourceHash"]) == 64
    assert all(len(document["sourceHash"]) == 64 for document in payload["documents"])


def test_normalize_endpoint_missing_optional_fields_become_null_or_empty_arrays() -> None:
    client = _client()

    response = client.post(
        "/v1/eis223/purchase/32413500002/normalize",
        json={"includeRawPayload": False},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["platformName"] is None
    assert payload["customer"]["address"] is None
    assert payload["price"]["priceFormula"] is None
    assert payload["security"]["applicationSecurityAmount"] is None
    assert payload["security"]["contractSecurityAmount"] is None
    assert payload["deadlines"]["applicationStartAt"] is None
    assert payload["deadlines"]["clarificationDeadlineAt"] is None
    assert payload["deadlines"]["resultAt"] is None
    assert payload["deadlines"]["updatedFromSourceAt"] is None
    assert payload["delivery"] == {"deliveryPlace": None, "deliveryPeriodText": None}
    assert payload["documents"] == []
    assert payload["requirements"] == []
    assert payload["criteria"] == []
    assert payload["changesFeed"] == []
    assert payload["sourcePayload"] is None


def test_normalize_endpoint_document_type_mapping() -> None:
    client = _client()

    response = client.post("/v1/eis223/purchase/32413500001/normalize", json={})

    assert response.status_code == 200
    assert [document["type"] for document in response.json()["documents"]] == [
        "NOTICE",
        "DOCUMENTATION",
        "CHANGE",
        "CLARIFICATION",
        "PROTOCOL",
        "RESULT",
        "CONTRACT_DRAFT",
        "OTHER",
    ]
    assert [document["externalDocumentId"] for document in response.json()["documents"]] == [
        "32413500001-notice",
        "32413500001-docs",
        "32413500001-change",
        "32413500001-clarification",
        "32413500001-protocol",
        "32413500001-result",
        "32413500001-contract-draft",
        "32413500001-other",
    ]


def test_normalize_endpoint_unknown_purchase_returns_typed_404() -> None:
    client = _client()

    response = client.post("/v1/eis223/purchase/unknown-purchase/normalize", json={})

    assert response.status_code == 404
    assert response.json() == {
        "error": "purchase_not_found",
        "message": "EIS 223-FZ purchase was not found.",
        "provider": "eis223",
    }
