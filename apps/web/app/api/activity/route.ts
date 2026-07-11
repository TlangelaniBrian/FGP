import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, activityEvents } from "@fgp/database";
import { getAuthenticatedActor } from "@/lib/portal-auth";

export async function GET() {
  if (!await getAuthenticatedActor()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const rows = await db.select().from(activityEvents).orderBy(desc(activityEvents.createdAt)).limit(30);
  return NextResponse.json(rows);
}
