# FGP Supabase-to-.NET Migration Design

**Version:** 0.4

**Status:** Approved design. Cloud deployment requires separate approval.

## Goal

Replace every Supabase dependency in First Generation Properties with a C#/.NET backend and portable PostgreSQL/PostGIS platform, while preserving the existing product behaviour and introducing the approved multi-user governance model.

## Non-goals

- Provisioning Azure resources or deploying any service.
- Operating Kubernetes at launch.
- Implementing social sign-in, billing, teams beyond the existing investment-club organisation model, or notifications beyond the current product scope.
- Rewriting the Python processing worker as part of this migration.

## Current-state findings

- The Next.js application owns public route handlers for parcel analysis, feasibility, tariff administration, projects, check-ins, and feasibility persistence.
- Drizzle currently connects those handlers directly to PostgreSQL. FastAPI owns spatial lookup and feasibility calculation.
- Supabase client packages and configuration remain in the repository, but the UI has no working authentication flow.
- Existing migrations contain Supabase `auth.uid()` row-level-security policies for project-related records, but the current direct database route handlers do not establish Supabase authentication and therefore do not enforce them. The .NET authorisation model deliberately supersedes these dead policies with authenticated, organisation-scoped access checks.
- The product design defines five roles: Owner, Chairperson, Treasurer, Analyst, and Viewer.

## Architecture

```text
Next.js web application
        |
        | HTTPS, secure cookie session
        v
ASP.NET Core API (.NET 10 LTS)
  |- Identity and organisation authorisation
  |- Projects, capital fund, tariffs, and reports
  |- PostgreSQL/PostGIS migrations and data access
  `- Private spatial gateway
              |
              v
       FastAPI processing worker
       spatial analysis, feasibility, PDFs, and scrapers

ASP.NET Core API <--> PostgreSQL + PostGIS
ASP.NET Core API <--> Redis, for worker job coordination only
```

The Next.js application is a presentation client only. It does not access PostgreSQL directly and it contains no Supabase client or credentials. It reaches ASP.NET through a same-origin `/api` reverse proxy, avoiding cross-origin cookie and CSRF behaviour. ASP.NET Core is the sole public backend and authorisation boundary.

.NET is chosen for the public backend because it is the product owner's preferred long-term platform and provides one supported home for identity, organisation authorisation, persistence, and the public API. Python remains a long-lived, private specialist worker: the existing geospatial, PDF, browser-automation, and queue toolchain is Python-native. Replacing an individual worker function with .NET is a future, separately approved decision that requires contract, correctness, performance, and operational-parity evidence; it is not a migration completion condition.

## Backend design

Create an ASP.NET Core Web API targeting .NET 10 LTS, organised as a modular monolith:

- `Identity`: account registration, verified email, sign-in, sign-out, and password recovery.
- `Organizations`: organisation creation, invitations, active memberships, and role assignment.
- `Projects`: projects, budgets, contacts, decisions, milestones, and check-ins.
- `CapitalFund`: contributions, correction proposals, fund-goal proposals, and approvals.
- `Tariffs`: tariff retrieval and role-protected updates.
- `Feasibility`: report persistence and the existing feasibility API contract.
- `SpatialGateway`: private HTTP integration with the Python processing worker.

Use EF Core with Npgsql and NetTopologySuite for PostgreSQL/PostGIS access. Database schema changes are EF Core migrations stored with the API. PostGIS extensions, spatial types, indexes, and GIS ingestion remain standard PostgreSQL/PostGIS features, not Supabase features.

## Identity, tenancy, and authorisation

Use ASP.NET Core Identity with verified email/password accounts and secure HTTP-only, `Secure`, same-site cookies. Do not place reusable bearer tokens in browser local storage.

Users are members of organisations. Role is stored per membership rather than globally, so one person may have different responsibilities in different investment groups. Every tenant-owned record includes an `organization_id`; all protected reads and writes derive that organisation from the signed-in membership rather than accepting it from a browser request.

The approved roles and capabilities are:

| Role | Allowed capabilities |
|---|---|
| Owner | All capabilities, including team management, governance proposals, financial-correction approval, and operational co-signing. |
| Chairperson | Team management, contribution recording, project/tariff/settings edits, financial-correction and fund-goal proposals, financial-correction approval, and operational co-signing. |
| Treasurer | Contribution recording, project/tariff/settings edits, operational co-signing, and fund-goal/correction proposals. Treasurer never approves financial corrections. |
| Analyst | Contribution recording, project/settings edits, and operational co-signing. Analyst never approves financial corrections. |
| Viewer | Read-only access. |

The API uses named authorisation policies such as `ManageTeam`, `EditTariffs`, `RecordContribution`, `CoSignFinancial`, `CoSignOperational`, `ProposeFundGoal`, and `ProposeCorrection`. `CoSignFinancial` is available only to Owner and Chairperson; `CoSignOperational` is available to Owner, Chairperson, Treasurer, and Analyst. UI capability checks mirror those policies but are never the security control.

An organisation has exactly one active Owner and at most one active Chairperson. The API requires an ownership transfer before removing or changing the current Owner's membership or role, and it prevents a second Chairperson assignment. This cardinality makes Owner/Chairperson cross-approval unambiguous.

Financial corrections use maker-checker governance: a proposer cannot approve their own correction. A correction is proposable only when the organisation has an active Owner and an active Chairperson before conflict exclusions; otherwise the API instructs the organisation to appoint the missing governing role. For an individual correction, at least one eligible financial approver must remain after excluding both the proposer and the member whose contribution is being corrected. If no approver remains, the API rejects the correction with a conflict-of-interest message rather than the missing-governor message.

A contribution correction rewrites a financial record and therefore requires `CoSignFinancial`, not `CoSignOperational`. An Owner-proposed correction requires an eligible Chairperson approval; a Chairperson-proposed correction requires an eligible Owner approval. A correction submission never creates an approval record. Treasurer or Analyst approval never satisfies a correction. Each correction, approval, rejection, and terminal transition is immutable and auditable.

Fund-goal proposals use unanimous-assent governance, not maker-checker: Owner, Chairperson, and Treasurer may submit them. Submission semantics are identical for every proposer: submission creates the proposer's immutable `AssentBySubmission` approval record, distinct from an independent review approval. A proposal applies only when every active, non-Viewer member in the membership snapshot created at submission has an immutable approval record. Any membership creation, removal, deactivation, or role change voids every open fund-goal proposal in the organisation; a new proposal must be submitted against the resulting membership set. The membership-change audit event and every proposal it voids are linked in the immutable audit trail. Withdrawal is a terminal proposal state and never deletes or alters its underlying approval records.

## Data migration and cutover

1. Add Identity, organisations, memberships, and role values through EF migrations.
2. Port every FGP table from `supabase/migrations` to standard PostgreSQL/PostGIS EF migrations.
3. Add `organization_id` to tenant-owned records, preserving foreign keys, timestamps, numeric values, and spatial data.
4. Classify the source database as production data or development/demo data before an import is approved. The current local snapshot contains user and tenant-linked records as well as sample spatial data, so it must not be assumed empty or production solely from repository history.
5. If the classified source contains data to preserve, export it and import it through a repeatable migration command. No records are fabricated, dropped, or assigned silently. If it is approved as demo-only, replace it with documented deterministic seed data instead.
6. Match legacy `user_id` values to new accounts where possible. Report unmatched records and assign them only through an explicit reviewed migration-owner mapping.
7. Validate row counts, primary and foreign keys, spatial query results, financial results, and authorisation outcomes before cutover.
8. Move routes one bounded module at a time behind the same Next.js `/api` proxy. The old handler and its validated database snapshot remain available until its replacement passes its module gate; rollback restores that route mapping and its source snapshot, not merely a backup file.
9. Remove the Drizzle database package, Supabase packages, Supabase configuration, environment variables, CLI instructions, and migrations only after every module passes parity and the legacy route set has been retired.

Each migration module has explicit entry, validation, and rollback conditions. A timestamped source export is evidence for a data restore, not the rollback procedure itself.

## Local development and verification

Local Docker Compose runs the web app, .NET API, PostgreSQL/PostGIS, Redis, and the Python worker. Each service has a health endpoint, uses environment-based configuration, and is containerised without cloud assumptions. The API owns public job records and authorisation; the worker owns execution of its queued scraper, PDF, and spatial jobs; Redis is an implementation detail of that queue, never a source of financial or tenancy truth.

Interactive parcel and feasibility requests have a 10-second end-to-end budget. The implementation plan must instrument the web, API, and worker segments, set a module-level target that leaves at least one second for response rendering, and return an authorised asynchronous job for document generation or scraping rather than holding an HTTP request open beyond that budget.

The migration must add automated coverage for:

- role permissions and cross-organisation isolation;
- maker-checker, financial-correction conflict exclusions, minimum-governance, fund-goal assent-by-submission, membership-change invalidation, withdrawal, and unanimous-goal rules;
- malformed request and error-response contracts;
- EF migration execution against a real PostGIS container;
- calculation and parcel-analysis parity with the current worker tests;
- end-to-end registration, invitation, role enforcement, tariffs, projects, and check-ins.

The same suite runs locally and as a required CI pull-request gate; a developer's local pass alone does not meet acceptance.

## Accepted risks and deferred decisions

- **Email delivery:** local development uses a non-delivering mail sink. A production email sender for verification and password recovery is a release prerequisite, selected and provisioned only under the separate deployment approval.
- **Object storage and PDFs:** the existing PDF fields remain portable database metadata. Generated packages are a worker responsibility behind an object-storage interface; local development uses a compatible local store, while Azure Blob configuration is deferred to deployment approval.
- **Backups and recovery:** local migration verification includes a tested PostgreSQL backup-and-restore procedure. Managed backup retention, off-site copies, recovery-point, and recovery-time objectives are release decisions and cannot be claimed complete in this no-deployment phase.
- **Schema ownership:** EF Core migrations are the sole production DDL authority, including PostGIS extensions, indexes, and SQL required for spatial features. GIS ingestion is versioned data-import tooling and never creates or mutates schema outside those migrations.
- **New product scope:** Capital Fund governance is new functionality, not parity with an existing public route. It is separately acceptance-tested after the base identity, tenancy, and existing-route migration path is working.
- **Solo-governor correction limit:** an organisation without an active Chairperson cannot correct a financial record. This is intentional segregation of duties, not a degraded Treasurer/Analyst fallback; appointing a Chairperson is the resolution.
- **Source-data disposition:** whether the current Supabase snapshot is production data to preserve or development/demo data remains an explicit owner decision. Until it is classified, no import or destructive cutover is approved.

## Deployment boundary

No Azure resources, deployment pipelines, cloud credentials, or hosted data stores are created as part of this migration design or implementation plan. When the local migration is complete and separately approved for release, the intended managed target is Azure Container Apps, Azure Database for PostgreSQL with PostGIS, Blob Storage, and Azure Container Registry. Kubernetes remains a later scaling decision.

## Acceptance criteria

The migration is complete only when:

1. No Supabase configuration, package, runtime dependency, or hosted service is needed to run the application.
2. The Next.js client calls only the C# API for protected application data.
3. ASP.NET Core owns authentication, the five-role organisation authorisation model, persistence, and public API contracts.
4. PostgreSQL/PostGIS schema and data are managed by portable .NET migrations and a verified import path.
5. Existing parcel and feasibility behaviour is preserved and tested.
6. All role, governance, data-isolation, and migration verification tests pass both locally and in the required CI pull-request gate.
7. No cloud deployment occurs without a new explicit approval.
