import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, tariffs } from "@fgp/database";
import { and, eq } from "drizzle-orm";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";

const DEFAULT_YEAR = 2026;
const tariffYearSchema = z.number().int().min(2024).max(2030);
const positive = z.number().positive().finite();

const unitValuesSchema = z.object({
  bachelor: positive,
  "1bed": positive,
  "2bed": positive,
  luxury: positive,
}).strict();

const bulkRangeSchema = z.tuple([positive, positive]).refine(
  ([minimum, maximum]) => minimum <= maximum,
  "bulk contribution minimum must not exceed maximum",
);

const municipalityBulkSchema = z.object({
  bachelor: bulkRangeSchema,
  "1bed": bulkRangeSchema,
  "2bed": bulkRangeSchema,
  luxury: bulkRangeSchema,
}).strict();

const bulkSchema = z.object({
  johannesburg: municipalityBulkSchema,
  tshwane: municipalityBulkSchema,
  ekurhuleni: municipalityBulkSchema,
}).strict();

const dutyBracketSchema = z.tuple([
  z.number().positive().finite().nullable(),
  z.number().min(0).max(1).finite(),
  z.number().nonnegative().finite(),
]);

const dutyBracketsSchema = z.array(dutyBracketSchema).min(2).superRefine((brackets, ctx) => {
  let previousUpper = -Infinity;
  let previousBase = -Infinity;
  brackets.forEach(([upper, , base], index) => {
    if (upper === null && index !== brackets.length - 1) {
      ctx.addIssue({ code: "custom", path: [index, 0], message: "only the final bracket may have no upper bound" });
    }
    if (upper !== null && upper <= previousUpper) {
      ctx.addIssue({ code: "custom", path: [index, 0], message: "bracket upper bounds must be strictly increasing" });
    }
    if (base < previousBase) {
      ctx.addIssue({ code: "custom", path: [index, 2], message: "bracket cumulative bases must be ordered" });
    }
    if (upper !== null) previousUpper = upper;
    previousBase = base;
  });
  if (brackets.at(-1)?.[0] !== null) {
    ctx.addIssue({ code: "custom", path: [brackets.length - 1, 0], message: "final bracket must have no upper bound" });
  }
});

const writeBase = { year: tariffYearSchema.default(DEFAULT_YEAR) };
const putSchema = z.discriminatedUnion("category", [
  z.object({ ...writeBase, category: z.literal("build_rates"), data: unitValuesSchema }).strict(),
  z.object({ ...writeBase, category: z.literal("unit_sizes"), data: unitValuesSchema }).strict(),
  z.object({ ...writeBase, category: z.literal("market_rents"), data: unitValuesSchema }).strict(),
  z.object({ ...writeBase, category: z.literal("bulk_contributions"), data: bulkSchema }).strict(),
  z.object({ ...writeBase, category: z.literal("transfer_duty_brackets"), data: dutyBracketsSchema }).strict(),
  z.object({
    ...writeBase,
    category: z.literal("fees"),
    data: z.object({ professional_fee_pct: z.number().positive().max(0.3).finite() }).strict(),
  }).strict(),
]);

// GET /api/tariffs?year=2026 → { year, tariffs: { category: data, ... } }
export async function GET(req: NextRequest) {
  if (!await getAuthenticatedActor(req)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const parsedYear = tariffYearSchema.safeParse(Number(searchParams.get("year") ?? DEFAULT_YEAR));
  if (!parsedYear.success) {
    return NextResponse.json({ error: parsedYear.error.flatten() }, { status: 422 });
  }
  const year = parsedYear.data;

  const rows = await db
    .select()
    .from(tariffs)
    .where(eq(tariffs.tariffYear, year));

  const grouped: Record<string, unknown> = {};
  for (const row of rows) grouped[row.category] = row.data;

  return NextResponse.json({ year, tariffs: grouped });
}

// PUT /api/tariffs → upsert one category for a year.
export async function PUT(req: NextRequest) {
  const guard = await requireSessionCapability("tariff", req);
  if (guard.response) return guard.response;
  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const year = parsed.data.year;
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
