from dataclasses import dataclass
from typing import Any, Protocol

from app.schemas import (
    EIS223NormalizeRequest,
    NormalizedTenderDTO,
    NormalizedTenderHit,
    SavedFilterExecutionRequest,
)
from app.settings import ProviderMode


@dataclass(frozen=True)
class EIS223SearchResult:
    hits: list[NormalizedTenderHit]
    next_cursor: str | None
    source_freshness: str | dict[str, Any]


class EIS223Provider(Protocol):
    mode: ProviderMode

    def search(
        self,
        request: SavedFilterExecutionRequest,
    ) -> EIS223SearchResult:
        """Return normalized 223-FZ tender hits without persisting state."""

    def normalize_purchase(
        self,
        external_purchase_id: str,
        request: EIS223NormalizeRequest,
    ) -> NormalizedTenderDTO:
        """Return a detailed normalized tender DTO without persisting state."""

    def execute_saved_filter(
        self,
        request: SavedFilterExecutionRequest,
    ) -> list[NormalizedTenderHit]:
        """Backward-compatible list-only adapter for older internal callers."""
