# Portal Identity and Authorization Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Follow TDD for every behavior change.

**Goal:** Make the role displayed and enforced by the portal derive from the authenticated active team membership, close Viewer mutation gaps, and make protected project rendering host-safe.

**Architecture:** Resolve the current actor once on the server, serialize it into a small React context in the application shell, and consume that context everywhere the UI gates a capability. Keep handler authorization in `portal-auth.ts`, require active membership, and add integration smoke coverage for non-member, invited, Viewer, and Owner identities.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres, Drizzle ORM, Node smoke tests.

## Global Constraints

- The authenticated Supabase user plus an active `team_members` row is the only authority for name and role.
- Non-members, invited members, suspended members, and removed members receive no workspace access.
- Active Viewers retain read access but no mutation capability in UI or handlers.
- Goal unanimity counts every active non-Viewer member, including Analysts.
- Server-rendered internal requests derive their origin from incoming forwarded/host headers.
- No demo identity or localStorage value may grant or hide a capability.

### Task 1: Identity and authorization contract

**Files:**
- Create: `apps/web/lib/portal-actor.tsx`
- Create: `apps/web/lib/request-origin.ts`
- Create: `apps/web/app/api/session/route.ts`
- Create: `scripts/auth-role-smoke.mjs`
- Modify: `apps/web/lib/portal-auth.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/_components/AppShell.tsx`
- Modify: `apps/web/app/_components/PortalChrome.tsx`
- Modify: `apps/web/app/capital/page.tsx`
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/app/settings/tariffs/page.tsx`
- Modify: `apps/web/app/projects/[id]/_components/ProjectActions.tsx`
- Modify: `apps/web/app/projects/[id]/_components/ProjectDetailEditor.tsx`
- Modify: `apps/web/app/projects/[id]/_components/ThisWeek.tsx`
- Modify: `apps/web/app/scout/[id]/zoning/page.tsx`
- Modify: `apps/web/app/api/listings/[id]/link-parcel/route.ts`
- Modify: `apps/web/app/api/capital/route.ts`
- Modify: `apps/web/app/projects/page.tsx`
- Modify: `apps/web/app/projects/[id]/page.tsx`
- Modify: `package.json`

**Interfaces:**
- `PortalActor = { userId: string; email: string; name: string; initials: string; role: Role }`
- `PortalActorProvider({ actor, children })` provides the server-resolved actor.
- `usePortalActor()` returns `PortalActor | null` and never reads localStorage.
- `GET /api/session` returns the active actor or `401`.
- `getRequestOrigin(headers)` uses `x-forwarded-host`/`host` and `x-forwarded-proto`, with the configured site URL only as a final fallback.

- [ ] Write the failing authenticated role smoke test first. It must prove: non-member denied, invited member denied, active Viewer returned as Viewer and denied parcel linking, active Owner returned as Owner and allowed a safe settings write, and all created records are cleaned up with asserted cleanup responses.
- [ ] Run the new smoke test against the current branch and capture the expected failures.
- [ ] Require `team_members.status = active` in `getAuthenticatedActor`; remove the implicit non-member Viewer fallback.
- [ ] Add the session route and server-provided actor context, then remove every `fgp_user`/static-team role gate from portal components.
- [ ] Hide or disable Viewer mutation controls for Settings, Tariffs, Project actions/details/check-ins, Capital, and Compliance documents.
- [ ] Guard parcel linking with the `record` capability.
- [ ] Count all active non-Viewers in capital goal unanimity.
- [ ] Replace stale configured-origin project self-fetching with `getRequestOrigin(headers())`.
- [ ] Run the authenticated role smoke test and verify it passes.
- [ ] Run `pnpm --filter web typecheck`, `pnpm --filter web lint`, and the existing API workflow smoke tests.
- [ ] Verify in browser that an active Owner shows Owner controls, an active Viewer shows the read-only banner without mutation controls, and project list/detail render on port 3001 while `NEXT_PUBLIC_SITE_URL` differs.
