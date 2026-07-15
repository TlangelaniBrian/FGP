import assert from "node:assert/strict";

const site = process.env.FGP_SITE_URL ?? "http://127.0.0.1:3001";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
assert(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required");

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "CapitalGovernance123!";
const createdUsers = [];
const createdMembers = [];
const createdGoalProposals = [];
const createdCorrectionProposals = [];
const createdContributions = [];
const createdSettings = [];
const originalMemberStatuses = [];
const failures = [];
let originalGoal;

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

async function direct(path, token, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  return { response, payload: await response.json().catch(() => null) };
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

async function check(name, callback) {
  try {
    await callback();
  } catch (error) {
    failures.push(error);
    console.error(`RED ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function createIdentity(kind, role) {
  const email = `fgp-capital-${kind}-${runId}@example.com`;
  const user = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  createdUsers.push(user.id);
  const [member] = await admin("/rest/v1/team_members", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      email,
      name: `Capital ${kind}`,
      role,
      status: "active",
    }),
  });
  createdMembers.push(member.id);
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const auth = await authResponse.json();
  assert.equal(authResponse.ok, true, JSON.stringify(auth));
  return { token: auth.access_token, userId: user.id, memberId: member.id, name: member.name, role };
}

async function setMemberStatus(memberId, status) {
  await admin(`/rest/v1/team_members?id=eq.${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

async function cleanup() {
  for (const id of createdCorrectionProposals) {
    await admin(`/rest/v1/capital_correction_proposals?id=eq.${id}`, { method: "DELETE" });
  }
  for (const id of createdGoalProposals) {
    await admin(`/rest/v1/capital_goal_proposals?id=eq.${id}`, { method: "DELETE" });
  }
  for (const id of createdContributions) {
    await admin(`/rest/v1/capital_contributions?id=eq.${id}`, { method: "DELETE" });
  }
  for (const key of createdSettings) {
    await admin(`/rest/v1/portal_settings?key=eq.${encodeURIComponent(key)}`, { method: "DELETE" });
  }
  if (originalGoal) {
    await admin("/rest/v1/portal_settings?key=eq.capital_goal", {
      method: "PATCH",
      body: JSON.stringify({ value: originalGoal.value, updated_by: originalGoal.updated_by }),
    });
  } else {
    await admin("/rest/v1/portal_settings?key=eq.capital_goal", { method: "DELETE" });
  }
  for (const memberId of createdMembers) {
    await admin(`/rest/v1/team_members?id=eq.${memberId}`, { method: "DELETE" });
  }
  for (const { id, status } of originalMemberStatuses) {
    await setMemberStatus(id, status);
  }
  for (const userId of createdUsers) {
    await admin(`/rest/v1/activity_events?actor_user_id=eq.${userId}`, { method: "DELETE" });
    await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  }
}

let primaryError;
try {
  const [goalRow] = await admin("/rest/v1/portal_settings?key=eq.capital_goal&select=key,value,updated_by");
  originalGoal = goalRow;
  const activeMembers = await admin("/rest/v1/team_members?status=eq.active&select=id,status");
  originalMemberStatuses.push(...activeMembers);
  for (const member of activeMembers) await setMemberStatus(member.id, "suspended");

  const owner = await createIdentity("owner", "Owner");

  await check("one-member goal applies atomically at creation", async () => {
    const amount = 810_000;
    const result = await api("/api/capital", owner.token, {
      method: "POST",
      body: JSON.stringify({ action: "goal", newAmount: amount }),
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    createdGoalProposals.push(result.payload.id);
    assert.equal(result.payload.status, "approved");
    assert.deepEqual(result.payload.approvals, [owner.memberId]);
    assert.deepEqual(result.payload.signatures, [{ memberId: owner.memberId, name: owner.name, role: owner.role, signed: true }]);
    const [storedProposal] = await admin(`/rest/v1/capital_goal_proposals?id=eq.${result.payload.id}&select=status`);
    const [storedGoal] = await admin("/rest/v1/portal_settings?key=eq.capital_goal&select=value");
    assert.equal(storedProposal.status, "approved");
    assert.equal(Number(storedGoal.value), amount);
  });

  const chair = await createIdentity("chair", "Chairperson");
  const treasurer = await createIdentity("treasurer", "Treasurer");
  const analyst = await createIdentity("analyst", "Analyst");
  const viewer = await createIdentity("viewer", "Viewer");

  await check("generic settings cannot mutate reserved capital goal", async () => {
    const [before] = await admin("/rest/v1/portal_settings?key=eq.capital_goal&select=value");
    const result = await api("/api/settings", owner.token, {
      method: "PUT",
      body: JSON.stringify({ capital_goal: 1 }),
    });
    assert.equal(result.response.status, 422, JSON.stringify(result.payload));
    const [after] = await admin("/rest/v1/portal_settings?key=eq.capital_goal&select=value");
    assert.deepEqual(after, before);
  });

  await check("direct settings writes cannot update or delete capital goal", async () => {
    const [before] = await admin("/rest/v1/portal_settings?key=eq.capital_goal&select=value");
    await admin("/rest/v1/portal_settings?key=eq.capital_goal", { method: "DELETE" });
    await direct("/rest/v1/portal_settings", owner.token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ key: "capital_goal", value: 1, updated_by: owner.name }),
    });
    const absentAfterInsert = await admin("/rest/v1/portal_settings?key=eq.capital_goal&select=value");
    assert.deepEqual(absentAfterInsert, []);
    await admin("/rest/v1/portal_settings", {
      method: "POST",
      body: JSON.stringify({ key: "capital_goal", value: before.value, updated_by: owner.name }),
    });
    await direct("/rest/v1/portal_settings?key=eq.capital_goal", owner.token, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ value: 2 }),
    });
    await direct("/rest/v1/portal_settings?key=eq.capital_goal", owner.token, {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
    const [after] = await admin("/rest/v1/portal_settings?key=eq.capital_goal&select=value");
    assert.deepEqual(after, before);
  });

  await check("Chairperson cannot create a goal proposal", async () => {
    const result = await api("/api/capital", chair.token, {
      method: "POST",
      body: JSON.stringify({ action: "goal", newAmount: 820_000 }),
    });
    assert.equal(result.response.status, 403, JSON.stringify(result.payload));
  });

  let pendingGoal;
  await check("goal electorate is snapshotted and only one proposal can remain pending", async () => {
    const result = await api("/api/capital", owner.token, {
      method: "POST",
      body: JSON.stringify({ action: "goal", newAmount: 830_000 }),
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    createdGoalProposals.push(result.payload.id);
    pendingGoal = result.payload;
    assert.equal(result.payload.status, "pending");
    assert.deepEqual(new Set(result.payload.signatures.map((entry) => entry.memberId)), new Set([owner.memberId, chair.memberId, treasurer.memberId, analyst.memberId]));
    assert.equal(result.payload.signatures.find((entry) => entry.memberId === owner.memberId)?.signed, true);
    assert.equal(result.payload.signatures.some((entry) => entry.memberId === viewer.memberId), false);
    const duplicate = await api("/api/capital", treasurer.token, {
      method: "POST",
      body: JSON.stringify({ action: "goal", newAmount: 840_000 }),
    });
    assert.equal(duplicate.response.status, 409, JSON.stringify(duplicate.payload));
  });

  await check("concurrent duplicate goal co-signs are idempotent and apply atomically", async () => {
    assert(pendingGoal);
    const duplicateResults = await Promise.all([
      api("/api/capital", treasurer.token, { method: "POST", body: JSON.stringify({ action: "approve-goal", proposalId: pendingGoal.id }) }),
      api("/api/capital", treasurer.token, { method: "POST", body: JSON.stringify({ action: "approve-goal", proposalId: pendingGoal.id }) }),
    ]);
    assert(duplicateResults.every(({ response }) => response.status === 200), JSON.stringify(duplicateResults.map(({ response, payload }) => [response.status, payload])));
    await api("/api/capital", chair.token, { method: "POST", body: JSON.stringify({ action: "approve-goal", proposalId: pendingGoal.id }) });
    const final = await api("/api/capital", analyst.token, { method: "POST", body: JSON.stringify({ action: "approve-goal", proposalId: pendingGoal.id }) });
    assert.equal(final.response.status, 200, JSON.stringify(final.payload));
    assert.equal(final.payload.approved, true);
    assert.equal(final.payload.approvals.filter((id) => id === treasurer.memberId).length, 1);
    const approvals = await admin(`/rest/v1/capital_goal_approvals?proposal_id=eq.${pendingGoal.id}&select=member_id`);
    assert.equal(approvals.filter((row) => row.member_id === treasurer.memberId).length, 1);
    const [proposal] = await admin(`/rest/v1/capital_goal_proposals?id=eq.${pendingGoal.id}&select=status`);
    const [goal] = await admin("/rest/v1/portal_settings?key=eq.capital_goal&select=value");
    assert.equal(proposal.status, "approved");
    assert.equal(Number(goal.value), 830_000);
  });

  let correction;
  await check("correction maker cannot self-approve", async () => {
    const contribution = await api("/api/capital", owner.token, {
      method: "POST",
      body: JSON.stringify({ action: "contribution", amount: 500, note: `Governance ${runId}` }),
    });
    assert.equal(contribution.response.status, 201, JSON.stringify(contribution.payload));
    createdContributions.push(contribution.payload.id);
    const result = await api("/api/capital", owner.token, {
      method: "POST",
      body: JSON.stringify({ action: "correction", contributionId: contribution.payload.id, correctionAction: "edit", amount: 575, proposedNote: `Corrected ${runId}` }),
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    createdCorrectionProposals.push(result.payload.id);
    correction = result.payload;
    assert.deepEqual(result.payload.approvals, []);
    const selfApproval = await api("/api/capital", owner.token, {
      method: "POST",
      body: JSON.stringify({ action: "approve-correction", proposalId: result.payload.id }),
    });
    assert.equal(selfApproval.response.status, 403, JSON.stringify(selfApproval.payload));
  });

  await check("one distinct concurrent correction co-signer applies exactly once atomically", async () => {
    assert(correction);
    const results = await Promise.all([
      api("/api/capital", analyst.token, { method: "POST", body: JSON.stringify({ action: "approve-correction", proposalId: correction.id }) }),
      api("/api/capital", analyst.token, { method: "POST", body: JSON.stringify({ action: "approve-correction", proposalId: correction.id }) }),
    ]);
    assert(results.every(({ response }) => response.status === 200), JSON.stringify(results.map(({ response, payload }) => [response.status, payload])));
    assert.equal(results.filter(({ payload }) => payload.changed === true).length, 1);
    assert.equal(results.filter(({ payload }) => payload.changed === false).length, 1);
    const approvals = await admin(`/rest/v1/capital_correction_approvals?proposal_id=eq.${correction.id}&select=member_id`);
    assert.deepEqual(approvals, [{ member_id: analyst.memberId }]);
    const [proposal] = await admin(`/rest/v1/capital_correction_proposals?id=eq.${correction.id}&select=status`);
    const [contribution] = await admin(`/rest/v1/capital_contributions?id=eq.${correction.contributionId}&select=amount,note,status`);
    assert.equal(proposal.status, "approved");
    assert.equal(Number(contribution.amount), 575);
    assert.equal(contribution.note, `Corrected ${runId}`);
    assert.equal(contribution.status, "corrected");
    const activity = await admin(`/rest/v1/activity_events?event_type=eq.correction_cosign&entity_type=eq.capital_correction&entity_id=eq.${correction.id}&select=id`);
    assert.equal(activity.length, 1, "duplicate idempotent correction requests emitted multiple activity events");
  });

  await check("finalized correction accepts no new effective approvals", async () => {
    assert(correction);
    const before = await admin(`/rest/v1/capital_correction_approvals?proposal_id=eq.${correction.id}&select=member_id`);
    const result = await api("/api/capital", treasurer.token, {
      method: "POST",
      body: JSON.stringify({ action: "approve-correction", proposalId: correction.id }),
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    assert.equal(result.payload.changed, false);
    const after = await admin(`/rest/v1/capital_correction_approvals?proposal_id=eq.${correction.id}&select=member_id`);
    assert.deepEqual(after, before);
  });

  await check("removed contribution stays out of fresh effective ledger totals", async () => {
    const baseline = await api("/api/capital", owner.token);
    assert.equal(baseline.response.status, 200, JSON.stringify(baseline.payload));
    const baselineTotal = baseline.payload.contributions.reduce((sum, row) => sum + Number(row.amount), 0);
    const contribution = await api("/api/capital", owner.token, {
      method: "POST",
      body: JSON.stringify({ action: "contribution", amount: 625, note: `Remove ${runId}` }),
    });
    assert.equal(contribution.response.status, 201, JSON.stringify(contribution.payload));
    createdContributions.push(contribution.payload.id);
    const proposal = await api("/api/capital", owner.token, {
      method: "POST",
      body: JSON.stringify({ action: "correction", contributionId: contribution.payload.id, correctionAction: "remove", proposedNote: `Remove ${runId}` }),
    });
    assert.equal(proposal.response.status, 201, JSON.stringify(proposal.payload));
    createdCorrectionProposals.push(proposal.payload.id);
    const approval = await api("/api/capital", treasurer.token, {
      method: "POST",
      body: JSON.stringify({ action: "approve-correction", proposalId: proposal.payload.id }),
    });
    assert.equal(approval.response.status, 200, JSON.stringify(approval.payload));
    const fresh = await api("/api/capital", owner.token);
    assert.equal(fresh.response.status, 200, JSON.stringify(fresh.payload));
    assert.equal(fresh.payload.contributions.some((row) => row.id === contribution.payload.id), false);
    assert.equal(fresh.payload.contributions.reduce((sum, row) => sum + Number(row.amount), 0), baselineTotal, "removed amount still contributes to effective total");
    const [auditRow] = await admin(`/rest/v1/capital_contributions?id=eq.${contribution.payload.id}&select=status`);
    assert.equal(auditRow.status, "removed", "removal audit row was not retained");
  });

  await check("active members can read but cannot directly mutate governance records", async () => {
    const reads = await Promise.all([
      direct(`/rest/v1/capital_goal_proposals?id=eq.${pendingGoal.id}&select=id`, viewer.token),
      direct(`/rest/v1/capital_goal_approvals?proposal_id=eq.${pendingGoal.id}&select=member_id`, viewer.token),
      direct(`/rest/v1/capital_goal_electorate?proposal_id=eq.${pendingGoal.id}&select=member_id`, viewer.token),
      direct(`/rest/v1/capital_correction_proposals?id=eq.${correction.id}&select=id`, viewer.token),
      direct(`/rest/v1/capital_correction_approvals?proposal_id=eq.${correction.id}&select=member_id`, viewer.token),
    ]);
    for (const read of reads) {
      assert.equal(read.response.status, 200, JSON.stringify(read.payload));
      assert(read.payload.length > 0);
    }

    const [goalBefore] = await admin(`/rest/v1/capital_goal_proposals?id=eq.${pendingGoal.id}&select=status`);
    const goalApprovalsBefore = await admin(`/rest/v1/capital_goal_approvals?proposal_id=eq.${pendingGoal.id}&select=member_id`);
    const correctionApprovalsBefore = await admin(`/rest/v1/capital_correction_approvals?proposal_id=eq.${correction.id}&select=member_id`);
    const goalCountBefore = await admin("/rest/v1/capital_goal_proposals?select=id");
    const correctionCountBefore = await admin("/rest/v1/capital_correction_proposals?select=id");
    await Promise.all([
      direct("/rest/v1/capital_goal_proposals", owner.token, { method: "POST", body: JSON.stringify({ proposed_by: owner.name, proposed_by_role: "Owner", proposed_by_member_id: owner.memberId, new_amount: 1 }) }),
      direct(`/rest/v1/capital_goal_proposals?id=eq.${pendingGoal.id}`, owner.token, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }),
      direct(`/rest/v1/capital_goal_approvals?proposal_id=eq.${pendingGoal.id}&member_id=eq.${owner.memberId}`, owner.token, { method: "DELETE" }),
      direct("/rest/v1/capital_correction_proposals", owner.token, { method: "POST", body: JSON.stringify({ contribution_id: correction.contributionId, proposed_by: owner.name, proposed_by_role: "Owner", proposed_by_member_id: owner.memberId, action: "remove" }) }),
      direct("/rest/v1/capital_correction_approvals", analyst.token, { method: "POST", body: JSON.stringify({ proposal_id: correction.id, member_id: treasurer.memberId }) }),
    ]);
    const [goalAfter] = await admin(`/rest/v1/capital_goal_proposals?id=eq.${pendingGoal.id}&select=status`);
    const goalApprovalsAfter = await admin(`/rest/v1/capital_goal_approvals?proposal_id=eq.${pendingGoal.id}&select=member_id`);
    const correctionApprovalsAfter = await admin(`/rest/v1/capital_correction_approvals?proposal_id=eq.${correction.id}&select=member_id`);
    const goalCountAfter = await admin("/rest/v1/capital_goal_proposals?select=id");
    const correctionCountAfter = await admin("/rest/v1/capital_correction_proposals?select=id");
    assert.deepEqual(goalAfter, goalBefore);
    assert.deepEqual(goalApprovalsAfter, goalApprovalsBefore);
    assert.deepEqual(correctionApprovalsAfter, correctionApprovalsBefore);
    assert.equal(goalCountAfter.length, goalCountBefore.length);
    assert.equal(correctionCountAfter.length, correctionCountBefore.length);
  });

  assert.equal(failures.length, 0, `${failures.length} capital governance regression checks failed`);
  console.log("Capital governance smoke passed: reserved settings, stable approvals, RLS, concurrency, and atomic effects asserted.");
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
