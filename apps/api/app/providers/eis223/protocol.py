from typing import Protocol

from app.schemas import NormalizedTenderHit, SavedFilterExecutionRequest
from app.settings import ProviderMode


class EIS223Provider(Protocol):
    mode: ProviderMode

    def execute_saved_filter(
        self,
        request: SavedFilterExecutionRequest,
    ) -> list[NormalizedTenderHit]:
        """Return normalized 223-FZ tender hits without persisting state."""
