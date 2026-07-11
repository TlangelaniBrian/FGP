import { NextRequest, NextResponse } from "next/server";
import {
  db, projects, projectBudgetItems, projectContacts,
  projectDecisions, milestones, projectCheckins,
} from "@fgp/database";
import { eq, desc, sql } from "drizzle-orm";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAuthenticatedActor(_req);
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const [project] = await db.select().from(projects).where(sql`${projects.id} = ${projectId} AND ${projects.userId} = ${actor.userId}`);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [budget, contacts, decisions, projectMilestones, checkins, savedAgg] = await Promise.all([
    db.select().from(projectBudgetItems).where(eq(projectBudgetItems.projectId, projectId)),
    db.select().from(projectContacts).where(eq(projectContacts.projectId, projectId)),
    db.select().from(projectDecisions).where(eq(projectDecisions.projectId, projectId)).orderBy(desc(projectDecisions.decidedAt)),
    db.select().from(milestones).where(eq(milestones.projectId, projectId)),
    db.select().from(projectCheckins).where(eq(projectCheckins.projectId, projectId)).orderBy(desc(projectCheckins.weekOf)).limit(1),
    db
      .select({ total: sql<string>`coalesce(sum(${projectCheckins.depositZar}), 0)` })
      .from(projectCheckins)
      .where(eq(projectCheckins.projectId, projectId)),
  ]);

  return NextResponse.json({
    project,
    budget,
    contacts,
    decisions,
    milestones: projectMilestones,
    latestCheckin: checkins[0] ?? null,
    savedToDate: Number(savedAgg[0]?.total ?? 0),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireSessionCapability("project", req);
  if (guard.response) return guard.response;
  const projectId = parseInt((await params).id, 10);
  if (isNaN(projectId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const body = await req.json() as { name?: string; status?: string; notes?: string; monthlySavingZar?: number; phase1TargetZar?: number };
  const allowedStatuses = ["planning", "compliance", "approved", "construction", "complete", "stalled"];
  if (body.status && !allowedStatuses.includes(body.status)) return NextResponse.json({ error: "invalid status" }, { status: 422 });
  const [row] = await db.update(projects).set({
    name: body.name,
    status: body.status,
    notes: body.notes,
    monthlySavingZar: body.monthlySavingZar == null ? undefined : String(body.monthlySavingZar),
    phase1TargetZar: body.phase1TargetZar == null ? undefined : String(body.phase1TargetZar),
    updatedAt: new Date(),
  }).where(sql`${projects.id} = ${projectId} AND ${projects.userId} = ${guard.actor!.userId}`).returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "project_updated", title: `Project updated: ${row.name}`, detail: row.status ?? undefined, entityType: "project", entityId: row.id });
  return NextResponse.json(row);
}
