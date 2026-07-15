import assert from "node:assert/strict";

const site = process.env.FGP_SITE_URL ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
const email = `fgp-smoke-${Date.now()}@example.com`;
const password = "SmokeTest123!";

async function supabaseAuth(path, body) {
  const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, { method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  assert.equal(response.ok, true, `${path} failed: ${JSON.stringify(payload)}`);
  return payload;
}

const signup = await supabaseAuth("signup", { email, password });
const token = signup.access_token ?? (await supabaseAuth("token?grant_type=password", { email, password })).access_token;
assert(token, "Supabase did not return an access token");
const headers = { Authorization: `Bearer ${token}` };

async function api(path, options = {}) {
  const response = await fetch(`${site}${path}`, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

const protectedReads = ["/api/activity", "/api/capital", "/api/listings", "/api/scrape/jobs", "/api/settings", "/api/team", "/api/tariffs?year=2026"];
for (const path of protectedReads) { const { response } = await api(path); assert.equal(response.status, 200, `${path} returned ${response.status}`); }

const viewerWrites = [
  ["/api/settings", "PUT", { autoAnalyze: false }],
  ["/api/listings", "POST", { address: "Smoke test", municipality: "johannesburg", sizeSqm: 500, price: 100000 }],
  ["/api/scrape/jobs", "POST", { source: "property24", location: "Midrand" }],
  ["/api/team", "DELETE", { id: 1 }],
];
for (const [path, method, body] of viewerWrites) { const { response } = await api(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); assert.equal(response.status, 403, `${path} unexpectedly allowed Viewer write`); }

const unauthenticated = await fetch(`${site}/api/capital`);
assert.equal(unauthenticated.status, 401);
for (const path of ["/api/parcel", "/api/feasibility"]) {
  const response = await fetch(`${site}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(response.status, 401, `${path} unexpectedly exposed without a session`);
}
console.log(`API smoke passed for ${protectedReads.length} authenticated reads and ${viewerWrites.length} denied writes.`);
