import { NextRequest, NextResponse } from "next/server";
import { db, projects } from "@fgp/database";
import { desc, sql } from "drizzle-orm";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const rawLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const rawOffset = parseInt(searchParams.get("offset") ?? "", 10);
  const limit = Number.isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(Math.max(rawLimit, 1), MAX_LIMIT);
  const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  const rows = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt))
    .limit(limit)
    .offset(offset);

  // When paginated explicitly, return an envelope with total; otherwise keep the
  // bare-array shape the sidebar/layout already consumes (backwards compatible).
  if (searchParams.has("limit") || searchParams.has("offset")) {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(projects);
    return NextResponse.json({ projects: rows, total, limit, offset });
  }

  return NextResponse.json(rows);
}
