# Task 4 report: atomic capital governance

## Status

`DONE_WITH_CONCERNS`

Implementation commit: `b1585db073b800e2e6eff0dd0b69c5cf1668da48`

## RED evidence

The dedicated authenticated integration smoke was written before production
changes and run against this worktree's FGP server on port 3001. Local
Supabase was verified healthy on 54321/54322; ports 3000/8000 belonged to
Martin and were not used.

The RED run exited 1 with eight expected governance failures:

- a one-member goal remained pending instead of applying;
- generic settings accepted `capital_goal` and direct PostgREST could mutate it;
- no normalized electorate/signature response existed;
- concurrent duplicate goal co-signs returned a 409 and used JSON read/modify/write;
- correction makers were pre-recorded as approvers;
- normalized goal/correction approval tables were absent (`PGRST205`);
- direct proposal/approval mutation was still exposed.

Cleanup restored the original capital goal and all pre-existing member states.

## Transaction model

`apps/web/lib/capital-governance.ts` is the authorized mutation service behind
the Next handler. Every goal/correction decision uses a Drizzle database
transaction. Co-sign paths lock the proposal row with `FOR UPDATE`, insert a
normalized approval with `ON CONFLICT DO NOTHING`, calculate quorum, and update
the proposal plus effective setting/contribution before the transaction commits.

The partial unique index permits one pending goal. Goal creation snapshots all
active non-Viewer member IDs and display metadata, records the maker by member
ID, and atomically applies a sole-member proposal. Corrections record no maker
approval; one active, distinct Owner/Chairperson/Treasurer/Analyst co-signer is
sufficient. Repeated concurrent calls return the durable result without
double-applying effects.

## Migration and backfill

Migration `0018_atomic_capital_governance.sql` adds:

- `proposed_by_member_id` on both proposal tables;
- normalized goal electorate, goal approval, and correction approval tables;
- primary/foreign-key uniqueness for stable member approvals;
- the one-pending-goal partial unique index;
- active-member read-only RLS for normalized governance state;
- reserved-setting policies excluding `capital_goal` from direct generic writes;
- read-only proposal policies, leaving Next/database transactions as the
  mutation surface.

Legacy maker/approval values map by stable member ID, user ID, or an
unambiguous display name. Ambiguous duplicate names are discarded rather than
expanded to multiple approvals. Older competing pending goals are rejected,
the newest remains pending, and backfill never promotes an incomplete proposal
to approved. Correction maker approvals are discarded.

The migration first passed a rollback-only replay, then applied locally through
`supabase migration up --local`. A disposable Supabase Postgres 17 replay ran
repository migrations 0001-0018 after supplying the raw image's platform-owned
`storage.buckets`, `auth.uid()`, and `auth.jwt()` prerequisites. It confirmed
all normalized tables and the partial index exist and legacy JSON approval
columns are absent. The final self-review tightened ambiguous-name predicates
after that replay; those predicate-only edits were type/lint reviewed but were
not re-applied before the finalization cutoff.

## Files changed

- Added the transactional capital governance service and authenticated
  governance smoke.
- Added migration 0018 and matching Drizzle schema tables/columns.
- Reworked the capital handler to use transactional services and stable-member
  response contracts.
- Reserved `capital_goal` in the generic settings handler.
- Updated Capital UI signature rendering and maker-checker controls without
  changing the visual design.
- Updated the existing auth-role smoke, package scripts, task checklist, and
  local error learnings.

## GREEN evidence

Fresh built-artifact checks:

```text
pnpm test:capital-governance
Capital governance smoke passed: reserved settings, stable approvals, RLS, concurrency, and atomic effects asserted.

pnpm test:auth-roles
Authenticated role smoke passed: RLS, page boundary, Viewer controls, stable approvals, and cleanup asserted.

pnpm test:api:workflow
Authenticated workflow smoke passed: listing, feasibility, project, check-in, documents, capital, scraper, and team removal.

pnpm --filter web typecheck
exit 0

pnpm --filter web lint
exit 0

pnpm --filter web build
exit 0; 26/26 static pages generated

PYTHONPATH=. apps/worker/.venv/bin/pytest -q
40 passed in 0.61s

supabase migration up --local
Local database is up to date through 0018.

supabase db lint --local --level warning
exit 0; only existing PostGIS extension diagnostics reported

git diff --check
exit 0
```

## Self-review

- Confirmed display names are response/audit metadata only; member IDs drive
  electorate, maker, eligibility, uniqueness, and quorum decisions.
- Confirmed goal/correction approval and effect writes share one transaction.
- Confirmed concurrent duplicates collapse to one normalized approval row.
- Confirmed correction makers are denied server-side and no longer see a
  co-sign control in the UI.
- Confirmed direct RLS denial by comparing persisted row counts/state before
  and after mutation attempts, including PostgREST's 204 no-op behavior.
- Confirmed only Task 4 files were committed; `.superpowers/audits/` remains
  untracked and untouched.

## Concerns

- The legacy unauthenticated `pnpm test:api` smoke still expects `/api/activity`
  to return 200 without a session; it receives the intended 401. The newer
  authenticated role/workflow smokes are the valid security contract.
- `supabase db lint` reports existing PostGIS extension-function diagnostics,
  but no Task 4 function or schema error and exits 0.

## Independent review remediation

Implementation commit: `84249da` (`fix(capital): preserve finalized governance state`).

### RED evidence

The authenticated governance smoke was extended before production edits and
failed with all runtime review findings:

```text
RED one distinct concurrent correction co-signer applies exactly once atomically:
duplicate idempotent correction requests emitted multiple activity events (2 !== 1)

RED finalized correction accepts no new effective approvals:
HTTP 200 appended a second member approval to an already approved correction

RED removed contribution stays out of fresh effective ledger totals:
fresh GET still included the removed contribution
```

The new disposable migration replay applied repository migrations 0001-0017,
inserted approved/rejected legacy goal and correction proposals plus an
unresolved pending correction maker, then applied the reviewed 0018. Its valid
RED result was:

```text
ERROR: approved goal approvals were not preserved
```

The raw-container harness initially reached migration 0009 before its platform
stubs were sent because `docker exec` lacked interactive stdin. Adding `-i`
made the test exercise repository SQL and produced the intended backfill RED.

### Fixes

- Capital GET now excludes `status = 'removed'` from the effective ledger, so
  refresh totals and leaderboards do not resurrect removed contributions; the
  durable contribution row remains available for audit.
- Migration 0018 now normalizes recognizable approvals for approved, rejected,
  and pending legacy proposals. Historical goal approval members are added to
  the normalized electorate before the composite foreign key is exercised.
- Pending legacy corrections with no resolvable stable maker member ID are
  changed to `rejected` before JSON approvals are dropped. The runtime service
  also refuses any correction whose maker identity remains unresolved.
- Goal and correction approval transactions return `changed`. Finalized
  proposals return `changed: false` without inserting another approval or
  reapplying effects. API activity is written only for a state-changing
  approval, so concurrent duplicates produce at most one co-sign event.

### GREEN evidence

Fresh verification after the final code changes:

```text
pnpm test:capital-governance
Capital governance smoke passed: reserved settings, stable approvals, RLS, concurrency, and atomic effects asserted.

pnpm test:capital-governance:migration
Capital governance migrations 0001-0018 replayed with legacy backfill assertions.

pnpm test:auth-roles
Authenticated role smoke passed: RLS, page boundary, Viewer controls, stable approvals, and cleanup asserted.

pnpm test:api:workflow
Authenticated workflow smoke passed: listing, feasibility, project, check-in, documents, capital, scraper, and team removal.

pnpm --filter web typecheck
exit 0

pnpm --filter web lint
exit 0

pnpm --filter web build
exit 0; 26/26 static pages generated

PYTHONPATH=. apps/worker/.venv/bin/pytest -q
40 passed in 0.61s

git diff --check
exit 0
```

The exact disposable replay supplies only the Supabase platform objects absent
from the raw Postgres image (`storage.buckets`, `auth.uid()`, and `auth.jwt()`),
then runs the checked-in migration files unchanged. Assertions cover completed
goal/correction approval counts, unresolved-maker rejection, and JSON-column
removal.

### Self-review and concerns

- Completed historical approvals remain audit evidence only; no migration path
  promotes an incomplete proposal to approved.
- The unresolved-maker check is fail-closed in both migration and runtime.
- Proposal row locks serialize concurrent approval requests; only the request
  that inserts an approval can apply an effect or emit activity.
- Removed contribution records remain in the database and are excluded only
  from the effective Capital response.
- No production fault-injection hook was added for a forced mid-transaction
  rollback test. Doing so would expand the trusted mutation surface; the
  existing concurrency checks and transaction-scoped persisted-state
  assertions remain the atomicity evidence.
- Pre-existing `.superpowers/audits/` artifacts remain untracked and untouched.
