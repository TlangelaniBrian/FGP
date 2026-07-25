import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, zoningSchemeRules } from "@fgp/database";

export const feasibilityInputSchema = z.object({
  address: z.string().min(1).max(500),
  municipality: z.enum(["johannesburg", "tshwane", "ekurhuleni"]),
  zone_code: z.string().min(1).max(20).regex(/^[a-z0-9_-]+$/i),
  size_sqm: z.number().min(100).max(1_000_000),
  price: z.number().min(10_000).max(500_000_000),
  unit_type: z.enum(["bachelor", "1bed", "2bed", "luxury"]),
  target_units: z.number().int().min(1).max(200),
  tariff_year: z.number().int().min(2024).max(2030),
}).strict();

export type FeasibilityInput = z.infer<typeof feasibilityInputSchema>;

const feasibilityResultSchema = z.object({
  viable: z.boolean(),
  decision_status: z.enum(["definitive", "degraded"]),
  zoning_evidence_available: z.boolean(),
  tariff_year: z.number().int(),
  build_rate_per_sqm: z.number().positive(),
  score: z.number().int().min(0).max(100),
  actual_units: z.number().int().nonnegative(),
  max_units_allowed: z.number().int().nonnegative().nullable(),
  capacity: z.object({
    density_units: z.number().int().nonnegative().nullable(),
    far_units: z.number().int().nonnegative().nullable(),
    footprint_storey_units: z.number().int().nonnegative().nullable(),
  }),
  rezoning_required: z.boolean(),
  max_footprint_sqm: z.number().nonnegative().nullable(),
  max_buildable_sqm: z.number().nonnegative().nullable(),
  cost_land: z.number().nonnegative(),
  cost_build: z.number().nonnegative(),
  cost_professional_fees: z.number().nonnegative(),
  cost_bulk_contributions: z.number().nonnegative(),
  cost_transfer_duty: z.number().nonnegative(),
  cost_total: z.number().nonnegative(),
  rent_per_unit_monthly: z.number().nonnegative(),
  gross_monthly_income: z.number().nonnegative(),
  gross_annual_income: z.number().nonnegative(),
  yield_gross_pct: z.number().nonnegative(),
  yield_at_85_occ_pct: z.number().nonnegative(),
  viability_notes: z.string().min(1),
  dolomite_risk: z.string().min(1),
  score_schools: z.number().int().nullable(),
  score_transport: z.number().int().nullable(),
  score_amenities: z.number().int().nullable(),
});

export type TrustedFeasibilityResult = z.infer<typeof feasibilityResultSchema>;

export class FeasibilityWorkerError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const numeric = (value: string | null) => value == null ? null : Number(value);

async function lookupZoneRules(input: FeasibilityInput) {
  const [rule] = await db
    .select()
    .from(zoningSchemeRules)
    .where(and(
      eq(zoningSchemeRules.municipality, input.municipality),
      eq(zoningSchemeRules.zoneCode, input.zone_code.toUpperCase()),
    ))
    .limit(1);

  if (!rule) return null;
  return {
    coverage_pct: numeric(rule.coveragePct),
    far: numeric(rule.far),
    max_storeys: rule.maxStoreys,
    max_units_per_erf: rule.maxUnitsPerErf,
    max_units_per_ha: rule.maxUnitsPerHa,
  };
}

export async function calculateTrustedFeasibility(input: FeasibilityInput) {
  const zoneRules = await lookupZoneRules(input);
  const payload = zoneRules ? { ...input, zone_rules: zoneRules } : input;
  const workerUrl = process.env.WORKER_URL ?? "http://localhost:8000";

  let response: Response;
  try {
    response = await fetch(`${workerUrl}/analyze/feasibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new FeasibilityWorkerError(502, "Worker unreachable — is the FastAPI service running?");
  }

  if (!response.ok) {
    throw new FeasibilityWorkerError(response.status, await response.text());
  }

  const parsed = feasibilityResultSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new FeasibilityWorkerError(502, "Worker returned an invalid feasibility result");
  }
  return parsed.data;
}
