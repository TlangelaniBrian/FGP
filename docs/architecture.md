# FGP architecture

First Generation Properties (FGP) is a property-development feasibility portal for a
small South African investment club operating in Gauteng. It takes a raw land listing
through scoring, zoning compliance, build-cost modelling and a go/no-go decision, then
tracks the resulting project and the shared capital fund that finances it.

This document describes what the system is today. For the visual specification see the
design handoff bundle described under [Design](#design).

## Services

| Service | Stack | Port (local) | Role |
| --- | --- | --- | --- |
| `apps/web` | Next.js 16, React 19 | 3000 | Presentation only. Talks to the API over same-origin `/api/*`. |
| `apps/api` | ASP.NET Core, .NET 10 | 8080 | Owns Identity, organization tenancy, EF Core migrations, all public contracts. |
| `apps/worker` | FastAPI, Python 3.12 | none published | Private. Spatial analysis and PDF rendering. Reachable only by the API. |
| PostgreSQL + PostGIS | 15 / 3.4 | 5433 | Single source of truth. |
| Redis | 7 | 6380 | Worker queue and caching. |
| Mailpit | 1.27 | 8025 (UI), 1025 (SMTP) | Local mail capture for Identity flows. |

The dependency direction is strict and one-way:

```
browser → apps/web → apps/api → apps/worker
                        ↓
                  PostgreSQL/PostGIS
```

The web app never reaches the database or the worker directly. The worker never serves
browser traffic; it accepts only requests carrying the configured service token.

## Tenancy

Every record that belongs to a club is scoped by `organization_id`.

The organization is resolved **only** from the authenticated user's `organization_id`
claim. No request body, query parameter or header may select an organization — that is
the core isolation invariant, and cross-organization reads must return `404`, not `403`,
so the existence of another tenant's row is never disclosed.

Roles are `Owner`, `Chairperson`, `Treasurer`, `Analyst`, `Viewer`. Capabilities are
enforced at the endpoint through authorization policies, not only hidden in the UI.
`Viewer` is read-only and its mutations are refused server-side even if invoked directly.

## Schema authority

EF Core migrations in `apps/api/src/FGP.Api/Migrations` are the **only** DDL authority.
There is no other migration tool, no ORM in the web app, and no hand-applied SQL. The
API applies migrations on startup and through the test host.

## Capital fund governance

The capital fund is the governance centrepiece and its rules are enforced in
`GovernanceService`, not in the UI:

- **Contributions are immutable.** A correction never edits a row; it supersedes it,
  producing a new version and leaving the prior version intact and auditable.
- **Corrections are maker-checker.** The proposer cannot approve their own correction;
  approval requires a *distinct* active Owner or Chairperson.
- **Fund-goal changes are unanimous.** A proposal records its exact submission
  electorate — every active, non-`Viewer` member at the moment of submission — plus the
  proposer's own immutable assent. Every member of that electorate must co-sign.
- **Membership changes void open goals.** If the electorate changes while a goal is
  open, the goal is voided and a governance audit event is linked to the change.

A member co-signs only as themselves; there is no acting-on-behalf-of.

## Feasibility pipeline

1. **Scout** lists persisted leads with a feasibility score, zone code and dolomite risk.
2. **Parcel detail** pulls spatial context — zoning designation, dolomite zone, nearby
   amenities — through the worker.
3. **Evaluate / Cost Oracle** turns plot size, price, unit type and unit count into a
   cost breakdown and a yield. Build rates and bulk contributions come from **Tariffs**,
   so tariff edits change feasibility output live.
4. **Compliance package** generates the municipal forms for the parcel's zone and
   municipality, rendered to PDF by the worker and stored through `IArtifactStorage`.
5. A viable report can become a **Project**, which carries budget, milestones, contacts,
   decisions and weekly check-ins.

Reports record a `decision_status` of `definitive` or `degraded`. `degraded` means the
zoning evidence was incomplete and the answer must not be presented as authoritative.

## Safety gates

These require explicit owner approval and are never performed automatically:

- Classifying a source database (`scripts/migration/classify-source.sh` is read-only).
- Importing external data (`import-approved-source.sh`, which additionally requires an
  approved classification report, a mapping manifest and an export checksum).
- Running the scrapers against live third-party sites.
- Deploying, or provisioning any cloud infrastructure.

The deterministic local demo path (`seed-demo-data.sh --classification demo`) is
separate, accepts only a local database host, and imports nothing external.

## Design

The UI implements the **Capitec Payments Design System**: brand navy `#0033A0`, action
blue `#2F70EF`, Nunito Sans, 16px card radius, full-pill buttons, sentence case, ZAR
formatted `R 1 234.56`. Light/dark themes and Classic/Navy/Bold moods are supported.

The design handoff bundle (`docs/design_handoff_fgp_portal/`) holds the HTML prototype,
screenshots for all eleven screens, and the design tokens. It is **deliberately not
committed** because it embeds third-party Capitec design-system assets and fonts; keep
it alongside your checkout. The prototype's runtime (`support.js`) is a prototyping
tool and is never shipped.

## Testing

| Suite | Command | Notes |
| --- | --- | --- |
| Web unit | `pnpm test:web` | Vitest. |
| API integration | `pnpm test:api` | Provisions disposable PostGIS via Testcontainers. |
| Worker | `pnpm test:worker` | pytest; `pytest` lives under the `dev` extra. |
| Security regression | `pnpm test:security-regression` | Asserts removed database paths stay removed. |

`pnpm test:api` runs a one-off SDK container with the host Docker socket mounted.
Testcontainers needs that socket, and the `api` service in `infra/docker-compose.yml`
does not mount it — so running `dotnet test` *inside* the compose api container cannot
work. CI runs `dotnet test` directly on the runner, which has Docker available.
