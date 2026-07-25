#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script_path="$repository_root/scripts/migration/classify-source.sh"

set +e
output="$(SOURCE_DATABASE_URL='postgresql://example.invalid/fgp' "$script_path" 2>&1)"
status=$?
set -e

if [[ $status -eq 0 ]]; then
  echo "expected classifier to reject an unacknowledged source read" >&2
  exit 1
fi

if [[ "$output" != *"--acknowledge-read-only"* ]]; then
  echo "classifier did not explain the read-only acknowledgement requirement" >&2
  exit 1
fi
