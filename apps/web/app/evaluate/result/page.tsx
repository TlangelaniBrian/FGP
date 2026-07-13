"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFeasibilityStore } from "@/lib/feasibility-store";
import { actorHeaders } from "@/lib/portal-client";
import { usePortalActor } from "@/lib/portal-actor";
import { can } from "@/lib/portal-state";

const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

export default function EvaluateResultPage() {
  const router = useRouter();
  const actor = usePortalActor();
  const canEdit = can(actor?.role ?? "Viewer", "record");
  const { result, formValues, clear } = useFeasibilityStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ listingId: number; reportId: number } | null>(null);
  const [project, setProject] = useState<{ id: number; name: string } | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    if (!result) router.replace("/evaluate");
  }, [result, router]);

  if (!result) return null;

  async function keep() {
    if (!result || !formValues) return;
    setSaving(true);
    const res = await fetch("/api/feasibility/save", {
      method: "POST",
      headers: actorHeaders(),
      body: JSON.stringify(formValues),
    });
    const data = await res.json();
    if (res.ok) setSaved(data);
    else setProjectError(typeof data?.error === "string" ? data.error : "Could not save analysis");
    setSaving(false);
  }

  async function createProject() {
    if (!saved || !formValues || !projectName.trim()) return;
    setProjectError(null);
    const res = await fetch("/api/projects", { method: "POST", headers: actorHeaders(), body: JSON.stringify({ listingId: saved.listingId, reportId: saved.reportId, name: projectName.trim(), phase1TargetZar: result?.costTotal ?? 0 }) });
    const body = await res.json();
    if (!res.ok) { setProjectError(body.error ? JSON.stringify(body.error) : "Could not create project"); return; }
    setProject(body);
  }

  const card = "bg-bg-surface border border-border rounded-card p-5";
  const statLabel = "text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1";
  const statVal = "font-mono text-sm font-semibold text-text-primary";

  return (
    <div className="portal-page" style={{ maxWidth: 980 }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Cost oracle · Feasibility report</p>
          <h1 className="page-title">{result.address}</h1>
          <p className="text-text-muted font-mono text-xs mt-1">
            {result.municipality.toUpperCase()} · {result.zoneCode} · {result.sizeSqm.toLocaleString()}m²
          </p>
        </div>
        <div className={`px-4 py-2 rounded-[20px] font-mono text-sm font-bold border ${result.viable ? "bg-accent-green/10 border-accent-green text-accent-green" : "bg-accent-red/10 border-accent-red text-accent-red"}`}>
          {result.decisionStatus === "degraded" ? "ZONING EVIDENCE NEEDED" : result.viable ? "VIABLE" : "NOT VIABLE"}
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
            ["Professional Fees", result.costProfessionalFees],
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
        {canEdit && (!saved ? (
          <button
            onClick={keep}
            disabled={saving}
            className="bg-accent-blue text-white font-mono text-sm font-semibold px-6 py-2.5 rounded-card transition-colors disabled:opacity-50 hover:opacity-90"
          >
            {saving ? "Saving..." : "Keep this analysis"}
          </button>
        ) : (
          <div><p className="text-accent-green font-mono text-sm">Saved — report #{saved.reportId}</p>{!project ? <div style={{ display: "flex", gap: 8, marginTop: 10 }}><input className="field" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" aria-label="Project name" /><button className="button button-secondary" onClick={createProject}>Create project</button></div> : <p className="text-accent-green font-mono text-xs mt-2">Project created: <a href={`/projects/${project.id}`}>{project.name}</a></p>}{projectError && <p className="text-accent-red font-mono text-xs mt-1">{projectError}</p>}</div>
        ))}
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
