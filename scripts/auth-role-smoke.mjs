import assert from "node:assert/strict";

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
  { kind: "viewer", email: `fgp-auth-viewer-${runId}@example.com`, role: "Viewer", status: "active" },
  { kind: "owner", email: `fgp-auth-owner-${runId}@example.com`, role: "Owner", status: "active" },
];

const createdUsers = [];
const createdMembers = [];

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
        name: `Auth Role ${identity.kind}`,
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
  return authPayload.access_token;
}

async function cleanup() {
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
  const tokens = Object.fromEntries(await Promise.all(identities.map(async (identity) => [identity.kind, await createIdentity(identity)])));

  let result = await api("/api/session", tokens["non-member"]);
  assert.equal(result.response.status, 401, `non-member session returned ${result.response.status}: ${JSON.stringify(result.payload)}`);

  result = await api("/api/session", tokens.invited);
  assert.equal(result.response.status, 401, `invited member session returned ${result.response.status}: ${JSON.stringify(result.payload)}`);

  result = await api("/api/session", tokens.viewer);
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.role, "Viewer");

  result = await api("/api/listings/2147483647/link-parcel", tokens.viewer, {
    method: "POST",
    body: JSON.stringify({ lat: -25.976, lng: 28.13 }),
  });
  assert.equal(result.response.status, 403, `active Viewer parcel link returned ${result.response.status}: ${JSON.stringify(result.payload)}`);

  result = await api("/api/session", tokens.owner);
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.role, "Owner");

  result = await api("/api/settings", tokens.owner, {
    method: "PUT",
    body: JSON.stringify({ [settingsKey]: { verified: true, runId } }),
  });
  assert.equal(result.response.status, 200, `Owner settings write returned ${result.response.status}: ${JSON.stringify(result.payload)}`);
  assert.deepEqual(result.payload[settingsKey], { verified: true, runId });

  console.log("Authenticated role smoke passed: non-member and invited denied, Viewer read-only, Owner authorized, cleanup asserted.");
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
