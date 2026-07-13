import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import {
  db, capitalContributions, capitalGoalProposals, capitalCorrectionProposals, portalSettings,
  teamMembers,
} from "@fgp/database";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

async function getGoverningMembers() {
  const rows = await db.select({ userId: teamMembers.userId, name: teamMembers.name, role: teamMembers.role, status: teamMembers.status }).from(teamMembers);
  return rows.filter((member): member is typeof member & { userId: string } => member.status === "active" && member.role !== "Viewer" && Boolean(member.userId));
}

export async function GET(req: NextRequest) {
  if (!await getAuthenticatedActor(req)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const [contributions, goalSetting, goalProposal, corrections, governingMembers] = await Promise.all([
    db.select().from(capitalContributions).orderBy(desc(capitalContributions.contributionDate), desc(capitalContributions.createdAt)),
    db.select().from(portalSettings).where(eq(portalSettings.key, "capital_goal")),
    db.select().from(capitalGoalProposals).where(eq(capitalGoalProposals.status, "pending")).orderBy(desc(capitalGoalProposals.createdAt)).limit(1),
    db.select().from(capitalCorrectionProposals).where(eq(capitalCorrectionProposals.status, "pending")).orderBy(desc(capitalCorrectionProposals.createdAt)),
    getGoverningMembers(),
  ]);
  return NextResponse.json({
    contributions,
    goal: Number(goalSetting[0]?.value ?? 760000),
    goalProposal: goalProposal[0] ?? null,
    corrections,
    governance: { requiredMembers: governingMembers, members: governingMembers },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { action?: string; amount?: number; note?: string; contributionId?: number; newAmount?: number; proposalId?: number; correctionAction?: "edit" | "remove"; proposedNote?: string };
  if (body.action === "contribution") {
    const guard = await requireSessionCapability("record", req);
    if (guard.response) return guard.response;
    if (!Number.isFinite(body.amount) || (body.amount ?? 0) <= 0) return NextResponse.json({ error: "amount must be greater than zero" }, { status: 422 });
    const [row] = await db.insert(capitalContributions).values({ memberName: guard.actor!.name, memberRole: guard.actor!.role, amount: String(body.amount), contributionDate: new Date().toISOString().slice(0, 10), note: body.note ?? "Monthly contribution" }).returning();
    await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "contribution", title: "Contribution recorded", detail: `R ${Number(body.amount).toLocaleString("en-ZA")}`, entityType: "capital_contribution", entityId: row.id });
    return NextResponse.json(row, { status: 201 });
  }
  if (body.action === "goal") {
    const guard = await requireSessionCapability("proposal", req);
    if (guard.response) return guard.response;
    if (!Number.isFinite(body.newAmount) || (body.newAmount ?? 0) <= 0) return NextResponse.json({ error: "newAmount must be greater than zero" }, { status: 422 });
    const [row] = await db.insert(capitalGoalProposals).values({ proposedBy: guard.actor!.name, proposedByRole: guard.actor!.role, newAmount: String(body.newAmount), approvals: [guard.actor!.userId] }).returning();
    await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "goal_proposal", title: "Capital goal proposal created", detail: `R ${Number(body.newAmount).toLocaleString("en-ZA")}`, entityType: "capital_goal_proposal", entityId: row.id });
    return NextResponse.json(row, { status: 201 });
  }
  if (body.action === "approve-goal") {
    const guard = await requireSessionCapability("cosign", req);
    if (guard.response) return guard.response;
    if (!body.proposalId) return NextResponse.json({ error: "proposalId is required" }, { status: 422 });
    const [proposal] = await db.select().from(capitalGoalProposals).where(and(eq(capitalGoalProposals.id, body.proposalId), eq(capitalGoalProposals.status, "pending")));
    if (!proposal) return NextResponse.json({ error: "pending goal proposal not found" }, { status: 404 });
    const approvals = Array.isArray(proposal.approvals) ? [...proposal.approvals as string[]] : [];
    if (approvals.includes(guard.actor!.userId)) return NextResponse.json({ error: "actor has already co-signed" }, { status: 409 });
    approvals.push(guard.actor!.userId);
    const governingMembers = await getGoverningMembers();
    const requiredMembers = governingMembers.length ? governingMembers : [{ userId: guard.actor!.userId, name: guard.actor!.name, role: guard.actor!.role, status: "active" }];
    const approved = requiredMembers.every((member) => approvals.includes(member.userId));
    await db.update(capitalGoalProposals).set({ approvals, status: approved ? "approved" : "pending" }).where(eq(capitalGoalProposals.id, proposal.id));
    if (approved) await db.insert(portalSettings).values({ key: "capital_goal", value: Number(proposal.newAmount), updatedBy: guard.actor!.name }).onConflictDoUpdate({ target: portalSettings.key, set: { value: Number(proposal.newAmount), updatedBy: guard.actor!.name, updatedAt: new Date() } });
    await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "goal_cosign", title: approved ? "Capital goal approved" : "Capital goal co-signed", detail: `Proposal #${proposal.id}`, entityType: "capital_goal_proposal", entityId: proposal.id });
    return NextResponse.json({ approved, approvals, requiredMembers });
  }
  if (body.action === "correction") {
    const guard = await requireSessionCapability("proposal", req);
    if (guard.response) return guard.response;
    if (!body.contributionId || !body.correctionAction) return NextResponse.json({ error: "contributionId and correctionAction are required" }, { status: 422 });
    const [row] = await db.insert(capitalCorrectionProposals).values({ contributionId: body.contributionId, proposedBy: guard.actor!.name, proposedByRole: guard.actor!.role, action: body.correctionAction, proposedAmount: body.amount ? String(body.amount) : null, proposedNote: body.proposedNote ?? null, approvals: [guard.actor!.userId] }).returning();
    await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "correction_proposal", title: "Contribution correction proposed", detail: `${body.correctionAction} · contribution #${body.contributionId}`, entityType: "capital_correction", entityId: row.id });
    return NextResponse.json(row, { status: 201 });
  }
  if (body.action === "approve-correction") {
    const guard = await requireSessionCapability("cosign", req);
    if (guard.response) return guard.response;
    if (!body.proposalId) return NextResponse.json({ error: "proposalId is required" }, { status: 422 });
    const [proposal] = await db.select().from(capitalCorrectionProposals).where(and(eq(capitalCorrectionProposals.id, body.proposalId), eq(capitalCorrectionProposals.status, "pending")));
    if (!proposal) return NextResponse.json({ error: "pending correction proposal not found" }, { status: 404 });
    const approvals = Array.isArray(proposal.approvals) ? [...proposal.approvals as string[]] : [];
    if (approvals.includes(guard.actor!.userId)) return NextResponse.json({ error: "actor has already co-signed" }, { status: 409 });
    approvals.push(guard.actor!.userId);
    const approved = approvals.length >= 2;
    if (approved) {
      if (proposal.action === "remove") await db.update(capitalContributions).set({ status: "removed" }).where(eq(capitalContributions.id, proposal.contributionId));
      if (proposal.action === "edit") await db.update(capitalContributions).set({ amount: proposal.proposedAmount ?? undefined, note: proposal.proposedNote ?? undefined, status: "corrected" }).where(eq(capitalContributions.id, proposal.contributionId));
    }
    await db.update(capitalCorrectionProposals).set({ approvals, status: approved ? "approved" : "pending" }).where(eq(capitalCorrectionProposals.id, proposal.id));
    await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "correction_cosign", title: approved ? "Contribution correction approved" : "Contribution correction co-signed", detail: `Proposal #${proposal.id}`, entityType: "capital_correction", entityId: proposal.id });
    return NextResponse.json({ approved, approvals });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
