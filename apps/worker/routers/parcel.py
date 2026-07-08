from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from services.rate_limit import is_rate_limited
from services.spatial import derive_params, normalize_dolomite_risk, score_amenities

log = logging.getLogger("fgp.parcel")

router = APIRouter(prefix="/analyze", tags=["parcel"])


def rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    if is_rate_limited(f"parcel:{ip}"):
        raise HTTPException(status_code=429, detail="Rate limit exceeded: 10 requests/minute")


class ParcelRequest(BaseModel):
    # Gauteng bounding box-ish guards (lat negative in the southern hemisphere).
    lat: float = Field(..., ge=-27.0, le=-25.0)
    lng: float = Field(..., ge=27.0, le=29.5)


class AmenityOut(BaseModel):
    name: str
    type: str
    subtype: str | None = None
    dist_km: float | None = None


class ParcelAnalysisResponse(BaseModel):
    found: bool
    erf_number: str | None = None
    township: str | None = None
    municipality: str | None = None
    size_sqm: float | None = None
    boundary_geojson: str | None = None
    zone_code: str | None = None
    zone_label: str | None = None
    coverage_pct: float | None = None
    far: float | None = None
    max_storeys: int | None = None
    rezoning_difficulty: str | None = None
    forms_required: list[str] | None = None
    dolomite_risk: str = "UNKNOWN"
    cgs_reference: str | None = None
    max_footprint_sqm: float | None = None
    max_buildable_sqm: float | None = None
    net_buildable_sqm: float | None = None
    max_units: int | None = None
    score_schools: int | None = None
    score_transport: int | None = None
    score_amenities: int | None = None
    score_composite: int | None = None
    amenities: list[AmenityOut] = []


@router.post("/parcel", response_model=ParcelAnalysisResponse)
async def analyze_parcel(
    body: ParcelRequest,
    _: None = Depends(rate_limit),
) -> dict[str, Any]:
    try:
        from db import spatial_lookup

        data = spatial_lookup(body.lat, body.lng)
    except Exception as e:  # noqa: BLE001 — DB/PostGIS unavailable
        log.warning("spatial lookup failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Spatial database unavailable — parcel analysis requires PostGIS.",
        )

    parcel = data.get("parcel")
    zone = data.get("zone")
    dolomite = data.get("dolomite")
    amenities = data.get("amenities", [])

    if not parcel and not zone:
        return {"found": False, "amenities": []}

    size_sqm = float(parcel["size_sqm"]) if parcel and parcel.get("size_sqm") else 0.0
    derived = derive_params(size_sqm, zone) if size_sqm else {}
    scores = score_amenities(amenities)

    return {
        "found": True,
        "erf_number": parcel.get("erf_number") if parcel else None,
        "township": parcel.get("township") if parcel else None,
        "municipality": (parcel or zone or {}).get("municipality"),
        "size_sqm": size_sqm or None,
        "boundary_geojson": parcel.get("boundary_geojson") if parcel else None,
        "zone_code": zone.get("zone_code") if zone else None,
        "zone_label": zone.get("zone_label") if zone else None,
        "coverage_pct": float(zone["coverage_pct"]) if zone and zone.get("coverage_pct") is not None else None,
        "far": float(zone["far"]) if zone and zone.get("far") is not None else None,
        "max_storeys": zone.get("max_storeys") if zone else None,
        "rezoning_difficulty": zone.get("rezoning_difficulty") if zone else None,
        "forms_required": zone.get("forms_required") if zone else None,
        "dolomite_risk": normalize_dolomite_risk(dolomite.get("risk_class") if dolomite else None),
        "cgs_reference": dolomite.get("cgs_reference") if dolomite else None,
        "max_footprint_sqm": derived.get("max_footprint_sqm"),
        "max_buildable_sqm": derived.get("max_buildable_sqm"),
        "net_buildable_sqm": derived.get("net_buildable_sqm"),
        "max_units": derived.get("max_units"),
        "score_schools": scores["score_schools"],
        "score_transport": scores["score_transport"],
        "score_amenities": scores["score_amenities"],
        "score_composite": scores["score_composite"],
        "amenities": amenities,
    }
