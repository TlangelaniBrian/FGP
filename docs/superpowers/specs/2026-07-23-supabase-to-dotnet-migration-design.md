# FGP Supabase-to-.NET Migration Design

**Status:** Approved design; implementation and any cloud deployment require separate approval.

## Goal

Replace every Supabase dependency in First Generation Properties with a C#/.NET backend and portable PostgreSQL/PostGIS platform, while preserving the existing product behaviour and introducing the approved multi-user governance model.

## Non-goals

- Provisioning Azure resources or deploying any service.
- Operating Kubernetes at launch.
- Implementing social sign-in, billing, teams beyond the existing investment-club organisation model, or notifications beyond the current product scope.
- Rewriting the Python spatial/calculation worker before parity is proved.

## Current-state findings

- The Next.js application owns public route handlers for parcel analysis, feasibility, tariff administration, projects, check-ins, and feasibility persistence.
- Drizzle currently connects those handlers directly to PostgreSQL. FastAPI owns spatial lookup and feasibility calculation.
- Supabase client packages and configuration remain in the repository, but the UI has no working authentication flow.
- Existing migrations use Supabase `auth.uid()` row-level-security policies for project-related records. Those policies must not silently disappear when Supabase is removed.
- The product design defines five roles: Owner, Chairperson, Treasurer, Analyst, and Viewer.

## Architecture

```text
Next.js web application
        |
        | HTTPS, secure cookie session
        v
ASP.NET Core API (.NET 10 LTS)
  |- Identity and organisation authorisation
  |- Projects, capital fund, tariffs, reports, and listings
  |- PostgreSQL/PostGIS migrations and data access
  `- Private spatial gateway
              |
              v
       FastAPI worker (temporary)
       parcel analysis and feasibility calculation

ASP.NET Core API <--> PostgreSQL + PostGIS
ASP.NET Core API <--> Redis, when background work requires it
```

The Next.js application is a presentation client only. It does not access PostgreSQL directly and it contains no Supabase client or credentials. ASP.NET Core is the sole public backend and authorisation boundary. The FastAPI worker remains private and replaceable until .NET equivalents demonstrate equivalent behaviour.

## Backend design

Create an ASP.NET Core Web API targeting .NET 10 LTS, organised as a modular monolith:

- `Identity`: account registration, verified email, sign-in, sign-out, and password recovery.
- `Organizations`: organisation creation, invitations, active memberships, and role assignment.
- `Projects`: projects, budgets, contacts, decisions, milestones, and check-ins.
- `CapitalFund`: contributions, correction proposals, fund-goal proposals, and approvals.
- `Tariffs`: tariff retrieval and role-protected updates.
- `Feasibility`: report persistence and the existing feasibility API contract.
- `SpatialGateway`: private HTTP integration with the temporary Python worker.

Use EF Core with Npgsql and NetTopologySuite for PostgreSQL/PostGIS access. Database schema changes are EF Core migrations stored with the API. PostGIS extensions, spatial types, indexes, and GIS ingestion remain standard PostgreSQL/PostGIS features, not Supabase features.

## Identity, tenancy, and authorisation

Use ASP.NET Core Identity with verified email/password accounts and secure HTTP-only, `Secure`, same-site cookies. Do not place reusable bearer tokens in browser local storage.

Users are members of organisations. Role is stored per membership rather than globally, so one person may have different responsibilities in different investment groups. Every tenant-owned record includes an `organization_id`; all protected reads and writes derive that organisation from the signed-in membership rather than accepting it from a browser request.

The approved roles and capabilities are:

| Role | Allowed capabilities |
|---|---|
| Owner | All capabilities, including team management and governance proposals. |
| Chairperson | Team management, contribution recording, project/tariff/settings edits, and co-signing. |
| Treasurer | Contribution recording, project/tariff/settings edits, co-signing, and fund-goal/correction proposals. |
| Analyst | Contribution recording, project/settings edits, and co-signing. |
| Viewer | Read-only access. |

The API uses named authorisation policies such as `ManageTeam`, `EditTariffs`, `RecordContribution`, `CoSign`, `ProposeFundGoal`, and `ProposeCorrection`. UI capability checks mirror those policies but are never the security control.

For maker-checker governance, a proposer cannot approve their own proposal. Each approval is an immutable record tied to an active membership. Goal changes apply only when every active, non-Viewer member has provided a distinct approval. Corrections apply only after the required distinct governing approval is recorded.

## Data migration and cutover

1. Add Identity, organisations, memberships, and role values through EF migrations.
2. Port every FGP table from `supabase/migrations` to standard PostgreSQL/PostGIS EF migrations.
3. Add `organization_id` to tenant-owned records, preserving foreign keys, timestamps, numeric values, and spatial data.
4. Export real legacy data from Supabase and import it through a repeatable migration command. No records are fabricated, dropped, or assigned silently.
5. Match legacy `user_id` values to new accounts where possible. Report unmatched records and assign them only through an explicit reviewed migration-owner mapping.
6. Validate row counts, primary and foreign keys, spatial query results, financial results, and authorisation outcomes before cutover.
7. Change Next.js to call the C# API. Remove the Drizzle database package, Supabase packages, Supabase configuration, environment variables, CLI instructions, and migrations only after parity passes.

A timestamped source database export is retained as rollback evidence. The implementation plan defines the exact validation reports and cutover gate.

## Local development and verification

Local Docker Compose runs the web app, .NET API, PostgreSQL/PostGIS, Redis, and the temporary worker. Each service has a health endpoint, uses environment-based configuration, and is containerised without cloud assumptions.

The migration must add automated coverage for:

- role permissions and cross-organisation isolation;
- maker-checker and unanimous-goal rules;
- malformed request and error-response contracts;
- EF migration execution against a real PostGIS container;
- calculation and parcel-analysis parity with the current worker tests;
- end-to-end registration, invitation, role enforcement, tariffs, projects, and check-ins.

## Deployment boundary

No Azure resources, deployment pipelines, cloud credentials, or hosted data stores are created as part of this migration design or implementation plan. When the local migration is complete and separately approved for release, the intended managed target is Azure Container Apps, Azure Database for PostgreSQL with PostGIS, Blob Storage, and Azure Container Registry. Kubernetes remains a later scaling decision.

## Acceptance criteria

The migration is complete only when:

1. No Supabase configuration, package, runtime dependency, or hosted service is needed to run the application.
2. The Next.js client calls only the C# API for protected application data.
3. ASP.NET Core owns authentication, the five-role organisation authorisation model, persistence, and public API contracts.
4. PostgreSQL/PostGIS schema and data are managed by portable .NET migrations and a verified import path.
5. Existing parcel and feasibility behaviour is preserved and tested.
6. All role, governance, data-isolation, and migration verification tests pass locally.
7. No cloud deployment occurs without a new explicit approval.
