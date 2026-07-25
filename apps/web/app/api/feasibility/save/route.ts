import { NextRequest, NextResponse } from "next/server";
import { db, feasibilityReports, listings } from "@fgp/database";
import { requireSessionCapability } from "@/lib/portal-auth";
import {
  calculateTrustedFeasibility,
  FeasibilityWorkerError,
  feasibilityInputSchema,
} from "@/lib/feasibility-server";

export async function POST(req: NextRequest) {
  const guard = await requireSessionCapability("record", req);
  if (guard.response) return guard.response;

  const parsed = feasibilityInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let result;
  try {
    result = await calculateTrustedFeasibility(parsed.data);
  } catch (error) {
    if (error instanceof FeasibilityWorkerError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Zoning rules could not be loaded" }, { status: 503 });
  }

  const saved = await db.transaction(async (tx) => {
    const [listing] = await tx.insert(listings).values({
      source: "manual",
      userId: guard.actor!.userId,
      address: parsed.data.address,
      municipality: parsed.data.municipality,
      sizeSqm: String(parsed.data.size_sqm),
      price: String(parsed.data.price),
      zoneCode: parsed.data.zone_code.toUpperCase(),
      dolomiteRisk: result.dolomite_risk,
      status: "analyzed",
      feasibilityScore: result.score,
    }).returning();

    const [report] = await tx.insert(feasibilityReports).values({
      listingId: listing.id,
      userId: guard.actor!.userId,
      unitType: parsed.data.unit_type,
      targetUnits: parsed.data.target_units,
      actualUnits: result.actual_units,
      buildRatePerSqm: String(result.build_rate_per_sqm),
      tariffYear: result.tariff_year,
      maxUnitsAllowed: result.max_units_allowed,
      decisionStatus: result.decision_status,
      zoningEvidenceAvailable: result.zoning_evidence_available,
      capacityDensityUnits: result.capacity.density_units,
      capacityFarUnits: result.capacity.far_units,
      capacityFootprintStoreyUnits: result.capacity.footprint_storey_units,
      maxBuildableSqm: result.max_buildable_sqm == null ? null : String(result.max_buildable_sqm),
      maxFootprintSqm: result.max_footprint_sqm == null ? null : String(result.max_footprint_sqm),
      rezoningRequired: result.rezoning_required,
      costLand: String(result.cost_land),
      costBuild: String(result.cost_build),
      costProfessionalFees: String(result.cost_professional_fees),
      costBulkContributions: String(result.cost_bulk_contributions),
      costTransferDuty: String(result.cost_transfer_duty),
      costTotal: String(result.cost_total),
      rentPerUnitMonthly: String(result.rent_per_unit_monthly),
      grossMonthlyIncome: String(result.gross_monthly_income),
      grossAnnualIncome: String(result.gross_annual_income),
      yieldGrossPct: String(result.yield_gross_pct),
      yieldAt85OccPct: String(result.yield_at_85_occ_pct),
      viable: result.viable,
      viabilityNotes: result.viability_notes,
    }).returning();

    return { listingId: listing.id, reportId: report.id };
  });

  return NextResponse.json(saved);
}
