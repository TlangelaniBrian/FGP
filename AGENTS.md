# FGP project instructions

## Workflow

1. Write a checkable plan in `tasks/todo.md` for multi-file work.
2. Verify the plan against the live repository before editing.
3. Keep changes small and organization-scoped; update the tracker as slices finish.
4. Run focused tests before the full verification matrix.
5. Add a review section to `tasks/todo.md` and record lessons in `tasks/lessons.md`
   when a correction changes the approach.

## Architecture

The Next.js app is presentation-only. ASP.NET Core/.NET 10 owns Identity, organization
tenancy, EF Core migrations, PostgreSQL/PostGIS persistence, and public `/api/*` routes.
FastAPI remains private behind a service token. No browser request may choose its
organization with a body field.

Full detail in `docs/architecture.md`.

## Safety gates

Do not deploy, provision cloud infrastructure, import external data, run scrapers
against live sites, or classify source data without explicit owner approval. The
production import script requires an approved aggregate classification and mapping
manifest; the demo seed path accepts only a local target and `--classification demo`.

## Quality

Use strong types and explicit error responses. Do not add debug logging or `any`.
Run `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:api`, and `pnpm test:worker`
before completion. EF migrations are the only schema authority. Capital Fund corrections
are immutable and require a distinct Owner/Chairperson approver; fund-goal assent and
membership-change void/audit invariants are mandatory.
