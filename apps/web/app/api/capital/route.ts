import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import {
  db, capitalContributions, capitalGoalProposals, capitalCorrectionProposals, portalSettings,
} from "@fgp/database";
import { requireCapability } from "@/lib/portal-auth";

const activeGoverningMembers = ["Tlangelani Mkhabela", "Thabo Nkosi", "Lerato Dube"];

export async function GET() {
  const [contributions, goalSetting, goalProposal, corrections] = await Promise.all([
    db.select().from(capitalContributions).orderBy(desc(capitalContributions.contributionDate), desc(capitalContributions.createdAt)),
    db.select().from(portalSettings).where(eq(portalSettings.key, "capital_goal")),
    db.select().from(capitalGoalProposals).where(eq(capitalGoalProposals.status, "pending")).orderBy(desc(capitalGoalProposals.createdAt)).limit(1),
    db.select().from(capitalCorrectionProposals).where(eq(capitalCorrectionProposals.status, "pending")).orderBy(desc(capitalCorrectionProposals.createdAt)),
  ]);
  return NextResponse.json({
    contributions,
    goal: Number(goalSetting[0]?.value ?? 760000),
    goalProposal: goalProposal[0] ?? null,
    corrections,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { action?: string; amount?: number; note?: string; contributionId?: number; newAmount?: number; proposalId?: number; correctionAction?: "edit" | "remove"; proposedNote?: string };
  if (body.action === "contribution") {
    const guard = requireCapability(req, "record");
    if (guard.response) return guard.response;
    if (!Number.isFinite(body.amount) || (body.amount ?? 0) <= 0) return NextResponse.json({ error: "amount must be greater than zero" }, { status: 422 });
    const [row] = await db.insert(capitalContributions).values({ memberName: guard.actor!.name, memberRole: guard.actor!.role, amount: String(body.amount), contributionDate: new Date().toISOString().slice(0, 10), note: body.note ?? "Monthly contribution" }).returning();
    return NextResponse.json(row, { status: 201 });
  }
  if (body.action === "goal") {
    const guard = requireCapability(req, "proposal");
    if (guard.response) return guard.response;
    if (!Number.isFinite(body.newAmount) || (body.newAmount ?? 0) <= 0) return NextResponse.json({ error: "newAmount must be greater than zero" }, { status: 422 });
    const [row] = await db.insert(capitalGoalProposals).values({ proposedBy: guard.actor!.name, proposedByRole: guard.actor!.role, newAmount: String(body.newAmount), approvals: [guard.actor!.name] }).returning();
    return NextResponse.json(row, { status: 201 });
  }
  if (body.action === "approve-goal") {
    const guard = requireCapability(req, "cosign");
    if (guard.response) return guard.response;
    if (!body.proposalId) return NextResponse.json({ error: "proposalId is required" }, { status: 422 });
    const [proposal] = await db.select().from(capitalGoalProposals).where(and(eq(capitalGoalProposals.id, body.proposalId), eq(capitalGoalProposals.status, "pending")));
    if (!proposal) return NextResponse.json({ error: "pending goal proposal not found" }, { status: 404 });
    const approvals = Array.isArray(proposal.approvals) ? [...proposal.approvals as string[]] : [];
    if (approvals.includes(guard.actor!.name)) return NextResponse.json({ error: "actor has already co-signed" }, { status: 409 });
    approvals.push(guard.actor!.name);
    const approved = activeGoverningMembers.every((member) => approvals.includes(member));
    await db.update(capitalGoalProposals).set({ approvals, status: approved ? "approved" : "pending" }).where(eq(capitalGoalProposals.id, proposal.id));
    if (approved) await db.insert(portalSettings).values({ key: "capital_goal", value: Number(proposal.newAmount), updatedBy: guard.actor!.name }).onConflictDoUpdate({ target: portalSettings.key, set: { value: Number(proposal.newAmount), updatedBy: guard.actor!.name, updatedAt: new Date() } });
    return NextResponse.json({ approved, approvals });
  }
  if (body.action === "correction") {
    const guard = requireCapability(req, "proposal");
    if (guard.response) return guard.response;
    if (!body.contributionId || !body.correctionAction) return NextResponse.json({ error: "contributionId and correctionAction are required" }, { status: 422 });
    const [row] = await db.insert(capitalCorrectionProposals).values({ contributionId: body.contributionId, proposedBy: guard.actor!.name, proposedByRole: guard.actor!.role, action: body.correctionAction, proposedAmount: body.amount ? String(body.amount) : null, proposedNote: body.proposedNote ?? null, approvals: [guard.actor!.name] }).returning();
    return NextResponse.json(row, { status: 201 });
  }
  if (body.action === "approve-correction") {
    const guard = requireCapability(req, "cosign");
    if (guard.response) return guard.response;
    if (!body.proposalId) return NextResponse.json({ error: "proposalId is required" }, { status: 422 });
    const [proposal] = await db.select().from(capitalCorrectionProposals).where(and(eq(capitalCorrectionProposals.id, body.proposalId), eq(capitalCorrectionProposals.status, "pending")));
    if (!proposal) return NextResponse.json({ error: "pending correction proposal not found" }, { status: 404 });
    const approvals = Array.isArray(proposal.approvals) ? [...proposal.approvals as string[]] : [];
    if (approvals.includes(guard.actor!.name)) return NextResponse.json({ error: "actor has already co-signed" }, { status: 409 });
    approvals.push(guard.actor!.name);
    const approved = approvals.length >= 2;
    if (approved) {
      if (proposal.action === "remove") await db.update(capitalContributions).set({ status: "removed" }).where(eq(capitalContributions.id, proposal.contributionId));
      if (proposal.action === "edit") await db.update(capitalContributions).set({ amount: proposal.proposedAmount ?? undefined, note: proposal.proposedNote ?? undefined, status: "corrected" }).where(eq(capitalContributions.id, proposal.contributionId));
    }
    await db.update(capitalCorrectionProposals).set({ approvals, status: approved ? "approved" : "pending" }).where(eq(capitalCorrectionProposals.id, proposal.id));
    return NextResponse.json({ approved, approvals });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
