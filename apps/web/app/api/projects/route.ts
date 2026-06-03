import { NextResponse } from "next/server";
import { db, projects } from "@fgp/database";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  return NextResponse.json(rows);
}
