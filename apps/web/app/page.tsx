import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, activityEvents, capitalContributions, feasibilityReports, listings, projects } from "@fgp/database";
import { getAuthenticatedActor } from "@/lib/portal-auth";
import { formatZar } from "@/lib/format";

async function getDashboard() {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) return { projectRows: [], projectCount: 0, reportCount: 0, avgYield: 0, fundTotal: 0, pipelineValue: 0, latestProject: undefined, topListing: undefined, activities: [] };
    const owner = (table: { userId: typeof projects.userId }) => eq(table.userId, actor.userId);
    const [projectRows, projectStats, reportStats, pipelineStats, fundStats, latestProject, topListing, activities] = await Promise.all([
      db.select({ id: projects.id, name: projects.name, status: projects.status, township: projects.township, target: projects.phase1TargetZar }).from(projects).where(owner(projects)).orderBy(desc(projects.createdAt)).limit(3),
      db.select({ count: sql<number>`count(*)::int` }).from(projects).where(owner(projects)),
      db.select({ count: sql<number>`count(*)::int`, avgYield: sql<number>`coalesce(avg(${feasibilityReports.yieldAt85OccPct}), 0)` }).from(feasibilityReports).where(eq(feasibilityReports.userId, actor.userId)),
      db.select({ total: sql<number>`coalesce(sum(${listings.price}), 0)` }).from(listings).where(and(eq(listings.userId, actor.userId), sql`${listings.status} <> 'dismissed'`)),
      db.select({ total: sql<number>`coalesce(sum(${capitalContributions.amount}), 0)` }).from(capitalContributions).where(sql`${capitalContributions.status} <> 'removed'`),
      db.select({ name: projects.name, township: projects.township, target: projects.phase1TargetZar }).from(projects).where(owner(projects)).orderBy(desc(projects.createdAt)).limit(1),
      db.select({ id: listings.id, address: listings.address, sizeSqm: listings.sizeSqm, price: listings.price, zoneCode: listings.zoneCode, municipality: listings.municipality, score: listings.feasibilityScore, dolomiteRisk: listings.dolomiteRisk }).from(listings).where(eq(listings.userId, actor.userId)).orderBy(desc(listings.feasibilityScore), desc(listings.createdAt)).limit(1),
      db.select({ title: activityEvents.title, detail: activityEvents.detail, createdAt: activityEvents.createdAt }).from(activityEvents).orderBy(desc(activityEvents.createdAt)).limit(4),
    ]);
    const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    return { projectRows, projectCount: projectStats[0]?.count ?? 0, reportCount: reportStats[0]?.count ?? 0, avgYield: Number(reportStats[0]?.avgYield ?? 0), fundTotal: Number(fundStats[0]?.total ?? 0), pipelineValue: Number(pipelineStats[0]?.total ?? 0), latestProject: latestProject[0], topListing: topListing[0], activities: activities.map((activity) => ({ ...activity, ageLabel: activity.createdAt ? relativeTime.format(Math.round((activity.createdAt.getTime() - Date.now()) / 86400000), "day") : "Recently" })) };
  } catch {
    return { projectRows: [], projectCount: 0, reportCount: 0, avgYield: 0, fundTotal: 0, pipelineValue: 0, latestProject: undefined, topListing: undefined, activities: [] };
  }
}

export default async function Home() {
  const dashboard = await getDashboard();
  const metrics = [
    ["Pipeline value", formatZar(dashboard.pipelineValue), `${dashboard.reportCount} feasibility reports`, "blue"],
    ["Active projects", String(dashboard.projectCount), "Live project records", "green"],
    ["Avg. gross yield", `${dashboard.avgYield.toFixed(1)}%`, "At 85% occupancy", "amber"],
    ["Capital fund", formatZar(dashboard.fundTotal), "Posted contributions", "navy"],
  ];
  return <div className="portal-page">
    <div className="portal-page-head"><div><p className="eyebrow">Dashboard · Gauteng, South Africa</p><h1 className="page-title">Pipeline overview</h1><p className="page-subtitle">Land feasibility, project progress, and investment decisions in one place.</p></div><Link className="button button-primary" href="/evaluate">＋ Evaluate land</Link></div>
    <div className="stat-grid" style={{ marginBottom: 18 }}>{metrics.map(([label, value, note, tone]) => <div className={`card stat-card stat-${tone}`} key={label}><span className="card-kicker">{label}</span><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>)}</div>
    <div className="portal-grid-2">
      <div className="stack">
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Pinned project</span><h2 className="card-title" style={{ marginTop: 6 }}>{dashboard.latestProject?.name ?? "No project pinned"}</h2><p className="muted" style={{ margin: "5px 0 0", fontSize: 12 }}>{dashboard.latestProject?.township ?? "Create a project from a saved feasibility report"}</p></div><span className="tag tag-green">Live data</span></div><div className="divider" /><div className="split"><div><span className="card-kicker">Phase 1 target</span><strong style={{ display: "block", marginTop: 5, fontSize: 20 }}>{formatZar(Number(dashboard.latestProject?.target ?? 0))}</strong></div><div style={{ textAlign: "right" }}><span className="card-kicker">Fund balance</span><strong style={{ display: "block", marginTop: 5, fontSize: 20, color: "#16834b" }}>{formatZar(dashboard.fundTotal)}</strong></div></div><div style={{ marginTop: 18 }}><div className="split" style={{ fontSize: 11, marginBottom: 7 }}><span className="muted">Funding progress</span><strong>{dashboard.latestProject?.target ? `${Math.min(100, Math.round(dashboard.fundTotal / Number(dashboard.latestProject.target) * 100))}%` : "—"}</strong></div><div className="progress"><span style={{ width: `${dashboard.latestProject?.target ? Math.min(100, dashboard.fundTotal / Number(dashboard.latestProject.target) * 100) : 0}%` }} /></div></div>{dashboard.projectRows[0] && <Link href={`/projects/${dashboard.projectRows[0].id}`} className="button button-secondary" style={{ marginTop: 19 }}>Open project →</Link>}</section>
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Recent activity</span><h2 className="card-title" style={{ marginTop: 6 }}>What’s moving</h2></div><Link className="muted" href="/projects" style={{ fontSize: 12, fontWeight: 800 }}>View projects</Link></div>{dashboard.activities.length ? dashboard.activities.map((activity) => <div className="list-row" key={`${activity.title}-${activity.createdAt?.toISOString()}`}><span><strong>{activity.title}</strong><small>{activity.detail ?? "Workspace activity"}</small></span><span className="muted" style={{ fontSize: 11 }}>{activity.ageLabel}</span></div>) : <div className="empty-state" style={{ marginTop: 16 }}>No workspace activity yet. Your next saved feasibility, contribution, or scrape will appear here.</div>}</section>
      </div>
      <div className="stack">
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Quick actions</span><h2 className="card-title" style={{ marginTop: 6 }}>Move a lead forward</h2></div><span style={{ color: "#2f70ef", fontSize: 21 }}>↗</span></div><div className="grid-3" style={{ gridTemplateColumns: "1fr", gap: 9, marginTop: 18 }}><Link href="/scout" className="button button-quiet" style={{ justifyContent: "flex-start" }}>⌖ <span><strong style={{ display: "block" }}>Scout new land</strong><small className="muted">Resolve zoning and amenity context</small></span></Link><Link href="/evaluate" className="button button-quiet" style={{ justifyContent: "flex-start" }}>＋ <span><strong style={{ display: "block" }}>Run a feasibility</strong><small className="muted">Turn listing data into a decision</small></span></Link><Link href="/capital" className="button button-quiet" style={{ justifyContent: "flex-start" }}>◉ <span><strong style={{ display: "block" }}>Review capital fund</strong><small className="muted">Track contributions and approvals</small></span></Link></div></section>
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Scout signal</span><h2 className="card-title" style={{ marginTop: 6 }}>Top lead this week</h2></div><span className="score-ring"><span>{dashboard.topListing?.score ?? "—"}</span></span></div>{dashboard.topListing ? <><h3 style={{ margin: "18px 0 4px", fontSize: 17 }}>{dashboard.topListing.address}</h3><p className="muted" style={{ margin: 0, fontSize: 12 }}>{Number(dashboard.topListing.sizeSqm ?? 0).toLocaleString("en-ZA")} m² · {dashboard.topListing.zoneCode ?? "Zone pending"} · {dashboard.topListing.municipality ?? "Municipality pending"}</p><div className="split" style={{ marginTop: 18 }}><span className="tag tag-blue">{dashboard.topListing.price ? formatZar(Number(dashboard.topListing.price)) : "Price pending"}</span><span className="tag tag-green">Dolomite {dashboard.topListing.dolomiteRisk?.toLowerCase() ?? "pending"}</span></div></> : <div className="empty-state" style={{ marginTop: 18 }}>No scored scout leads yet. Import a listing or run a scraper job to populate this signal.</div>}<Link href="/scout" className="button button-primary" style={{ width: "100%", marginTop: 18 }}>Review scout leads</Link></section>
      </div>
    </div>
  </div>;
}
