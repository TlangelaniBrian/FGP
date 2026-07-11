import assert from "node:assert/strict";

const site = process.env.FGP_SITE_URL ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
assert(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required");

const email = `fgp-workflow-${Date.now()}@example.com`;
const password = "WorkflowTest123!";
let userId;
let teamMemberId;
let secondaryMemberId;
let listingId;
let reportId;
let projectId;

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

async function cleanup() {
  const tables = ["compliance_documents", "projects", "feasibility_reports", "listings", "team_members"];
  for (const table of tables) {
    const filter = table === "team_members" ? `email=like.fgp-workflow-*%40example.com` : `user_id=eq.${userId}`;
    await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  }
  if (userId) await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
}

try {
  const user = await supabase("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Workflow Smoke" } }) });
  userId = user.id;
  const member = await supabase("/rest/v1/team_members", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: userId, email, name: "Workflow Smoke", role: "Owner", status: "active" }) });
  teamMemberId = member[0].id;
  const secondary = await supabase("/rest/v1/team_members", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ email: `fgp-workflow-secondary-${Date.now()}@example.com`, name: "Secondary Smoke", role: "Viewer", status: "invited" }) });
  secondaryMemberId = secondary[0].id;

  const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const authPayload = await auth.json();
  assert.equal(auth.ok, true, JSON.stringify(authPayload));
  const token = authPayload.access_token;

  let result = await api("/api/listings", token, { method: "POST", body: JSON.stringify({ address: "Workflow Smoke Stand", municipality: "johannesburg", sizeSqm: 720, price: 1250000 }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  listingId = result.payload.id;

  result = await api("/api/feasibility/save", token, { method: "POST", body: JSON.stringify({ address: "Workflow Smoke Stand", municipality: "johannesburg", zoneCode: "RES3", sizeSqm: 720, price: 1250000, unitType: "1bed", targetUnits: 8, viable: true, score: 82, actualUnits: 8, maxUnitsAllowed: 10, rezoningRequired: false, maxFootprintSqm: 432, maxBuildableSqm: 1080, costLand: 1250000, costBuild: 6248000, costProfessionalFees: 749760, costBulkContributions: 400000, costTransferDuty: 0, costTotal: 8645760, rentPerUnitMonthly: 8500, grossMonthlyIncome: 68000, grossAnnualIncome: 816000, yieldGrossPct: 9.44, yieldAt85OccPct: 8.02, viabilityNotes: "Smoke test viability", dolomiteRisk: "LOW" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  listingId = result.payload.listingId;
  reportId = result.payload.reportId;

  result = await api(`/api/listings/${listingId}/link-parcel`, token, { method: "POST", body: JSON.stringify({ lat: -25.976, lng: 28.13 }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.parcelId, 2);

  result = await api("/api/projects", token, { method: "POST", body: JSON.stringify({ listingId, reportId, name: "Workflow Smoke Project", phase1TargetZar: 8645760, monthlySavingZar: 25000 }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  projectId = result.payload.id;

  result = await api("/api/documents", token, { method: "POST", body: JSON.stringify({ listingId, reportId, municipality: "johannesburg", forms: ["zoning_certificate", "dolomite_declaration"], prefilledData: { erf_number: "SMOKE-1", zone_code: "RES3" } }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  assert.equal(result.payload.length, 2);
  result = await api(`/api/documents/${result.payload[0].id}`, token, { method: "PATCH", body: JSON.stringify({ status: "submitted" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.status, "submitted");

  result = await api(`/api/projects/${projectId}/checkins`, token, { method: "POST", body: JSON.stringify({ weekOf: "2026-07-13", savingsConfirmed: true, depositZar: 25000, supplierProgress: "Smoke test" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  for (const detail of [
    { action: "budget", category: "general", item: "Workflow survey", totalCost: 5000 },
    { action: "contact", role: "Architect", name: "Workflow Architect" },
    { action: "decision", decidedAt: "2026-07-13", decision: "Proceed to survey", rationale: "Workflow smoke" },
    { action: "milestone", targetDate: "2026-08", milestone: "Workflow survey complete", owner: "Workflow Smoke" },
  ]) {
    result = await api(`/api/projects/${projectId}/details`, token, { method: "POST", body: JSON.stringify(detail) });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  }
  result = await api(`/api/projects/${projectId}`, token, { method: "PATCH", body: JSON.stringify({ status: "compliance", notes: "Smoke test update" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));

  result = await api("/api/capital", token, { method: "POST", body: JSON.stringify({ action: "contribution", amount: 1000, note: "Workflow smoke" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  result = await api("/api/scrape/jobs", token, { method: "POST", body: JSON.stringify({ source: "property24", location: "Midrand" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  const scrapeJobId = result.payload.id;
  result = await api(`/api/scrape/jobs/${scrapeJobId}/ingest`, token, { method: "POST", body: JSON.stringify({ listings: [{ address: "Workflow scored lead", municipality: "johannesburg", sizeSqm: 600, price: 900000, feasibilityScore: 84 }, { address: "Workflow pending lead", municipality: "johannesburg", sizeSqm: 600, price: 900000 }] }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  assert.equal(result.payload.listings[0].status, "analyzed");
  assert.equal(result.payload.listings[1].status, "analyzing");

  result = await api("/api/team", token, { method: "DELETE", body: JSON.stringify({ id: secondaryMemberId }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.status, "removed");
  console.log("Authenticated workflow smoke passed: listing, feasibility, project, check-in, documents, capital, scraper, and team removal.");
} finally {
  await cleanup();
}
