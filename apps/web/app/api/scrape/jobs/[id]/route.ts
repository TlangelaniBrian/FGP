import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, scrapeJobs } from "@fgp/database";
import { getAuthenticatedActor } from "@/lib/portal-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAuthenticatedActor(_req)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const actor = await getAuthenticatedActor(_req);
  const [job] = await db.select().from(scrapeJobs).where(sql`${scrapeJobs.id} = ${id} AND ${scrapeJobs.userId} = ${actor!.userId}`);
  return job ? NextResponse.json(job) : NextResponse.json({ error: "not found" }, { status: 404 });
}
