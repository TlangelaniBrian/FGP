# Demo runbook

How to bring FGP up from cold and walk it end to end. Budget 10 minutes for setup.

## 1. Start the stack

```bash
docker compose -f infra/docker-compose.yml up -d postgis redis mailpit worker api
pnpm install
pnpm dev
```

Wait for the API to answer before loading the portal:

```bash
curl -s http://localhost:8080/health   # {"status":"ok"}
```

| Surface | URL |
| --- | --- |
| Portal | <http://localhost:3000> |
| API | <http://localhost:8080> |
| Mailpit | <http://localhost:8025> |

## 2. Seed the demo organization

This is deterministic and safe to re-run — it replaces its own rows and imports nothing
external. It creates the five role users, reference tariffs, spatial fixtures, five
Gauteng leads, three projects with full detail, and three months of contributions.

```bash
docker compose -f infra/docker-compose.yml exec -T \
  -e ConnectionStrings__Fgp="Host=postgis;Port=5432;Database=postgres;Username=postgres;Password=postgres" \
  -e Seed__OrganizationId="11111111-1111-4111-8111-111111111111" \
  api dotnet run --project apps/api/src/FGP.Api/FGP.Api.csproj --no-launch-profile -- --seed-demo
```

Verify:

```bash
docker exec infra-postgis-1 psql -U postgres -d postgres \
  -c "select name, status from projects order by id;"
```

You should see Soshanguve Build (construction), Noordwyk (compliance), Karenpark (planning).

## 3. Demo accounts

All five share the password `Fgp-Demo-2026!Pass` (deterministic, local-only, defined in
`RoleUserSeeder.cs`).

| Email | Role | Use it to show |
| --- | --- | --- |
| `owner@fgp.demo` | Owner | Everything. Default for the main walkthrough. |
| `chairperson@fgp.demo` | Chairperson | Team management; cannot propose goals or corrections. |
| `treasurer@fgp.demo` | Treasurer | Proposes goals and corrections; cannot manage team. |
| `analyst@fgp.demo` | Analyst | Tariffs locked, team management hidden. |
| `viewer@fgp.demo` | Viewer | App-wide read-only. |

## 4. Suggested walkthrough

Roughly 8 minutes, following the value story rather than the nav order.

1. **Dashboard** — pipeline value, three active projects, average yield, fund balance.
   Frame it as "every land decision and every rand in one place."
2. **Scout** — five persisted leads with score rings. Filter to `Score ≥ 80`, then
   search a suburb. Point out zone code, dolomite risk and yield on each card.
3. **Parcel detail** — open Erf 14201. Show the fact grid and spatial context
   (zoning, dolomite, nearby amenities) coming from the private worker.
4. **Evaluate → Cost Oracle** — run 1024 m², R950 000, bachelor, 8 units. Show the cost
   breakdown and the yield verdict.
5. **Tariffs** — change a build rate, then re-run step 4 to show feasibility move. This
   is the strongest "it is really wired together" moment.
6. **Capital fund** — balance against the R760 000 goal, the contributions ledger, and
   the governance panel. Then the closer: sign in as Treasurer, propose a new goal, sign
   in as Owner, and show that it needs every active non-Viewer member to co-sign.
7. **Viewer role** — sign in as `viewer@fgp.demo` to show the read-only banner and that
   controls are genuinely gone, not just greyed out.

## 5. Reset between runs

Re-run the seed command in step 2. It clears the demo organization's listings, projects
and contributions first, so state from a previous walkthrough does not leak in.

## Known gaps

Be ready for these — better to name them than be caught by them.

- **Scrapers do not run.** The scraper network and GIS ingestion are owner-gated and not
  wired to live sources. Settings shows the sources and their toggles; "no scraper job
  has run yet" is expected.
- **The map is unstyled without a tile key.** Set `NEXT_PUBLIC_MAPTILER_KEY` for a
  proper basemap; lead pins plot correctly either way.
- **No deployment.** The portal runs locally only. Deployment and Azure Blob artifact
  storage are a deliberate owner gate.
- **The "next milestone" tile on Capital is a placeholder** and not yet driven by data.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Portal loads but every panel is empty | API not up yet | `curl localhost:8080/health`, then reload |
| `401` on every request | Session cookie expired | Sign in again at `/sign-in` |
| Projects screen empty | Seed not run | Re-run step 2 |
| API changes not visible | Container runs a built DLL, not a watcher | `docker compose -f infra/docker-compose.yml restart api` |
