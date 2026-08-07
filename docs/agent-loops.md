# Agent loop prompts

Two prompts designed to be run with `/loop`. They are deliberately separate: one writes
code, one reviews it. Do not merge them into a single loop — an agent reviewing its own
work in the same context will rubber-stamp it.

Run them in **different sessions**.

---

## Loop 1 — Implement the roadmap, one small PR at a time

```
/loop Work the FGP roadmap one small, shippable slice per iteration.

## Before anything
Run `git checkout main && git pull --ff-only origin main`. Never start work on a
stale branch — a branch four commits behind main has already once presented
merged fixes as live bugs.

## Pick the work
1. Read `docs/roadmap.md`. Work stages strictly in order: Stage 0 before Stage 1,
   and so on. Within a stage, follow the step numbers.
2. Respect blockers. #10 before #11. #13 before #14. #31 before #15.
   #16 before #17 before #18. A blocked issue is not available, even if it looks
   easier than what is available.
3. Check open PRs first with `gh pr list`. If two or more of my PRs are already
   open and awaiting review, do NOT open another — instead spend this iteration
   responding to review comments or fixing red CI on those. Incremental means a
   short queue, not a long one.

## Verify the issue is real before working it
Several issues on this board have been stale — on 2026-08-07, six of seventeen
were already delivered or half-delivered. Before writing code, check the claim
against the code on main and, where practical, against the running stack
(`curl` the endpoint, read the handler).

- If it is already delivered: close it with the specific evidence (file, line,
  live response) and move to the next item. That is a complete, valuable
  iteration — do not force code out.
- If it is partly delivered: comment with what remains, narrow the scope to
  that, and work only that.

## Implement
Branch from main: `git checkout -b <type>/<short-name>`.

Build the SMALLEST slice that is independently reviewable and leaves the tree
consistent. One concern per PR. If an issue naturally splits into API and web
halves, that is two PRs, and the API half goes first.

Match the surrounding code — its naming, comment density, and error-handling
idiom. Read the file before editing it.

## Verify — do not skip, do not claim without running
Run focused tests first, then the full matrix:

    pnpm lint && pnpm typecheck && pnpm build
    pnpm test:web
    pnpm test:api      # one-off SDK container, needs the host Docker socket
    pnpm test:worker

After API changes: `docker compose -f infra/docker-compose.yml restart api`.
After worker changes: `docker compose -f infra/docker-compose.yml build worker`
then `up -d --force-recreate worker`.

If anything fails, fix it and re-run. Do not open a PR with a failing check and
do not describe a failure as "pre-existing" without proving it fails on main too.

Where the change is user-visible, drive the running app and confirm the screen
actually renders — a green test suite did not catch the Scout crash, the empty
Projects screen, or PDFs silently falling back to plain text.

## Open the PR
Title: what changed. Body: what was broken, why, what you did, and the exact
verification output. State plainly anything you did NOT do.

Then STOP. One slice per iteration. Do not start the next issue.

## Never
- Never deploy, provision cloud infrastructure, import external data, classify a
  source database, or run scrapers against live sites. All are owner gates. If a
  roadmap item requires one, comment saying so and move to the next available
  item.
- Never merge your own PR. Never force-push to main.
- Never weaken a test to make it pass.
- Never leave generated artifacts in the tree.

## Report each iteration
Which issue, what you found when you verified it, what you changed, the
verification results, and the PR number. If the iteration ended in closing a
stale issue rather than writing code, say that clearly.
```

---

## Loop 2 — Review open PRs

Run this in a **separate session** from Loop 1.

```
/loop Review the open pull requests on this repository and leave useful comments.

## Each iteration
1. `gh pr list --state open --json number,title,headRefOid,updatedAt`.
2. For each open PR, check whether you have already reviewed its current head
   SHA (look for your own prior comment quoting that SHA). Skip ones you have.
   If every open PR is already reviewed at its current head, say so and stop —
   an empty iteration is a valid result. Do not invent nitpicks to fill it.
3. Review the least-recently-reviewed unreviewed PR.

## How to review
Read the full diff: `gh pr diff <n>`. Then read the surrounding code — a diff
alone does not show what a change breaks.

Verify the description's claims rather than trusting them. If the body says
"returns 200" or "suite green", check: `gh pr checks <n>`, and where practical
exercise the endpoint against the running stack. PR descriptions have been
wrong before.

Look for, in priority order:
1. **Correctness** — does it do what it claims? Off-by-one, null/undefined
   confusion, wrong comparison operators. The Scout crash was a `!== null`
   guard against a value that was `undefined`.
2. **Tenancy** — is every query scoped to the authenticated `organization_id`
   claim? Cross-tenant reads must return 404, never 403, and organization must
   never come from a request body.
3. **Governance invariants** — contributions immutable and versioned;
   corrections need a *distinct* active Owner/Chairperson; fund goals need the
   exact submission electorate of active non-Viewer members; membership changes
   void open goals with a linked audit event.
4. **Silent failure** — swallowed exceptions, bare `except`, fallbacks that hide
   a broken dependency. WeasyPrint failed on every request for weeks behind a
   bare `except Exception`.
5. **Schema authority** — EF Core migrations are the only DDL. No hand SQL, no
   second migration tool.
6. **Tests** — do they assert the behaviour that was broken, or only that the
   code runs? Would they fail if the fix were reverted?
7. **Scope** — is this one reviewable concern, or several PRs in a trench coat?

## Comment style
Anchor to file and line. Say what is wrong, why it matters, and what would
happen concretely — inputs and the resulting wrong output. Suggest the fix.

Distinguish severity explicitly:
- **Blocking** — correctness, tenancy, governance, security.
- **Should fix** — silent failure, missing coverage of the actual bug.
- **Optional** — style, naming, structure.

Do not pad a review. If the change is genuinely clean, say that and say what you
checked to conclude it. A short, specific review beats a long, vague one.

## Never
- Never approve, merge, close, or re-open a PR. Recommend; the owner decides.
- Never push commits to someone else's branch.
- Never claim you ran something you did not run.
```

---

## Why two loops

The implementation loop optimises for shipping; the review loop optimises for finding
problems. Those pull in opposite directions, and an agent holding both goals in one
context resolves the conflict in favour of shipping. Separate sessions also mean the
reviewer reads the diff cold, without the author's rationalisations in context.
