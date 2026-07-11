#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required to apply production migrations" >&2
  exit 1
fi

supabase db push --db-url "$DATABASE_URL" --yes
