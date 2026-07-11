"""Thin psycopg data-access helpers for the worker.

The worker is mostly pure compute; this module is the only place it talks to
PostGIS. Connections are opened per-call (psycopg handles its own pooling well
enough for our low request volume and it keeps failure handling simple). All
spatial SQL uses parameterised placeholders — never f-string interpolation —
per the security standards in CLAUDE.md.
"""
from __future__ import annotations

import logging
from typing import Any

from config import settings

log = logging.getLogger("fgp.db")

_CONNECT_TIMEOUT = 5


def _connect():
    import psycopg

    return psycopg.connect(settings.database_url, connect_timeout=_CONNECT_TIMEOUT)


def fetch_tariff_rows(year: int) -> dict[str, Any]:
    """Return {category: data(JSONB)} for a tariff year. Empty dict if none."""
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT category, data FROM tariffs WHERE tariff_year = %s",
                (year,),
            )
            return {row[0]: row[1] for row in cur.fetchall()}


# --- Spatial lookups for /analyze/parcel -----------------------------------------
# A point built once and reused across the four joins below.
_POINT = "ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)"

_PARCEL_SQL = f"""
    SELECT id, erf_number, township, municipality, size_sqm,
           ST_AsGeoJSON(boundary) AS boundary_geojson
    FROM parcels
    WHERE ST_Contains(boundary::geometry, {_POINT})
    LIMIT 1
"""

_ZONE_SQL = f"""
    SELECT z.zone_code, z.zone_label, z.municipality,
           r.coverage_pct, r.far, r.max_storeys, r.max_height_m,
           r.building_line_front_m, r.building_line_side_m, r.building_line_rear_m,
           r.max_units_per_ha, r.max_units_per_erf,
           r.permitted_uses, r.consent_uses,
           r.rezoning_possible_to, r.rezoning_difficulty, r.rezoning_approval_rate,
           r.forms_required
    FROM zoning_designations z
    LEFT JOIN zoning_scheme_rules r
      ON r.municipality = z.municipality AND r.zone_code = z.zone_code
    WHERE ST_Contains(z.geometry::geometry, {_POINT})
    LIMIT 1
"""

_DOLOMITE_SQL = f"""
    SELECT risk_class, cgs_reference
    FROM dolomite_zones
    WHERE ST_Contains(geometry::geometry, {_POINT})
    LIMIT 1
"""

# KNN order (<->) uses the GIST index; ST_DWithin bounds the search to 5km.
_AMENITY_SQL = f"""
    SELECT name, type, subtype,
           ROUND((ST_Distance(geometry, {_POINT}::geography) / 1000)::numeric, 2) AS dist_km
    FROM amenities
    WHERE ST_DWithin(geometry, {_POINT}::geography, 5000)
    ORDER BY geometry <-> {_POINT}::geography
    LIMIT 20
"""


def spatial_lookup(lat: float, lng: float) -> dict[str, Any]:
    """Spatial join a coordinate against parcels, zoning, dolomite and amenities.

    Raises on connection failure (the router converts that to a 503). A point
    that matches no parcel/zone returns those keys as None rather than raising.
    """
    from psycopg.rows import dict_row

    params = {"lat": lat, "lng": lng}
    with _connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_PARCEL_SQL, params)
            parcel = cur.fetchone()

            cur.execute(_ZONE_SQL, params)
            zone = cur.fetchone()

            cur.execute(_DOLOMITE_SQL, params)
            dolomite = cur.fetchone()

            cur.execute(_AMENITY_SQL, params)
            amenities = cur.fetchall()

    return {
        "parcel": parcel,
        "zone": zone,
        "dolomite": dolomite,
        "amenities": [dict(a) for a in amenities],
    }
