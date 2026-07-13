"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useFeasibilityStore } from "@/lib/feasibility-store";

// Pull a human-readable message out of whatever the API returned. The
// feasibility route may return a string error (worker text), a Zod flatten
// object (422), or a worker-unreachable message (502).
function extractError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const e = (payload as { error: unknown }).error;
    if (typeof e === "string") return e;
    if (e && typeof e === "object") {
      // Zod flatten: surface the first field/form error we can find.
      const flat = e as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const first =
        flat.formErrors?.[0] ??
        Object.values(flat.fieldErrors ?? {}).flat()[0];
      if (first) return first;
      return JSON.stringify(e);
    }
  }
  return `Request failed (HTTP ${status}).`;
}

const schema = z.object({
  address: z.string().min(1, "Required"),
  municipality: z.enum(["johannesburg", "tshwane", "ekurhuleni"]),
  zone_code: z.enum(["RES1", "RES2", "RES3", "RES4", "COM1"]),
  size_sqm: z.number().min(100).max(1_000_000),
  price: z.number().min(10_000).max(500_000_000),
  unit_type: z.enum(["bachelor", "1bed", "2bed", "luxury"]),
  target_units: z.number().int().min(1).max(200),
  tariff_year: z.number().int().min(2024).max(2030),
});

type FormValues = z.infer<typeof schema>;

export default function EvaluatePage() {
  const router = useRouter();
  const setResult = useFeasibilityStore((s) => s.setResult);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { municipality: "johannesburg", zone_code: "RES3", unit_type: "bachelor", target_units: 8, tariff_year: 2026 },
  });

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    let res: Response;
    try {
      res = await fetch("/api/feasibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setSubmitError("Could not reach the server. Check your connection and try again.");
      return;
    }

    if (!res.ok) {
      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        /* non-JSON error body */
      }
      setSubmitError(extractError(payload, res.status));
      return;
    }

    const data = await res.json();
    setResult(
      {
        address: values.address, municipality: values.municipality, zoneCode: values.zone_code,
        sizeSqm: values.size_sqm, price: values.price, unitType: values.unit_type, targetUnits: values.target_units,
        tariffYear: data.tariff_year, decisionStatus: data.decision_status,
        zoningEvidenceAvailable: data.zoning_evidence_available,
        viable: data.viable, score: data.score, actualUnits: data.actual_units,
        maxUnitsAllowed: data.max_units_allowed, rezoningRequired: data.rezoning_required,
        maxFootprintSqm: data.max_footprint_sqm, maxBuildableSqm: data.max_buildable_sqm,
        costLand: data.cost_land, costBuild: data.cost_build, costProfessionalFees: data.cost_professional_fees,
        costBulkContributions: data.cost_bulk_contributions, costTransferDuty: data.cost_transfer_duty,
        costTotal: data.cost_total, rentPerUnitMonthly: data.rent_per_unit_monthly,
        grossMonthlyIncome: data.gross_monthly_income, grossAnnualIncome: data.gross_annual_income,
        yieldGrossPct: data.yield_gross_pct, yieldAt85OccPct: data.yield_at_85_occ_pct,
        viabilityNotes: data.viability_notes, dolomiteRisk: data.dolomite_risk,
      },
      values
    );
    router.push("/evaluate/result");
  }

  const field = "bg-bg-surface border border-border rounded-card px-3 py-2 text-text-primary font-mono text-sm w-full focus:outline-none focus:border-accent-blue";
  const label = "text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1 block";
  const err = "text-accent-red text-xs mt-1";

  return (
    <div className="portal-page" style={{ maxWidth: 860 }}>
      <p className="eyebrow">Analysis · Cost oracle</p>
      <h1 className="page-title" style={{ marginBottom: 8 }}>Evaluate land</h1>
      <p className="page-subtitle" style={{ marginBottom: 24 }}>Turn a raw listing into a go/no-go investment decision with build cost, yield, and zoning context.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div>
          <label className={label}>Address</label>
          <input {...register("address")} placeholder="123 Main St, Midrand" className={field} />
          {errors.address && <p className={err}>{errors.address.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Municipality</label>
            <select {...register("municipality")} className={field}>
              <option value="johannesburg">Johannesburg</option>
              <option value="tshwane">Tshwane</option>
              <option value="ekurhuleni">Ekurhuleni</option>
            </select>
          </div>
          <div>
            <label className={label}>Zone Code</label>
            <select {...register("zone_code")} className={field}>
              {["RES1","RES2","RES3","RES4","COM1"].map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Size (m²)</label>
            <input type="number" {...register("size_sqm", { valueAsNumber: true })} className={field} />
            {errors.size_sqm && <p className={err}>{errors.size_sqm.message}</p>}
          </div>
          <div>
            <label className={label}>Price (ZAR)</label>
            <input type="number" {...register("price", { valueAsNumber: true })} className={field} />
            {errors.price && <p className={err}>{errors.price.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Unit Type</label>
            <select {...register("unit_type")} className={field}>
              <option value="bachelor">Bachelor (35m²)</option>
              <option value="1bed">1 Bedroom (55m²)</option>
              <option value="2bed">2 Bedroom (85m²)</option>
              <option value="luxury">Luxury (120m²)</option>
            </select>
          </div>
          <div>
            <label className={label}>Target Units</label>
            <input type="number" {...register("target_units", { valueAsNumber: true })} className={field} />
            {errors.target_units && <p className={err}>{errors.target_units.message}</p>}
          </div>
        </div>
        <div>
          <label className={label}>Tariff Year</label>
          <input type="number" min={2024} max={2030} {...register("tariff_year", { valueAsNumber: true })} className={field} />
          {errors.tariff_year && <p className={err}>{errors.tariff_year.message}</p>}
        </div>
        {submitError && (
          <div
            role="alert"
            className="border border-accent-red/40 bg-accent-red/10 text-accent-red rounded-card px-3 py-2 text-xs font-mono"
          >
            {submitError}
          </div>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-accent-blue text-white font-mono text-sm font-semibold py-2.5 rounded-card transition-colors disabled:opacity-50 hover:opacity-90"
        >
          {isSubmitting ? "Calculating..." : "Run Analysis"}
        </button>
      </form>
    </div>
  );
}
