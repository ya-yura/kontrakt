from dataclasses import dataclass
from typing import Any, Protocol

from app.schemas import NormalizedTenderHit, SavedFilterExecutionRequest
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

    def execute_saved_filter(
        self,
        request: SavedFilterExecutionRequest,
    ) -> list[NormalizedTenderHit]:
        """Backward-compatible list-only adapter for older internal callers."""
