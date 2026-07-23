# FGP .NET Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase with an ASP.NET Core public backend and portable PostgreSQL/PostGIS while preserving current routes, adding organisation security, and delivering the separately scoped Capital Fund governance module.

**Architecture:** Next.js remains the presentation layer and proxies `/api/*` to one ASP.NET Core API on the same origin. The API owns Identity, organisation-scoped persistence, EF Core migrations, and public endpoints; the existing Python worker stays private behind typed HTTP clients for spatial and feasibility work. Route migration is incremental: each legacy route is only removed after its replacement passes contract and authorisation tests.

**Tech Stack:** .NET 10, ASP.NET Core Identity, EF Core, Npgsql, NetTopologySuite, PostgreSQL 15/PostGIS 3.4, Next.js 16, TypeScript, FastAPI, Redis, Docker Compose, GitHub Actions.

## Global Constraints

- Do not provision Azure resources, deploy containers, import external data, or classify source data without separate user approval.
- Use exactly one active Owner and at most one active Chairperson per organisation.
- Store every tenant-owned record with `organization_id`; never take the tenant identity from a browser-supplied field.
- `CoSignFinancial` is Owner/Chairperson only; `CoSignOperational` is Owner/Chairperson/Treasurer/Analyst.
- A financial-correction submission never approves itself. A fund-goal submission always creates its proposer’s immutable `AssentBySubmission` record.
- Any membership or role change voids open fund-goal proposals and writes linked immutable audit events.
- Preserve the current FastAPI parcel and feasibility contracts before considering a .NET replacement for worker functions.
- Interactive parcel and feasibility requests must fit the 10-second end-to-end budget; document generation and scraping are asynchronous jobs.
- EF Core migrations are the only production DDL authority. Data import tooling may insert data but must not create schema.

---

## File map

| Path | Responsibility |
|---|---|
| `apps/api/FGP.Api.sln` | .NET solution root. |
| `apps/api/src/FGP.Api/Program.cs` | API host, identity cookies, route groups, health checks. |
| `apps/api/src/FGP.Api/Data/FgpDbContext.cs` | EF model, PostGIS configuration, query filters. |
| `apps/api/src/FGP.Api/Identity/*` | account, organisation, membership, authorisation policies. |
| `apps/api/src/FGP.Api/Projects/*`, `Tariffs/*`, `Feasibility/*`, `Spatial/*` | replacement contracts for existing routes. |
| `apps/api/src/FGP.Api/CapitalFund/*` | new governance module, separate from parity route migration. |
| `apps/api/tests/FGP.Api.Tests/*` | API integration and governance tests against PostGIS. |
| `apps/web/next.config.ts` | same-origin reverse proxy to the API. |
| `apps/web/app/api/**` | removed one module at a time after replacement contract passes. |
| `infra/docker-compose.yml` | local API and test dependencies. |
| `scripts/migration/*` | read-only classification, deterministic seed and approved import commands. |
| `.github/workflows/verify.yml` | required test, lint, build and migration CI gate. |

### Task 1: Establish the .NET solution and local service boundary

**Files:**
- Create: `global.json`
- Create: `apps/api/FGP.Api.sln`
- Create: `apps/api/src/FGP.Api/FGP.Api.csproj`
- Create: `apps/api/src/FGP.Api/Program.cs`
- Create: `apps/api/src/FGP.Api/appsettings.Development.json`
- Create: `apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj`
- Create: `apps/api/tests/FGP.Api.Tests/HealthEndpointTests.cs`
- Modify: `infra/docker-compose.yml`
- Modify: `.env.example`

**Interfaces:**
- Produces `GET /health` returning `{ "status": "ok" }` and a Docker service named `api` on port 8080.
- Consumes `ConnectionStrings__Fgp`, `Worker__BaseUrl`, and `Redis__ConnectionString`; these values never enter the browser bundle.

- [ ] **Step 1: Write the failing health test.**

```csharp
[Fact]
public async Task GetHealth_returns_ok()
{
    await using var app = new FgpApiFactory();
    var response = await app.CreateClient().GetAsync("/health");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Equal("ok", (await response.Content.ReadFromJsonAsync<HealthResponse>())!.Status);
}
```

- [ ] **Step 2: Run it and confirm it fails because the API project does not exist.**

Run: `dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj --filter FullyQualifiedName~HealthEndpointTests`

Expected: failure indicating the solution/project cannot be found.

- [ ] **Step 3: Create the solution and minimal host.** Target SDK `10.0.100` in `global.json`; use `WebApplication.CreateBuilder`, `app.MapGet("/health", () => Results.Ok(new HealthResponse("ok")))`, and `app.Run()`. Add a Docker Compose `api` service that waits for PostGIS and worker health checks.

- [ ] **Step 4: Run the focused test and `docker compose -f infra/docker-compose.yml config`.**

Expected: health test passes; Compose configuration validates without interpolation errors.

- [ ] **Step 5: Commit.**

```bash
git add global.json apps/api infra/docker-compose.yml .env.example
git commit -m "feat: add .net api foundation"
```

### Task 2: Make EF Core the portable PostgreSQL/PostGIS schema owner

**Files:**
- Create: `apps/api/src/FGP.Api/Data/FgpDbContext.cs`
- Create: `apps/api/src/FGP.Api/Data/Entities/SpatialEntities.cs`
- Create: `apps/api/src/FGP.Api/Data/Entities/ProjectEntities.cs`
- Create: `apps/api/src/FGP.Api/Data/Entities/TariffEntities.cs`
- Create: `apps/api/src/FGP.Api/Migrations/202607230001_InitialPortableSchema.cs`
- Create: `apps/api/tests/FGP.Api.Tests/SchemaMigrationTests.cs`
- Create: `scripts/migration/classify-source.sh`
- Modify: `infra/docker-compose.yml`

**Interfaces:**
- Produces `FgpDbContext` with `DbSet<Parcel>`, `DbSet<Project>`, `DbSet<Tariff>`, and all translated existing tables.
- Produces a read-only source report with table counts, null `user_id` counts, and spatial sample flags; it must not print emails or export data.

- [ ] **Step 1: Write migration tests.**

```csharp
[Fact]
public async Task Initial_migration_enables_postgis_and_creates_parcel_spatial_index()
{
    await using var database = await PostgisDatabase.StartAsync();
    await FgpMigrator.ApplyAsync(database.ConnectionString);

    Assert.True(await database.ExtensionExistsAsync("postgis"));
    Assert.True(await database.IndexExistsAsync("parcels_boundary_idx"));
}
```

- [ ] **Step 2: Run the focused test against the real PostGIS test container.**

Run: `dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj --filter FullyQualifiedName~SchemaMigrationTests`

Expected: failure before the context and first migration exist.

- [ ] **Step 3: Implement entities and migration.** Translate `supabase/migrations/0001_initial.sql` through `0005_spatial_sample_data.sql` to EF entities and migration SQL where EF cannot express extensions, generated values, GIST indexes, or geography types. Configure `UseNpgsql(..., o => o.UseNetTopologySuite())`; call `migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS postgis")` in the first migration. Do not copy `auth.uid()` policies.

- [ ] **Step 4: Add the source classifier.** Make `scripts/migration/classify-source.sh` require `SOURCE_DATABASE_URL`, query only aggregate counts and linkage/null statistics, and write `artifacts/source-classification.json`. Exit non-zero unless called with `--acknowledge-read-only`.

- [ ] **Step 5: Re-run migration tests and the classifier against a disposable local database.**

Expected: PostGIS migration test passes; classifier produces only aggregate metadata.

- [ ] **Step 6: Commit.**

```bash
git add apps/api scripts/migration infra/docker-compose.yml
git commit -m "feat: add portable postgis schema migrations"
```

### Task 3: Implement Identity, organisations, and policy enforcement

**Files:**
- Create: `apps/api/src/FGP.Api/Identity/ApplicationUser.cs`
- Create: `apps/api/src/FGP.Api/Organizations/Organization.cs`
- Create: `apps/api/src/FGP.Api/Organizations/Membership.cs`
- Create: `apps/api/src/FGP.Api/Identity/AuthorizationPolicies.cs`
- Create: `apps/api/src/FGP.Api/Identity/AuthEndpoints.cs`
- Create: `apps/api/src/FGP.Api/Organizations/OrganizationEndpoints.cs`
- Create: `apps/api/tests/FGP.Api.Tests/AuthorizationPolicyTests.cs`
- Create: `apps/api/tests/FGP.Api.Tests/OrganizationIsolationTests.cs`

**Interfaces:**
- Produces cookie-authenticated `POST /api/auth/register`, `/sign-in`, `/sign-out`, and organisation membership endpoints.
- Produces `RequireCapability(string capability)` for `ManageTeam`, `EditTariffs`, `RecordContribution`, `CoSignFinancial`, `CoSignOperational`, `ProposeFundGoal`, and `ProposeCorrection`.

- [ ] **Step 1: Write failing authorisation tests.**

```csharp
[Theory]
[InlineData(Role.Owner, Capabilities.CoSignFinancial, HttpStatusCode.OK)]
[InlineData(Role.Chairperson, Capabilities.CoSignFinancial, HttpStatusCode.OK)]
[InlineData(Role.Treasurer, Capabilities.CoSignFinancial, HttpStatusCode.Forbidden)]
[InlineData(Role.Analyst, Capabilities.CoSignFinancial, HttpStatusCode.Forbidden)]
public async Task Capability_policy_is_role_scoped(Role role, string capability, HttpStatusCode expected) { /* arrange, act, assert */ }
```

- [ ] **Step 2: Run those tests.**

Run: `dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj --filter FullyQualifiedName~AuthorizationPolicyTests`

Expected: failure before capability policies and memberships are implemented.

- [ ] **Step 3: Implement ASP.NET Identity and memberships.** Use `ApplicationUser : IdentityUser<Guid>` and a unique `(organization_id, user_id)` membership. Create the Founder as Owner during organisation creation. Enforce exactly one active Owner and at most one active Chairperson transactionally; require ownership transfer before Owner demotion/removal. Derive current organisation and role claims server-side from the authenticated membership.

- [ ] **Step 4: Add authenticated integration tests for cross-organisation reads and writes.** A user in organisation A must receive `404` for A-scoped resources requested with an ID belonging to organisation B, not a tenant-existence leak.

- [ ] **Step 5: Run the focused tests and full API suite.**

Run: `dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj`

Expected: all identity, policy, and isolation tests pass.

- [ ] **Step 6: Commit.**

```bash
git add apps/api
git commit -m "feat: add organisation identity and policies"
```

### Task 4: Move the web transport to the same-origin API proxy

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/lib/parcel.ts`
- Modify: `apps/web/lib/feasibility-store.ts`
- Create: `apps/web/lib/api-client.ts`
- Create: `apps/web/lib/api-client.test.ts`
- Modify: `apps/web/package.json`
- Delete: `apps/web/lib/supabase.ts`
- Delete: `apps/web/lib/supabase-server.ts`

**Interfaces:**
- Produces a browser client that calls only relative `/api/...` URLs with cookies included by the browser.
- Consumes API errors in `{ code, message, traceId }` shape and does not access `DATABASE_URL` or Supabase variables.

- [ ] **Step 1: Write failing client tests.**

```ts
it("uses a relative API route and preserves credentials", async () => {
  await apiClient.get("/api/projects");
  expect(fetch).toHaveBeenCalledWith("/api/projects", expect.objectContaining({ credentials: "include" }));
});
```

- [ ] **Step 2: Run the test.**

Run: `pnpm --filter web test -- api-client.test.ts`

Expected: failure because the shared API client does not exist.

- [ ] **Step 3: Add the rewrite, client, and test runner.** Add `vitest` and a `test` script to `apps/web/package.json`. In `next.config.ts`, rewrite `/api/:path*` to `${API_INTERNAL_ORIGIN}/api/:path*`; keep each legacy Next route only until its corresponding API endpoint passes Task 5–7 contract tests. Centralise fetch/error parsing in `lib/api-client.ts`; remove unused Supabase libraries and dependencies only after no imports remain.

- [ ] **Step 4: Run the focused test, web typecheck, and build.**

Run: `pnpm --filter web test -- api-client.test.ts && pnpm --filter web typecheck && pnpm --filter web build`

Expected: all commands pass and no Supabase import remains under `apps/web`.

- [ ] **Step 5: Commit.**

```bash
git add apps/web
git commit -m "feat: route web requests through api gateway"
```

### Task 5: Preserve parcel and feasibility behaviour through the private worker gateway

**Files:**
- Create: `apps/api/src/FGP.Api/Spatial/WorkerClient.cs`
- Create: `apps/api/src/FGP.Api/Spatial/ParcelEndpoints.cs`
- Create: `apps/api/src/FGP.Api/Feasibility/FeasibilityEndpoints.cs`
- Create: `apps/api/src/FGP.Api/Feasibility/FeasibilityRepository.cs`
- Create: `apps/api/tests/FGP.Api.Tests/ParcelContractTests.cs`
- Create: `apps/api/tests/FGP.Api.Tests/FeasibilityContractTests.cs`
- Modify: `apps/web/app/api/parcel/route.ts`
- Modify: `apps/web/app/api/feasibility/route.ts`
- Modify: `apps/web/app/api/feasibility/save/route.ts`

**Interfaces:**
- Produces authenticated `POST /api/parcel`, `POST /api/feasibility`, and `POST /api/feasibility/save` with the current JSON request/response shapes.
- Consumes only private worker URLs `/analyze/parcel` and `/analyze/feasibility`; maps worker timeouts/unavailability to stable `503` API errors.

- [ ] **Step 1: Capture current contracts in tests.** Use the current TypeScript route fixtures and worker tests to assert response property names, Gauteng coordinate validation, `429` rate-limit mapping, unavailable-worker `503`, and feasibility numerical results.

- [ ] **Step 2: Run contract tests against the unimplemented API endpoints.**

Run: `dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj --filter "FullyQualifiedName~ParcelContractTests|FullyQualifiedName~FeasibilityContractTests"`

Expected: `404`/missing endpoint failures.

- [ ] **Step 3: Implement typed `HttpClient` gateway and endpoints.** Use a per-request cancellation token with an eight-second worker timeout, preserve worker validation boundaries, attach organisation context before saving reports, and record timings for API and worker segments. Return `202 Accepted` only for future asynchronous documents/scrapes, never for parcel/feasibility.

- [ ] **Step 4: Switch these three web calls to the API and delete their legacy handlers only after parity passes.** Keep their request paths unchanged so page components require no route rewrite.

- [ ] **Step 5: Run API contracts, existing worker tests, and web build.**

Run: `dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj && (cd apps/worker && uv run pytest) && pnpm --filter web build`

Expected: all suites pass; measured parcel/feasibility test requests complete inside ten seconds.

- [ ] **Step 6: Commit.**

```bash
git add apps/api apps/web
git commit -m "feat: proxy parcel and feasibility through .net api"
```

### Task 6: Migrate projects, check-ins, and tariffs one bounded route group at a time

**Files:**
- Create: `apps/api/src/FGP.Api/Projects/ProjectEndpoints.cs`
- Create: `apps/api/src/FGP.Api/Projects/CheckInEndpoints.cs`
- Create: `apps/api/src/FGP.Api/Tariffs/TariffEndpoints.cs`
- Create: `apps/api/tests/FGP.Api.Tests/ProjectEndpointTests.cs`
- Create: `apps/api/tests/FGP.Api.Tests/CheckInEndpointTests.cs`
- Create: `apps/api/tests/FGP.Api.Tests/TariffEndpointTests.cs`
- Delete: `apps/web/app/api/projects/route.ts`
- Delete: `apps/web/app/api/projects/[id]/route.ts`
- Delete: `apps/web/app/api/projects/[id]/checkins/route.ts`
- Delete: `apps/web/app/api/tariffs/route.ts`

**Interfaces:**
- Produces organisation-scoped replacements for every deleted route with compatible pagination and response fields.
- Requires `EditTariffs` for tariff writes, `RecordContribution` only for contribution-related commands, and role-appropriate project permissions for project mutations.

- [ ] **Step 1: Write failing endpoint tests for each route group.** Include pagination bounds (`limit` 1–200), project not-found versus cross-organisation non-disclosure, check-in creation, tariff read, and forbidden tariff update by Viewer/Analyst.

- [ ] **Step 2: Run tests and observe missing endpoint failures.**

Run: `dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj --filter "FullyQualifiedName~ProjectEndpointTests|FullyQualifiedName~CheckInEndpointTests|FullyQualifiedName~TariffEndpointTests"`

Expected: failures before route groups are mapped.

- [ ] **Step 3: Implement and migrate one group at a time.** Complete projects first, then check-ins, then tariffs. For each group: map a protected route group; add `organization_id` predicates to every query and command; run its test class; point the page data client to `/api/...`; then delete only that group’s Next handler.

- [ ] **Step 4: Run regression verification.**

Run: `dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj && pnpm --filter web typecheck && pnpm --filter web build`

Expected: existing project screens build and all route-contract tests pass.

- [ ] **Step 5: Commit each group separately.**

```bash
git add apps/api apps/web && git commit -m "feat: migrate project api routes"
git add apps/api apps/web && git commit -m "feat: migrate checkin api route"
git add apps/api apps/web && git commit -m "feat: migrate tariff api routes"
```

### Task 7: Build Capital Fund governance as a new, independently tested module

**Files:**
- Create: `apps/api/src/FGP.Api/CapitalFund/Contribution.cs`
- Create: `apps/api/src/FGP.Api/CapitalFund/CorrectionProposal.cs`
- Create: `apps/api/src/FGP.Api/CapitalFund/FundGoalProposal.cs`
- Create: `apps/api/src/FGP.Api/CapitalFund/GovernanceAuditEvent.cs`
- Create: `apps/api/src/FGP.Api/CapitalFund/CapitalFundEndpoints.cs`
- Create: `apps/api/src/FGP.Api/CapitalFund/GovernanceService.cs`
- Create: `apps/api/tests/FGP.Api.Tests/FinancialCorrectionGovernanceTests.cs`
- Create: `apps/api/tests/FGP.Api.Tests/FundGoalGovernanceTests.cs`

**Interfaces:**
- Produces `POST /api/capital-fund/corrections`, correction approval endpoints, fund-goal submission/approval/withdrawal endpoints, and immutable audit records.
- Produces `GovernanceService.ProposeCorrectionAsync`, `ApproveCorrectionAsync`, `ProposeFundGoalAsync`, `ApproveFundGoalAsync`, `VoidOpenGoalsForMembershipChangeAsync`, and `WithdrawFundGoalAsync`.

- [ ] **Step 1: Write the failing correction matrix tests.** Cover Owner/Chairperson/Treasurer proposer cases, Owner/Chairperson subjects, exclusion of proposer and subject, no Treasurer/Analyst approval, missing-governor precondition, and zero eligible approvers conflict response.

```csharp
[Fact]
public async Task Treasurer_proposed_correction_requires_an_owner_or_chairperson_who_is_not_the_subject()
{
    var proposal = await Fixture.ProposeCorrectionAsync(Role.Treasurer, subject: Fixture.Analyst);
    await Fixture.ApproveAsync(proposal, Role.Analyst).ShouldBeForbiddenAsync();
    await Fixture.ApproveAsync(proposal, Role.Chairperson).ShouldBeAcceptedAsync();
}
```

- [ ] **Step 2: Write failing fund-goal tests.** Assert each Owner, Chairperson, and Treasurer submission creates exactly one immutable `AssentBySubmission` record; a proposal applies only at N records for the submission snapshot; membership/role changes terminally void all open goals and link audit events; withdrawal leaves approvals untouched.

- [ ] **Step 3: Run the two focused test classes.**

Run: `dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj --filter "FullyQualifiedName~FinancialCorrectionGovernanceTests|FullyQualifiedName~FundGoalGovernanceTests"`

Expected: failures before entity, policy, and service implementation exists.

- [ ] **Step 4: Implement immutable proposal and audit persistence.** Use append-only approval/audit tables; prohibit update/delete operations in application commands. Make contribution corrections write a new corrected-record version and audit link rather than mutating the old financial fact in place. In the same transaction, snapshot active non-Viewer membership on fund-goal submission and create the proposer’s `AssentBySubmission` record.

- [ ] **Step 5: Connect membership changes to governance invalidation.** Every create/remove/deactivate/role-change command calls `VoidOpenGoalsForMembershipChangeAsync` in its transaction and records the membership event ID on each void audit event.

- [ ] **Step 6: Run focused tests and full API suite.**

Run: `dotnet test apps/api/tests/FGP.Api.Tests/FGP.Api.Tests.csproj`

Expected: every adversarial governance matrix case passes with stable error codes.

- [ ] **Step 7: Commit.**

```bash
git add apps/api
git commit -m "feat: add capital fund governance"
```

### Task 8: Finalise deterministic data handling, Supabase removal, and CI gate

**Files:**
- Create: `scripts/migration/import-approved-source.sh`
- Create: `scripts/migration/seed-demo-data.sh`
- Create: `scripts/migration/verify-import.sh`
- Create: `.github/workflows/verify.yml`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Delete: `supabase/config.toml`
- Delete: `supabase/migrations/0001_initial.sql`
- Delete: `supabase/migrations/0002_projects_extended.sql`
- Delete: `supabase/migrations/0003_tariffs.sql`
- Delete: `supabase/migrations/0004_checkin_deposits.sql`
- Delete: `supabase/migrations/0005_spatial_sample_data.sql`
- Delete: `packages/database/client.ts`
- Delete: `packages/database/index.ts`
- Delete: `packages/database/schema.ts`
- Delete: `packages/database/package.json`

**Interfaces:**
- Produces source-specific import manifests and verification reports; import fails unless an approved source classification file is supplied.
- Produces CI jobs for web lint/typecheck/build, API test, worker test, EF migration test, and no-Supabase dependency scan.

- [ ] **Step 1: Write failing import-verification and dependency-scan tests.** The import verifier must fail on mismatched counts/foreign keys/spatial fixtures, and CI scan must fail if `@supabase/`, `supabase/`, `SUPABASE_`, or `auth.uid()` remains in runtime code.

- [ ] **Step 2: Run them before removal.**

Run: `scripts/migration/verify-import.sh artifacts/source-classification.json && rg -n "@supabase/|SUPABASE_|auth\.uid\(\)" apps packages supabase`

Expected: verification/scans fail before the approved import path and cleanup are complete.

- [ ] **Step 3: Implement the mutually exclusive data paths.** `import-approved-source.sh` requires `--classification production` and an approved mapping manifest; it exports/imports only after confirmation and writes counts/checksums. `seed-demo-data.sh` requires `--classification demo`, uses deterministic data, and never connects to a production URL. Do not execute either path until the owner classifies the source snapshot.

- [ ] **Step 4: Remove Supabase and Drizzle only after every route group and verification report passes.** Remove package dependencies, CLI documentation, runtime environment variables, and migrations; preserve no compatibility fallback. Replace README with .NET API, PostGIS, worker, test, backup-restore, and local mail-sink instructions.

- [ ] **Step 5: Add and exercise CI locally.** Use `act` only if already available; otherwise run the exact commands from the workflow locally. Required commands are `pnpm lint`, `pnpm typecheck`, `pnpm build`, `dotnet test`, `(cd apps/worker && uv run pytest)`, and a clean PostGIS migration test.

- [ ] **Step 6: Perform final no-Supabase and rollback verification.** Confirm no Supabase runtime/config/dependency remains, restore a disposable database from the timestamped export, switch one route mapping back to the retained legacy implementation in a test environment, and verify the old route still serves the pre-cutover contract.

- [ ] **Step 7: Commit.**

```bash
git add -A
git commit -m "feat: complete supabase migration"
```

## Plan self-review

- **Spec coverage:** Tasks 1–3 implement platform identity, tenancy, and schema ownership; Tasks 4–6 migrate every existing public route; Task 7 implements the new Capital Fund governance module; Task 8 enforces source classification, removal, rollback evidence, CI, and documentation. Python worker preservation, 10-second timing, Redis ownership, and no-deployment boundaries are global constraints and verified in Tasks 1, 5, and 8.
- **Deliberate gates:** The plan contains no command that imports current Supabase data, provisions Azure, deploys containers, or configures a production email/object-store provider. Source classification and deployment approval remain external gates.
- **Consistency:** `AssentBySubmission` is limited to fund goals; correction approval requires a distinct eligible Owner/Chairperson. The Chairperson can submit fund goals and corrections, but cannot self-approve a correction.
