# Task 1 brief: authenticated identity and authorization contract

Implement Task 1 from `docs/superpowers/plans/2026-07-13-portal-identity-security.md` in this isolated clone. Read that plan first; its exact constraints and interfaces are binding.

Observed reproduction: an authenticated user with an active `team_members` row containing role `Owner` renders as `Viewer` because `PortalChrome` and page-level gates use the static `team` array/localStorage. The same bearer token receives 200 from Owner-only settings writes, proving the UI and API authority disagree.

Additional verified defects:

- Any authenticated non-member currently becomes a Viewer and can read workspace APIs.
- Invited members receive handler privileges before activation.
- `POST /api/listings/:id/link-parcel` lacks a mutation capability guard.
- Goal unanimity excludes Analysts and includes invited members.
- `/projects` and `/projects/:id` prefer `NEXT_PUBLIC_SITE_URL` over the incoming host.

Use TDD: add and run the failing auth-role smoke before production changes. Do not weaken the handler matrix or replace real session validation with headers. Do not implement unrelated visual work.

Report requirements: write `.superpowers/sdd/task-1-report.md` with the RED command/output summary, files changed, GREEN commands/results, commit SHA, self-review, and any concerns. Return `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED` plus the report path.
