# FGP Execution Tracker

## Portal redesign

- [x] Deliver authenticated portal shell, core Scout/Evaluate/Projects/Capital screens, and persisted API workflows.
- [x] Enforce authenticated Viewer and role restrictions across portal mutation routes.
- [ ] Complete Settings/Tariffs controls and five-role browser acceptance.
- [ ] Complete canonical PDF/package storage, private worker boundary, scraper execution, GIS ingestion, and browser regression coverage.
- [ ] Verify the production deployment on its approved public host.

## Supabase-to-.NET migration

- [x] Establish the .NET API foundation, local Mailpit service, and health test.
- [x] Port the baseline PostgreSQL/PostGIS schema from Supabase migrations 0001–0004 and add migration verification; the read-only classifier is implemented but has not inspected any source database.
- [x] Port the portal schema added by the former hosted-database migrations into EF Core migrations before removing the hosted database.
- [x] Implement Identity, organisations, roles, and policy enforcement.
- [ ] Add the authenticated web user journey and same-origin API transport.
- [x] Migrate every remaining portal route group to organization-scoped .NET API targets; external scraper/import actions remain explicitly approval-gated.
- [x] Implement Capital Fund contributions and approved governance rules, replacing provisional correction co-signing with immutable Owner/Chairperson maker-checker approval and exact fund-goal submission assent.
- [ ] Classify source data before choosing either approved import or deterministic demo seeding.
- [x] Remove hosted-database/TypeScript ORM runtime paths, add deterministic seed/import gates, CI, and rollback documentation.

## Gates

- No source-data classification/import or cloud deployment without separate approval.
- Financial corrections require Owner/Chairperson maker-checker approval.
- Fund-goal submission creates the proposer’s immutable assent record.

## Task 7 repair and Task 8/9 review

- [x] Independently re-review `e49ee44..f07f86a`; worker test collection lacked `pythonpath = ["."]`, repaired in `apps/worker/pyproject.toml`.
- [x] Add Capital Fund versioning, distinct correction approval, goal electorate assent, membership-change voiding, and linked governance audit events.
- [x] Remove legacy Next route handlers, hosted-database configuration, the TypeScript ORM package, and TypeScript seeders after adding .NET portal targets.
- [x] Add owner-gated source import, deterministic local demo seed, aggregate verification, CI workflow, and backup/rollback instructions.

### Review

- Task 7 focused worker tests passed 21/21; the API build passed; API integration tests required a Docker SDK container with the host Docker socket because the compose SDK container does not expose it.
- Capital governance integration passed 6/6; schema migration tests passed 9/9; the corrected no-eligible-approver fixture excludes both proposer and contribution subject.
- No source classification, external import, deployment, or Azure provisioning was executed.
- Final verification: the complete API suite passed 111/111 after the route cutover; web lint, typecheck, production build, worker tests (46/46), Compose validation, dependency smoke, and CI lockfile installation passed.
- Local custom-format PostgreSQL backup/restore was exercised into a disposable database and restored all 20 public tables; the disposable database was removed.
- Project detail parity now persists budget, contact, decision, and milestone actions through the organization-scoped .NET route. PDF storage/generation, team invitations/mutations, and scraper execution remain explicit follow-up gates where their external dependency or workflow is not yet approved/configured.

## PR #5 review follow-up

- [x] Repair Identity claim rehydration, lockout enforcement, cookie policy, registration enumeration, and Capital Fund membership checks.
- [x] Harden governance identity handling, serializable retries, audit entity IDs, JSON disposal, ledger invariants, and immutable audit events.
- [x] Harden worker credential comparison/cache bounds, configure worker timeout, correct tariff documentation, and repair CI dependency installation.
- [x] Add focused regressions and use a shared PostGIS container with isolated test databases.

### Review

- API build passed with 0 warnings and the full API suite passed 115/115.
- Worker tests passed 47/47; targeted worker Ruff checks passed; web lint, typecheck, and production build passed; Compose config validated.
- The legacy `/api/capital` POST multiplexer remains temporarily because the current capital page still uses that compatibility contract; its server-side active-membership check remains enforced.
- No deployment, Azure provisioning, external import, or source-data classification was performed.

### Follow-up review

- [x] Close the pre-auth sign-in enumeration and preserve Identity lockout behavior.
- [x] Make duplicate registration return the same neutral success status/body as first registration.
- [x] Add deterministic membership ordering, deadlock retry coverage, bounded cache sweeping, and an explicit worker-client dependency.
- [x] Migrate one PostGIS test template and clone isolated per-test databases with deterministic process-exit cleanup.

### Review

- The focused auth suite passed 10/10, including wrong-password email-confirmation non-disclosure and 429 `AccountLocked` behavior.
- The full API suite passed 116/116 and worker tests passed 47/47.
- Web lint, typecheck, production build, Compose validation, and the removed-database-path security smoke all passed.
- No deployment, Azure provisioning, external import, or source-data classification was performed.

## Task 3 remediation

- [x] Capture a failing multi-membership capability test that selects the authenticated `organization_id`.
- [x] Add authenticated organisation-isolation coverage for member reads and writes, including indistinguishable `404` responses.
- [x] Implement the minimal claim-bound membership resolution and tenant-scoped member read.
- [x] Run the focused authorization/isolation tests and the full API suite.
- [x] Review the diff, document evidence, and commit the Task 3 remediation.

### Review

- RED: the wrong-tenant `CoSignFinancial` check returned `true`, and the missing scoped member read returned `405` for an in-tenant membership.
- GREEN: focused authorization/isolation suite passed 10/10; full API suite passed 42/42 through the .NET 10 Docker SDK and Testcontainers.
- Claim-selected membership resolution now drives capability checks, organisation endpoints, and the `AuthSession` membership response.
- Foreign and nonexistent membership IDs return the same empty `404` response for reads and writes; the foreign membership remains unchanged.
- Scope stayed within Task 3 API identity/organisation code and tests; no web behavior, legacy route migration, or external resource was changed.

## Task 6 worker gateway parity

- [x] Audit the partial .NET parcel/feasibility implementation against the legacy routes and FastAPI contracts.
- [x] Add contract coverage for authentication, validation, `429`, stable `503`, numerical parity, timing, and claim-bound organisation save context.
- [x] Capture and document the focused RED failures before production changes.
- [x] Implement the minimal gateway, endpoint, and repository changes needed for parity.
- [x] Prove focused parity, then delete only the three legacy parcel/feasibility handlers.
- [x] Run the full API suite, worker suite, and web build.
- [x] Review scope, write the Task 6 report, and commit.

### Review

- RED: the initial focused contracts passed 1/14 and exposed the missing save endpoint, `400` validation, leaking worker exceptions, non-legacy `429` shape, and missing timing evidence.
- Additional RED checks proved that an unexpected worker `202` leaked from synchronous analysis and a null worker `capacity` escaped as `500`; both now return stable `502` errors.
- GREEN: focused Task 6 contracts passed 17/17; the full API suite passed 59/59 through the .NET 10 Docker SDK and Testcontainers; worker tests passed 40/40; the web production build passed.
- Save uses the authenticated `organization_id` claim and persists the listing/report atomically from a validated worker result; a deliberately earlier second membership verifies that no first-membership lookup is used.
- The final legacy feasibility save route was deleted only after focused parity passed. The parcel and feasibility legacy handlers were already absent in this branch.
- Scope stayed within Task 6 API gateway/endpoints/tests, the final legacy save route, and the narrow EF explicit-column mapping correction discovered by the save contract.

## Task 6 review repair round 1

- [x] Restore the prematurely removed parcel and feasibility handlers in a dedicated audit commit.
- [x] Capture RED regressions for strict JSON names/types, lookup failures, endpoint-wide deadlines, and authentication.
- [x] Add direct production-gateway allowlist and caller-cancellation coverage.
- [x] Implement exact JSON contracts, stable lookup errors, and a configurable eight-second endpoint deadline.
- [x] Prove .NET parity and Next filesystem precedence while the restored handlers are present.
- [x] Remove only the two restored handlers after parity, then run the complete verification matrix.
- [x] Append transparent repair evidence to the Task 6 report and commit.

### Review

- Audit restoration commit `ec4ed30` restored the original two TypeScript handlers verbatim; the restored-state Next build listed `/api/parcel` and `/api/feasibility`, proving those files took precedence over the `afterFiles` proxy.
- RED: the review suite passed 21/31 and failed the ten intended cases: four case/quoted-number request violations, two trusted-worker violations, two leaking zoning lookup failures, and two missing lookup/persistence deadline controls.
- GREEN before deletion: all 31 review contracts passed with both legacy handlers still present.
- GREEN after deletion: the complete API suite passed 74/74; worker tests passed 40/40; the web production build passed and its 28-page route inventory omitted the two legacy handlers.
- Requests and trusted-worker results now require exact property names and JSON numbers; endpoint cancellation covers lookup, worker validation, and transactional save persistence.
- Zoning lookup failures return the legacy `503 {"error":"Zoning rules could not be loaded"}` response, while deadline expiry returns the stable analysis-unavailable `503` without leaking details.
