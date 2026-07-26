#!/usr/bin/env bash
set -euo pipefail

classification_path="${1:-${SOURCE_CLASSIFICATION_PATH:-}}"
target="${TARGET_DATABASE_URL:-}"
if [[ -z "$classification_path" || ! -f "$classification_path" ]]; then echo "Usage: verify-import.sh <approved-classification.json>" >&2; exit 2; fi
if [[ -z "$target" ]]; then echo "TARGET_DATABASE_URL is required." >&2; exit 2; fi
if [[ "$(jq -r '.readOnlyAcknowledged // false' "$classification_path")" != "true" ]]; then echo "Classification report is missing read-only acknowledgement." >&2; exit 2; fi

query="SELECT jsonb_build_object('parcels', (SELECT count(*) FROM parcels), 'zoningDesignations', (SELECT count(*) FROM zoning_designations), 'dolomiteZones', (SELECT count(*) FROM dolomite_zones), 'amenities', (SELECT count(*) FROM amenities), 'listings', (SELECT count(*) FROM listings), 'projects', (SELECT count(*) FROM projects), 'foreignKeyViolations', (SELECT count(*) FROM listings l LEFT JOIN organizations o ON o.id = l.organization_id WHERE o.id IS NULL), 'spatialFixtures', (SELECT count(*) FROM parcels WHERE boundary IS NOT NULL));"
actual="$(psql "$target" -X -A -t -v ON_ERROR_STOP=1 -c "$query" | jq -c .)"
if [[ -z "$actual" ]]; then echo "Target verification returned no aggregate result." >&2; exit 1; fi
if [[ "$(jq -r '.foreignKeyViolations' <<<"$actual")" != "0" ]]; then echo "Foreign-key verification failed: $actual" >&2; exit 1; fi
if [[ "$(jq -r '.spatialFixtures' <<<"$actual")" == "0" ]]; then echo "Spatial fixture verification failed: $actual" >&2; exit 1; fi
printf '%s\n' "$actual" > artifacts/import-verification.json
echo "Target aggregate, foreign-key, and spatial verification passed."
