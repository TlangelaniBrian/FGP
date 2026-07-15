import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { attemptAll, createRunIdentity } from "./workflow-cleanup.mjs";

const site = process.env.FGP_SITE_URL ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
assert(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required");

const { runId, marker, email, secondaryEmail, actorName } = createRunIdentity(process.env.FGP_WORKFLOW_RUN_ID);
const workflowZoneCode = `SMK${runId.replace(/[^a-z0-9]/gi, "").slice(-12)}`.toUpperCase();
const password = randomBytes(24).toString("base64url");
let userId;
let secondaryMemberId;
let listingId;
let reportId;
let projectId;
let priorSettings;
let priorDecimalTariffs;
const createdRecords = [];
const createdRecordKeys = new Set();

function track(table, row) {
  const key = `${table}:${row.id}`;
  if (!createdRecordKeys.has(key)) {
    createdRecordKeys.add(key);
    createdRecords.push({ table, id: row.id });
  }
  return row;
}

function controlledFailure(point) {
  if (process.env.FGP_WORKFLOW_FAIL_AFTER === point) {
    throw new Error(`Controlled workflow failure after ${point}`);
  }
}

async function supabase(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const payload = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${path} failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function api(path, token, options = {}) {
  const response = await fetch(`${site}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers ?? {}) } });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function reconcileAuthUser() {
  const users = await supabase("/auth/v1/admin/users?page=1&per_page=1000");
  const matchingUser = users.users.find((user) => user.email === email);
  if (matchingUser) userId = matchingUser.id;
}

async function reconcileRecords() {
  const tasks = [];
  if (userId) {
    for (const table of ["compliance_documents", "projects", "feasibility_reports", "listings", "scrape_jobs"]) {
      tasks.push([`reconcile ${table}`, async () => {
        const rows = await supabase(`/rest/v1/${table}?user_id=eq.${userId}&select=id`);
        rows.forEach((row) => track(table, row));
      }]);
    }
  }

  tasks.push(["reconcile capital contributions", async () => {
    const rows = await supabase(`/rest/v1/capital_contributions?member_name=eq.${encodeURIComponent(actorName)}&note=eq.${encodeURIComponent(marker)}&select=id`);
    rows.forEach((row) => track("capital_contributions", row));
  }]);
  tasks.push(["reconcile zoning rule", async () => {
    const rows = await supabase(`/rest/v1/zoning_scheme_rules?municipality=eq.johannesburg&zone_code=eq.${workflowZoneCode}&select=id`);
    rows.forEach((row) => track("zoning_scheme_rules", row));
  }]);

  await attemptAll([
    ["reconcile user and marker records", () => attemptAll(tasks)],
    ["reconcile project children", async () => {
      const projectIds = createdRecords.filter(({ table }) => table === "projects").map(({ id }) => id);
      if (!projectIds.length) return;
      await attemptAll(["project_checkins", "project_budget_items", "project_contacts", "project_decisions", "milestones"].map((table) => [
        `reconcile ${table}`,
        async () => {
          const rows = await supabase(`/rest/v1/${table}?project_id=in.(${projectIds.join(",")})&select=id`);
          rows.forEach((row) => track(table, row));
        },
      ]));
    }],
  ]);
}

async function cleanupRecords() {
  const order = [
    "compliance_documents", "project_checkins", "project_budget_items", "project_contacts", "project_decisions", "milestones",
    "projects", "feasibility_reports", "listings", "scrape_jobs", "capital_contributions", "zoning_scheme_rules",
  ];
  const records = [...createdRecords]
    .filter(({ table }) => table !== "team_members")
    .sort((left, right) => order.indexOf(left.table) - order.indexOf(right.table));

  await attemptAll([
    ["delete exact records", () => attemptAll(records.map(({ table, id }) => [
      `delete ${table} ${id}`,
      () => supabase(`/rest/v1/${table}?id=eq.${id}`, { method: "DELETE" }),
    ]))],
    ["assert exact record absence", () => attemptAll(records.map(({ table, id }) => [
      `assert ${table} ${id}`,
      async () => {
        const rows = await supabase(`/rest/v1/${table}?id=eq.${id}&select=id`);
        assert.deepEqual(rows, [], `${table} ${id} was not cleaned up`);
      },
    ]))],
  ]);
}

async function cleanupActivity() {
  if (!userId) return;
  await attemptAll([
    ["delete actor activity", () => supabase(`/rest/v1/activity_events?actor_user_id=eq.${userId}`, { method: "DELETE" })],
    ["assert actor activity absence", async () => {
      const events = await supabase(`/rest/v1/activity_events?actor_user_id=eq.${userId}&select=id`);
      assert.deepEqual(events, [], `activity events for ${userId} were not cleaned up`);
    }],
  ]);
}

async function restoreSettings() {
  if (!priorSettings) return;
  const priorKeys = new Set(priorSettings.map(({ key }) => key));
  const absentKeys = ["scoreThreshold", "autoAnalyze"].filter((key) => !priorKeys.has(key));
  const tasks = [];
  if (priorSettings.length) {
    tasks.push(["restore prior setting rows", () => supabase("/rest/v1/portal_settings", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(priorSettings),
    })]);
  }
  for (const key of absentKeys) {
    tasks.push([`remove temporary ${key}`, () => supabase(`/rest/v1/portal_settings?key=eq.${key}`, { method: "DELETE" })]);
  }
  tasks.push(["verify settings restoration", async () => {
    const restored = await supabase("/rest/v1/portal_settings?key=in.(scoreThreshold,autoAnalyze)&select=key,value,updated_by,updated_at&order=key");
    assert.deepEqual(restored, priorSettings, "workflow settings were not restored");
  }]);
  await attemptAll(tasks);
}

async function cleanupTeam() {
  await attemptAll([
    ["reconcile team members", () => attemptAll([email, secondaryEmail].map((memberEmail) => [
      `reconcile ${memberEmail}`,
      async () => {
        const rows = await supabase(`/rest/v1/team_members?email=eq.${encodeURIComponent(memberEmail)}&select=id`);
        rows.forEach((row) => track("team_members", row));
      },
    ]))],
    ["delete exact team members", () => attemptAll(createdRecords.filter(({ table }) => table === "team_members").map(({ id }) => [
      `delete team member ${id}`,
      () => supabase(`/rest/v1/team_members?id=eq.${id}`, { method: "DELETE" }),
    ]))],
    ["assert team member absence", () => attemptAll([email, secondaryEmail].map((memberEmail) => [
      `assert ${memberEmail}`,
      async () => {
        const rows = await supabase(`/rest/v1/team_members?email=eq.${encodeURIComponent(memberEmail)}&select=id`);
        assert.deepEqual(rows, [], `team member ${memberEmail} was not cleaned up`);
      },
    ]))],
  ]);
}

async function cleanupAuth() {
  if (!userId) return;
  await attemptAll([
    ["delete auth user", () => supabase(`/auth/v1/admin/users/${userId}`, { method: "DELETE" })],
    ["assert auth user absence", async () => {
      const users = await supabase("/auth/v1/admin/users?page=1&per_page=1000");
      assert.equal(users.users.some((user) => user.id === userId || user.email === email), false, `auth user ${userId} was not cleaned up`);
    }],
  ]);
}

async function cleanup() {
  await attemptAll([
    ["auth-user reconciliation", reconcileAuthUser],
    ["record reconciliation", reconcileRecords],
    ["record deletion and absence checks", cleanupRecords],
    ["actor activity cleanup", cleanupActivity],
    ["settings restoration", restoreSettings],
    ["decimal tariff restoration", async () => {
      if (!priorDecimalTariffs) return;
      await supabase("/rest/v1/tariffs?tariff_year=eq.2029", { method: "DELETE" });
      if (priorDecimalTariffs.length) {
        await supabase("/rest/v1/tariffs", { method: "POST", body: JSON.stringify(priorDecimalTariffs) });
      }
    }],
    ["team cleanup", cleanupTeam],
    ["auth cleanup", cleanupAuth],
  ]);
}

let workflowError;
try {
  const user = await supabase("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: actorName, workflow_marker: marker } }) });
  userId = user.id;
  const member = await supabase("/rest/v1/team_members", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: userId, email, name: actorName, role: "Owner", status: "active" }) });
  track("team_members", member[0]);
  const secondary = await supabase("/rest/v1/team_members", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ email: secondaryEmail, name: `Secondary Smoke ${runId}`, role: "Viewer", status: "invited" }) });
  secondaryMemberId = secondary[0].id;
  track("team_members", secondary[0]);

  const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const authPayload = await auth.json();
  assert.equal(auth.ok, true, JSON.stringify(authPayload));
  const token = authPayload.access_token;

  const zoningRule = await supabase("/rest/v1/zoning_scheme_rules", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ municipality: "johannesburg", zone_code: workflowZoneCode, coverage_pct: 60, far: 1.5, max_storeys: 3, max_units_per_ha: 80 }) });
  track("zoning_scheme_rules", zoningRule[0]);

  let result = await api("/api/listings", token, { method: "POST", body: JSON.stringify({ address: `Workflow Smoke Stand ${marker}`, municipality: "johannesburg", sizeSqm: 720, price: 1250000, description: marker }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  listingId = track("listings", result.payload).id;

  const canonicalFeasibility = { address: `Workflow Smoke Stand ${marker}`, municipality: "johannesburg", zone_code: workflowZoneCode, size_sqm: 720, price: 1250000, unit_type: "1bed", target_units: 8, tariff_year: 2026 };
  const forgedAddress = `Forged Workflow Smoke Stand ${marker}`;
  result = await api("/api/feasibility/save", token, { method: "POST", body: JSON.stringify({ ...canonicalFeasibility, address: forgedAddress, viable: true, score: 100, cost_total: 1, yield_at_85_occ_pct: 999, viability_notes: marker, dolomite_risk: "LOW" }) });
  assert.equal(result.response.status, 422, JSON.stringify(result.payload));
  result = await api("/api/feasibility/save", token, { method: "POST", body: JSON.stringify({ address: forgedAddress, municipality: "johannesburg", zoneCode: "RES3", sizeSqm: 720, price: 1250000, unitType: "1bed", targetUnits: 8, viable: true, score: 100, actualUnits: 8, maxUnitsAllowed: 9999, rezoningRequired: false, maxFootprintSqm: 9999, maxBuildableSqm: 9999, costLand: 1, costBuild: 1, costProfessionalFees: 1, costBulkContributions: 1, costTransferDuty: 1, costTotal: 1, rentPerUnitMonthly: 999999, grossMonthlyIncome: 999999, grossAnnualIncome: 999999, yieldGrossPct: 999, yieldAt85OccPct: 999, viabilityNotes: marker, dolomiteRisk: "LOW" }) });
  assert.equal(result.response.status, 422, JSON.stringify(result.payload));
  const forgedListings = await supabase(`/rest/v1/listings?address=eq.${encodeURIComponent(forgedAddress)}&select=id`);
  assert.deepEqual(forgedListings, [], "forged feasibility outputs created a listing");

  const existingBuildRates = await supabase("/rest/v1/tariffs?tariff_year=eq.2026&category=eq.build_rates&select=data");
  result = await api("/api/tariffs", token, { method: "PUT", body: JSON.stringify({ year: 2026, category: "build_rates", data: { bachelor: -1, "1bed": 14200, "2bed": 15000, luxury: 18500 } }) });
  assert.equal(result.response.status, 422, JSON.stringify(result.payload));
  const buildRatesAfterInvalidWrite = await supabase("/rest/v1/tariffs?tariff_year=eq.2026&category=eq.build_rates&select=data");
  assert.deepEqual(buildRatesAfterInvalidWrite, existingBuildRates, "invalid tariff payload was persisted");

  priorDecimalTariffs = await supabase("/rest/v1/tariffs?tariff_year=eq.2029&select=*");
  const decimalTariffs = [
    ["build_rates", { bachelor: 13500.75, "1bed": 14200.25, "2bed": 15000.5, luxury: 18500.125 }],
    ["unit_sizes", { bachelor: 35.5, "1bed": 55.25, "2bed": 85.75, luxury: 120.5 }],
    ["market_rents", { bachelor: 4500.5, "1bed": 6500.75, "2bed": 9500.25, luxury: 18000.5 }],
    ["bulk_contributions", { johannesburg: { bachelor: [45000, 65000], "1bed": [50000, 65000], "2bed": [55000, 65000], luxury: [65000, 80000] }, tshwane: { bachelor: [38000, 55000], "1bed": [42000, 55000], "2bed": [46000, 55000], luxury: [55000, 70000] }, ekurhuleni: { bachelor: [40000, 58000], "1bed": [44000, 58000], "2bed": [48000, 58000], luxury: [58000, 73000] } }],
    ["transfer_duty_brackets", [[1100000, 0, 0], [1512500, 0.03, 0], [null, 0.13, 1128600]]],
    ["fees", { professional_fee_pct: 0.12 }],
  ];
  for (const [category, data] of decimalTariffs) {
    result = await api("/api/tariffs", token, { method: "PUT", body: JSON.stringify({ year: 2029, category, data }) });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  }
  result = await api("/api/feasibility", token, { method: "POST", body: JSON.stringify({ ...canonicalFeasibility, tariff_year: 2029 }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.build_rate_per_sqm, 14200.25);
  assert.equal(result.payload.rent_per_unit_monthly, 6500.75);
  assert.equal(result.payload.cost_build, Math.round(5 * 55.25 * 14200.25 * 100) / 100);

  result = await api("/api/feasibility/save", token, { method: "POST", body: JSON.stringify(canonicalFeasibility) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  listingId = result.payload.listingId;
  reportId = result.payload.reportId;
  track("listings", { id: listingId });
  track("feasibility_reports", { id: reportId });
  const [savedReport] = await supabase(`/rest/v1/feasibility_reports?id=eq.${reportId}&select=viable,cost_total,cost_build,yield_at_85_occ_pct,viability_notes,tariff_year,target_units,actual_units,decision_status,zoning_evidence_available,capacity_density_units,capacity_far_units,capacity_footprint_storey_units`);
  assert.notEqual(Number(savedReport.cost_total), 1, "saved report persisted forged total cost");
  assert.notEqual(Number(savedReport.yield_at_85_occ_pct), 999, "saved report persisted forged yield");
  assert.notEqual(savedReport.viability_notes, marker, "saved report persisted forged notes");
  assert.equal(savedReport.tariff_year, 2026);
  assert.equal(savedReport.target_units, 8);
  assert.equal(savedReport.actual_units, 5);
  assert.equal(savedReport.decision_status, "definitive");
  assert.equal(savedReport.zoning_evidence_available, true);
  assert.equal(savedReport.capacity_density_units, 5);
  assert.equal(savedReport.capacity_far_units, 19);
  assert.equal(savedReport.capacity_footprint_storey_units, 23);
  assert.equal(Number(savedReport.cost_build), 5 * 55 * 14200);

  const missingTariffAddress = `Missing Tariff Workflow ${marker}`;
  result = await api("/api/feasibility/save", token, { method: "POST", body: JSON.stringify({ ...canonicalFeasibility, address: missingTariffAddress, tariff_year: 2030 }) });
  assert.equal(result.response.status, 422, JSON.stringify(result.payload));
  const missingTariffListings = await supabase(`/rest/v1/listings?address=eq.${encodeURIComponent(missingTariffAddress)}&select=id`);
  assert.deepEqual(missingTariffListings, [], "missing non-2026 tariffs created a definitive report");

  result = await api(`/api/listings/${listingId}/link-parcel`, token, { method: "POST", body: JSON.stringify({ lat: -25.976, lng: 28.13 }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.parcelId, 2);

  result = await api("/api/projects", token, { method: "POST", body: JSON.stringify({ listingId, reportId, name: `Workflow Smoke Project ${marker}`, phase1TargetZar: 8645760, monthlySavingZar: 25000 }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  controlledFailure("project-write");
  projectId = track("projects", result.payload).id;

  result = await api("/api/documents", token, { method: "POST", body: JSON.stringify({ listingId, reportId, municipality: "johannesburg", forms: ["zoning_certificate", "dolomite_declaration"], prefilledData: { erf_number: `SMOKE-${runId}`, zone_code: "RES3", workflow_marker: marker } }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  assert.equal(result.payload.length, 2);
  result.payload.forEach((document) => track("compliance_documents", document));
  result = await api(`/api/documents/${result.payload[0].id}`, token, { method: "PATCH", body: JSON.stringify({ status: "submitted" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.status, "submitted");

  result = await api(`/api/projects/${projectId}/checkins`, token, { method: "POST", body: JSON.stringify({ weekOf: "2026-07-13", savingsConfirmed: true, depositZar: 25000, supplierProgress: marker }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  track("project_checkins", result.payload);
  for (const [table, detail] of [
    ["project_budget_items", { action: "budget", category: "general", item: `Workflow survey ${marker}`, totalCost: 5000 }],
    ["project_contacts", { action: "contact", role: "Architect", name: `Workflow Architect ${marker}` }],
    ["project_decisions", { action: "decision", decidedAt: "2026-07-13", decision: `Proceed to survey ${marker}`, rationale: marker }],
    ["milestones", { action: "milestone", targetDate: "2026-08", milestone: `Workflow survey complete ${marker}`, owner: actorName }],
  ]) {
    result = await api(`/api/projects/${projectId}/details`, token, { method: "POST", body: JSON.stringify(detail) });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    controlledFailure(`${table}-write`);
    track(table, result.payload);
  }
  result = await api(`/api/projects/${projectId}`, token, { method: "PATCH", body: JSON.stringify({ status: "compliance", notes: marker }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));

  result = await api("/api/capital", token, { method: "POST", body: JSON.stringify({ action: "contribution", amount: 1000, note: marker }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  controlledFailure("capital-write");
  track("capital_contributions", result.payload);

  priorSettings = await supabase("/rest/v1/portal_settings?key=in.(scoreThreshold,autoAnalyze)&select=key,value,updated_by,updated_at&order=key");
  await supabase("/rest/v1/portal_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([
      { key: "scoreThreshold", value: 75, updated_by: marker },
      { key: "autoAnalyze", value: true, updated_by: marker },
    ]),
  });
  controlledFailure("settings-write");

  result = await api("/api/scrape/jobs", token, { method: "POST", body: JSON.stringify({ source: "property24", location: `Midrand ${marker}` }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  const scrapeJobId = track("scrape_jobs", result.payload).id;
  result = await api(`/api/scrape/jobs/${scrapeJobId}/ingest`, token, { method: "POST", body: JSON.stringify({ listings: [{ address: `Workflow scored lead ${marker}`, municipality: "johannesburg", sizeSqm: 600, price: 900000, feasibilityScore: 84, description: marker }, { address: `Workflow pending lead ${marker}`, municipality: "johannesburg", sizeSqm: 600, price: 900000, description: marker }] }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  result.payload.listings.forEach((listing) => track("listings", listing));
  assert.equal(result.payload.listings[0].status, "analyzed");
  assert.equal(result.payload.listings[1].status, "analyzing");

  result = await api("/api/team", token, { method: "DELETE", body: JSON.stringify({ id: secondaryMemberId }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.status, "removed");
  console.log("Authenticated workflow smoke passed: listing, feasibility, project, check-in, documents, capital, scraper, and team removal.");
} catch (error) {
  workflowError = error;
} finally {
  let cleanupError;
  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }
  if (workflowError && cleanupError) throw new AggregateError([workflowError, cleanupError], "Workflow and cleanup both failed");
  if (cleanupError) throw cleanupError;
}
if (workflowError) throw workflowError;
