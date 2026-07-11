import Link from "next/link";

const metrics = [
  ["Pipeline value", "R 8.42m", "+12.4% this quarter", "blue"],
  ["Active projects", "3", "1 entering construction", "green"],
  ["Avg. gross yield", "11.8%", "Across 8 feasibility reports", "amber"],
  ["Capital fund", "R 486 000", "64% of current goal", "navy"],
];

export default function Home() {
  return <div className="portal-page">
    <div className="portal-page-head"><div><p className="eyebrow">Dashboard · Gauteng, South Africa</p><h1 className="page-title">Pipeline overview</h1><p className="page-subtitle">Land feasibility, project progress, and investment decisions in one place.</p></div><Link className="button button-primary" href="/evaluate">＋ Evaluate land</Link></div>
    <div className="stat-grid" style={{ marginBottom: 18 }}>{metrics.map(([label, value, note, tone]) => <div className={`card stat-card stat-${tone}`} key={label}><span className="card-kicker">{label}</span><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>)}</div>
    <div className="grid-2">
      <div className="stack">
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Pinned project</span><h2 className="card-title" style={{ marginTop: 6 }}>Soshanguve Build</h2><p className="muted" style={{ margin: "5px 0 0", fontSize: 12 }}>ERF 1247 · Soshanguve Block XX · Tshwane</p></div><span className="tag tag-green">On track</span></div><div className="divider" /><div className="split"><div><span className="card-kicker">Phase 1 target</span><strong style={{ display: "block", marginTop: 5, fontSize: 20 }}>R 1 420 000</strong></div><div style={{ textAlign: "right" }}><span className="card-kicker">Saved to date</span><strong style={{ display: "block", marginTop: 5, fontSize: 20, color: "#16834b" }}>R 486 000</strong></div></div><div style={{ marginTop: 18 }}><div className="split" style={{ fontSize: 11, marginBottom: 7 }}><span className="muted">Funding progress</span><strong>64%</strong></div><div className="progress"><span style={{ width: "64%" }} /></div></div><Link href="/projects/1" className="button button-secondary" style={{ marginTop: 19 }}>Open project →</Link></section>
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Recent activity</span><h2 className="card-title" style={{ marginTop: 6 }}>What’s moving</h2></div><Link className="muted" href="/projects" style={{ fontSize: 12, fontWeight: 800 }}>View projects</Link></div><div className="list-row"><span><strong>Feasibility report ready</strong><small>Plot 18, Noordwyk · Cost oracle</small></span><span className="tag tag-blue">12.2% yield</span></div><div className="list-row"><span><strong>Contribution recorded</strong><small>Tlangelani Mkhabela · Capital fund</small></span><span className="muted" style={{ fontSize: 11 }}>Yesterday</span></div><div className="list-row"><span><strong>Zoning match confirmed</strong><small>RES3 · Midrand scout lead</small></span><span className="tag tag-green">Low risk</span></div></section>
      </div>
      <div className="stack">
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Quick actions</span><h2 className="card-title" style={{ marginTop: 6 }}>Move a lead forward</h2></div><span style={{ color: "#2f70ef", fontSize: 21 }}>↗</span></div><div className="grid-3" style={{ gridTemplateColumns: "1fr", gap: 9, marginTop: 18 }}><Link href="/scout" className="button button-quiet" style={{ justifyContent: "flex-start" }}>⌖ <span><strong style={{ display: "block" }}>Scout new land</strong><small className="muted">Resolve zoning and amenity context</small></span></Link><Link href="/evaluate" className="button button-quiet" style={{ justifyContent: "flex-start" }}>＋ <span><strong style={{ display: "block" }}>Run a feasibility</strong><small className="muted">Turn listing data into a decision</small></span></Link><Link href="/capital" className="button button-quiet" style={{ justifyContent: "flex-start" }}>◉ <span><strong style={{ display: "block" }}>Review capital fund</strong><small className="muted">Track contributions and approvals</small></span></Link></div></section>
        <section className="card card-pad"><div className="split"><div><span className="card-kicker">Scout signal</span><h2 className="card-title" style={{ marginTop: 6 }}>Top lead this week</h2></div><span className="score-ring"><span>86</span></span></div><h3 style={{ margin: "18px 0 4px", fontSize: 17 }}>Stand 218, Noordwyk Ext 42</h3><p className="muted" style={{ margin: 0, fontSize: 12 }}>1 024 m² · RES3 · Johannesburg</p><div className="split" style={{ marginTop: 18 }}><span className="tag tag-blue">Buildable 1 536 m²</span><span className="tag tag-green">Dolomite low</span></div><Link href="/scout" className="button button-primary" style={{ width: "100%", marginTop: 18 }}>Review scout leads</Link></section>
      </div>
    </div>
  </div>;
}
