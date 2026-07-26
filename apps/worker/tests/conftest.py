import pytest

from config import settings


@pytest.fixture(autouse=True)
def worker_service_credential(monkeypatch):
    monkeypatch.setattr(
        settings,
        "worker_service_token",
        "test-worker-service-token",
    )
