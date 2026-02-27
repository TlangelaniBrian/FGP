from fastapi import FastAPI

from config import settings

app = FastAPI(
    title="FGP Worker",
    version="0.1.0",
    description="First Generation Properties — geo processing worker",
)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "version": "0.1.0",
        "tariff_year": settings.tariff_year,
    }
