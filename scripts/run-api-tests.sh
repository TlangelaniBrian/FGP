#!/usr/bin/env bash
# Runs the API integration suite.
#
# The tests provision disposable PostGIS containers through Testcontainers, so the
# runner needs the host Docker socket. The `api` service in infra/docker-compose.yml
# does not mount it, which is why `docker compose exec api dotnet test` fails to
# reach a Docker endpoint. This script runs a one-off SDK container that does.
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
project="${1:-apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj}"
shift || true

exec docker run --rm \
  -v "$repository_root":/workspace \
  -w /workspace \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v fgp_nuget:/root/.nuget/packages \
  --network infra_default \
  -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal \
  -e TESTCONTAINERS_RYUK_DISABLED=true \
  mcr.microsoft.com/dotnet/sdk:10.0 \
  dotnet test "$project" "$@"
