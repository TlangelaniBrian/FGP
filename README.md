# First Generation Properties

FGP is a Gauteng property-development feasibility portal. The web app is a Next.js presentation layer; the ASP.NET Core API owns authentication, organization tenancy, EF Core migrations, and PostgreSQL/PostGIS persistence; the FastAPI worker is private behind the API service-token boundary.

## Local development

Prerequisites: Docker, Node.js 20+, pnpm 10+, and `uv`.

```bash
docker compose -f infra/docker-compose.yml up -d postgis redis mailpit worker api
pnpm install
pnpm --filter web dev
```

The portal runs at <http://localhost:3000>, the API at <http://localhost:8080>, Mailpit at <http://localhost:8025>, and PostGIS on port `5433`. EF Core migrations are the only schema authority; the API applies them through the test host and local startup workflow.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm build
docker compose -f infra/docker-compose.yml exec -T api dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj
(cd apps/worker && uv run pytest)
```

The API integration tests use disposable PostGIS containers. The worker has no published host port in the compose configuration. CI is defined in `.github/workflows/verify.yml`.

## Data handling

Reference values and deterministic spatial fixtures are seeded only through `scripts/migration/seed-demo-data.sh --classification demo`, with a local `TARGET_DATABASE_URL` and `SEED_ORGANIZATION_ID`. The command never imports external data.

`scripts/migration/import-approved-source.sh --classification production --confirm` is a separately gated path. It requires an owner-approved aggregate classification report, an approved mapping manifest, source and target URLs, and records an export checksum. It must not be run without explicit approval. `scripts/migration/verify-import.sh` performs aggregate, foreign-key, and spatial checks after an approved import.

## Backup and rollback

Use `pg_dump --format=custom --no-owner --no-acl "$TARGET_DATABASE_URL" > artifacts/fgp-$(date -u +%Y%m%dT%H%M%SZ).dump` for a timestamped portable backup and restore it into a disposable PostgreSQL/PostGIS database with `pg_restore`. Keep the dump and checksum together. Rollback is a deployment-owner decision; no production deployment or cloud provisioning is performed by this repository workflow.

## Architecture notes

- Tenant identity comes from the authenticated `organization_id` claim, never from browser input.
- Financial corrections require a distinct active Owner/Chairperson approval and immutable contribution versions.
- Fund-goal submission records immutable proposer assent; membership changes void open goals and link an immutable governance audit event.
- Source classification, external-data import, deployment, and Azure provisioning are explicit owner gates.
