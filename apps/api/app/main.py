from typing import Literal

from fastapi import FastAPI, Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.ai.router import router as ai_router
from app.documents.router import router as documents_router
from app.providers.eis223.factory import build_eis223_provider
from app.providers.errors import ProviderError
from app.schemas import (
    EIS223NormalizeRequest,
    EIS223SearchResponse,
    NormalizedTenderDTO,
    SavedFilterExecutionRequest,
)
from app.settings import ProviderMode, get_settings


class ProviderHealth(BaseModel):
    name: Literal["eis223"] = "eis223"
    mode: ProviderMode
    configured: bool


class HealthResponse(BaseModel):
    status: Literal["healthy"] = "healthy"
    service: Literal["api"] = "api"
    provider: ProviderHealth


app = FastAPI(
    title="Operational Workspace API",
    version="0.1.0",
    description="Stateless compute/adaptation service for the 223-FZ MVP.",
)
app.include_router(ai_router)
app.include_router(documents_router)


@app.exception_handler(ProviderError)
async def provider_error_handler(_: object, exc: ProviderError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_response().model_dump(mode="json", by_alias=True),
    )


@app.get("/healthz", response_model=HealthResponse, tags=["health"])
def healthz() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        provider=ProviderHealth(
            mode=settings.eis_provider_mode,
            configured=settings.is_provider_configured,
        ),
    )


@app.post("/v1/eis223/search", response_model=EIS223SearchResponse, tags=["eis223"])
def search_eis223(request: SavedFilterExecutionRequest) -> EIS223SearchResponse:
    settings = get_settings()
    provider = build_eis223_provider(settings)
    result = provider.search(request)
    return EIS223SearchResponse(
        hits=result.hits,
        next_cursor=result.next_cursor,
        provider_mode=provider.mode,
        source_freshness=result.source_freshness,
    )


@app.post(
    "/v1/eis223/purchase/{externalPurchaseId}/normalize",
    response_model=NormalizedTenderDTO,
    tags=["eis223"],
)
def normalize_eis223_purchase(
    external_purchase_id: str = Path(alias="externalPurchaseId"),
    request: EIS223NormalizeRequest | None = None,
) -> NormalizedTenderDTO:
    settings = get_settings()
    provider = build_eis223_provider(settings)
    return provider.normalize_purchase(
        external_purchase_id,
        request or EIS223NormalizeRequest(),
    )
