from types import SimpleNamespace

from fastapi.testclient import TestClient

import main
from main import app


def test_private_worker_routes_reject_missing_and_invalid_service_credentials(monkeypatch):
    monkeypatch.setattr(
        main,
        "settings",
        SimpleNamespace(
            worker_service_token="expected-worker-service-token",
            tariff_year=2026,
        ),
    )
    client = TestClient(app)

    missing = client.post("/analyze/feasibility", json={})
    invalid = client.post(
        "/analyze/feasibility",
        json={},
        headers={"Authorization": "Bearer wrong-worker-service-token"},
    )

    assert missing.status_code == 401
    assert invalid.status_code == 401


def test_worker_health_remains_available_without_service_credentials(monkeypatch):
    monkeypatch.setattr(
        main,
        "settings",
        SimpleNamespace(
            worker_service_token="expected-worker-service-token",
            tariff_year=2026,
        ),
    )

    response = TestClient(app).get("/health")

    assert response.status_code == 200
