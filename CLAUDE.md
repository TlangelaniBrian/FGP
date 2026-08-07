# FGP maintainer notes

FGP is a Next.js 16 frontend, ASP.NET Core/.NET 10 API, PostgreSQL 15/PostGIS 3.4
database, and private FastAPI worker for Gauteng feasibility analysis.

See `docs/architecture.md` for the full picture and `docs/demo-runbook.md` for running
a demo.

## Repository boundaries

- `apps/web` contains presentation code and same-origin `/api/*` requests.
- `apps/api` owns Identity, organization claims, EF Core migrations, tenant-scoped
  records, and public API contracts.
- `apps/worker` is private and accepts only the configured service token.
- `scripts/migration` contains read-only classification, owner-approved import gates,
  and deterministic local demo seeding.

## Required practices

- Keep every tenant query scoped to the authenticated organization claim. Cross-tenant
  reads return `404`, never `403`.
- Treat EF Core migrations as the only DDL authority.
- Do not import external data, classify a source snapshot, run scrapers against live
  sites, deploy, or provision cloud infrastructure without explicit owner approval.
- Use focused tests first, then the full API, worker, and web verification matrix.
- For financial corrections, preserve immutable versions and require a distinct active
  Owner/Chairperson approver.
- For fund goals, preserve proposer assent, exact submission electorate, and
  membership-change void/audit behavior.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm build
pnpm test:web
pnpm test:api      # one-off SDK container; needs the host Docker socket
pnpm test:worker
```

`dotnet test` inside the compose `api` container cannot pass — that service does not
mount the Docker socket the Testcontainers-based suite needs. Use `pnpm test:api`.

Do not reintroduce hosted-auth, browser-direct database, or TypeScript ORM dependencies.
CI enforces this in `.github/workflows/verify.yml`.
