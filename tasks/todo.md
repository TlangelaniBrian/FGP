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
- [ ] Port the portal schema added by Supabase migrations 0006–0018 before removing the hosted database.
- [ ] Implement Identity, organisations, roles, and policy enforcement.
- [ ] Add the authenticated web user journey and same-origin API transport.
- [ ] Migrate every legacy route group: parcel/feasibility, projects/check-ins/tariffs, listings, documents, scraper jobs, settings/team/activity, session/auth, and Capital Fund.
- [ ] Implement Capital Fund contributions and governance rules.
- [ ] Classify source data before choosing either approved import or deterministic demo seeding.
- [ ] Remove Supabase/Drizzle only after every route group passes parity and CI gates.

## Gates

- No source-data classification/import or cloud deployment without separate approval.
- Financial corrections require Owner/Chairperson maker-checker approval.
- Fund-goal submission creates the proposer’s immutable assent record.
