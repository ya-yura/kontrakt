from decimal import Decimal

from app.providers.eis223.fixture import FixtureEIS223Provider
from app.schemas import SavedFilterExecutionRequest


def test_fixture_provider_returns_predictable_tender_hits() -> None:
    provider = FixtureEIS223Provider()

    hits = provider.execute_saved_filter(SavedFilterExecutionRequest())

    assert [hit.registry_number for hit in hits] == [
        "32413500001",
        "32413500002",
        "32413500003",
    ]
    assert hits[0].provider == "eis223"
    assert hits[0].law == "223-FZ"
    assert hits[0].source_stage == "APPLICATION_SUBMISSION"
    assert hits[0].initial_price == Decimal("1850000.00")


def test_fixture_provider_applies_saved_filter_fields() -> None:
    provider = FixtureEIS223Provider()
    request = SavedFilterExecutionRequest(
        query="оборудования",
        regions=["Пермский край"],
        okpd2_codes=["33.13.12.000"],
        source_stages=["COMMISSION_REVIEW"],
        min_initial_price=Decimal("4000000"),
        max_initial_price=Decimal("5000000"),
    )

    hits = provider.execute_saved_filter(request)

    assert [hit.registry_number for hit in hits] == ["32413500002"]


def test_fixture_provider_respects_limit() -> None:
    provider = FixtureEIS223Provider()

    hits = provider.execute_saved_filter(SavedFilterExecutionRequest(limit=2))

    assert [hit.registry_number for hit in hits] == ["32413500001", "32413500002"]
