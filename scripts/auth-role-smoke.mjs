import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import supabaseSsr from "../apps/web/node_modules/@supabase/ssr/dist/main/index.js";

const { createServerClient } = supabaseSsr;

const site = process.env.FGP_SITE_URL ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
assert(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required");

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = randomBytes(24).toString("base64url");
const settingsKeys = ["autoAnalyze", "scoreThreshold", "email", "whatsapp", "weekly", "digest", "scrapers"];
const settingsFilter = encodeURIComponent(`(${settingsKeys.join(",")})`);
const settingsPayload = {
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
};
const identities = [
  { kind: "non-member", email: `fgp-auth-non-member-${runId}@example.com` },
  { kind: "invited", email: `fgp-auth-invited-${runId}@example.com`, role: "Owner", status: "invited" },
  { kind: "suspended", email: `fgp-auth-suspended-${runId}@example.com`, role: "Owner", status: "suspended" },
  { kind: "removed", email: `fgp-auth-removed-${runId}@example.com`, role: "Owner", status: "removed" },
  { kind: "viewer", email: `fgp-auth-viewer-${runId}@example.com`, role: "Viewer", status: "active" },
  { kind: "owner", email: `fgp-auth-owner-${runId}@example.com`, name: "Duplicate Approval Member", role: "Owner", status: "active" },
  { kind: "chairperson", email: `fgp-auth-chairperson-${runId}@example.com`, role: "Chairperson", status: "active" },
  { kind: "treasurer", email: `fgp-auth-treasurer-${runId}@example.com`, role: "Treasurer", status: "active" },
  { kind: "analyst", email: `fgp-auth-analyst-${runId}@example.com`, name: "Duplicate Approval Member", role: "Analyst", status: "active" },
  { kind: "unbound-analyst", email: `fgp-auth-unbound-${runId}@example.com`, name: "Duplicate Approval Member", role: "Analyst", status: "active", bindUserId: false },
];

const createdUsers = [];
const createdMembers = [];
const createdContributions = [];
const createdGoalProposals = [];
const createdCorrectionProposals = [];
const createdWorkspaceRecords = [];
const regressionFailures = [];
let settingsSnapshot = null;

async function checkRegression(name, test) {
  try {
    await test();
  } catch (error) {
    regressionFailures.push(error);
    console.error(`RED ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function admin(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${options.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

async function api(path, token, options = {}) {
  const response = await fetch(`${site}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  return { response, payload: await response.json().catch(() => null) };
}

async function direct(path, token, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  return { response, payload: await response.json().catch(() => null) };
}

async function sessionCookie(session) {
  const cookies = [];
  const client = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (values) => cookies.splice(0, cookies.length, ...values),
    },
  });
  const { error } = await client.auth.setSession({ access_token: session.token, refresh_token: session.refreshToken });
  assert.equal(error, null, `Could not serialize ${session.kind} session: ${error?.message}`);
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

async function createIdentity(identity) {
  const user = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: identity.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Auth Role ${identity.kind}` },
    }),
  });
  createdUsers.push(user.id);

  if (identity.status) {
    const [member] = await admin("/rest/v1/team_members", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: identity.bindUserId === false ? null : user.id,
        email: identity.email,
        name: identity.name ?? `Auth Role ${identity.kind}`,
        role: identity.role,
        status: identity.status,
      }),
    });
    createdMembers.push(member.id);
    identity.memberId = member.id;
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: identity.email, password }),
  });
  const authPayload = await authResponse.json();
  assert.equal(authResponse.ok, true, `Sign-in failed for ${identity.kind}: ${JSON.stringify(authPayload)}`);
  assert(authPayload.access_token, `No access token returned for ${identity.kind}`);
  return { kind: identity.kind, userId: user.id, memberId: identity.memberId ?? null, token: authPayload.access_token, refreshToken: authPayload.refresh_token };
}

async function createWorkspaceRecord(table, values) {
  const [row] = await admin(`/rest/v1/${table}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(values) });
  createdWorkspaceRecords.unshift({ table, id: row.id });
  return row;
}

async function seedViewerWorkspace(userId) {
  const project = await createWorkspaceRecord("projects", { user_id: userId, name: `Viewer project ${runId}`, notes: "original" });
  const listing = await createWorkspaceRecord("listings", { user_id: userId, source: "manual", address: `Viewer listing ${runId}`, description: "original" });
  const report = await createWorkspaceRecord("feasibility_reports", { user_id: userId, listing_id: listing.id, unit_type: "1bed", target_units: 1, actual_units: 1, viability_notes: "original" });
  const document = await createWorkspaceRecord("compliance_documents", { user_id: userId, listing_id: listing.id, report_id: report.id, doc_type: "zoning_certificate", municipality: "original", status: "ready" });
  const scrapeJob = await createWorkspaceRecord("scrape_jobs", { user_id: userId, source: "property24", status: "queued", error_message: "original" });
  const budget = await createWorkspaceRecord("project_budget_items", { project_id: project.id, category: "general", item: `Viewer budget ${runId}`, notes: "original" });
  const contact = await createWorkspaceRecord("project_contacts", { project_id: project.id, role: "Architect", name: "original" });
  const decision = await createWorkspaceRecord("project_decisions", { project_id: project.id, decided_at: "2026-07-13", decision: `Viewer decision ${runId}`, rationale: "original" });
  const checkin = await createWorkspaceRecord("project_checkins", { project_id: project.id, week_of: "2026-07-13", open_issues: "original" });
  const milestone = await createWorkspaceRecord("milestones", { project_id: project.id, target_date: "2026-08", milestone: `Viewer milestone ${runId}`, owner: "original" });
  return [
    { table: "projects", row: project, field: "notes", insert: { user_id: userId, name: `Viewer insert project ${runId}` } },
    { table: "listings", row: listing, field: "description", insert: { user_id: userId, source: "manual", address: `Viewer insert listing ${runId}` } },
    { table: "feasibility_reports", row: report, field: "viability_notes", insert: { user_id: userId, listing_id: listing.id, unit_type: "1bed", target_units: 2, actual_units: 2 } },
    { table: "compliance_documents", row: document, field: "municipality", insert: { user_id: userId, listing_id: listing.id, doc_type: "motivation_letter" } },
    { table: "scrape_jobs", row: scrapeJob, field: "error_message", insert: { user_id: userId, source: "property24" } },
    { table: "project_budget_items", row: budget, field: "notes", insert: { project_id: project.id, category: "general", item: `Viewer insert budget ${runId}` } },
    { table: "project_contacts", row: contact, field: "name", insert: { project_id: project.id, role: "Engineer", name: "viewer insert" } },
    { table: "project_decisions", row: decision, field: "rationale", insert: { project_id: project.id, decided_at: "2026-07-14", decision: `Viewer insert decision ${runId}` } },
    { table: "project_checkins", row: checkin, field: "open_issues", insert: { project_id: project.id, week_of: "2026-07-20" } },
    { table: "milestones", row: milestone, field: "owner", insert: { project_id: project.id, target_date: "2026-09", milestone: `Viewer insert milestone ${runId}` } },
  ];
}

async function cleanup() {
  for (const id of createdCorrectionProposals) await admin(`/rest/v1/capital_correction_proposals?id=eq.${id}`, { method: "DELETE" });
  for (const id of createdGoalProposals) await admin(`/rest/v1/capital_goal_proposals?id=eq.${id}`, { method: "DELETE" });
  for (const id of createdContributions) await admin(`/rest/v1/capital_contributions?id=eq.${id}`, { method: "DELETE" });
  for (const { table, id } of createdWorkspaceRecords) await admin(`/rest/v1/${table}?id=eq.${id}`, { method: "DELETE" });

  for (const userId of createdUsers) {
    await admin(`/rest/v1/activity_events?actor_user_id=eq.${userId}`, { method: "DELETE" });
    const events = await admin(`/rest/v1/activity_events?actor_user_id=eq.${userId}`);
    assert.deepEqual(events, [], `activity events for ${userId} were not cleaned up`);
  }

  for (const memberId of createdMembers) {
    await admin(`/rest/v1/team_members?id=eq.${memberId}`, { method: "DELETE" });
    const rows = await admin(`/rest/v1/team_members?id=eq.${memberId}`);
    assert.deepEqual(rows, [], `team member ${memberId} was not cleaned up`);
  }

  if (settingsSnapshot) {
    await admin(`/rest/v1/portal_settings?key=in.${settingsFilter}`, { method: "DELETE" });
    if (settingsSnapshot.length > 0) {
      await admin("/rest/v1/portal_settings", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(settingsSnapshot),
      });
    }
    const restoredSettings = await admin(
      `/rest/v1/portal_settings?key=in.${settingsFilter}&select=key,value,updated_by,updated_at&order=key.asc`,
    );
    assert.deepEqual(restoredSettings, settingsSnapshot, "approved settings rows were not restored exactly");
  }

  for (const userId of createdUsers) {
    await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
    const users = await admin(`/auth/v1/admin/users?page=1&per_page=1000`);
    assert.equal(users.users.some((user) => user.id === userId), false, `auth user ${userId} was not cleaned up`);
  }
}

let primaryError;
try {
  settingsSnapshot = await admin(
    `/rest/v1/portal_settings?key=in.${settingsFilter}&select=key,value,updated_by,updated_at&order=key.asc`,
  );
  const sessions = Object.fromEntries(await Promise.all(identities.map(async (identity) => [identity.kind, await createIdentity(identity)])));

  await checkRegression("Viewer mutation controls", async () => {
    for (const path of [
      "apps/web/app/scout/[id]/_components/LinkParcelForm.tsx",
      "apps/web/app/settings/scraper/page.tsx",
      "apps/web/app/evaluate/result/page.tsx",
    ]) {
      const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
      assert.match(source, /usePortalActor/, `${path} does not resolve the authenticated actor`);
      assert.match(source, /can\(actor\?\.role \?\? "Viewer"/, `${path} does not gate Viewer mutation controls`);
    }
  });

  await checkRegression("read-only document download contract", async () => {
    const route = await readFile(new URL("../apps/web/app/api/documents/[id]/download/route.ts", import.meta.url), "utf8");
    const getBody = route.split("export async function POST")[0];
    assert.doesNotMatch(getBody, /forms\/generate|\.upload\(|db\.update/, "document GET still generates or persists an artifact");
    assert.match(route, /export async function POST/, "document generation POST is missing");
    assert.match(route, /requireSessionCapability\("project"/, "document generation POST lacks the project capability guard");
    const zoning = await readFile(new URL("../apps/web/app/scout/[id]/zoning/page.tsx", import.meta.url), "utf8");
    assert.match(zoning, /document\.pdfUrl/, "zoning UI does not restrict downloads to stored artifacts");
    assert.match(zoning, /method: "POST"/, "zoning UI has no explicit artifact generation action");
  });

  let result = await api("/api/session", sessions["non-member"].token);
  assert.equal(result.response.status, 401, `non-member session returned ${result.response.status}: ${JSON.stringify(result.payload)}`);

  for (const kind of ["invited", "suspended", "removed"]) {
    result = await api("/api/session", sessions[kind].token);
    assert.equal(result.response.status, 401, `${kind} member session returned ${result.response.status}: ${JSON.stringify(result.payload)}`);
  }

  result = await api("/api/session", sessions.viewer.token);
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.role, "Viewer");

  result = await api("/api/listings/2147483647/link-parcel", sessions.viewer.token, {
    method: "POST",
    body: JSON.stringify({ lat: -25.976, lng: 28.13 }),
  });
  assert.equal(result.response.status, 403, `active Viewer parcel link returned ${result.response.status}: ${JSON.stringify(result.payload)}`);

  result = await api("/api/session", sessions.owner.token);
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.role, "Owner");

  let persistedSettings;
  for (const [index, kind] of ["owner", "chairperson", "treasurer", "analyst"].entries()) {
    const expected = { ...settingsPayload, scoreThreshold: settingsPayload.scoreThreshold + index };
    const write = await api("/api/settings", sessions[kind].token, {
      method: "PUT",
      body: JSON.stringify(expected),
    });
    assert.equal(write.response.status, 200, `${kind} settings write returned ${write.response.status}: ${JSON.stringify(write.payload)}`);
    assert.deepEqual(write.payload, expected, `${kind} settings write returned an incomplete object`);
    persistedSettings = expected;
  }

  const viewerWrite = await api("/api/settings", sessions.viewer.token, {
    method: "PUT",
    body: JSON.stringify(settingsPayload),
  });
  assert.equal(viewerWrite.response.status, 403, `Viewer settings write returned ${viewerWrite.response.status}: ${JSON.stringify(viewerWrite.payload)}`);

  for (const invalidPayload of [
    { ...settingsPayload, capital_goal: 1 },
    { autoAnalyze: true },
  ]) {
    const invalidWrite = await api("/api/settings", sessions.owner.token, {
      method: "PUT",
      body: JSON.stringify(invalidPayload),
    });
    assert.equal(invalidWrite.response.status, 422, `invalid settings write returned ${invalidWrite.response.status}: ${JSON.stringify(invalidWrite.payload)}`);
  }

  const persistedRead = await api("/api/settings", sessions.viewer.token);
  assert.equal(persistedRead.response.status, 200, JSON.stringify(persistedRead.payload));
  assert.deepEqual(persistedRead.payload, persistedSettings, "strict invalid writes changed persisted settings");

  await checkRegression("direct PostgREST active-member boundary", async () => {
    for (const kind of ["non-member", "invited", "suspended", "removed"]) {
      for (const path of [
        "/rest/v1/portal_settings?key=eq.autoAnalyze&select=key",
        "/rest/v1/team_members?select=id&limit=1",
      ]) {
        const read = await direct(path, sessions[kind].token);
        assert.equal(read.response.status, 200, `${kind} direct read returned ${read.response.status}: ${JSON.stringify(read.payload)}`);
        assert.deepEqual(read.payload, [], `${kind} directly read workspace data from ${path}`);
      }
    }
    const viewerRead = await direct("/rest/v1/portal_settings?key=eq.autoAnalyze&select=key", sessions.viewer.token);
    assert.equal(viewerRead.response.status, 200, JSON.stringify(viewerRead.payload));
    assert.deepEqual(viewerRead.payload, [{ key: "autoAnalyze" }]);
  });

  await checkRegression("Viewer direct workspace writes", async () => {
    const resources = await seedViewerWorkspace(sessions.viewer.userId);
    const mutated = [];
    const deleted = [];
    const inserted = [];
    for (const resource of resources) {
      const read = await direct(`/rest/v1/${resource.table}?id=eq.${resource.row.id}&select=id`, sessions.viewer.token);
      assert.equal(read.response.status, 200, `${resource.table} Viewer read failed`);
      assert.deepEqual(read.payload, [{ id: resource.row.id }], `${resource.table} Viewer read was denied`);

      await direct(`/rest/v1/${resource.table}?id=eq.${resource.row.id}`, sessions.viewer.token, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ [resource.field]: "viewer-mutated" }) });
      const afterPatch = await admin(`/rest/v1/${resource.table}?id=eq.${resource.row.id}&select=${resource.field}`);
      if (afterPatch[0]?.[resource.field] === "viewer-mutated") mutated.push(resource.table);

      const insert = await direct(`/rest/v1/${resource.table}`, sessions.viewer.token, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(resource.insert) });
      if (insert.response.ok && insert.payload?.[0]?.id) {
        inserted.push(resource.table);
        createdWorkspaceRecords.unshift({ table: resource.table, id: insert.payload[0].id });
      }
    }
    for (const resource of [...resources].reverse()) {
      await direct(`/rest/v1/${resource.table}?id=eq.${resource.row.id}`, sessions.viewer.token, { method: "DELETE", headers: { Prefer: "return=representation" } });
      const afterDelete = await admin(`/rest/v1/${resource.table}?id=eq.${resource.row.id}&select=id`);
      if (afterDelete.length === 0) deleted.push(resource.table);
    }
    assert.deepEqual(mutated, [], `Viewer directly updated: ${mutated.join(", ")}`);
    assert.deepEqual(deleted, [], `Viewer directly deleted: ${deleted.join(", ")}`);
    assert.deepEqual(inserted, [], `Viewer directly inserted: ${inserted.join(", ")}`);
  });

  await checkRegression("caller-controlled document PDF path", async () => {
    const document = await createWorkspaceRecord("compliance_documents", {
      user_id: sessions.owner.userId,
      doc_type: "zoning_certificate",
      status: "draft",
    });
    const foreignPath = `${sessions.analyst.userId}/${document.id}-${document.doc_type}.pdf`;

    const response = await api(`/api/documents/${document.id}`, sessions.owner.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "ready", pdfUrl: foreignPath }),
    });
    assert.equal(response.response.status, 200, JSON.stringify(response.payload));
    const [persisted] = await admin(`/rest/v1/compliance_documents?id=eq.${document.id}&select=pdf_url,status`);
    assert.equal(persisted.pdf_url, null, "document PATCH accepted a caller-controlled PDF object path");
  });

  await checkRegression("cross-owner document PDF path", async () => {
    const document = await createWorkspaceRecord("compliance_documents", {
      user_id: sessions.owner.userId,
      doc_type: "zoning_certificate",
      status: "ready",
    });
    const foreignPath = `${sessions.analyst.userId}/${document.id}-${document.doc_type}.pdf`;
    await admin(`/rest/v1/compliance_documents?id=eq.${document.id}`, {
      method: "PATCH",
      body: JSON.stringify({ pdf_url: foreignPath }),
    });
    const response = await api(`/api/documents/${document.id}/download`, sessions.owner.token, { redirect: "manual" });
    assert.equal(response.response.status, 422, `cross-owner PDF path returned ${response.response.status}`);
    assert.match(response.payload?.error ?? "", /object path/i);
    const [persisted] = await admin(`/rest/v1/compliance_documents?id=eq.${document.id}&select=pdf_url`);
    assert.equal(persisted.pdf_url, foreignPath, "download validation mutated the persisted path");
  });

  await checkRegression("protected page active-member boundary", async () => {
    for (const kind of ["non-member", "invited", "suspended", "removed"]) {
      const cookie = await sessionCookie(sessions[kind]);
      const page = await fetch(`${site}/`, { headers: { cookie }, redirect: "manual" });
      assert.equal(page.status, 307, `${kind} protected page returned ${page.status}`);
      assert.match(page.headers.get("location") ?? "", /\/login\?error=membership_required/, `${kind} was not redirected to the membership denied path`);
    }
  });

  await checkRegression("stable goal approval IDs", async () => {
    result = await api("/api/capital", sessions.owner.token, { method: "POST", body: JSON.stringify({ action: "goal", newAmount: 765432 }) });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    createdGoalProposals.push(result.payload.id);
    assert.deepEqual(result.payload.approvals, [sessions.owner.memberId], "goal proposal approvals must use member IDs");
    result = await api("/api/capital", sessions.analyst.token, { method: "POST", body: JSON.stringify({ action: "approve-goal", proposalId: createdGoalProposals[0] }) });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    assert.deepEqual(new Set(result.payload.approvals), new Set([sessions.owner.memberId, sessions.analyst.memberId]));
    result = await api("/api/capital", sessions["unbound-analyst"].token, { method: "POST", body: JSON.stringify({ action: "approve-goal", proposalId: createdGoalProposals[0] }) });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    assert.equal(result.payload.approvals.includes(sessions["unbound-analyst"].memberId), true, "active member without user_id was omitted from approvals");
  });

  await checkRegression("stable correction approval IDs", async () => {
    result = await api("/api/capital", sessions.owner.token, { method: "POST", body: JSON.stringify({ action: "contribution", amount: 123, note: `Auth role ${runId}` }) });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    createdContributions.push(result.payload.id);
    result = await api("/api/capital", sessions.owner.token, { method: "POST", body: JSON.stringify({ action: "correction", contributionId: createdContributions[0], correctionAction: "edit", amount: 124, proposedNote: `Auth role correction ${runId}` }) });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    createdCorrectionProposals.push(result.payload.id);
    assert.deepEqual(result.payload.approvals, [], "correction maker must not be recorded as an approver");
    result = await api("/api/capital", sessions.analyst.token, { method: "POST", body: JSON.stringify({ action: "approve-correction", proposalId: createdCorrectionProposals[0] }) });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    assert.deepEqual(result.payload.approvals, [sessions.analyst.memberId]);
  });

  assert.equal(regressionFailures.length, 0, `${regressionFailures.length} security regression checks failed`);

  console.log("Authenticated role smoke passed: strict settings roles and persistence, RLS, page boundary, Viewer controls, stable approvals, and exact cleanup asserted.");
} catch (error) {
  primaryError = error;
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    if (!primaryError) primaryError = cleanupError;
    else console.error("Cleanup also failed:", cleanupError);
  }
}

if (primaryError) throw primaryError;
