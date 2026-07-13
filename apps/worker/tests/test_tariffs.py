import math

from services.calculations import calculate_feasibility_score
from services.tariffs import (
    Tariffs,
    default_tariffs,
    tariffs_from_rows,
)


def test_default_tariffs_shape():
    t = default_tariffs(2026)
    assert t.source == "fallback"
    assert t.build_rates["bachelor"] == 13_500
    assert t.unit_sizes["2bed"] == 85
    assert t.market_rents["1bed"] == 6_500
    assert t.unit_sizes["luxury"] == 120
    assert t.market_rents["luxury"] == 18_000
    assert t.bulk_contributions["johannesburg"]["luxury"] == (65_000, 80_000)
    assert t.professional_fee_pct == 0.12
    # Top bracket has no upper bound.
    assert math.isinf(t.transfer_duty_brackets[-1][0])


def test_tariffs_from_rows_parses_db_jsonb():
    rows = {
        "build_rates": {"bachelor": 14000, "1bed": 15000, "2bed": 16000, "luxury": 19000},
        "unit_sizes": {"bachelor": 36, "1bed": 56, "2bed": 86, "luxury": 125},
        "market_rents": {"bachelor": 5000, "1bed": 7000, "2bed": 10000, "luxury": 19000},
        "bulk_contributions": {
            "johannesburg": {
                "bachelor": [46000, 66000],
                "1bed": [51000, 66000],
                "2bed": [56000, 66000],
                "luxury": [65000, 80000],
            },
            "tshwane": {
                "bachelor": [38000, 55000],
                "1bed": [42000, 55000],
                "2bed": [46000, 55000],
                "luxury": [55000, 70000],
            },
            "ekurhuleni": {
                "bachelor": [40000, 58000],
                "1bed": [44000, 58000],
                "2bed": [48000, 58000],
                "luxury": [58000, 73000],
            },
        },
        "transfer_duty_brackets": [
            [1100000, 0.0, 0],
            [1512500, 0.03, 0],
            [None, 0.13, 1128600],
        ],
        "fees": {"professional_fee_pct": 0.15},
    }
    t = tariffs_from_rows(2027, rows)
    assert t.source == "db"
    assert t.year == 2027
    assert t.build_rates["bachelor"] == 14000
    assert t.market_rents["2bed"] == 10000
    assert t.bulk_contributions["johannesburg"]["bachelor"] == (46000, 66000)
    assert math.isinf(t.transfer_duty_brackets[-1][0])
    assert t.professional_fee_pct == 0.15


def test_tariffs_from_rows_falls_back_per_category_on_bad_data():
    # Malformed build_rates + missing other categories -> fall back to constants.
    rows = {"build_rates": "not-a-dict"}
    t = tariffs_from_rows(2026, rows)
    assert t.build_rates["bachelor"] == 13_500  # fallback
    assert t.market_rents["1bed"] == 6_500  # fallback (category absent)


def test_db_tariffs_change_feasibility_output():
    # Same inputs, different build rate -> different build cost.
    base = default_tariffs(2026)
    pricier = Tariffs(
        year=2026,
        build_rates={**base.build_rates, "bachelor": 27_000},  # double
        unit_sizes=base.unit_sizes,
        market_rents=base.market_rents,
        bulk_contributions=base.bulk_contributions,
        transfer_duty_brackets=base.transfer_duty_brackets,
        professional_fee_pct=base.professional_fee_pct,
        source="db",
    )
    args = dict(
        land_price=980_000,
        size_sqm=1024,
        unit_type="bachelor",
        target_units=8,
        municipality="johannesburg",
        zone_rules={"coverage_pct": 60, "far": 1.5, "max_units_per_ha": 80},
    )
    r_default = calculate_feasibility_score(**args)
    r_pricey = calculate_feasibility_score(**args, tariffs=pricier)
    assert r_pricey["cost_build"] > r_default["cost_build"]


def test_default_tariffs_matches_legacy_numbers():
    # Regression guard: feasibility output with default tariffs must be stable.
    result = calculate_feasibility_score(
        land_price=980_000,
        size_sqm=1024,
        unit_type="bachelor",
        target_units=8,
        municipality="johannesburg",
        zone_rules={"coverage_pct": 60, "far": 1.5, "max_units_per_ha": 80},
    )
    # 8 units * 35 sqm * 13500 = 3,780,000 build cost
    assert result["cost_build"] == 3_780_000.0
    assert result["cost_professional_fees"] == 453_600.0  # 12%
