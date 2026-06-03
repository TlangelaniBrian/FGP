"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFeasibilityStore } from "@/lib/feasibility-store";

const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

export default function EvaluateResultPage() {
  const router = useRouter();
  const { result, formValues, clear } = useFeasibilityStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ listingId: number; reportId: number } | null>(null);

  useEffect(() => {
    if (!result) router.replace("/evaluate");
  }, [result, router]);

  if (!result) return null;

  async function keep() {
    if (!result || !formValues) return;
    setSaving(true);
    const res = await fetch("/api/feasibility/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: result.address, municipality: result.municipality, zoneCode: result.zoneCode,
        sizeSqm: result.sizeSqm, price: result.price, unitType: result.unitType, targetUnits: result.targetUnits,
        viable: result.viable, score: result.score, actualUnits: result.actualUnits,
        maxUnitsAllowed: result.maxUnitsAllowed, rezoningRequired: result.rezoningRequired,
        maxFootprintSqm: result.maxFootprintSqm, maxBuildableSqm: result.maxBuildableSqm,
        costLand: result.costLand, costBuild: result.costBuild, costProfessionalFees: result.costProfessionalFees,
        costBulkContributions: result.costBulkContributions, costTransferDuty: result.costTransferDuty,
        costTotal: result.costTotal, rentPerUnitMonthly: result.rentPerUnitMonthly,
        grossMonthlyIncome: result.grossMonthlyIncome, grossAnnualIncome: result.grossAnnualIncome,
        yieldGrossPct: result.yieldGrossPct, yieldAt85OccPct: result.yieldAt85OccPct,
        viabilityNotes: result.viabilityNotes, dolomiteRisk: result.dolomiteRisk,
      }),
    });
    const data = await res.json();
    setSaved(data);
    setSaving(false);
  }

  const card = "bg-bg-surface border border-border rounded-card p-5";
  const statLabel = "text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1";
  const statVal = "font-mono text-sm font-semibold text-text-primary";

  return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-1">Analysis Result</p>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{result.address}</h1>
          <p className="text-text-muted font-mono text-xs mt-1">
            {result.municipality.toUpperCase()} · {result.zoneCode} · {result.sizeSqm.toLocaleString()}m²
          </p>
        </div>
        <div className={`px-4 py-2 rounded-[20px] font-mono text-sm font-bold border ${result.viable ? "bg-accent-green/10 border-accent-green text-accent-green" : "bg-accent-red/10 border-accent-red text-accent-red"}`}>
          {result.viable ? "VIABLE" : "NOT VIABLE"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className={card}>
          <p className={statLabel}>Score</p>
          <p className="font-mono text-3xl font-bold text-text-primary">
            {result.score}<span className="text-text-muted text-lg">/100</span>
          </p>
        </div>
        <div className={card}>
          <p className={statLabel}>Yield @ 85% occ</p>
          <p className={`font-mono text-2xl font-bold ${result.yieldAt85OccPct >= 10 ? "text-accent-green" : "text-accent-red"}`}>
            {pct(result.yieldAt85OccPct)}
          </p>
        </div>
        <div className={card}>
          <p className={statLabel}>Units (actual / target)</p>
          <p className="font-mono text-2xl font-bold text-text-primary">
            {result.actualUnits}<span className="text-text-muted text-lg">/{result.targetUnits}</span>
          </p>
          {result.rezoningRequired && <p className="text-accent-amber text-xs mt-1">Rezoning required</p>}
        </div>
      </div>

      <div className={card}>
        <p className={statLabel + " mb-3"}>Cost Breakdown</p>
        <div className="flex flex-col gap-2">
          {[
            ["Land", result.costLand],
            ["Build", result.costBuild],
            ["Professional Fees (12%)", result.costProfessionalFees],
            ["Bulk Service Contributions", result.costBulkContributions],
            ["Transfer Duty", result.costTransferDuty],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between text-xs font-mono">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary">{fmt(val as number)}</span>
            </div>
          ))}
          <div className="border-t border-border mt-1 pt-2 flex justify-between text-sm font-mono font-bold">
            <span className="text-text-muted">Total Investment</span>
            <span className="text-text-primary">{fmt(result.costTotal)}</span>
          </div>
        </div>
      </div>

      <div className={card}>
        <p className={statLabel + " mb-3"}>Income Projection</p>
        <div className="grid grid-cols-3 gap-4">
          <div><p className={statLabel}>Rent/Unit/Mo</p><p className={statVal}>{fmt(result.rentPerUnitMonthly)}</p></div>
          <div><p className={statLabel}>Gross Monthly</p><p className={statVal}>{fmt(result.grossMonthlyIncome)}</p></div>
          <div><p className={statLabel}>Gross Annual</p><p className={statVal}>{fmt(result.grossAnnualIncome)}</p></div>
        </div>
      </div>

      <p className="text-text-muted font-mono text-xs">{result.viabilityNotes}</p>

      <div className="flex gap-3">
        {!saved ? (
          <button
            onClick={keep}
            disabled={saving}
            className="bg-accent-blue text-white font-mono text-sm font-semibold px-6 py-2.5 rounded-card transition-colors disabled:opacity-50 hover:opacity-90"
          >
            {saving ? "Saving..." : "Keep this analysis"}
          </button>
        ) : (
          <p className="text-accent-green font-mono text-sm">Saved — report #{saved.reportId}</p>
        )}
        <button
          onClick={() => { clear(); router.push("/evaluate"); }}
          className="border border-border text-text-muted hover:text-text-primary font-mono text-sm px-6 py-2.5 rounded-card transition-colors"
        >
          New Analysis
        </button>
      </div>
    </div>
  );
}
