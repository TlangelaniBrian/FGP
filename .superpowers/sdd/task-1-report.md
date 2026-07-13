# Task 1 report: authenticated identity and authorization contract

## Status

`DONE_WITH_CONCERNS`

Implementation commit: `e0e3b4855ae0c40664008b73697314b88fc571c7`

## RED evidence

The authenticated role smoke was added before production changes and run against the isolated clone on port 3001:

```text
FGP_SITE_URL=http://127.0.0.1:3001 pnpm test:auth-roles
exit 1
AssertionError: non-member session returned 404: null
404 !== 401
```

This was the expected missing-contract failure: `/api/session` did not exist. The smoke's created auth users and membership records were cleaned up. A preliminary run that lacked `DATABASE_URL` produced an environmental 500 and was discarded before capturing the valid RED result.

## Files changed

- Added the server-resolved actor context in `apps/web/lib/portal-actor.tsx` and the active actor endpoint in `apps/web/app/api/session/route.ts`.
- Hardened `apps/web/lib/portal-auth.ts` so only active `team_members` rows authenticate and no implicit Viewer fallback exists.
- Passed the actor through the root layout/application shell and replaced demo-team/localStorage role gates in Portal Chrome, Capital, Settings, Tariffs, project mutation components, and compliance documents.
- Added the `record` capability guard to parcel linking.
- Changed capital unanimity membership to all active non-Viewer members, including Analysts and excluding invited members.
- Added `apps/web/lib/request-origin.ts` and used incoming forwarded/host headers for project list/detail self-fetches.
- Added `scripts/auth-role-smoke.mjs` and the `test:auth-roles` package script.
- Included the binding plan, task brief, and task tracking update.

## GREEN evidence

```text
FGP_SITE_URL=http://127.0.0.1:3001 pnpm test:auth-roles
exit 0
Authenticated role smoke passed: non-member and invited denied, Viewer read-only, Owner authorized, cleanup asserted.
```

The smoke verifies:

- authenticated non-members receive 401;
- invited members receive 401;
- active Viewers are returned as Viewer and receive 403 from parcel linking;
- active Owners are returned as Owner and can perform an isolated settings write;
- activity events, team rows, the temporary setting, and auth users are deleted with cleanup responses and post-delete assertions.

Additional confirmed checks:

```text
pnpm --filter web typecheck
exit 0: tsc --noEmit

pnpm --filter web lint
exit 0: eslint

git diff --check
exit 0
```

## Existing workflow smoke concern

The first workflow rerun used port 8000, which belonged to an unrelated Martin FastAPI process, and parcel linking returned 502. After starting this clone's worker on port 8001 and pointing the web app at it, the workflow advanced through the identity-sensitive operations but failed at the existing scraper ingest assertion:

```text
pnpm test:api:workflow
exit 1
AssertionError: Expected values to be strictly equal:
'new' !== 'analyzed'
scripts/api-workflow-smoke.mjs:102
```

This is persisted scraper/auto-analysis settings state outside Task 1, not an identity or authorization assertion. Per the finalization instruction, no further Supabase CLI or workflow reruns were attempted. The requested Owner/Viewer browser verification was also not completed before finalization was requested.

## Self-review

- Confirmed there are no remaining `fgp_user` or static `team` role gates under `apps/web`.
- Confirmed API authorization remains based on Supabase session validation; no identity headers were introduced.
- Confirmed the Viewer handler matrix was not weakened and parcel linking now fails at capability authorization before record lookup or worker access.
- Confirmed settings smoke data uses a unique key and asserts cleanup of every created record, including the settings activity event foreign key.
- Scope is limited to the binding Task 1 files plus its plan, brief, test script, package script, and todo update. `.superpowers/audits` remains untracked and excluded.

## Concerns

- The full authenticated workflow smoke is not green because of the unrelated scraper status assertion above.
- Browser verification for Owner controls, Viewer read-only controls, and stale-site-URL project rendering remains outstanding.
- Prettier expanded formatting in the Capital, Settings, and Tariffs client pages while applying the role-gate edits; semantics remain scoped, and typecheck/lint are clean, but the diff is larger than ideal.

## Review remediation (2026-07-13)

### RED

The focused smoke was extended before the review fixes. A single run reported all security regressions and exited 1:

```text
RED Viewer mutation controls: LinkParcelForm.tsx does not resolve the authenticated actor
RED direct PostgREST active-member boundary: non-member directly read the unique portal setting
RED protected page active-member boundary: non-member protected page returned 200, expected 307
RED stable goal approval IDs: stored display name instead of the Owner userId
RED stable correction approval IDs: stored display name instead of the Owner userId
AssertionError: 5 security regression checks failed
```

### Fixes

- Added migration `0015_active_member_workspace_boundary.sql`, which introduces the fail-closed `fgp_is_active_member()` RLS predicate and applies it to workspace membership, settings, capital, activity, owned records, scraper jobs, project details, and milestones. Active Viewers retain read access. Pending legacy name-based approval arrays are reset.
- Applied the migration successfully to the local Supabase database through `docker exec -i supabase_db_FGP psql ...` after the host lacked `psql`.
- Middleware now checks active membership via the database predicate, redirects non-active identities to `/login?error=membership_required`, clears their session, and leaves a usable denied message/sign-in path. Active members alone are redirected away from login.
- Parcel linking, scraper queue/run controls, and feasibility save/project controls now resolve `usePortalActor()` and omit mutations for Viewers.
- Goal and correction approvals now persist authenticated `userId` values. Goal unanimity compares every active non-Viewer member's stable user ID; names are display-only in the UI.
- Request-origin construction now validates host/protocol and ignores untrusted forwarded hosts unless they match the incoming host or configured origin, while still preferring the incoming host over a stale configured URL.

### GREEN

Fresh required checks after the final code change:

```text
pnpm test:auth-roles
exit 0: Authenticated role smoke passed: RLS, page boundary, Viewer controls, stable approvals, and cleanup asserted.

pnpm --filter web typecheck
exit 0: tsc --noEmit

pnpm --filter web lint
exit 0: eslint

git diff --check
exit 0
```

The existing authenticated workflow was rerun once and still fails at its previously observed, unrelated scraper-state assertion:

```text
scripts/api-workflow-smoke.mjs:102
actual: 'new'
expected: 'analyzed'
```

No workflow production behavior was changed to mask that failure.
