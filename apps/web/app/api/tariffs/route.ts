import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, tariffs } from "@fgp/database";
import { and, eq } from "drizzle-orm";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";

const DEFAULT_YEAR = 2026;

// The set of categories the worker understands. Editing anything outside this
// list would be silently ignored by the feasibility engine, so we reject it.
const CATEGORIES = [
  "build_rates",
  "unit_sizes",
  "market_rents",
  "bulk_contributions",
  "transfer_duty_brackets",
  "fees",
] as const;

const parseYear = (raw: string | null) => {
  const n = parseInt(raw ?? "", 10);
  return Number.isNaN(n) ? DEFAULT_YEAR : n;
};

// GET /api/tariffs?year=2026 → { year, tariffs: { category: data, ... } }
export async function GET(req: NextRequest) {
  if (!await getAuthenticatedActor()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const year = parseYear(searchParams.get("year"));

  const rows = await db
    .select()
    .from(tariffs)
    .where(eq(tariffs.tariffYear, year));

  const grouped: Record<string, unknown> = {};
  for (const row of rows) grouped[row.category] = row.data;

  return NextResponse.json({ year, tariffs: grouped });
}

const putSchema = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
  category: z.enum(CATEGORIES),
  // `data` shape varies per category (object or array), validated by the worker
  // loader on read; here we only require it to be present JSON.
  data: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]),
});

// PUT /api/tariffs → upsert one category for a year.
export async function PUT(req: NextRequest) {
  const guard = await requireSessionCapability("tariff");
  if (guard.response) return guard.response;
  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const year = parsed.data.year ?? DEFAULT_YEAR;
  const { category, data } = parsed.data;

  const [row] = await db
    .insert(tariffs)
    .values({ tariffYear: year, category, data })
    .onConflictDoUpdate({
      target: [tariffs.tariffYear, tariffs.category],
      set: { data, updatedAt: new Date() },
    })
    .returning();

  // Fall back to a fetch in case the dialect doesn't support RETURNING on upsert.
  if (!row) {
    const [existing] = await db
      .select()
      .from(tariffs)
      .where(and(eq(tariffs.tariffYear, year), eq(tariffs.category, category)))
      .limit(1);
    return NextResponse.json(existing ?? { tariffYear: year, category, data });
  }

  return NextResponse.json(row);
}
