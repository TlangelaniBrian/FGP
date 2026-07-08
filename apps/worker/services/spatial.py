"""Pure spatial scoring + derivation helpers.

Kept free of any DB/IO so they can be unit-tested directly. The parcel router
fetches raw rows from PostGIS and feeds them through these functions.
"""
from __future__ import annotations

from typing import Any

# Amenity type buckets. `type` values come from the `amenities.type` column
# (see CLAUDE.md schema: 'school' | 'mall' | 'hospital' | 'taxi_rank' |
# 'highway_on_ramp' etc).
SCHOOL_TYPES = {"school"}
TRANSPORT_TYPES = {"taxi_rank", "gautrain", "train_station", "bus_station", "highway_on_ramp"}
RETAIL_HEALTH_TYPES = {"mall", "shopping_centre", "hospital", "clinic"}

# Distance (km) at/under which an amenity scores 100, and beyond which it scores 0.
NEAR_KM = 0.5
MAX_USEFUL_KM = 5.0


def proximity_score(dist_km: float) -> int:
    """Linear proximity score: 100 within NEAR_KM, 0 at/beyond MAX_USEFUL_KM."""
    if dist_km <= NEAR_KM:
        return 100
    if dist_km >= MAX_USEFUL_KM:
        return 0
    frac = (dist_km - NEAR_KM) / (MAX_USEFUL_KM - NEAR_KM)
    return int(round(100 * (1 - frac)))


def _best_score(amenities: list[dict[str, Any]], types: set[str]) -> int | None:
    dists = [
        a["dist_km"]
        for a in amenities
        if a.get("type") in types and a.get("dist_km") is not None
    ]
    if not dists:
        return None
    return proximity_score(min(dists))


def score_amenities(amenities: list[dict[str, Any]]) -> dict[str, int | None]:
    """Score nearest school / transport / retail-health amenity by proximity.

    Each amenity dict is expected to have `type` and `dist_km`. Returns component
    scores (None when no amenity of that bucket is within range) plus a composite
    that averages the present buckets.
    """
    schools = _best_score(amenities, SCHOOL_TYPES)
    transport = _best_score(amenities, TRANSPORT_TYPES)
    retail = _best_score(amenities, RETAIL_HEALTH_TYPES)

    present = [s for s in (schools, transport, retail) if s is not None]
    composite = int(round(sum(present) / len(present))) if present else None

    return {
        "score_schools": schools,
        "score_transport": transport,
        "score_amenities": retail,
        "score_composite": composite,
    }


def normalize_dolomite_risk(risk_class: str | None) -> str:
    """Normalise a dolomite risk class; UNKNOWN when no zone matched."""
    if not risk_class:
        return "UNKNOWN"
    return str(risk_class).upper()


def derive_params(size_sqm: float, zone: dict[str, Any] | None) -> dict[str, Any]:
    """Derive the building envelope + max units from erf size and zone rules.

    Mirrors the logic in calculate_feasibility_score so the parcel screen and
    the feasibility engine agree on capacity.
    """
    zone = zone or {}
    coverage = float(zone.get("coverage_pct") or 40) / 100
    far = float(zone.get("far") or 0.5)
    max_units_erf = zone.get("max_units_per_erf")
    max_units_ha = zone.get("max_units_per_ha")

    max_footprint = size_sqm * coverage
    max_buildable = size_sqm * far

    max_units = 9999
    if max_units_erf:
        max_units = min(max_units, int(max_units_erf))
    if max_units_ha:
        max_units = min(max_units, int((size_sqm / 10_000) * float(max_units_ha)))

    return {
        "max_footprint_sqm": round(max_footprint, 1),
        "max_buildable_sqm": round(max_buildable, 1),
        "net_buildable_sqm": round(max_buildable * 0.85, 1),  # 15% circulation
        "max_units": None if max_units == 9999 else max_units,
    }
