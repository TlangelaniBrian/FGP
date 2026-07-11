import { NextRequest, NextResponse } from "next/server";
import {
  db, projects, projectBudgetItems, projectContacts,
  projectDecisions, milestones, projectCheckins,
} from "@fgp/database";
import { eq, desc, sql } from "drizzle-orm";
import { requireCapability } from "@/lib/portal-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
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
  const guard = requireCapability(req, "project");
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
  }).where(eq(projects.id, projectId)).returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row);
}
