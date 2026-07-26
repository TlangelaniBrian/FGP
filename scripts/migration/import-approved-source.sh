#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--classification" || "${2:-}" != "production" || "${3:-}" != "--confirm" ]]; then
  echo "Usage: import-approved-source.sh --classification production --confirm" >&2
  echo "This command requires an approved classification and mapping manifest; it never runs implicitly." >&2
  exit 2
fi
if [[ -z "${SOURCE_DATABASE_URL:-}" || -z "${TARGET_DATABASE_URL:-}" ]]; then echo "SOURCE_DATABASE_URL and TARGET_DATABASE_URL are required." >&2; exit 2; fi
if [[ -z "${SOURCE_CLASSIFICATION_PATH:-}" || ! -f "$SOURCE_CLASSIFICATION_PATH" ]]; then echo "SOURCE_CLASSIFICATION_PATH must point to the approved aggregate classification report." >&2; exit 2; fi
if [[ -z "${IMPORT_MAPPING_PATH:-}" || ! -f "$IMPORT_MAPPING_PATH" ]]; then echo "IMPORT_MAPPING_PATH must point to the approved mapping manifest." >&2; exit 2; fi
if [[ "$(jq -r '.classification // empty' "$SOURCE_CLASSIFICATION_PATH")" != "production" || "$(jq -r '.approved // false' "$SOURCE_CLASSIFICATION_PATH")" != "true" ]]; then echo "The classification report is not approved for production import." >&2; exit 2; fi
if [[ "$(jq -r '.approved // false' "$IMPORT_MAPPING_PATH")" != "true" ]]; then echo "The mapping manifest is not approved." >&2; exit 2; fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$repository_root/artifacts"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_path="$repository_root/artifacts/approved-source-$timestamp.dump"
report_path="$repository_root/artifacts/import-$timestamp.json"
echo "Approved import gate passed. Exporting source to $dump_path."
pg_dump --format=custom --no-owner --no-acl "$SOURCE_DATABASE_URL" > "$dump_path"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$TARGET_DATABASE_URL" "$dump_path"
source_checksum="$(shasum -a 256 "$dump_path" | awk '{print $1}')"
jq -n --arg timestamp "$timestamp" --arg dump "$dump_path" --arg checksum "$source_checksum" '{classification:"production", approved:true, completedAt:$timestamp, dump:$dump, sha256:$checksum}' > "$report_path"
echo "Import completed and recorded at $report_path."
