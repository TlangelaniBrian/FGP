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
