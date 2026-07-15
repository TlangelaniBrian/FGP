"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFeasibilityStore } from "@/lib/feasibility-store";
import { actorHeaders } from "@/lib/portal-client";
import { usePortalActor } from "@/lib/portal-actor";
import { can } from "@/lib/portal-state";
import { formatZar } from "@/lib/format";
import { CostBreakdownBars } from "./_components/CostBreakdownBars";

const pct = (value: number) => `${value.toFixed(1)}%`;

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
  const trustedTotal = result.costTotal;

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
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: actorHeaders(),
      body: JSON.stringify({
        listingId: saved.listingId,
        reportId: saved.reportId,
        name: projectName.trim(),
        phase1TargetZar: trustedTotal,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setProjectError(body.error ? JSON.stringify(body.error) : "Could not create project");
      return;
    }
    setProject(body);
  }

  const unitLabel = {
    bachelor: "bachelor",
    "1bed": "1-bed",
    "2bed": "2-bed",
    luxury: "luxury",
  }[result.unitType];
  const municipalityLabel = {
    johannesburg: "City of Johannesburg",
    tshwane: "City of Tshwane",
    ekurhuleni: "Ekurhuleni",
  }[result.municipality] ?? result.municipality;
  const evidenceLabel = result.decisionStatus === "degraded" || !result.zoningEvidenceAvailable
    ? "Zoning evidence needed"
    : result.viable ? "Viable" : "Not viable";

  return (
    <div className="portal-page cost-oracle-page">
      <div className="cost-oracle-head">
        <div>
          <button className="cost-edit-inputs" type="button" onClick={() => router.push("/evaluate")}>
            <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
            Edit inputs
          </button>
          <h1 className="page-title">Cost oracle</h1>
          <p className="page-subtitle cost-oracle-subtitle">
            {result.address} · {result.actualUnits} {unitLabel} units · {result.tariffYear} Gauteng tariffs
          </p>
        </div>
        <div className={`cost-verdict-pill ${result.decisionStatus === "degraded" ? "is-warning" : result.viable ? "is-success" : "is-danger"}`}>
          {evidenceLabel}
        </div>
      </div>

      <section className="card cost-analysis-subject" aria-labelledby="analysis-subject-heading">
        <span className="cost-subject-icon material-symbols-rounded" aria-hidden="true">home_work</span>
        <div className="cost-subject-copy">
          <p id="analysis-subject-heading">Analysis subject</p>
          <strong>{result.address}</strong>
          <span>{municipalityLabel} · {result.zoneCode} · {result.sizeSqm.toLocaleString("en-ZA")} m² · {formatZar(result.price)}</span>
        </div>
        <div className="cost-subject-status">
          <span>Linked to</span>
          <strong className={project ? "is-linked" : ""}>
            <span className="material-symbols-rounded" aria-hidden="true">{project ? "link" : "link_off"}</span>
            {project?.name ?? (saved ? `Saved report #${saved.reportId}` : "Unsaved analysis")}
          </strong>
        </div>
      </section>

      <section className="portal-grid-3 cost-kpi-grid" aria-label="Feasibility summary">
        <div className="stat-card"><span className="stat-label">Total investment</span><strong className="stat-value">{formatZar(result.costTotal)}</strong><span className="cost-kpi-note">All-in cost</span></div>
        <div className="stat-card"><span className="stat-label">Gross annual income</span><strong className="stat-value">{formatZar(result.grossAnnualIncome)}</strong><span className="cost-kpi-note is-positive">100% occupied</span></div>
        <div className="stat-card"><span className="stat-label">Yield @ 100%</span><strong className="stat-value is-positive">{pct(result.yieldGrossPct)}</strong><span className="cost-kpi-note">Before expenses</span></div>
        <div className="stat-card"><span className="stat-label">Yield @ 85% occ.</span><strong className={`stat-value ${result.yieldAt85OccPct >= 10 ? "is-positive" : "is-negative"}`}>{pct(result.yieldAt85OccPct)}</strong><span className="cost-kpi-note">Realistic</span></div>
      </section>

      <div className="cost-oracle-layout">
        <section className="card cost-breakdown-card" aria-labelledby="cost-breakdown-heading">
          <div className="cost-card-head"><h2 id="cost-breakdown-heading">Cost breakdown</h2></div>
          <div className="cost-card-content">
            <CostBreakdownBars costs={result} />
            <div className="cost-breakdown-total"><span>Total</span><strong>{formatZar(result.costTotal)}</strong></div>
          </div>
        </section>

        <div className="cost-oracle-aside">
          <section className="card" aria-labelledby="income-projection-heading">
            <div className="cost-card-head"><h2 id="income-projection-heading">Income projection</h2></div>
            <dl className="cost-income-list">
              <div><dt>Rent per unit</dt><dd>{formatZar(result.rentPerUnitMonthly)} / mo</dd></div>
              <div><dt>Units (actual / target)</dt><dd>{result.actualUnits} / {result.targetUnits}</dd></div>
              <div><dt>Gross monthly</dt><dd>{formatZar(result.grossMonthlyIncome)}</dd></div>
              <div><dt>Gross annual</dt><dd>{formatZar(result.grossAnnualIncome)}</dd></div>
            </dl>
          </section>

          <section className={`card cost-decision-card ${result.decisionStatus === "degraded" ? "is-warning" : result.viable ? "is-success" : "is-danger"}`} aria-labelledby="decision-engine-heading">
            <p className="cost-decision-eyebrow" id="decision-engine-heading">Decision engine</p>
            <div className="cost-decision-verdict">
              <span className="material-symbols-rounded" aria-hidden="true">{result.decisionStatus === "degraded" ? "warning" : result.viable ? "check" : "priority_high"}</span>
              <div>
                <strong>{result.decisionStatus === "degraded" ? "Evidence review required" : result.viable ? "Viable investment" : result.rezoningRequired ? "Rezoning required" : "Below threshold"}</strong>
                <small>Score {result.score}/100 · {result.dolomiteRisk} dolomite risk</small>
              </div>
            </div>
            <p className="cost-decision-notes">{result.viabilityNotes}</p>
            {result.rezoningRequired && <p className="cost-evidence-note">Actual units {result.actualUnits} of target {result.targetUnits}; rezoning is required.</p>}
            {result.decisionStatus === "degraded" && <p className="cost-evidence-note">A definitive go/no-go decision requires verified zoning evidence.</p>}
          </section>
        </div>
      </div>

      <div className="cost-actions">
        {canEdit && (!saved ? (
          <button onClick={keep} disabled={saving} className="button">{saving ? "Saving..." : "Keep this analysis"}</button>
        ) : (
          <div className="cost-save-state">
            <p>Saved — report #{saved.reportId}</p>
            {!project ? (
              <div className="cost-project-create">
                <input className="field" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" aria-label="Project name" />
                <button className="button button-secondary" onClick={createProject}>Create project</button>
              </div>
            ) : <p>Project created: <a href={`/projects/${project.id}`}>{project.name}</a></p>}
            {projectError && <p className="cost-action-error">{projectError}</p>}
          </div>
        ))}
        <button onClick={() => { clear(); router.push("/evaluate"); }} className="button button-secondary">New analysis</button>
      </div>
    </div>
  );
}
