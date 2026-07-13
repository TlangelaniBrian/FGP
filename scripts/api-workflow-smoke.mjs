import assert from "node:assert/strict";
import { attemptAll } from "./workflow-cleanup.mjs";

const site = process.env.FGP_SITE_URL ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
assert(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required");

const runId = process.env.FGP_WORKFLOW_RUN_ID ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const marker = `fgp-workflow:${runId}`;
const email = `fgp-workflow-${runId}@example.com`;
const secondaryEmail = `fgp-workflow-secondary-${runId}@example.com`;
const actorName = `Workflow Smoke ${runId}`;
const password = "WorkflowTest123!";
let userId;
let secondaryMemberId;
let listingId;
let reportId;
let projectId;
let priorSettings;
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
    "projects", "feasibility_reports", "listings", "scrape_jobs", "capital_contributions",
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

  let result = await api("/api/listings", token, { method: "POST", body: JSON.stringify({ address: `Workflow Smoke Stand ${marker}`, municipality: "johannesburg", sizeSqm: 720, price: 1250000, description: marker }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  listingId = track("listings", result.payload).id;

  result = await api("/api/feasibility/save", token, { method: "POST", body: JSON.stringify({ address: `Workflow Smoke Stand ${marker}`, municipality: "johannesburg", zoneCode: "RES3", sizeSqm: 720, price: 1250000, unitType: "1bed", targetUnits: 8, viable: true, score: 82, actualUnits: 8, maxUnitsAllowed: 10, rezoningRequired: false, maxFootprintSqm: 432, maxBuildableSqm: 1080, costLand: 1250000, costBuild: 6248000, costProfessionalFees: 749760, costBulkContributions: 400000, costTransferDuty: 0, costTotal: 8645760, rentPerUnitMonthly: 8500, grossMonthlyIncome: 68000, grossAnnualIncome: 816000, yieldGrossPct: 9.44, yieldAt85OccPct: 8.02, viabilityNotes: marker, dolomiteRisk: "LOW" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  listingId = result.payload.listingId;
  reportId = result.payload.reportId;
  track("listings", { id: listingId });
  track("feasibility_reports", { id: reportId });

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
