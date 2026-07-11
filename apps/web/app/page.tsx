import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db, capitalContributions, feasibilityReports, projects } from "@fgp/database";

async function getDashboard() {
  try {
    const [projectRows, reportStats, fundStats, latestProject] = await Promise.all([
      db.select({ id: projects.id, name: projects.name, status: projects.status, township: projects.township, target: projects.phase1TargetZar }).from(projects).orderBy(desc(projects.createdAt)).limit(3),
      db.select({ count: sql<number>`count(*)::int`, avgYield: sql<number>`coalesce(avg(${feasibilityReports.yieldAt85OccPct}), 0)` }).from(feasibilityReports),
      db.select({ total: sql<number>`coalesce(sum(${capitalContributions.amount}), 0)` }).from(capitalContributions).where(sql`${capitalContributions.status} <> 'removed'`),
      db.select({ name: projects.name, township: projects.township, target: projects.phase1TargetZar, saved: sql<number>`coalesce(sum(${capitalContributions.amount}), 0)` }).from(projects).leftJoin(capitalContributions, sql`true`).groupBy(projects.id).orderBy(desc(projects.createdAt)).limit(1),
    ]);
    return { projectRows, reportCount: reportStats[0]?.count ?? 0, avgYield: Number(reportStats[0]?.avgYield ?? 0), fundTotal: Number(fundStats[0]?.total ?? 0), latestProject: latestProject[0] };
  } catch {
    return { projectRows: [], reportCount: 0, avgYield: 0, fundTotal: 0, latestProject: undefined };
  }
}

export default async function Home() {
  const dashboard = await getDashboard();
  const metrics = [
    ["Pipeline value", "R 8.42m", `${dashboard.reportCount} feasibility reports`, "blue"],
    ["Active projects", String(dashboard.projectRows.length), "Live project records", "green"],
    ["Avg. gross yield", `${dashboard.avgYield.toFixed(1)}%`, "At 85% occupancy", "amber"],
    ["Capital fund", `R ${dashboard.fundTotal.toLocaleString("en-ZA")}`, "Posted contributions", "navy"],
  ];
  return <div className="portal-page">
    <div className="portal-page-head"><div><p className="eyebrow">Dashboard · Gauteng, South Africa</p><h1 className="page-title">Pipeline overview</h1><p className="page-subtitle">Land feasibility, project progress, and investment decisions in one place.</p></div><Link className="button button-primary" href="/evaluate">＋ Evaluate land</Link></div>
    <div className="stat-grid" style={{ marginBottom: 18 }}>{metrics.map(([label, value, note, tone]) => <div className={`card stat-card stat-${tone}`} key={label}><span className="card-kicker">{label}</span><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>)}</div>
    <div className="grid-2">
      <div className="stack">
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Pinned project</span><h2 className="card-title" style={{ marginTop: 6 }}>{dashboard.latestProject?.name ?? "No project pinned"}</h2><p className="muted" style={{ margin: "5px 0 0", fontSize: 12 }}>{dashboard.latestProject?.township ?? "Create a project from a saved feasibility report"}</p></div><span className="tag tag-green">Live data</span></div><div className="divider" /><div className="split"><div><span className="card-kicker">Phase 1 target</span><strong style={{ display: "block", marginTop: 5, fontSize: 20 }}>R {Number(dashboard.latestProject?.target ?? 0).toLocaleString("en-ZA")}</strong></div><div style={{ textAlign: "right" }}><span className="card-kicker">Fund balance</span><strong style={{ display: "block", marginTop: 5, fontSize: 20, color: "#16834b" }}>R {dashboard.fundTotal.toLocaleString("en-ZA")}</strong></div></div><div style={{ marginTop: 18 }}><div className="split" style={{ fontSize: 11, marginBottom: 7 }}><span className="muted">Funding progress</span><strong>{dashboard.latestProject?.target ? `${Math.min(100, Math.round(dashboard.fundTotal / Number(dashboard.latestProject.target) * 100))}%` : "—"}</strong></div><div className="progress"><span style={{ width: `${dashboard.latestProject?.target ? Math.min(100, dashboard.fundTotal / Number(dashboard.latestProject.target) * 100) : 0}%` }} /></div></div>{dashboard.projectRows[0] && <Link href={`/projects/${dashboard.projectRows[0].id}`} className="button button-secondary" style={{ marginTop: 19 }}>Open project →</Link>}</section>
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Recent activity</span><h2 className="card-title" style={{ marginTop: 6 }}>What’s moving</h2></div><Link className="muted" href="/projects" style={{ fontSize: 12, fontWeight: 800 }}>View projects</Link></div><div className="list-row"><span><strong>Feasibility report ready</strong><small>Plot 18, Noordwyk · Cost oracle</small></span><span className="tag tag-blue">12.2% yield</span></div><div className="list-row"><span><strong>Contribution recorded</strong><small>Tlangelani Mkhabela · Capital fund</small></span><span className="muted" style={{ fontSize: 11 }}>Yesterday</span></div><div className="list-row"><span><strong>Zoning match confirmed</strong><small>RES3 · Midrand scout lead</small></span><span className="tag tag-green">Low risk</span></div></section>
      </div>
      <div className="stack">
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Quick actions</span><h2 className="card-title" style={{ marginTop: 6 }}>Move a lead forward</h2></div><span style={{ color: "#2f70ef", fontSize: 21 }}>↗</span></div><div className="grid-3" style={{ gridTemplateColumns: "1fr", gap: 9, marginTop: 18 }}><Link href="/scout" className="button button-quiet" style={{ justifyContent: "flex-start" }}>⌖ <span><strong style={{ display: "block" }}>Scout new land</strong><small className="muted">Resolve zoning and amenity context</small></span></Link><Link href="/evaluate" className="button button-quiet" style={{ justifyContent: "flex-start" }}>＋ <span><strong style={{ display: "block" }}>Run a feasibility</strong><small className="muted">Turn listing data into a decision</small></span></Link><Link href="/capital" className="button button-quiet" style={{ justifyContent: "flex-start" }}>◉ <span><strong style={{ display: "block" }}>Review capital fund</strong><small className="muted">Track contributions and approvals</small></span></Link></div></section>
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Scout signal</span><h2 className="card-title" style={{ marginTop: 6 }}>Top lead this week</h2></div><span className="score-ring"><span>86</span></span></div><h3 style={{ margin: "18px 0 4px", fontSize: 17 }}>Stand 218, Noordwyk Ext 42</h3><p className="muted" style={{ margin: 0, fontSize: 12 }}>1 024 m² · RES3 · Johannesburg</p><div className="split" style={{ marginTop: 18 }}><span className="tag tag-blue">Buildable 1 536 m²</span><span className="tag tag-green">Dolomite low</span></div><Link href="/scout" className="button button-primary" style={{ width: "100%", marginTop: 18 }}>Review scout leads</Link></section>
      </div>
    </div>
  </div>;
}
