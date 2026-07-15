import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from main import app
from routers import feasibility

client = TestClient(app)

VALID_PAYLOAD = {
    "address": "123 Test St, Midrand",
    "municipality": "johannesburg",
    "zone_code": "RES3",
    "size_sqm": 1024,
    "price": 980000,
    "unit_type": "bachelor",
    "target_units": 8,
}


def test_feasibility_returns_result():
    resp = client.post("/analyze/feasibility", json=VALID_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["viable"], bool)
    assert 0 <= data["score"] <= 100
    assert data["cost_total"] > 0


def test_feasibility_invalid_municipality():
    payload = {**VALID_PAYLOAD, "municipality": "durban"}
    resp = client.post("/analyze/feasibility", json=payload)
    assert resp.status_code == 422


def test_feasibility_invalid_zone_code():
    payload = {**VALID_PAYLOAD, "zone_code": "RES 3!"}
    resp = client.post("/analyze/feasibility", json=payload)
    assert resp.status_code == 422


def test_feasibility_size_too_small():
    payload = {**VALID_PAYLOAD, "size_sqm": 50}
    resp = client.post("/analyze/feasibility", json=payload)
    assert resp.status_code == 422


def test_feasibility_rejects_missing_non_2026_tariff_bundle():
    payload = {
        **VALID_PAYLOAD,
        "unit_type": "luxury",
        "tariff_year": 2027,
        "zone_rules": {
            "coverage_pct": 50,
            "far": 1.0,
            "max_storeys": 2,
            "max_units_per_erf": 10,
        },
    }
    resp = client.post("/analyze/feasibility", json=payload)

    assert resp.status_code == 422
    assert "tariff" in resp.json()["detail"].lower()


def test_capacity_response_model_requires_all_named_components():
    CapacityResponse = feasibility.CapacityResponse
    FeasibilityResponse = feasibility.FeasibilityResponse
    assert set(CapacityResponse.model_fields) == {
        "density_units",
        "far_units",
        "footprint_storey_units",
    }
    with pytest.raises(ValidationError):
        CapacityResponse(density_units=None, far_units=10)
    assert FeasibilityResponse.model_fields["capacity"].annotation is CapacityResponse
