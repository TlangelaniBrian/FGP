import json
import os
import subprocess
from pathlib import Path


def test_compose_keeps_worker_private_and_shares_service_credential():
    repository = Path(__file__).resolve().parents[3]
    environment = {
        **os.environ,
        "WORKER_SERVICE_TOKEN": "compose-contract-worker-token",
    }
    completed = subprocess.run(
        [
            "docker",
            "compose",
            "-f",
            str(repository / "infra/docker-compose.yml"),
            "config",
            "--format",
            "json",
        ],
        cwd=repository,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    services = json.loads(completed.stdout)["services"]

    assert "ports" not in services["worker"]
    assert services["worker"]["environment"]["WORKER_SERVICE_TOKEN"] == (
        "compose-contract-worker-token"
    )
    assert services["api"]["environment"]["Worker__ServiceToken"] == (
        "compose-contract-worker-token"
    )
    assert services["api"]["environment"]["Worker__BaseUrl"] == "http://worker:8000"
