import assert from "node:assert/strict";
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
const password = "AuthRoleSmoke123!";
const settingsKey = `auth_role_smoke_${runId.replaceAll("-", "_")}`;
const identities = [
  { kind: "non-member", email: `fgp-auth-non-member-${runId}@example.com` },
  { kind: "invited", email: `fgp-auth-invited-${runId}@example.com`, role: "Owner", status: "invited" },
  { kind: "suspended", email: `fgp-auth-suspended-${runId}@example.com`, role: "Owner", status: "suspended" },
  { kind: "removed", email: `fgp-auth-removed-${runId}@example.com`, role: "Owner", status: "removed" },
  { kind: "viewer", email: `fgp-auth-viewer-${runId}@example.com`, role: "Viewer", status: "active" },
  { kind: "owner", email: `fgp-auth-owner-${runId}@example.com`, name: "Duplicate Approval Member", role: "Owner", status: "active" },
  { kind: "analyst", email: `fgp-auth-analyst-${runId}@example.com`, name: "Duplicate Approval Member", role: "Analyst", status: "active" },
];

const createdUsers = [];
const createdMembers = [];
const createdContributions = [];
const createdGoalProposals = [];
const createdCorrectionProposals = [];
const regressionFailures = [];

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

async function direct(path, token) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
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
        user_id: user.id,
        email: identity.email,
        name: identity.name ?? `Auth Role ${identity.kind}`,
        role: identity.role,
        status: identity.status,
      }),
    });
    createdMembers.push(member.id);
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: identity.email, password }),
  });
  const authPayload = await authResponse.json();
  assert.equal(authResponse.ok, true, `Sign-in failed for ${identity.kind}: ${JSON.stringify(authPayload)}`);
  assert(authPayload.access_token, `No access token returned for ${identity.kind}`);
  return { kind: identity.kind, userId: user.id, token: authPayload.access_token, refreshToken: authPayload.refresh_token };
}

async function cleanup() {
  for (const id of createdCorrectionProposals) await admin(`/rest/v1/capital_correction_proposals?id=eq.${id}`, { method: "DELETE" });
  for (const id of createdGoalProposals) await admin(`/rest/v1/capital_goal_proposals?id=eq.${id}`, { method: "DELETE" });
  for (const id of createdContributions) await admin(`/rest/v1/capital_contributions?id=eq.${id}`, { method: "DELETE" });

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

  await admin(`/rest/v1/portal_settings?key=eq.${encodeURIComponent(settingsKey)}`, { method: "DELETE" });
  const settingsRows = await admin(`/rest/v1/portal_settings?key=eq.${encodeURIComponent(settingsKey)}`);
  assert.deepEqual(settingsRows, [], `portal setting ${settingsKey} was not cleaned up`);

  for (const userId of createdUsers) {
    await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
    const users = await admin(`/auth/v1/admin/users?page=1&per_page=1000`);
    assert.equal(users.users.some((user) => user.id === userId), false, `auth user ${userId} was not cleaned up`);
  }
}

let primaryError;
try {
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

  result = await api("/api/settings", sessions.owner.token, {
    method: "PUT",
    body: JSON.stringify({ [settingsKey]: { verified: true, runId } }),
  });
  assert.equal(result.response.status, 200, `Owner settings write returned ${result.response.status}: ${JSON.stringify(result.payload)}`);
  assert.deepEqual(result.payload[settingsKey], { verified: true, runId });

  await checkRegression("direct PostgREST active-member boundary", async () => {
    for (const kind of ["non-member", "invited", "suspended", "removed"]) {
      for (const path of [
        `/rest/v1/portal_settings?key=eq.${encodeURIComponent(settingsKey)}&select=key`,
        "/rest/v1/team_members?select=id&limit=1",
      ]) {
        const read = await direct(path, sessions[kind].token);
        assert.equal(read.response.status, 200, `${kind} direct read returned ${read.response.status}: ${JSON.stringify(read.payload)}`);
        assert.deepEqual(read.payload, [], `${kind} directly read workspace data from ${path}`);
      }
    }
    const viewerRead = await direct(`/rest/v1/portal_settings?key=eq.${encodeURIComponent(settingsKey)}&select=key`, sessions.viewer.token);
    assert.equal(viewerRead.response.status, 200, JSON.stringify(viewerRead.payload));
    assert.deepEqual(viewerRead.payload, [{ key: settingsKey }]);
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
    assert.deepEqual(result.payload.approvals, [sessions.owner.userId], "goal proposal approvals must use user IDs");
    result = await api("/api/capital", sessions.analyst.token, { method: "POST", body: JSON.stringify({ action: "approve-goal", proposalId: createdGoalProposals[0] }) });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    assert.deepEqual(new Set(result.payload.approvals), new Set([sessions.owner.userId, sessions.analyst.userId]));
  });

  await checkRegression("stable correction approval IDs", async () => {
    result = await api("/api/capital", sessions.owner.token, { method: "POST", body: JSON.stringify({ action: "contribution", amount: 123, note: `Auth role ${runId}` }) });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    createdContributions.push(result.payload.id);
    result = await api("/api/capital", sessions.owner.token, { method: "POST", body: JSON.stringify({ action: "correction", contributionId: createdContributions[0], correctionAction: "edit", amount: 124, proposedNote: `Auth role correction ${runId}` }) });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    createdCorrectionProposals.push(result.payload.id);
    assert.deepEqual(result.payload.approvals, [sessions.owner.userId], "correction approvals must use user IDs");
    result = await api("/api/capital", sessions.analyst.token, { method: "POST", body: JSON.stringify({ action: "approve-correction", proposalId: createdCorrectionProposals[0] }) });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    assert.deepEqual(new Set(result.payload.approvals), new Set([sessions.owner.userId, sessions.analyst.userId]));
  });

  assert.equal(regressionFailures.length, 0, `${regressionFailures.length} security regression checks failed`);

  console.log("Authenticated role smoke passed: RLS, page boundary, Viewer controls, stable approvals, and cleanup asserted.");
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
