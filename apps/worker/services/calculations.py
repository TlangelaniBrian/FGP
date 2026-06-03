from __future__ import annotations
from typing import Any

BUILD_RATES_2026: dict[str, int] = {
    "bachelor": 13_500,
    "1bed": 14_200,
    "2bed": 15_000,
    "luxury": 18_500,
}

UNIT_SIZES: dict[str, int] = {
    "bachelor": 35,
    "1bed": 55,
    "2bed": 85,
}

MARKET_RENT_2026: dict[str, dict[str, int]] = {
    "bachelor": {"default": 4_500},
    "1bed":     {"default": 6_500},
    "2bed":     {"default": 9_500},
}

BULK_RATES_2026: dict[str, dict[str, tuple[int, int]]] = {
    "johannesburg":  {"bachelor": (45_000, 65_000), "1bed": (50_000, 65_000), "2bed": (55_000, 65_000)},
    "tshwane":       {"bachelor": (38_000, 55_000), "1bed": (42_000, 55_000), "2bed": (46_000, 55_000)},
    "ekurhuleni":    {"bachelor": (40_000, 58_000), "1bed": (44_000, 58_000), "2bed": (48_000, 58_000)},
}

# SARS 2026 transfer duty brackets: (upper_threshold, rate, cumulative_base)
# Base is the duty already accumulated at the bottom of this bracket.
TRANSFER_DUTY_BRACKETS_2026 = [
    (1_100_000,  0.00, 0),
    (1_512_500,  0.03, 0),
    (2_117_500,  0.06, 12_375),
    (2_722_500,  0.08, 49_125),
    (12_100_000, 0.11, 97_125),
    (float("inf"), 0.13, 1_128_600),
]


def calculate_transfer_duty(price: float, year: int = 2026) -> float:
    if price <= 1_100_000:
        return 0.0
    for i, (threshold, rate, base) in enumerate(TRANSFER_DUTY_BRACKETS_2026[1:], 1):
        prev_threshold = TRANSFER_DUTY_BRACKETS_2026[i - 1][0]
        if price <= threshold:
            return base + (price - prev_threshold) * rate
    return 0.0


def calculate_bulk_contributions(
    municipality: str, unit_type: str, units: int, year: int = 2026
) -> float:
    rates = BULK_RATES_2026.get(municipality, BULK_RATES_2026["johannesburg"])
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
) -> dict[str, Any]:
    if size_sqm > 1_000_000:
        raise ValueError("size_sqm exceeds maximum allowed value of 1,000,000")
    if land_price > 500_000_000:
        raise ValueError("price exceeds maximum allowed value of 500,000,000")

    unit_sqm = UNIT_SIZES.get(unit_type, 35)
    build_rate = BUILD_RATES_2026.get(unit_type, 13_500)

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
    cost_prof_fees = cost_build * 0.12
    cost_transfer = calculate_transfer_duty(land_price, tariff_year)
    cost_bulk = calculate_bulk_contributions(municipality, unit_type, actual_units, tariff_year)
    cost_total = land_price + cost_build + cost_prof_fees + cost_transfer + cost_bulk

    rent = MARKET_RENT_2026.get(unit_type, {}).get("default", 4_500)
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
            "Viable at 85% occupancy" if viable
            else f"Yield {yield_85:.1f}% below 10% threshold at 85% occupancy"
        ),
        "dolomite_risk": "UNKNOWN",
        "score_schools": None,
        "score_transport": None,
        "score_amenities": None,
    }
