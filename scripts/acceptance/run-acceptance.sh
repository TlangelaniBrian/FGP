#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_files=(
  -f "$repository_root/infra/docker-compose.yml"
  -f "$repository_root/infra/docker-compose.acceptance.yml"
)

cleanup() {
  docker compose "${compose_files[@]}" down -v --remove-orphans
}
trap cleanup EXIT

docker compose "${compose_files[@]}" up -d

web_ready=false
for _ in $(seq 1 240); do
  if curl -fsS -m 5 -o /dev/null http://localhost:3000/sign-in; then
    web_ready=true
    break
  fi
  sleep 2
done
if [[ "$web_ready" != true ]]; then
  echo "The FGP web service did not become reachable on http://localhost:3000/sign-in." >&2
  docker compose "${compose_files[@]}" logs --tail=80 api web seed || true
  exit 1
fi

curl -fsS http://localhost:8080/health >/dev/null

cd "$repository_root/apps/web"
"$repository_root/apps/web/node_modules/.bin/playwright" test
