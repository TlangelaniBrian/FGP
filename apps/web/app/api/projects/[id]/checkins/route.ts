import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, projectCheckins } from "@fgp/database";

const schema = z.object({
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attorneyStatus: z.string().max(1000).optional(),
  savingsConfirmed: z.boolean().optional(),
  depositZar: z.number().nonnegative().max(100_000_000).optional(),
  supplierProgress: z.string().max(1000).optional(),
  openIssues: z.string().max(2000).optional(),
  actionsNextCall: z.string().max(2000).optional(),
  decisionsNeeded: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { depositZar, ...rest } = parsed.data;
  const [checkin] = await db.insert(projectCheckins).values({
    projectId,
    ...rest,
    // numeric columns are represented as strings in Drizzle
    depositZar: depositZar != null ? String(depositZar) : undefined,
  }).returning();

  return NextResponse.json(checkin, { status: 201 });
}
