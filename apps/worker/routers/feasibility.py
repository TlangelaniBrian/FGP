from __future__ import annotations  # enables X | Y syntax on Python 3.9
import time
from collections import defaultdict
from typing import Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from services.calculations import calculate_feasibility_score

router = APIRouter(prefix="/analyze", tags=["feasibility"])

# In-memory rate limiter: max 10 requests per 60 seconds per IP
_request_log: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 10
_RATE_WINDOW = 60.0


def rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    window_start = now - _RATE_WINDOW
    _request_log[ip] = [t for t in _request_log[ip] if t > window_start]
    if len(_request_log[ip]) >= _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded: 10 requests/minute")
    _request_log[ip].append(now)


class ZoneRulesInput(BaseModel):
    coverage_pct: float | None = None
    far: float | None = None
    max_storeys: int | None = None
    max_units_per_erf: int | None = None
    max_units_per_ha: int | None = None


class FeasibilityRequest(BaseModel):
    address: str = Field(..., min_length=1, max_length=500)
    municipality: Literal["johannesburg", "tshwane", "ekurhuleni"]
    zone_code: str = Field(..., min_length=1, max_length=20)
    size_sqm: float = Field(..., ge=100, le=1_000_000)
    price: float = Field(..., ge=10_000, le=500_000_000)
    unit_type: Literal["bachelor", "1bed", "2bed"]
    target_units: int = Field(..., ge=1, le=200)
    zone_rules: ZoneRulesInput | None = None
    tariff_year: int = Field(default=2026, ge=2024, le=2030)

    @field_validator("zone_code")
    @classmethod
    def zone_code_alphanumeric(cls, v: str) -> str:
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("zone_code must be alphanumeric")
        return v.upper()


class FeasibilityResponse(BaseModel):
    viable: bool
    score: int
    actual_units: int
    max_units_allowed: int
    rezoning_required: bool
    max_footprint_sqm: float
    max_buildable_sqm: float
    cost_land: float
    cost_build: float
    cost_professional_fees: float
    cost_bulk_contributions: float
    cost_transfer_duty: float
    cost_total: float
    rent_per_unit_monthly: float
    gross_monthly_income: float
    gross_annual_income: float
    yield_gross_pct: float
    yield_at_85_occ_pct: float
    viability_notes: str
    dolomite_risk: str
    score_schools: int | None
    score_transport: int | None
    score_amenities: int | None


@router.post("/feasibility", response_model=FeasibilityResponse)
async def analyze_feasibility(
    body: FeasibilityRequest,
    _: None = Depends(rate_limit),
) -> dict[str, Any]:
    rules: dict[str, Any] = {}
    if body.zone_rules:
        rules = body.zone_rules.model_dump(exclude_none=True)

    return calculate_feasibility_score(
        land_price=body.price,
        size_sqm=body.size_sqm,
        unit_type=body.unit_type,
        target_units=body.target_units,
        municipality=body.municipality,
        zone_rules=rules,
        tariff_year=body.tariff_year,
    )
