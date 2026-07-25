# Supabase-to-.NET Migration

- [x] Establish the .NET API foundation, local Mailpit service, and health test.
- [x] Port the portable PostgreSQL/PostGIS schema and add migration verification; the read-only classifier is implemented but has not inspected any source database.
- [ ] Implement Identity, organisations, roles, and policy enforcement.
- [ ] Add the authenticated web user journey and same-origin API transport.
- [ ] Migrate parcel, feasibility, projects, check-ins, and tariffs route groups.
- [ ] Implement Capital Fund contributions and governance rules.
- [ ] Classify source data before choosing either approved import or deterministic demo seeding.
- [ ] Remove Supabase/Drizzle only after every route group passes parity and CI gates.

## Non-negotiable gates

- No Azure provisioning or deployment without separate approval.
- No source-data import or classification without separate approval.
- A financial correction requires eligible Owner/Chairperson maker-checker approval.
- A fund-goal submission creates its proposer’s immutable assent record.
