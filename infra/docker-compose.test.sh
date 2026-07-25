#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
configuration="$(docker compose -f "$repository_root/infra/docker-compose.yml" config)"

if [[ "$configuration" != *"pg_isready -h localhost -U postgres"* ]]; then
  echo "PostGIS health must verify TCP connectivity before dependent services start." >&2
  exit 1
fi
