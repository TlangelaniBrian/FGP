import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, listings, feasibilityReports } from "@fgp/database";
import { requireSessionCapability } from "@/lib/portal-auth";

const schema = z.object({
  address: z.string().min(1).max(500),
  municipality: z.enum(["johannesburg", "tshwane", "ekurhuleni"]),
  zoneCode: z.string().min(1).max(20),
  sizeSqm: z.number().min(100).max(1_000_000),
  price: z.number().min(10_000).max(500_000_000),
  unitType: z.enum(["bachelor", "1bed", "2bed"]),
  targetUnits: z.number().int().min(1).max(200),
  viable: z.boolean(),
  score: z.number().int().min(0).max(100),
  actualUnits: z.number().int(),
  maxUnitsAllowed: z.number().int(),
  rezoningRequired: z.boolean(),
  maxFootprintSqm: z.number(),
  maxBuildableSqm: z.number(),
  costLand: z.number(),
  costBuild: z.number(),
  costProfessionalFees: z.number(),
  costBulkContributions: z.number(),
  costTransferDuty: z.number(),
  costTotal: z.number(),
  rentPerUnitMonthly: z.number(),
  grossMonthlyIncome: z.number(),
  grossAnnualIncome: z.number(),
  yieldGrossPct: z.number(),
  yieldAt85OccPct: z.number(),
  viabilityNotes: z.string(),
  dolomiteRisk: z.string(),
});

export async function POST(req: NextRequest) {
  const guard = await requireSessionCapability("record");
  if (guard.response) return guard.response;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const d = parsed.data;

  const [listing] = await db.insert(listings).values({
    source: "manual",
    userId: guard.actor!.userId,
    address: d.address,
    municipality: d.municipality,
    sizeSqm: String(d.sizeSqm),
    price: String(d.price),
    zoneCode: d.zoneCode,
    dolomiteRisk: d.dolomiteRisk,
    status: "analyzed",
    feasibilityScore: d.score,
  }).returning();

  const [report] = await db.insert(feasibilityReports).values({
    listingId: listing.id,
    userId: guard.actor!.userId,
    unitType: d.unitType,
    targetUnits: d.targetUnits,
    buildRatePerSqm: "13500",
    tariffYear: 2026,
    maxUnitsAllowed: d.maxUnitsAllowed,
    maxBuildableSqm: String(d.maxBuildableSqm),
    maxFootprintSqm: String(d.maxFootprintSqm),
    rezoningRequired: d.rezoningRequired,
    costLand: String(d.costLand),
    costBuild: String(d.costBuild),
    costProfessionalFees: String(d.costProfessionalFees),
    costBulkContributions: String(d.costBulkContributions),
    costTransferDuty: String(d.costTransferDuty),
    costTotal: String(d.costTotal),
    rentPerUnitMonthly: String(d.rentPerUnitMonthly),
    grossMonthlyIncome: String(d.grossMonthlyIncome),
    grossAnnualIncome: String(d.grossAnnualIncome),
    yieldGrossPct: String(d.yieldGrossPct),
    yieldAt85OccPct: String(d.yieldAt85OccPct),
    viable: d.viable,
    viabilityNotes: d.viabilityNotes,
  }).returning();

  return NextResponse.json({ listingId: listing.id, reportId: report.id });
}
