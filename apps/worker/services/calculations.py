from __future__ import annotations

from typing import Any

from services.tariffs import (
    BUILD_RATES_2026,
    BULK_RATES_2026,
    MARKET_RENT_2026,
    TRANSFER_DUTY_BRACKETS_2026,
    UNIT_SIZES,
    Tariffs,
    default_tariffs,
)

# Re-exported for backwards compatibility with existing imports/tests. The
# authoritative definitions now live in services/tariffs.py (DB-backed at
# runtime, these constants are the fallback).
__all__ = [
    "BUILD_RATES_2026",
    "UNIT_SIZES",
    "MARKET_RENT_2026",
    "BULK_RATES_2026",
    "TRANSFER_DUTY_BRACKETS_2026",
    "calculate_transfer_duty",
    "calculate_bulk_contributions",
    "calculate_feasibility_score",
]


def calculate_transfer_duty(
    price: float,
    brackets: list[tuple[float, float, float]] | None = None,
) -> float:
    """SARS stepped transfer duty. `brackets` is (upper, rate, cumulative_base)."""
    table = brackets if brackets is not None else TRANSFER_DUTY_BRACKETS_2026
    if price <= table[0][0]:
        return 0.0
    for i in range(1, len(table)):
        threshold, rate, base = table[i]
        prev_threshold = table[i - 1][0]
        if price <= threshold:
            return base + (price - prev_threshold) * rate
    return 0.0


def calculate_bulk_contributions(
    municipality: str,
    unit_type: str,
    units: int,
    year: int = 2026,
    bulk_rates: dict[str, dict[str, tuple[float, float]]] | None = None,
) -> float:
    rates_all = bulk_rates if bulk_rates is not None else BULK_RATES_2026
    rates = rates_all.get(municipality, rates_all["johannesburg"])
    lo, hi = rates.get(unit_type, rates["bachelor"])
    mid = (lo + hi) / 2
    return mid * units


def calculate_feasibility_score(
    land_price: float,
    size_sqm: float,
    unit_type: str,
    target_units: int,
    municipality: str,
    zone_rules: dict[str, Any] | None,
    tariff_year: int = 2026,
    tariffs: Tariffs | None = None,
) -> dict[str, Any]:
    if size_sqm > 1_000_000:
        raise ValueError("size_sqm exceeds maximum allowed value of 1,000,000")
    if land_price > 500_000_000:
        raise ValueError("price exceeds maximum allowed value of 500,000,000")

    # When no tariff bundle is supplied (e.g. unit tests) fall back to the
    # baseline constants — identical numbers to the pre-DB implementation.
    t = tariffs if tariffs is not None else default_tariffs(tariff_year)

    unit_sqm = t.unit_sizes[unit_type]
    build_rate = t.build_rates[unit_type]

    zoning_evidence_available = bool(zone_rules)
    rules = zone_rules or {}
    coverage_raw = rules.get("coverage_pct")
    far_raw = rules.get("far")
    storeys_raw = rules.get("max_storeys")
    max_units_erf = rules.get("max_units_per_erf")
    max_units_ha = rules.get("max_units_per_ha")

    max_footprint = size_sqm * float(coverage_raw) / 100 if coverage_raw is not None else None
    max_buildable = size_sqm * float(far_raw) if far_raw is not None else None

    density_limits: list[int] = []
    if max_units_erf is not None:
        density_limits.append(int(max_units_erf))
    if max_units_ha is not None:
        density_limits.append(int((size_sqm / 10_000) * float(max_units_ha)))
    density_units = min(density_limits) if density_limits else None
    far_units = int(max_buildable // unit_sqm) if max_buildable is not None else None
    footprint_storey_units = (
        int((max_footprint * int(storeys_raw)) // unit_sqm)
        if max_footprint is not None and storeys_raw is not None
        else None
    )
    available_limits = [
        limit for limit in (density_units, far_units, footprint_storey_units) if limit is not None
    ]
    max_units_calc = min(available_limits) if available_limits else None

    actual_units = min(target_units, max_units_calc) if max_units_calc is not None else target_units
    rezoning_required = max_units_calc is not None and target_units > max_units_calc

    total_build_sqm = unit_sqm * actual_units
    cost_build = total_build_sqm * build_rate
    cost_prof_fees = cost_build * t.professional_fee_pct
    cost_transfer = calculate_transfer_duty(land_price, t.transfer_duty_brackets)
    cost_bulk = calculate_bulk_contributions(
        municipality, unit_type, actual_units, t.year, t.bulk_contributions
    )
    cost_total = land_price + cost_build + cost_prof_fees + cost_transfer + cost_bulk

    rent = t.market_rents[unit_type]
    gross_monthly = rent * actual_units
    gross_annual = gross_monthly * 12

    yield_gross = (gross_annual / cost_total) * 100 if cost_total > 0 else 0
    yield_85 = (gross_annual * 0.85 / cost_total) * 100 if cost_total > 0 else 0
    calculated_viable = yield_85 >= 10.0
    viable = calculated_viable and zoning_evidence_available

    score = min(100, max(0, int(yield_85 * 5)))

    return {
        "viable": viable,
        "decision_status": "definitive" if zoning_evidence_available else "degraded",
        "zoning_evidence_available": zoning_evidence_available,
        "tariff_year": t.year,
        "build_rate_per_sqm": build_rate,
        "score": score,
        "actual_units": actual_units,
        "max_units_allowed": max_units_calc,
        "rezoning_required": rezoning_required,
        "capacity": {
            "density_units": density_units,
            "far_units": far_units,
            "footprint_storey_units": footprint_storey_units,
        },
        "max_footprint_sqm": round(max_footprint, 1) if max_footprint is not None else None,
        "max_buildable_sqm": round(max_buildable, 1) if max_buildable is not None else None,
        "cost_land": land_price,
        "cost_build": round(cost_build, 2),
        "cost_professional_fees": round(cost_prof_fees, 2),
        "cost_bulk_contributions": round(cost_bulk, 2),
        "cost_transfer_duty": round(cost_transfer, 2),
        "cost_total": round(cost_total, 2),
        "rent_per_unit_monthly": rent,
        "gross_monthly_income": round(gross_monthly, 2),
        "gross_annual_income": round(gross_annual, 2),
        "yield_gross_pct": round(yield_gross, 2),
        "yield_at_85_occ_pct": round(yield_85, 2),
        "viability_notes": (
            "Zoning rules are unavailable; capacity and a definitive go/no-go decision "
            "require verified zoning evidence"
            if not zoning_evidence_available
            else "Viable at 85% occupancy"
            if viable
            else f"Yield {yield_85:.1f}% below 10% threshold at 85% occupancy"
        ),
        "dolomite_risk": "UNKNOWN",
        "score_schools": None,
        "score_transport": None,
        "score_amenities": None,
    }
