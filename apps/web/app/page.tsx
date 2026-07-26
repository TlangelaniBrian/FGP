import Link from "next/link";
import { headers } from "next/headers";
import { getRequestOrigin } from "@/lib/request-origin";
import { formatZar } from "@/lib/format";
import { RequireSession } from "./_components/RequireSession";

type Dashboard = {
  projectRows: Array<{ id: number; name: string; status: string; phase1TargetZar?: number | null }>;
  projectCount: number;
  reportCount: number;
  avgYield: number;
  fundTotal: number;
  pipelineValue: number;
  latestProject?: { name?: string; phase1TargetZar?: number | null };
  topListing?: { id: number; address?: string | null; sizeSqm?: number | null; price?: number | null; zoneCode?: string | null; municipality?: string | null; feasibilityScore?: number | null; dolomiteRisk?: string | null };
  activities: Array<{ id?: number; title: string; detail?: string | null; createdAt?: string }>;
};

async function getDashboard(): Promise<Dashboard> {
  const fallback: Dashboard = { projectRows: [], projectCount: 0, reportCount: 0, avgYield: 0, fundTotal: 0, pipelineValue: 0, activities: [] };
  try {
    const requestHeaders = await headers();
    const response = await fetch(`${getRequestOrigin(requestHeaders)}/api/dashboard`, { cache: "no-store", headers: { cookie: requestHeaders.get("cookie") ?? "" } });
    return response.ok ? await response.json() as Dashboard : fallback;
  } catch {
    return fallback;
  }
}

async function DashboardContent() {
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
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Pinned project</span><h2 className="card-title" style={{ marginTop: 6 }}>{dashboard.latestProject?.name ?? "No project pinned"}</h2></div><span className="tag tag-green">Live data</span></div><div className="divider" /><div className="split"><div><span className="card-kicker">Phase 1 target</span><strong style={{ display: "block", marginTop: 5, fontSize: 20 }}>{formatZar(Number(dashboard.latestProject?.phase1TargetZar ?? 0))}</strong></div><div style={{ textAlign: "right" }}><span className="card-kicker">Fund balance</span><strong style={{ display: "block", marginTop: 5, fontSize: 20, color: "#16834b" }}>{formatZar(dashboard.fundTotal)}</strong></div></div>{dashboard.projectRows[0] && <Link href={`/projects/${dashboard.projectRows[0].id}`} className="button button-secondary" style={{ marginTop: 19 }}>Open project →</Link>}</section>
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Recent activity</span><h2 className="card-title" style={{ marginTop: 6 }}>What’s moving</h2></div><Link className="muted" href="/projects" style={{ fontSize: 12, fontWeight: 800 }}>View projects</Link></div>{dashboard.activities.length ? dashboard.activities.map((activity, index) => <div className="list-row" key={activity.id ?? index}><span><strong>{activity.title}</strong><small>{activity.detail ?? "Workspace activity"}</small></span></div>) : <div className="empty-state" style={{ marginTop: 16 }}>No workspace activity yet.</div>}</section>
      </div>
      <div className="stack">
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Quick actions</span><h2 className="card-title" style={{ marginTop: 6 }}>Move a lead forward</h2></div><span style={{ color: "#2f70ef", fontSize: 21 }}>↗</span></div><div className="grid-3" style={{ gridTemplateColumns: "1fr", gap: 9, marginTop: 18 }}><Link href="/scout" className="button button-quiet" style={{ justifyContent: "flex-start" }}>⌖ Scout new land</Link><Link href="/evaluate" className="button button-quiet" style={{ justifyContent: "flex-start" }}>＋ Run a feasibility</Link><Link href="/capital" className="button button-quiet" style={{ justifyContent: "flex-start" }}>◉ Review capital fund</Link></div></section>
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Scout signal</span><h2 className="card-title" style={{ marginTop: 6 }}>Top lead this week</h2></div><span className="score-ring"><span>{dashboard.topListing?.feasibilityScore ?? "—"}</span></span></div>{dashboard.topListing ? <><h3 style={{ margin: "18px 0 4px", fontSize: 17 }}>{dashboard.topListing.address}</h3><p className="muted" style={{ margin: 0, fontSize: 12 }}>{Number(dashboard.topListing.sizeSqm ?? 0).toLocaleString("en-ZA")} m² · {dashboard.topListing.zoneCode ?? "Zone pending"}</p><div className="split" style={{ marginTop: 18 }}><span className="tag tag-blue">{dashboard.topListing.price ? formatZar(Number(dashboard.topListing.price)) : "Price pending"}</span><span className="tag tag-green">Dolomite {dashboard.topListing.dolomiteRisk?.toLowerCase() ?? "pending"}</span></div></> : <div className="empty-state" style={{ marginTop: 18 }}>No scored scout leads yet.</div>}<Link href="/scout" className="button button-primary" style={{ width: "100%", marginTop: 18 }}>Review scout leads</Link></section>
      </div>
    </div>
  </div>;
}

export default function Home() {
  return <RequireSession pathname="/"><DashboardContent /></RequireSession>;
}
