import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  capitalContributions,
  capitalCorrectionApprovals,
  capitalCorrectionProposals,
  capitalGoalApprovals,
  capitalGoalElectorate,
  capitalGoalProposals,
  db,
  portalSettings,
  teamMembers,
} from "@fgp/database";
import type { PortalActor } from "./portal-actor";

const proposalRoles = ["Owner", "Treasurer"] as const;
const cosignRoles = ["Owner", "Chairperson", "Treasurer", "Analyst"] as const;

export class CapitalGovernanceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Transaction;

function assertRole(actor: PortalActor, allowed: readonly string[], action: string) {
  if (!allowed.includes(actor.role)) {
    throw new CapitalGovernanceError(`${actor.role} cannot ${action}`, 403);
  }
}

async function goalProposalResponse(executor: Executor, proposalId: number) {
  const [proposal] = await executor
    .select()
    .from(capitalGoalProposals)
    .where(eq(capitalGoalProposals.id, proposalId))
    .limit(1);
  if (!proposal) throw new CapitalGovernanceError("goal proposal not found", 404);

  const [electorate, approvals] = await Promise.all([
    executor
      .select({
        memberId: capitalGoalElectorate.memberId,
        name: capitalGoalElectorate.memberName,
        role: capitalGoalElectorate.memberRole,
      })
      .from(capitalGoalElectorate)
      .where(eq(capitalGoalElectorate.proposalId, proposalId))
      .orderBy(asc(capitalGoalElectorate.memberId)),
    executor
      .select({ memberId: capitalGoalApprovals.memberId })
      .from(capitalGoalApprovals)
      .where(eq(capitalGoalApprovals.proposalId, proposalId))
      .orderBy(asc(capitalGoalApprovals.memberId)),
  ]);
  const signedIds = new Set(approvals.map((approval) => approval.memberId));
  return {
    ...proposal,
    approvals: approvals.map((approval) => approval.memberId),
    signatures: electorate.map((member) => ({ ...member, signed: signedIds.has(member.memberId) })),
  };
}

async function correctionProposalResponse(executor: Executor, proposalId: number) {
  const [proposal] = await executor
    .select()
    .from(capitalCorrectionProposals)
    .where(eq(capitalCorrectionProposals.id, proposalId))
    .limit(1);
  if (!proposal) throw new CapitalGovernanceError("correction proposal not found", 404);
  const [approvals, eligibleMembers] = await Promise.all([
    executor
      .select({ memberId: capitalCorrectionApprovals.memberId })
      .from(capitalCorrectionApprovals)
      .where(eq(capitalCorrectionApprovals.proposalId, proposalId))
      .orderBy(asc(capitalCorrectionApprovals.memberId)),
    executor
      .select({ memberId: teamMembers.id, name: teamMembers.name, role: teamMembers.role })
      .from(teamMembers)
      .where(and(
        eq(teamMembers.status, "active"),
        inArray(teamMembers.role, [...cosignRoles]),
        proposal.proposedByMemberId == null
          ? sql`true`
          : ne(teamMembers.id, proposal.proposedByMemberId),
      ))
      .orderBy(asc(teamMembers.id)),
  ]);
  const signedIds = new Set(approvals.map((approval) => approval.memberId));
  return {
    ...proposal,
    approvals: approvals.map((approval) => approval.memberId),
    signatures: eligibleMembers.map((member) => ({ ...member, signed: signedIds.has(member.memberId) })),
  };
}

export async function createGoalProposal(actor: PortalActor, newAmount: number) {
  assertRole(actor, proposalRoles, "propose a capital goal");
  try {
    return await db.transaction(async (tx) => {
      const electorate = await tx
        .select({ memberId: teamMembers.id, name: teamMembers.name, role: teamMembers.role })
        .from(teamMembers)
        .where(and(eq(teamMembers.status, "active"), ne(teamMembers.role, "Viewer")))
        .orderBy(asc(teamMembers.id));
      if (!electorate.some((member) => member.memberId === actor.memberId)) {
        throw new CapitalGovernanceError("proposal maker is not an active governing member", 403);
      }

      const [proposal] = await tx
        .insert(capitalGoalProposals)
        .values({
          proposedBy: actor.name,
          proposedByRole: actor.role,
          proposedByMemberId: actor.memberId,
          newAmount: String(newAmount),
        })
        .returning();
      await tx.insert(capitalGoalElectorate).values(
        electorate.map((member) => ({
          proposalId: proposal.id,
          memberId: member.memberId,
          memberName: member.name,
          memberRole: member.role,
        })),
      );
      await tx.insert(capitalGoalApprovals).values({ proposalId: proposal.id, memberId: actor.memberId });

      if (electorate.length === 1) {
        await tx.update(capitalGoalProposals).set({ status: "approved" }).where(eq(capitalGoalProposals.id, proposal.id));
        await tx
          .insert(portalSettings)
          .values({ key: "capital_goal", value: newAmount, updatedBy: actor.name })
          .onConflictDoUpdate({
            target: portalSettings.key,
            set: { value: newAmount, updatedBy: actor.name, updatedAt: new Date() },
          });
      }
      return goalProposalResponse(tx, proposal.id);
    });
  } catch (error) {
    if (error instanceof CapitalGovernanceError) throw error;
    const directCode = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
    const causeCode = typeof cause === "object" && cause !== null && "code" in cause ? cause.code : undefined;
    if (directCode === "23505" || causeCode === "23505") {
      throw new CapitalGovernanceError("a capital goal proposal is already pending", 409);
    }
    throw error;
  }
}

export async function approveGoalProposal(actor: PortalActor, proposalId: number) {
  assertRole(actor, cosignRoles, "co-sign a capital goal");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from capital_goal_proposals where id = ${proposalId} for update`);
    const [proposal] = await tx
      .select()
      .from(capitalGoalProposals)
      .where(eq(capitalGoalProposals.id, proposalId))
      .limit(1);
    if (!proposal) throw new CapitalGovernanceError("goal proposal not found", 404);
    if (proposal.status === "rejected") throw new CapitalGovernanceError("goal proposal is no longer pending", 409);

    const [eligible] = await tx
      .select({ memberId: capitalGoalElectorate.memberId })
      .from(capitalGoalElectorate)
      .where(and(eq(capitalGoalElectorate.proposalId, proposalId), eq(capitalGoalElectorate.memberId, actor.memberId)))
      .limit(1);
    if (!eligible) throw new CapitalGovernanceError("actor is not in this proposal electorate", 403);
    if (proposal.status === "approved") {
      return { approved: true, changed: false, ...(await goalProposalResponse(tx, proposalId)) };
    }
    const inserted = await tx
      .insert(capitalGoalApprovals)
      .values({ proposalId, memberId: actor.memberId })
      .onConflictDoNothing()
      .returning({ memberId: capitalGoalApprovals.memberId });
    const changed = inserted.length > 0;

    const [[required], [approvalCount]] = await Promise.all([
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(capitalGoalElectorate)
        .where(eq(capitalGoalElectorate.proposalId, proposalId)),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(capitalGoalApprovals)
        .where(eq(capitalGoalApprovals.proposalId, proposalId)),
    ]);
    const approved = proposal.status === "approved" || (required.count > 0 && approvalCount.count === required.count);
    if (approved && proposal.status === "pending") {
      await tx.update(capitalGoalProposals).set({ status: "approved" }).where(eq(capitalGoalProposals.id, proposalId));
      await tx
        .insert(portalSettings)
        .values({ key: "capital_goal", value: Number(proposal.newAmount), updatedBy: actor.name })
        .onConflictDoUpdate({
          target: portalSettings.key,
          set: { value: Number(proposal.newAmount), updatedBy: actor.name, updatedAt: new Date() },
        });
    }
    return { approved, changed, ...(await goalProposalResponse(tx, proposalId)) };
  });
}

export async function createCorrectionProposal(
  actor: PortalActor,
  input: { contributionId: number; action: "edit" | "remove"; amount?: number; note?: string },
) {
  assertRole(actor, proposalRoles, "propose a contribution correction");
  return db.transaction(async (tx) => {
    const [contribution] = await tx
      .select({ id: capitalContributions.id })
      .from(capitalContributions)
      .where(eq(capitalContributions.id, input.contributionId))
      .limit(1);
    if (!contribution) throw new CapitalGovernanceError("contribution not found", 404);
    const [proposal] = await tx
      .insert(capitalCorrectionProposals)
      .values({
        contributionId: input.contributionId,
        proposedBy: actor.name,
        proposedByRole: actor.role,
        proposedByMemberId: actor.memberId,
        action: input.action,
        proposedAmount: input.amount == null ? null : String(input.amount),
        proposedNote: input.note ?? null,
      })
      .returning();
    return correctionProposalResponse(tx, proposal.id);
  });
}

export async function approveCorrectionProposal(actor: PortalActor, proposalId: number) {
  assertRole(actor, cosignRoles, "co-sign a contribution correction");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from capital_correction_proposals where id = ${proposalId} for update`);
    const [proposal] = await tx
      .select()
      .from(capitalCorrectionProposals)
      .where(eq(capitalCorrectionProposals.id, proposalId))
      .limit(1);
    if (!proposal) throw new CapitalGovernanceError("correction proposal not found", 404);
    if (proposal.proposedByMemberId == null) {
      throw new CapitalGovernanceError("correction proposal requires a stable maker identity", 409);
    }
    if (proposal.proposedByMemberId === actor.memberId) {
      throw new CapitalGovernanceError("proposal maker cannot approve their own correction", 403);
    }
    if (proposal.status === "rejected") throw new CapitalGovernanceError("correction proposal is no longer pending", 409);
    if (proposal.status === "approved") {
      return { approved: true, changed: false, ...(await correctionProposalResponse(tx, proposalId)) };
    }

    const [eligible] = await tx
      .select({ memberId: teamMembers.id })
      .from(teamMembers)
      .where(and(
        eq(teamMembers.id, actor.memberId),
        eq(teamMembers.status, "active"),
        inArray(teamMembers.role, [...cosignRoles]),
      ))
      .limit(1);
    if (!eligible) throw new CapitalGovernanceError("actor is not an eligible co-signer", 403);
    const inserted = await tx
      .insert(capitalCorrectionApprovals)
      .values({ proposalId, memberId: actor.memberId })
      .onConflictDoNothing()
      .returning({ memberId: capitalCorrectionApprovals.memberId });
    const changed = inserted.length > 0;

    if (changed) {
      if (proposal.action === "remove") {
        await tx
          .update(capitalContributions)
          .set({ status: "removed" })
          .where(eq(capitalContributions.id, proposal.contributionId));
      } else {
        await tx
          .update(capitalContributions)
          .set({
            amount: proposal.proposedAmount ?? undefined,
            note: proposal.proposedNote ?? undefined,
            status: "corrected",
          })
          .where(eq(capitalContributions.id, proposal.contributionId));
      }
      await tx
        .update(capitalCorrectionProposals)
        .set({ status: "approved" })
        .where(eq(capitalCorrectionProposals.id, proposalId));
    }
    return { approved: true, changed, ...(await correctionProposalResponse(tx, proposalId)) };
  });
}

export async function getPendingGoalProposal() {
  const [proposal] = await db
    .select({ id: capitalGoalProposals.id })
    .from(capitalGoalProposals)
    .where(eq(capitalGoalProposals.status, "pending"))
    .orderBy(desc(capitalGoalProposals.createdAt))
    .limit(1);
  return proposal ? goalProposalResponse(db, proposal.id) : null;
}

export async function getPendingCorrectionProposals() {
  const proposals = await db
    .select({ id: capitalCorrectionProposals.id })
    .from(capitalCorrectionProposals)
    .where(eq(capitalCorrectionProposals.status, "pending"))
    .orderBy(desc(capitalCorrectionProposals.createdAt));
  return Promise.all(proposals.map((proposal) => correctionProposalResponse(db, proposal.id)));
}
