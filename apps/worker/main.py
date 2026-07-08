from fastapi import FastAPI
from pydantic import BaseModel

from config import settings
from routers.feasibility import router as feasibility_router
from routers.parcel import router as parcel_router

APP_VERSION = "0.1.0"

app = FastAPI(
    title="FGP Worker",
    version=APP_VERSION,
    description="First Generation Properties — geo processing worker",
)
app.include_router(feasibility_router)
app.include_router(parcel_router)


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
