# Settings and Tariffs Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining prototype-only Settings and Tariffs controls with strict, persisted, role-enforced controls that match the approved Capitec handoff and preserve the trusted feasibility tariff contract.

**Architecture:** Settings use one canonical Zod contract shared by the route and client-facing types; the API persists only the approved top-level keys and the page renders server-loaded notification, scraper, and auto-analysis state. Tariffs retain the existing six category payloads and server validation, but a typed adapter converts API JSON to accessible numeric form fields and converts edited fields back to the exact worker-facing shapes. Authentication and authorization remain server-derived from the active Supabase member; no role headers, localStorage identities, or demo state are introduced.

**Tech Stack:** Next.js App Router, React 19, TypeScript 5, Zod 4, Drizzle ORM, Supabase Auth/Postgres, existing Capitec portal CSS, Node/tsx smoke tests.

## Global Constraints

- High-fidelity Capitec reference: Nunito Sans, 16px cards, pill controls, sentence-case copy, semantic light/dark tokens, and the existing 160ms `cubic-bezier(0.2,0,0,1)` motion contract.
- At widths at or below 860px, controls must remain usable without horizontal page overflow; verify at 320px.
- Settings keys are exactly `autoAnalyze`, `scoreThreshold`, `email`, `whatsapp`, `weekly`, `digest`, and `scrapers`; `scoreThreshold` is an integer from 50 through 95 and `scrapers` contains exactly six boolean source keys.
- Scraper keys are exactly `property24`, `private_property`, `propdata`, `gumtree`, `immo_africa`, and `entegral`.
- Tariff categories and stored payload shapes remain exactly `build_rates`, `unit_sizes`, `market_rents`, `bulk_contributions`, `transfer_duty_brackets`, and `fees` as validated by `apps/web/app/api/tariffs/route.ts`.
- Unit keys remain exactly `bachelor`, `1bed`, `2bed`, and `luxury`; municipalities remain exactly `johannesburg`, `tshwane`, and `ekurhuleni`.
- Owner, Chairperson, and Treasurer may edit tariffs; Analyst and Viewer may only view them. Owner, Chairperson, Treasurer, and Analyst may edit settings; Viewer may only view them. Only Owner and Chairperson may manage team members.
- UI gating is not a security boundary: both settings and tariff handlers must return 403 for an authenticated actor without the required capability.
- All role/capability decisions come from the authenticated server actor. Do not add actor headers, localStorage roles, or client-selected identities.
- Preserve all existing Task 1–6 security, governance, feasibility, responsive, theme, currency, and motion behavior.
- Work only in `/private/tmp/fgp-pull-new-designs-validation.CtdZIq`; do not modify the user checkout, push, or add `.superpowers/audits/`.

---

### Task 7A: Strict persisted Settings controls

**Files:**
- Create: `apps/web/lib/portal-settings.ts`
- Create: `scripts/settings-controls-smoke.ts`
- Modify: `apps/web/app/api/settings/route.ts`
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `scripts/auth-role-smoke.mjs`
- Modify: `package.json`
- Modify: `tasks/todo.md`

**Interfaces:**
- Consumes: `requireSessionCapability("settings", req)`, `getAuthenticatedActor(req)`, `actorHeaders()`, `usePortalActor()`, and the existing `portal_settings(key, value)` table.
- Produces: `portalSettingsSchema`, `PortalSettings`, `DEFAULT_PORTAL_SETTINGS`, and `mergePortalSettings(rows)` from `apps/web/lib/portal-settings.ts`; `GET /api/settings` returns a complete `PortalSettings`; `PUT /api/settings` accepts only a complete strict `PortalSettings` and returns the saved object.

- [ ] **Step 1: Write the failing settings contract and UI smoke**

  Add `scripts/settings-controls-smoke.ts`. It must import the contract and assert:

  ```ts
  assert.deepEqual(
    portalSettingsSchema.parse({
      autoAnalyze: true,
      scoreThreshold: 75,
      email: true,
      whatsapp: true,
      weekly: false,
      digest: true,
      scrapers: {
        property24: true,
        private_property: true,
        propdata: false,
        gumtree: false,
        immo_africa: true,
        entegral: true,
      },
    }).scrapers,
    {
      property24: true,
      private_property: true,
      propdata: false,
      gumtree: false,
      immo_africa: true,
      entegral: true,
    },
  );
  assert.equal(portalSettingsSchema.safeParse({ ...valid, capital_goal: 1 }).success, false);
  assert.equal(portalSettingsSchema.safeParse({ ...valid, scoreThreshold: 49 }).success, false);
  assert.equal(portalSettingsSchema.safeParse({ ...valid, scrapers: { ...valid.scrapers, unknown: true } }).success, false);
  ```

  The same smoke must read `apps/web/app/settings/page.tsx` and assert visible labels for `Email alerts`, `WhatsApp alerts`, `Weekly digest`, `Document status`, all six source labels, `Auto-score new leads`, and `Alert threshold`; it must also assert that scraper rows render toggles rather than status-only tags.

- [ ] **Step 2: Run the settings smoke to verify RED**

  Run: `pnpm exec tsx scripts/settings-controls-smoke.ts`

  Expected: FAIL because `apps/web/lib/portal-settings.ts` does not exist and the page lacks the complete notification/scraper controls.

- [ ] **Step 3: Implement the strict settings contract**

  In `apps/web/lib/portal-settings.ts`, define strict Zod objects for the six scraper flags and complete settings object. Export these defaults:

  ```ts
  export const DEFAULT_PORTAL_SETTINGS = {
    autoAnalyze: true,
    scoreThreshold: 75,
    email: true,
    whatsapp: true,
    weekly: false,
    digest: true,
    scrapers: {
      property24: true,
      private_property: true,
      propdata: false,
      gumtree: false,
      immo_africa: true,
      entegral: true,
    },
  } satisfies PortalSettings;
  ```

  `mergePortalSettings` must start from these defaults, accept database rows shaped as `{ key: string; value: unknown }[]`, copy only individually valid approved keys, validate `scrapers` atomically, and never surface unknown/reserved rows.

- [ ] **Step 4: Make the settings route complete and strict**

  `GET` must authenticate, select settings rows, and return `mergePortalSettings(rows)`. `PUT` must capability-guard first, parse JSON with `portalSettingsSchema.safeParse`, return 422 without writes when invalid, upsert exactly the seven approved keys, record one activity event, and return the complete parsed object. A partial body, unknown key, malformed scraper map, or `capital_goal` must return 422.

- [ ] **Step 5: Rebuild the Settings page around the persisted contract**

  Load the complete `PortalSettings`, preserve last known/default state on network failure, show a non-success error banner when loading or saving fails, and disable Save while loading/saving or for Viewer. Render:

  - four independent notification toggles with the handoff copy;
  - six independent scraper toggles, source domains, active count, and latest job detail without letting job status replace enabled state;
  - auto-score toggle and integer threshold control from 50 through 95;
  - the existing server-backed team management, with Owner/Chairperson controls and read-only copy for other roles.

  Every toggle must use `aria-pressed`, a unique accessible name, the existing `.toggle` control, and `disabled={!canEditSettings}`. Save must send the complete settings object with `actorHeaders()` and must not optimistically claim success before the response is accepted.

- [ ] **Step 6: Extend the authenticated role smoke before accepting GREEN**

  Replace the arbitrary dynamic setting write with a snapshot/restore of the seven approved settings rows. Add active Chairperson and Treasurer identities. Assert:

  ```js
  // Owner, Chairperson, Treasurer, Analyst
  assert.equal(write.response.status, 200);
  // Viewer
  assert.equal(viewerWrite.response.status, 403);
  // Unknown/partial payload
  assert.equal(invalidWrite.response.status, 422);
  ```

  Preserve the direct PostgREST boundary check by reading one approved setting key. Cleanup must restore the exact pre-run rows, including `updated_by` and `updated_at`, and remove temporary activity/membership/auth rows even when assertions fail.

- [ ] **Step 7: Run Task 7A GREEN verification**

  Run:

  ```bash
  pnpm exec tsx scripts/settings-controls-smoke.ts
  FGP_SITE_URL=http://127.0.0.1:3001 pnpm test:auth-roles
  pnpm --filter web typecheck
  pnpm --filter web lint
  ```

  Expected: all commands exit 0; the authenticated smoke proves the four editable roles, Viewer 403, strict 422 behavior, persistence, and cleanup.

- [ ] **Step 8: Commit Task 7A**

  ```bash
  git add apps/web/lib/portal-settings.ts apps/web/app/api/settings/route.ts apps/web/app/settings/page.tsx scripts/settings-controls-smoke.ts scripts/auth-role-smoke.mjs package.json tasks/todo.md
  git commit -m "feat(settings): persist notification and scraper controls"
  ```

---

### Task 7B: Field-based trusted Tariff editors

**Files:**
- Create: `apps/web/lib/tariff-editor.ts`
- Create: `apps/web/app/settings/tariffs/_components/TariffFields.tsx`
- Create: `scripts/tariff-controls-smoke.ts`
- Modify: `apps/web/app/settings/tariffs/page.tsx`
- Modify: `package.json`
- Modify: `tasks/todo.md`

**Interfaces:**
- Consumes: `GET /api/tariffs?year=<year>`, the existing category-specific `PUT /api/tariffs` validator, `requireSessionCapability("tariff", req)`, `actorHeaders()`, and `usePortalActor()`.
- Produces: `TariffDraft`, `emptyTariffDraft()`, `parseTariffDraft(tariffs)`, and `payloadForCategory(draft, category)` from `apps/web/lib/tariff-editor.ts`; `TariffFields` renders typed inputs and calls `onSave(category)` with no JSON textareas.

- [ ] **Step 1: Write the failing tariff adapter and UI smoke**

  Add `scripts/tariff-controls-smoke.ts` with a complete six-category fixture including decimal values. Assert that `parseTariffDraft` and `payloadForCategory` round-trip every category exactly, including:

  ```ts
  const buildRates = payloadForCategory(draft, "build_rates");
  assert.equal(buildRates.ok, true);
  if (buildRates.ok) assert.deepEqual(buildRates.data, fixture.build_rates);

  const bulk = payloadForCategory(draft, "bulk_contributions");
  assert.equal(bulk.ok, true);
  if (bulk.ok) assert.deepEqual(bulk.data, fixture.bulk_contributions);

  const duty = payloadForCategory(draft, "transfer_duty_brackets");
  assert.equal(duty.ok, true);
  if (duty.ok) assert.deepEqual(duty.data, fixture.transfer_duty_brackets);

  const fees = payloadForCategory(draft, "fees");
  assert.equal(fees.ok, true);
  if (fees.ok) assert.deepEqual(fees.data, fixture.fees);
  ```

  Assert missing categories produce empty numeric fields rather than invented 2026 values, an empty last upper bound serializes as `null`, and any non-finite/blank required field makes `payloadForCategory` return a typed error result rather than `NaN`, `Infinity`, or zero. Read the Tariffs page/component source and reject `<textarea`, `JSON.parse`, and `JSON.stringify(json.tariffs`; require labels for build rates, unit sizes, market rents, all three municipalities, transfer duty, and professional fees.

- [ ] **Step 2: Run the tariff smoke to verify RED**

  Run: `pnpm exec tsx scripts/tariff-controls-smoke.ts`

  Expected: FAIL because the typed tariff adapter/component do not exist and the page still exposes raw JSON textareas.

- [ ] **Step 3: Implement the tariff draft adapter**

  Define numeric draft fields as `number | ""`. Parse unknown API data category-by-category without coercing invalid values. Preserve decimals. `payloadForCategory` must return:

  ```ts
  type TariffPayloadResult =
    | { ok: true; data: unknown }
    | { ok: false; message: string };
  ```

  The successful data must exactly match the existing route payloads: four-key unit objects, the three-municipality/four-unit tuple tree, tuple-array duty brackets, or `{ professional_fee_pct: number }`. For fees, keep the stored ratio visible and editable as a ratio (for example `0.12`) so conversion cannot silently change trusted calculations.

- [ ] **Step 4: Build accessible field groups for every category**

  `TariffFields` must render:

  - build rate, unit size, and market rent rows for Bachelor, 1 Bedroom, 2 Bedroom, and Luxury;
  - minimum and maximum bulk contribution inputs for every municipality/unit combination;
  - one transfer-duty row per tuple with upper bound, marginal rate, and cumulative base, plus add/remove row controls for editable actors;
  - professional fee ratio;
  - one save action and inline status per category.

  Inputs use `type="number"`, `step="any"`, explicit `<label htmlFor>`, stable IDs, semantic portal field classes, and `disabled={!canEdit || saving}`. Do not add generic transitions or hover translation. Wide bulk/duty grids must wrap or horizontally contain inside their card at 320px without page overflow.

- [ ] **Step 5: Rebuild the Tariffs page around typed fields**

  Keep year range 2024–2030 and reload on change. Show the handoff information banner explaining that tariff changes feed Cost Oracle. Preserve read access for all active members; disable all edit/add/remove/save controls and show the lock banner for Analyst/Viewer. On save, call `payloadForCategory`; show its local validation message without making a request when invalid, otherwise send `{ year, category, data }`. After a successful save, replace that category from the response/accepted draft and display `Saved` without fake checkmark copy.

- [ ] **Step 6: Run Task 7B GREEN verification**

  Run:

  ```bash
  pnpm exec tsx scripts/tariff-controls-smoke.ts
  FGP_SITE_URL=http://127.0.0.1:3001 pnpm test:api:workflow
  pnpm --filter web typecheck
  pnpm --filter web lint
  pnpm --filter web build
  ```

  Expected: all commands exit 0; decimal tariff fixtures still drive trusted feasibility calculations and the production build completes all routes.

- [ ] **Step 7: Commit Task 7B**

  ```bash
  git add apps/web/lib/tariff-editor.ts apps/web/app/settings/tariffs/_components/TariffFields.tsx apps/web/app/settings/tariffs/page.tsx scripts/tariff-controls-smoke.ts package.json tasks/todo.md
  git commit -m "feat(tariffs): replace raw json with trusted field editors"
  ```

---

### Task 7C: Authenticated role and visual acceptance

**Files:**
- Modify: `tasks/todo.md`
- Modify: `.superpowers/sdd/progress.md` (scratch ledger only; do not commit)

**Interfaces:**
- Consumes: Task 7A complete `PortalSettings`, Task 7B typed tariff editor, local Supabase at `127.0.0.1:54321`, web at `127.0.0.1:3001`, and the authenticated test identities created by the smoke harness.
- Produces: independent review evidence covering Owner, Chairperson, Treasurer, Analyst, and Viewer plus Task 7 completion in the durable ledger.

- [ ] **Step 1: Run the complete automated Task 7 matrix**

  Run:

  ```bash
  pnpm exec tsx scripts/settings-controls-smoke.ts
  pnpm exec tsx scripts/tariff-controls-smoke.ts
  FGP_SITE_URL=http://127.0.0.1:3001 pnpm test:auth-roles
  FGP_SITE_URL=http://127.0.0.1:3001 pnpm test:api:workflow
  pnpm test:ui-foundation
  pnpm --filter web typecheck
  pnpm --filter web lint
  pnpm --filter web build
  ```

  Expected: every command exits 0 and cleanup reports no surviving Task 7 auth, team, activity, settings, tariff, listing, report, project, document, or scraper fixtures.

- [ ] **Step 2: Verify the authenticated browser matrix**

  At 1440px and 320px, inspect Settings and Tariffs in light and dark modes. Verify no page-level horizontal overflow, complete labels, persisted reload state, keyboard focus, readable lock banners, and semantic error/success surfaces. For each role verify:

  | Role | Settings | Team | Tariffs |
  |---|---|---|---|
  | Owner | edit | manage | edit |
  | Chairperson | edit | manage | edit |
  | Treasurer | edit | read-only | edit |
  | Analyst | edit | read-only | read-only |
  | Viewer | read-only | read-only | read-only |

  Use real authenticated sessions only. Confirm that disabled UI matches the handler results already proven by the authenticated smoke.

- [ ] **Step 3: Dispatch the whole Task 7 independent review**

  Generate a review package from the Task 7 plan commit base through current HEAD. The reviewer must compare the package against this full plan, the handoff README, `09-tariffs.png`, and `10-settings.png`, and report Critical/Important/Minor findings plus separate spec-compliance and code-quality verdicts. Fix and re-review every Critical or Important finding.

- [ ] **Step 4: Record Task 7 completion**

  Mark the Settings/Tariffs completion-audit item in `tasks/todo.md` only after the whole review is approved. Append three lines to `.superpowers/sdd/progress.md`: one each for Task 7A, Task 7B, and whole Task 7. Every line must contain the actual abbreviated base and head commit IDs plus either `review clean` or `whole Settings/Tariffs review approved`. Then commit only the tracked todo change with `docs: close settings and tariffs controls` if it was not included in a prior implementation commit.

## Plan self-review

- Spec coverage: Settings includes all four notification flags, six scraper toggles, auto-analysis, threshold, team roles, persistence, handler enforcement, responsive/theme acceptance, and the five-role matrix. Tariffs includes year and all six trusted categories with exact payload preservation and role enforcement.
- Placeholder scan: there are no deferred implementation details or substitute-later values.
- Type consistency: `PortalSettings`, `TariffDraft`, category names, unit names, municipality names, and role capabilities match the current APIs and feasibility worker contract.
