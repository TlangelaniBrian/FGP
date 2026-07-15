from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.scrapers import SearchParams, scrape

router = APIRouter(prefix="/scrape", tags=["scrapers"])


class ScrapeRequest(BaseModel):
    source: str = Field(..., min_length=2)
    location: str = Field(..., min_length=2, max_length=120)
    radius_km: float = Field(default=20, gt=0, le=100)
    min_size_sqm: float = Field(default=300, gt=0)
    max_price: float = Field(default=5_000_000, gt=0)


@router.post("/execute")
async def execute_scrape(body: ScrapeRequest) -> dict[str, object]:
    try:
        rows = await scrape(SearchParams(**body.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - external source/network dependent
        raise HTTPException(status_code=502, detail=f"scraper source unavailable: {exc}") from exc
    return {"source": body.source, "location": body.location, "listings": rows}
