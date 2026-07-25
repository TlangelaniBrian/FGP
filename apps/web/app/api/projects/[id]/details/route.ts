import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, milestones, projectBudgetItems, projectContacts, projectDecisions, projects } from "@fgp/database";
import { requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

const detailSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("budget"), category: z.string().min(1).max(100), item: z.string().min(1).max(160), totalCost: z.number().nonnegative(), status: z.string().max(40).default("estimate") }),
  z.object({ action: z.literal("contact"), role: z.string().min(1).max(100), name: z.string().min(1).max(160), email: z.string().email().optional(), phone: z.string().max(60).optional(), status: z.string().max(40).default("pending") }),
  z.object({ action: z.literal("decision"), decidedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), decision: z.string().min(1).max(1000), rationale: z.string().max(2000).optional(), impact: z.string().max(2000).optional() }),
  z.object({ action: z.literal("milestone"), targetDate: z.string().min(1).max(80), milestone: z.string().min(1).max(200), owner: z.string().max(160).optional(), status: z.string().max(40).default("PENDING") }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSessionCapability("project", req);
  if (guard.response) return guard.response;
  const projectId = Number((await params).id);
  if (!Number.isInteger(projectId)) return NextResponse.json({ error: "invalid project id" }, { status: 400 });
  const [project] = await db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, guard.actor!.userId))).limit(1);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  const parsed = detailSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  let row: unknown;
  if (parsed.data.action === "budget") row = (await db.insert(projectBudgetItems).values({ projectId, category: parsed.data.category, item: parsed.data.item, totalCost: String(parsed.data.totalCost), status: parsed.data.status }).returning())[0];
  if (parsed.data.action === "contact") row = (await db.insert(projectContacts).values({ projectId, role: parsed.data.role, name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone, status: parsed.data.status }).returning())[0];
  if (parsed.data.action === "decision") row = (await db.insert(projectDecisions).values({ projectId, decidedAt: parsed.data.decidedAt, decision: parsed.data.decision, rationale: parsed.data.rationale, impact: parsed.data.impact }).returning())[0];
  if (parsed.data.action === "milestone") row = (await db.insert(milestones).values({ projectId, targetDate: parsed.data.targetDate, milestone: parsed.data.milestone, owner: parsed.data.owner, status: parsed.data.status }).returning())[0];
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: `project_${parsed.data.action}`, title: `Project detail added: ${parsed.data.action}`, detail: project.name ?? `Project #${projectId}`, entityType: "project", entityId: projectId });
  return NextResponse.json(row, { status: 201 });
}
