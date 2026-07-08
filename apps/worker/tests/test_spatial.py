from services.spatial import (
    derive_params,
    normalize_dolomite_risk,
    proximity_score,
    score_amenities,
)


def test_proximity_score_bounds():
    assert proximity_score(0.0) == 100
    assert proximity_score(0.5) == 100
    assert proximity_score(5.0) == 0
    assert proximity_score(10.0) == 0
    mid = proximity_score(2.75)  # halfway between 0.5 and 5.0
    assert 45 <= mid <= 55


def test_score_amenities_buckets():
    amenities = [
        {"name": "Soshanguve Primary", "type": "school", "dist_km": 0.4},
        {"name": "Mall of the North", "type": "mall", "dist_km": 3.0},
        {"name": "Taxi Rank", "type": "taxi_rank", "dist_km": 0.5},
    ]
    scores = score_amenities(amenities)
    assert scores["score_schools"] == 100
    assert scores["score_transport"] == 100
    assert 0 < scores["score_amenities"] < 100
    assert scores["score_composite"] is not None


def test_score_amenities_missing_bucket_is_none():
    scores = score_amenities([{"name": "A school", "type": "school", "dist_km": 1.0}])
    assert scores["score_schools"] is not None
    assert scores["score_transport"] is None
    assert scores["score_amenities"] is None
    # Composite uses only present buckets.
    assert scores["score_composite"] == scores["score_schools"]


def test_score_amenities_empty():
    scores = score_amenities([])
    assert scores["score_schools"] is None
    assert scores["score_composite"] is None


def test_normalize_dolomite_risk():
    assert normalize_dolomite_risk(None) == "UNKNOWN"
    assert normalize_dolomite_risk("") == "UNKNOWN"
    assert normalize_dolomite_risk("high") == "HIGH"
    assert normalize_dolomite_risk("D4") == "D4"


def test_derive_params_uses_zone_rules():
    d = derive_params(1000, {"coverage_pct": 60, "far": 1.5, "max_units_per_ha": 80})
    assert d["max_footprint_sqm"] == 600.0
    assert d["max_buildable_sqm"] == 1500.0
    assert d["net_buildable_sqm"] == 1275.0  # 85% of buildable
    # 1000 sqm = 0.1 ha * 80 units/ha = 8
    assert d["max_units"] == 8


def test_derive_params_defaults_when_no_zone():
    d = derive_params(1000, None)
    assert d["max_footprint_sqm"] == 400.0  # default coverage 40%
    assert d["max_buildable_sqm"] == 500.0  # default far 0.5
    assert d["max_units"] is None  # no density cap given
