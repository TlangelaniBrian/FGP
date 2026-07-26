import secrets

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config import settings
from routers.feasibility import router as feasibility_router
from routers.forms import router as forms_router
from routers.parcel import router as parcel_router
from routers.scraper import router as scraper_router

APP_VERSION = "0.1.0"

app = FastAPI(
    title="FGP Worker",
    version=APP_VERSION,
    description="First Generation Properties — geo processing worker",
)
app.include_router(feasibility_router)
app.include_router(parcel_router)
app.include_router(forms_router)
app.include_router(scraper_router)


@app.middleware("http")
async def require_worker_service_credential(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)

    supplied = request.headers.get("authorization", "")
    expected_token = settings.worker_service_token
    expected = f"Bearer {expected_token}"
    supplied_bytes = supplied.encode("utf-8", "surrogateescape")
    expected_bytes = expected.encode("utf-8", "surrogateescape")
    if (
        not expected_token
        or not supplied
        or not secrets.compare_digest(supplied_bytes, expected_bytes)
    ):
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized worker request"},
        )

    return await call_next(request)


class HealthResponse(BaseModel):
    status: str
    version: str
    tariff_year: int


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=APP_VERSION,
        tariff_year=settings.tariff_year,
    )
