# First Generation Properties

FGP is a Gauteng property-development feasibility portal. It takes a land listing through
scoring, zoning compliance, build-cost modelling and a go/no-go decision, then tracks the
resulting project and the shared capital fund that finances it.

The web app is a Next.js presentation layer; the ASP.NET Core API owns authentication,
organization tenancy, EF Core migrations and PostgreSQL/PostGIS persistence; the FastAPI
worker is private behind the API's service-token boundary.

- [Architecture](docs/architecture.md) — services, tenancy, governance rules, safety gates
- [Demo runbook](docs/demo-runbook.md) — cold start to full walkthrough
- [Delivery order](docs/roadmap.md) — what to work on next, and what blocks what
- [Agent loops](docs/agent-loops.md) — prompts for working the roadmap and reviewing PRs

## Local development

Prerequisites: Docker, Node.js 20+, pnpm 10+, and `uv`.

```bash
docker compose -f infra/docker-compose.yml up -d postgis redis mailpit worker api
pnpm install
pnpm dev
```

The portal runs at <http://localhost:3000>, the API at <http://localhost:8080>, Mailpit at
<http://localhost:8025>, and PostGIS on port `5433`. EF Core migrations are the only schema
authority; the API applies them on startup and through the test host.

To load the deterministic demo organization — five role users, five leads, three projects
and a funded capital fund — follow [step 2 of the demo runbook](docs/demo-runbook.md#2-seed-the-demo-organization).

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:web
pnpm test:api
pnpm test:worker
```

`pnpm test:api` runs the integration suite in a one-off SDK container with the host Docker
socket mounted, because the tests provision disposable PostGIS databases through
Testcontainers. Running `dotnet test` inside the compose `api` container cannot work — that
service does not mount the socket. CI runs `dotnet test` directly on the runner.

The worker has no published host port in the compose configuration. CI is defined in
`.github/workflows/verify.yml`.

## Data handling

Reference values and deterministic spatial fixtures are seeded only through
`scripts/migration/seed-demo-data.sh --classification demo`, with a local
`TARGET_DATABASE_URL` and `SEED_ORGANIZATION_ID`. The command never imports external data.

`scripts/migration/import-approved-source.sh --classification production --confirm` is a
separately gated path. It requires an owner-approved aggregate classification report, an
approved mapping manifest, source and target URLs, and records an export checksum. It must
not be run without explicit approval. `scripts/migration/verify-import.sh` performs
aggregate, foreign-key and spatial checks after an approved import.

## Backup and rollback

```bash
pg_dump --format=custom --no-owner --no-acl "$TARGET_DATABASE_URL" \
  > artifacts/fgp-$(date -u +%Y%m%dT%H%M%SZ).dump
```

Restore into a disposable PostgreSQL/PostGIS database with `pg_restore`. Keep the dump and
its checksum together. Rollback is a deployment-owner decision; no production deployment or
cloud provisioning is performed by this repository workflow.

## Invariants

- Tenant identity comes from the authenticated `organization_id` claim, never from browser
  input. Cross-organization reads return `404`, not `403`.
- EF Core migrations are the only DDL authority.
- Financial corrections require a distinct active Owner/Chairperson approver and preserve
  immutable contribution versions.
- Fund-goal submission records immutable proposer assent and the exact submission
  electorate; membership changes void open goals and link a governance audit event.
- Source classification, external-data import, scraper execution, deployment and cloud
  provisioning are explicit owner gates.
