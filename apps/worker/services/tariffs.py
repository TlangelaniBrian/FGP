"""Tariff bundle + loader.

Tariffs (build rates, unit sizes, market rents, bulk contributions, SARS
transfer-duty brackets, professional fee) change on a fixed annual cadence —
SARS transfer duty each March budget, municipal BSC each July gazette. To avoid
a code deploy for every rate change they live in the `tariffs` DB table
(JSONB-per-category, keyed by tariff_year). This module loads them from the DB
with a short in-process cache and falls back to the constants below when the DB
is unavailable, so feasibility results never break on a transient DB outage.

The constants here MUST mirror scripts/seed/seed_tariffs.ts for TARIFF_YEAR=2026
so behaviour is identical before and after migrating to the DB.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

log = logging.getLogger("fgp.tariffs")

FALLBACK_TARIFF_YEAR = 2026
UNIT_TYPES = {"bachelor", "1bed", "2bed", "luxury"}
MUNICIPALITIES = {"johannesburg", "tshwane", "ekurhuleni"}
REQUIRED_CATEGORIES = {
    "build_rates",
    "unit_sizes",
    "market_rents",
    "bulk_contributions",
    "transfer_duty_brackets",
    "fees",
}


class TariffValidationError(ValueError):
    pass


# --- Fallback constants (mirror the 2026 DB seed) --------------------------------
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
    "luxury": 120,
}

# Flat {unit_type: monthly_rent}. The legacy calculations module nested these
# under a "default" key; the DB stores them flat, so this is the canonical shape.
MARKET_RENT_2026: dict[str, int] = {
    "bachelor": 4_500,
    "1bed": 6_500,
    "2bed": 9_500,
    "luxury": 18_000,
}

BULK_RATES_2026: dict[str, dict[str, tuple[float, float]]] = {
    "johannesburg": {
        "bachelor": (45_000, 65_000),
        "1bed": (50_000, 65_000),
        "2bed": (55_000, 65_000),
        "luxury": (65_000, 80_000),
    },
    "tshwane": {
        "bachelor": (38_000, 55_000),
        "1bed": (42_000, 55_000),
        "2bed": (46_000, 55_000),
        "luxury": (55_000, 70_000),
    },
    "ekurhuleni": {
        "bachelor": (40_000, 58_000),
        "1bed": (44_000, 58_000),
        "2bed": (48_000, 58_000),
        "luxury": (58_000, 73_000),
    },
}

# (upper_threshold, rate, cumulative_base); inf upper = top (no-bound) bracket.
TRANSFER_DUTY_BRACKETS_2026: list[tuple[float, float, float]] = [
    (1_100_000, 0.00, 0),
    (1_512_500, 0.03, 0),
    (2_117_500, 0.06, 12_375),
    (2_722_500, 0.08, 49_125),
    (12_100_000, 0.11, 97_125),
    (float("inf"), 0.13, 1_128_600),
]

PROFESSIONAL_FEE_PCT = 0.12


@dataclass(frozen=True)
class Tariffs:
    year: int
    build_rates: dict[str, int]
    unit_sizes: dict[str, int]
    market_rents: dict[str, int]
    bulk_contributions: dict[str, dict[str, tuple[float, float]]]
    transfer_duty_brackets: list[tuple[float, float, float]]
    professional_fee_pct: float
    source: str = "fallback"  # "db" | "fallback"


def default_tariffs(year: int = 2026) -> Tariffs:
    """The hardcoded 2026 baseline, used when the DB is unavailable."""
    if year != FALLBACK_TARIFF_YEAR:
        raise TariffValidationError("hard-coded tariff fallback is available only for 2026")
    return Tariffs(
        year=year,
        build_rates=dict(BUILD_RATES_2026),
        unit_sizes=dict(UNIT_SIZES),
        market_rents=dict(MARKET_RENT_2026),
        bulk_contributions={m: dict(v) for m, v in BULK_RATES_2026.items()},
        transfer_duty_brackets=list(TRANSFER_DUTY_BRACKETS_2026),
        professional_fee_pct=PROFESSIONAL_FEE_PCT,
        source="fallback",
    )


# --- Parsing (pure; unit-tested without a DB) ------------------------------------
def _parse_brackets(raw: Any) -> list[tuple[float, float, float]]:
    """[[upper|null, rate, base], ...] -> [(upper_or_inf, rate, base), ...]."""
    out: list[tuple[float, float, float]] = []
    for item in raw:
        upper, rate, base = item[0], item[1], item[2]
        upper_f = float("inf") if upper is None else float(upper)
        out.append((upper_f, float(rate), float(base)))
    if not out:
        raise ValueError("empty transfer_duty_brackets")
    previous_upper = float("-inf")
    previous_base = float("-inf")
    for index, (upper, rate, base) in enumerate(out):
        if rate < 0 or rate > 1 or base < previous_base:
            raise ValueError("invalid transfer_duty_brackets ordering")
        if upper == float("inf") and index != len(out) - 1:
            raise ValueError("only final transfer duty bracket may be unbounded")
        if upper != float("inf") and upper <= previous_upper:
            raise ValueError("transfer duty upper bounds must be strictly increasing")
        previous_upper = upper
        previous_base = base
    if out[-1][0] != float("inf"):
        raise ValueError("final transfer duty bracket must be unbounded")
    return out


def _parse_bulk(raw: Any) -> dict[str, dict[str, tuple[float, float]]]:
    parsed = {
        muni: {ut: (float(pair[0]), float(pair[1])) for ut, pair in zones.items()}
        for muni, zones in raw.items()
    }
    if set(parsed) != MUNICIPALITIES:
        raise ValueError("bulk contributions require all supported municipalities")
    for rates in parsed.values():
        if set(rates) != UNIT_TYPES:
            raise ValueError("bulk contributions require all supported unit types")
        if any(low <= 0 or high <= 0 or low > high for low, high in rates.values()):
            raise ValueError("bulk contribution ranges must be positive and ordered")
    return parsed


def _parse_unit_values(raw: Any) -> dict[str, int]:
    parsed = {key: int(value) for key, value in raw.items()}
    if set(parsed) != UNIT_TYPES or any(value <= 0 for value in parsed.values()):
        raise ValueError("tariff category requires positive values for all supported unit types")
    return parsed


def tariffs_from_rows(year: int, rows: dict[str, Any]) -> Tariffs:
    """Build a Tariffs bundle from a {category: data} mapping (e.g. DB rows).

    The 2026 bundle may fall back category-by-category to its matching hard-coded
    baseline. Every other year must provide a complete, valid database bundle.
    """
    if year != FALLBACK_TARIFF_YEAR:
        missing = REQUIRED_CATEGORIES - rows.keys()
        if missing:
            raise TariffValidationError(
                f"tariff bundle for {year} is incomplete: missing {', '.join(sorted(missing))}"
            )
        try:
            fee = float(rows["fees"]["professional_fee_pct"])
            if fee <= 0 or fee > 0.3:
                raise ValueError("professional fee percentage is out of range")
            return Tariffs(
                year=year,
                build_rates=_parse_unit_values(rows["build_rates"]),
                unit_sizes=_parse_unit_values(rows["unit_sizes"]),
                market_rents=_parse_unit_values(rows["market_rents"]),
                bulk_contributions=_parse_bulk(rows["bulk_contributions"]),
                transfer_duty_brackets=_parse_brackets(rows["transfer_duty_brackets"]),
                professional_fee_pct=fee,
                source="db",
            )
        except (ValueError, TypeError, AttributeError, KeyError, IndexError) as error:
            raise TariffValidationError(f"tariff bundle for {year} is invalid: {error}") from error

    base = default_tariffs(year)
    build_rates = base.build_rates
    unit_sizes = base.unit_sizes
    market_rents = base.market_rents
    bulk = base.bulk_contributions
    brackets = base.transfer_duty_brackets
    fee = base.professional_fee_pct

    if "build_rates" in rows:
        try:
            build_rates = _parse_unit_values(rows["build_rates"])
        except (ValueError, TypeError, AttributeError) as e:
            log.warning("bad build_rates tariff row, using fallback: %s", e)
    if "unit_sizes" in rows:
        try:
            unit_sizes = _parse_unit_values(rows["unit_sizes"])
        except (ValueError, TypeError, AttributeError) as e:
            log.warning("bad unit_sizes tariff row, using fallback: %s", e)
    if "market_rents" in rows:
        try:
            market_rents = _parse_unit_values(rows["market_rents"])
        except (ValueError, TypeError, AttributeError) as e:
            log.warning("bad market_rents tariff row, using fallback: %s", e)
    if "bulk_contributions" in rows:
        try:
            parsed_bulk = _parse_bulk(rows["bulk_contributions"])
            bulk = {
                municipality: {
                    **rates,
                    **parsed_bulk.get(municipality, {}),
                }
                for municipality, rates in base.bulk_contributions.items()
            }
        except (ValueError, TypeError, AttributeError, IndexError) as e:
            log.warning("bad bulk_contributions tariff row, using fallback: %s", e)
    if "transfer_duty_brackets" in rows:
        try:
            brackets = _parse_brackets(rows["transfer_duty_brackets"])
        except (ValueError, TypeError, IndexError) as e:
            log.warning("bad transfer_duty_brackets tariff row, using fallback: %s", e)
    if "fees" in rows:
        try:
            fee = float(rows["fees"]["professional_fee_pct"])
        except (ValueError, TypeError, KeyError) as e:
            log.warning("bad fees tariff row, using fallback: %s", e)

    return Tariffs(
        year=year,
        build_rates=build_rates,
        unit_sizes=unit_sizes,
        market_rents=market_rents,
        bulk_contributions=bulk,
        transfer_duty_brackets=brackets,
        professional_fee_pct=fee,
        source="db",
    )


# --- Loader with cache + graceful fallback ---------------------------------------
_CACHE_TTL = 300.0  # seconds — tariffs change rarely; refresh every 5 minutes
_cache: dict[int, tuple[float, Tariffs]] = {}


def load_tariffs(year: int = 2026, *, use_cache: bool = True) -> Tariffs:
    """Load tariffs for `year` from the DB, falling back to constants.

    Never raises: a DB outage or missing rows yields the 2026 fallback so the
    feasibility endpoint stays available.
    """
    now = time.time()
    if use_cache and year in _cache:
        ts, cached = _cache[year]
        if now - ts < _CACHE_TTL:
            return cached

    try:
        from db import fetch_tariff_rows

        rows = fetch_tariff_rows(year)
    except Exception as e:  # noqa: BLE001 — fallback path must catch everything
        if year != FALLBACK_TARIFF_YEAR:
            raise TariffValidationError(f"tariff bundle for {year} is unavailable") from e
        log.warning("tariff DB load failed for %s, using fallback constants: %s", year, e)
        return default_tariffs(year)

    if not rows and year != FALLBACK_TARIFF_YEAR:
        raise TariffValidationError(f"tariff bundle for {year} is unavailable")
    result = tariffs_from_rows(year, rows) if rows else default_tariffs(year)
    if use_cache:
        _cache[year] = (now, result)
    return result


def clear_cache() -> None:
    _cache.clear()
