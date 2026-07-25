#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--acknowledge-read-only" ]]; then
  echo "Refusing to inspect a source database without --acknowledge-read-only." >&2
  exit 2
fi

if [[ -z "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "SOURCE_DATABASE_URL is required." >&2
  exit 2
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output_dir="$repository_root/artifacts"
output_path="$output_dir/source-classification.json"
mkdir -p "$output_dir"
temporary_path="$(mktemp "$output_dir/.source-classification.XXXXXX")"
trap 'rm -f "$temporary_path"' EXIT

read -r -d '' query <<'SQL' || true
SELECT jsonb_build_object(
  'generatedAt', now(),
  'readOnlyAcknowledged', true,
  'tables', jsonb_build_object(
    'parcels', (SELECT jsonb_build_object('count', count(*), 'hasBoundary', bool_or(boundary IS NOT NULL), 'hasCentroid', bool_or(centroid IS NOT NULL)) FROM parcels),
    'zoningDesignations', (SELECT jsonb_build_object('count', count(*), 'hasGeometry', bool_or(geometry IS NOT NULL)) FROM zoning_designations),
    'dolomiteZones', (SELECT jsonb_build_object('count', count(*), 'hasGeometry', bool_or(geometry IS NOT NULL)) FROM dolomite_zones),
    'landUseHexagons', (SELECT jsonb_build_object('count', count(*), 'hasGeometry', bool_or(geometry IS NOT NULL)) FROM land_use_hexagons),
    'amenities', (SELECT jsonb_build_object('count', count(*), 'hasGeometry', bool_or(geometry IS NOT NULL)) FROM amenities),
    'listings', (SELECT jsonb_build_object('count', count(*)) FROM listings),
    'feasibilityReports', (SELECT jsonb_build_object('count', count(*), 'nullUserIdCount', count(*) FILTER (WHERE user_id IS NULL)) FROM feasibility_reports),
    'projects', (SELECT jsonb_build_object('count', count(*), 'nullUserIdCount', count(*) FILTER (WHERE user_id IS NULL)) FROM projects),
    'projectCheckins', (SELECT jsonb_build_object('count', count(*)) FROM project_checkins),
    'tariffs', (SELECT jsonb_build_object('count', count(*)) FROM tariffs),
    'scrapeJobs', (SELECT jsonb_build_object('count', count(*)) FROM scrape_jobs)
  )
);
SQL

run_psql() {
  if command -v psql >/dev/null 2>&1; then
    psql "$SOURCE_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$query"
    return
  fi

  docker run --rm --entrypoint psql postgis/postgis:15-3.4 \
    "$SOURCE_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$query"
}

run_psql > "$temporary_path"
jq --exit-status --compact-output . "$temporary_path" > "$output_path"

echo "Wrote aggregate-only source classification to artifacts/source-classification.json"
