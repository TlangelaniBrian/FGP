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
    zone_rules: dict[str, Any],
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

    unit_sqm = t.unit_sizes.get(unit_type, 35)
    build_rate = t.build_rates.get(unit_type, 13_500)

    coverage = float(zone_rules.get("coverage_pct") or 40) / 100
    far = float(zone_rules.get("far") or 0.5)
    max_units_erf = zone_rules.get("max_units_per_erf")
    max_units_ha = zone_rules.get("max_units_per_ha")

    max_footprint = size_sqm * coverage
    max_buildable = size_sqm * far
    max_units_calc = 9999
    if max_units_erf:
        max_units_calc = min(max_units_calc, int(max_units_erf))
    if max_units_ha:
        max_units_calc = min(max_units_calc, int((size_sqm / 10_000) * max_units_ha))

    actual_units = min(target_units, max_units_calc)
    rezoning_required = target_units > max_units_calc

    total_build_sqm = unit_sqm * actual_units
    cost_build = total_build_sqm * build_rate
    cost_prof_fees = cost_build * t.professional_fee_pct
    cost_transfer = calculate_transfer_duty(land_price, t.transfer_duty_brackets)
    cost_bulk = calculate_bulk_contributions(
        municipality, unit_type, actual_units, t.year, t.bulk_contributions
    )
    cost_total = land_price + cost_build + cost_prof_fees + cost_transfer + cost_bulk

    rent = t.market_rents.get(unit_type, 4_500)
    gross_monthly = rent * actual_units
    gross_annual = gross_monthly * 12

    yield_gross = (gross_annual / cost_total) * 100 if cost_total > 0 else 0
    yield_85 = (gross_annual * 0.85 / cost_total) * 100 if cost_total > 0 else 0
    viable = yield_85 >= 10.0

    score = min(100, max(0, int(yield_85 * 5)))

    return {
        "viable": viable,
        "score": score,
        "actual_units": actual_units,
        "max_units_allowed": max_units_calc,
        "rezoning_required": rezoning_required,
        "max_footprint_sqm": round(max_footprint, 1),
        "max_buildable_sqm": round(max_buildable, 1),
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
            "Viable at 85% occupancy"
            if viable
            else f"Yield {yield_85:.1f}% below 10% threshold at 85% occupancy"
        ),
        "dolomite_risk": "UNKNOWN",
        "score_schools": None,
        "score_transport": None,
        "score_amenities": None,
    }
