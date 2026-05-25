from typing import Literal

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.providers.errors import ProviderError
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


@app.exception_handler(ProviderError)
async def provider_error_handler(_: object, exc: ProviderError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_response().model_dump(),
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
