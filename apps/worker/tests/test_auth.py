from types import SimpleNamespace

import pytest

from config import settings
from main import require_worker_service_credential


@pytest.mark.asyncio
async def test_non_ascii_authorization_header_is_rejected_without_server_error():
    request = SimpleNamespace(
        url=SimpleNamespace(path="/analyze/feasibility"),
        headers={"authorization": "Bearer \u2603"},
    )

    response = await require_worker_service_credential(request, lambda _: None)

    assert response.status_code == 401
    assert settings.worker_service_token
