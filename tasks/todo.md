# FGP Execution Tracker

## Portal redesign

- [x] Deliver authenticated portal shell, core Scout/Evaluate/Projects/Capital screens, and persisted API workflows.
- [x] Enforce authenticated Viewer and role restrictions across portal mutation routes.
- [ ] Complete Settings/Tariffs controls and five-role browser acceptance.
- [ ] Complete canonical PDF/package storage, private worker boundary, scraper execution, GIS ingestion, and browser regression coverage.
- [ ] Verify the production deployment on its approved public host.

## Supabase-to-.NET migration

- [x] Establish the .NET API foundation, local Mailpit service, and health test.
- [ ] Port the portable PostgreSQL/PostGIS schema and add migration verification.
- [ ] Implement Identity, organisations, roles, authenticated web flow, and route cutover.
- [ ] Implement Capital Fund governance, then remove Supabase/Drizzle only after parity and CI gates pass.

## Gates

- No source-data classification/import or cloud deployment without separate approval.
- Financial corrections require Owner/Chairperson maker-checker approval.
- Fund-goal submission creates the proposer’s immutable assent record.
