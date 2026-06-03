import { NextRequest, NextResponse } from "next/server";
import {
  db, projects, projectBudgetItems, projectContacts,
  projectDecisions, milestones, projectCheckins,
} from "@fgp/database";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [budget, contacts, decisions, projectMilestones, checkins] = await Promise.all([
    db.select().from(projectBudgetItems).where(eq(projectBudgetItems.projectId, projectId)),
    db.select().from(projectContacts).where(eq(projectContacts.projectId, projectId)),
    db.select().from(projectDecisions).where(eq(projectDecisions.projectId, projectId)).orderBy(desc(projectDecisions.decidedAt)),
    db.select().from(milestones).where(eq(milestones.projectId, projectId)),
    db.select().from(projectCheckins).where(eq(projectCheckins.projectId, projectId)).orderBy(desc(projectCheckins.weekOf)).limit(1),
  ]);

  return NextResponse.json({
    project,
    budget,
    contacts,
    decisions,
    milestones: projectMilestones,
    latestCheckin: checkins[0] ?? null,
  });
}
