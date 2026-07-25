import { NextRequest, NextResponse } from "next/server";
import { desc, eq, ne } from "drizzle-orm";
import { db, capitalContributions, portalSettings, teamMembers } from "@fgp/database";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";
import {
  approveCorrectionProposal,
  approveGoalProposal,
  CapitalGovernanceError,
  createCorrectionProposal,
  createGoalProposal,
  getPendingCorrectionProposals,
  getPendingGoalProposal,
} from "@/lib/capital-governance";

async function getGoverningMembers() {
  const rows = await db
    .select({ memberId: teamMembers.id, name: teamMembers.name, role: teamMembers.role, status: teamMembers.status })
    .from(teamMembers);
  return rows.filter((member) => member.status === "active" && member.role !== "Viewer");
}

export async function GET(req: NextRequest) {
  if (!(await getAuthenticatedActor(req))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const [contributions, goalSetting, goalProposal, corrections, governingMembers] = await Promise.all([
    db.select().from(capitalContributions).where(ne(capitalContributions.status, "removed")).orderBy(desc(capitalContributions.contributionDate), desc(capitalContributions.createdAt)),
    db.select().from(portalSettings).where(eq(portalSettings.key, "capital_goal")),
    getPendingGoalProposal(),
    getPendingCorrectionProposals(),
    getGoverningMembers(),
  ]);
  return NextResponse.json({
    contributions,
    goal: Number(goalSetting[0]?.value ?? 760000),
    goalProposal,
    corrections,
    governance: { requiredMembers: goalProposal?.signatures ?? [], members: governingMembers },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    action?: string;
    amount?: number;
    note?: string;
    contributionId?: number;
    newAmount?: number;
    proposalId?: number;
    correctionAction?: "edit" | "remove";
    proposedNote?: string;
  };
  try {
    if (body.action === "contribution") {
      const guard = await requireSessionCapability("record", req);
      if (guard.response) return guard.response;
      if (!Number.isFinite(body.amount) || (body.amount ?? 0) <= 0) {
        return NextResponse.json({ error: "amount must be greater than zero" }, { status: 422 });
      }
      const [row] = await db
        .insert(capitalContributions)
        .values({
          memberName: guard.actor!.name,
          memberRole: guard.actor!.role,
          amount: String(body.amount),
          contributionDate: new Date().toISOString().slice(0, 10),
          note: body.note ?? "Monthly contribution",
        })
        .returning();
      await recordActivity({
        actorUserId: guard.actor!.userId,
        actorName: guard.actor!.name,
        eventType: "contribution",
        title: "Contribution recorded",
        detail: `R ${Number(body.amount).toLocaleString("en-ZA")}`,
        entityType: "capital_contribution",
        entityId: row.id,
      });
      return NextResponse.json(row, { status: 201 });
    }

    if (body.action === "goal") {
      const guard = await requireSessionCapability("proposal", req);
      if (guard.response) return guard.response;
      if (!Number.isFinite(body.newAmount) || (body.newAmount ?? 0) <= 0) {
        return NextResponse.json({ error: "newAmount must be greater than zero" }, { status: 422 });
      }
      const proposal = await createGoalProposal(guard.actor!, body.newAmount!);
      await recordActivity({
        actorUserId: guard.actor!.userId,
        actorName: guard.actor!.name,
        eventType: "goal_proposal",
        title: proposal.status === "approved" ? "Capital goal approved" : "Capital goal proposal created",
        detail: `R ${Number(body.newAmount).toLocaleString("en-ZA")}`,
        entityType: "capital_goal_proposal",
        entityId: proposal.id,
      });
      return NextResponse.json(proposal, { status: 201 });
    }

    if (body.action === "approve-goal") {
      const guard = await requireSessionCapability("cosign", req);
      if (guard.response) return guard.response;
      if (!body.proposalId) return NextResponse.json({ error: "proposalId is required" }, { status: 422 });
      const proposal = await approveGoalProposal(guard.actor!, body.proposalId);
      if (proposal.changed) {
        await recordActivity({
          actorUserId: guard.actor!.userId,
          actorName: guard.actor!.name,
          eventType: "goal_cosign",
          title: proposal.approved ? "Capital goal approved" : "Capital goal co-signed",
          detail: `Proposal #${proposal.id}`,
          entityType: "capital_goal_proposal",
          entityId: proposal.id,
        });
      }
      return NextResponse.json(proposal);
    }

    if (body.action === "correction") {
      const guard = await requireSessionCapability("proposal", req);
      if (guard.response) return guard.response;
      if (!body.contributionId || !body.correctionAction) {
        return NextResponse.json({ error: "contributionId and correctionAction are required" }, { status: 422 });
      }
      if (body.correctionAction === "edit" && (!Number.isFinite(body.amount) || (body.amount ?? 0) <= 0)) {
        return NextResponse.json({ error: "amount must be greater than zero for an edit" }, { status: 422 });
      }
      const proposal = await createCorrectionProposal(guard.actor!, {
        contributionId: body.contributionId,
        action: body.correctionAction,
        amount: body.amount,
        note: body.proposedNote,
      });
      await recordActivity({
        actorUserId: guard.actor!.userId,
        actorName: guard.actor!.name,
        eventType: "correction_proposal",
        title: "Contribution correction proposed",
        detail: `${body.correctionAction} · contribution #${body.contributionId}`,
        entityType: "capital_correction",
        entityId: proposal.id,
      });
      return NextResponse.json(proposal, { status: 201 });
    }

    if (body.action === "approve-correction") {
      const guard = await requireSessionCapability("cosign", req);
      if (guard.response) return guard.response;
      if (!body.proposalId) return NextResponse.json({ error: "proposalId is required" }, { status: 422 });
      const proposal = await approveCorrectionProposal(guard.actor!, body.proposalId);
      if (proposal.changed) {
        await recordActivity({
          actorUserId: guard.actor!.userId,
          actorName: guard.actor!.name,
          eventType: "correction_cosign",
          title: "Contribution correction approved",
          detail: `Proposal #${proposal.id}`,
          entityType: "capital_correction",
          entityId: proposal.id,
        });
      }
      return NextResponse.json(proposal);
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof CapitalGovernanceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
