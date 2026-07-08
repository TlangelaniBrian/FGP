import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, zoningSchemeRules } from "@fgp/database";
import { and, eq } from "drizzle-orm";

const schema = z.object({
  address: z.string().min(1).max(500),
  municipality: z.enum(["johannesburg", "tshwane", "ekurhuleni"]),
  zone_code: z.string().min(1).max(20),
  size_sqm: z.number().min(100).max(1_000_000),
  price: z.number().min(10_000).max(500_000_000),
  unit_type: z.enum(["bachelor", "1bed", "2bed"]),
  target_units: z.number().int().min(1).max(200),
});

const num = (v: string | null) => (v == null ? null : Number(v));

// Look up the zoning scheme rules for a municipality + zone so the worker can
// compute the building envelope from the real coverage/FAR/density rather than
// falling back to generic defaults.
async function lookupZoneRules(municipality: string, zoneCode: string) {
  const [rule] = await db
    .select()
    .from(zoningSchemeRules)
    .where(
      and(
        eq(zoningSchemeRules.municipality, municipality),
        eq(zoningSchemeRules.zoneCode, zoneCode.toUpperCase())
      )
    )
    .limit(1);
  if (!rule) return null;
  return {
    coverage_pct: num(rule.coveragePct),
    far: num(rule.far),
    max_storeys: rule.maxStoreys,
    max_units_per_erf: rule.maxUnitsPerErf,
    max_units_per_ha: rule.maxUnitsPerHa,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let zoneRules: Record<string, unknown> | null = null;
  try {
    zoneRules = await lookupZoneRules(parsed.data.municipality, parsed.data.zone_code);
  } catch {
    // Non-fatal: worker falls back to default envelope rules if absent.
    zoneRules = null;
  }

  const payload = zoneRules ? { ...parsed.data, zone_rules: zoneRules } : parsed.data;

  const workerUrl = process.env.WORKER_URL ?? "http://localhost:8000";
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/analyze/feasibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return NextResponse.json(
      { error: "Worker unreachable — is the FastAPI service running?" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
