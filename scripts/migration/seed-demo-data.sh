#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--classification" || "${2:-}" != "demo" ]]; then
  echo "Usage: seed-demo-data.sh --classification demo" >&2
  exit 2
fi
target="${TARGET_DATABASE_URL:-}"
organization_id="${SEED_ORGANIZATION_ID:-}"
if [[ -z "$target" || -z "$organization_id" ]]; then echo "TARGET_DATABASE_URL and SEED_ORGANIZATION_ID are required." >&2; exit 2; fi
if [[ ! "$target" =~ (localhost|127\.0\.0\.1|host\.docker\.internal|postgis) ]]; then echo "Demo seeding only accepts a local database host." >&2; exit 2; fi
if [[ ! "$organization_id" =~ ^[0-9a-fA-F-]{36}$ ]]; then echo "SEED_ORGANIZATION_ID must be a UUID." >&2; exit 2; fi

ConnectionStrings__Fgp="$target" Seed__OrganizationId="$organization_id" \
  dotnet run --project "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../apps/api" && pwd)/src/FGP.Api/FGP.Api.csproj" --no-launch-profile -- --seed-demo
