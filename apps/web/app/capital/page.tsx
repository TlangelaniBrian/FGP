"use client";

import { useMemo, useState } from "react";
import { can, formatZar, readPortalPreference, team, type Role, writePortalPreference } from "@/lib/portal-state";

type Contribution = { id: number; member: string; date: string; amount: number; note: string };
const seed: Contribution[] = [
  { id: 1, member: "Tlangelani Mkhabela", date: "03 Jul 2026", amount: 18000, note: "Monthly contribution" },
  { id: 2, member: "Thabo Nkosi", date: "01 Jul 2026", amount: 12000, note: "Monthly contribution" },
  { id: 3, member: "Tlangelani Mkhabela", date: "03 Jun 2026", amount: 18000, note: "Monthly contribution" },
  { id: 4, member: "Thabo Nkosi", date: "01 Jun 2026", amount: 12000, note: "Monthly contribution" },
  { id: 5, member: "Lerato Dube", date: "01 Jun 2026", amount: 7000, note: "Monthly contribution" },
];

export default function CapitalPage() {
  const [current] = useState(() => readPortalPreference("fgp_user", team[0]));
  const [contributions, setContributions] = useState(() => readPortalPreference("fgp_contributions", seed));
  const [goal] = useState(760000);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("Monthly contribution");
  const [showRecord, setShowRecord] = useState(false);
  const [goalProposal, setGoalProposal] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const total = useMemo(() => contributions.reduce((sum, item) => sum + item.amount, 0), [contributions]);
  const activeMembers = team.filter((member) => member.role !== "Viewer");

  function recordContribution(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!value || value < 1) return;
    const next = [{ id: Date.now(), member: current.name, date: "11 Jul 2026", amount: value, note }, ...contributions];
    setContributions(next); writePortalPreference("fgp_contributions", next); setAmount(""); setShowRecord(false); setMessage("Contribution recorded in the ledger.");
  }

  function proposeGoal(event: React.FormEvent) {
    event.preventDefault();
    const value = Number((event.currentTarget as HTMLFormElement).querySelector("input")?.value);
    if (!value || value < total) return;
    setGoalProposal(value); setMessage("Goal proposal created. Each governing member must co-sign before it applies.");
  }

  return <div className="portal-page">
    <div className="portal-page-head"><div><p className="eyebrow">Governance · Shared capital</p><h1 className="page-title">Capital fund</h1><p className="page-subtitle">Transparent contributions, accountable approvals, and a shared path to the next build.</p></div>{can(current.role as Role, "record") && <button className="button button-primary" onClick={() => setShowRecord(true)}>＋ Record contribution</button>}</div>
    {message && <div className="card" style={{ padding: "12px 16px", marginBottom: 16, color: "#16653d", background: "#effaf3", borderColor: "#b9e6c9", fontSize: 12, fontWeight: 800 }}>{message}</div>}
    <div className="stat-grid" style={{ marginBottom: 18 }}><div className="card stat-card"><span className="card-kicker">Current balance</span><div className="stat-value">{formatZar(total)}</div><div className="stat-note">5 contributions this cycle</div></div><div className="card stat-card"><span className="card-kicker">Current goal</span><div className="stat-value">{formatZar(goal)}</div><div className="stat-note">{Math.round(total / goal * 100)}% funded</div></div><div className="card stat-card"><span className="card-kicker">Members contributing</span><div className="stat-value">3 / 3</div><div className="stat-note">All governing members active</div></div><div className="card stat-card"><span className="card-kicker">Next milestone</span><div className="stat-value">R 500k</div><div className="stat-note">{formatZar(Math.max(0, 500000 - total))} to go</div></div></div>
    <div className="grid-2"><section className="card card-pad"><div className="split"><div><span className="card-kicker">Contributions ledger</span><h2 className="card-title" style={{ marginTop: 6 }}>Every rand accounted for</h2></div><button className="button button-quiet" onClick={() => setMessage("Account details copied to your clipboard.")}>Share account details</button></div><div style={{ marginTop: 14 }}>{contributions.map((item) => <div className="list-row" key={item.id}><span><strong>{item.member}</strong><small>{item.date} · {item.note}</small></span><strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatZar(item.amount)}</strong></div>)}</div></section><div className="stack"><section className="card card-pad"><div className="split"><div><span className="card-kicker">Goal progress</span><h2 className="card-title" style={{ marginTop: 6 }}>Soshanguve acquisition</h2></div><span className="tag tag-blue">2026</span></div><div style={{ marginTop: 24 }}><div className="split" style={{ marginBottom: 7, fontSize: 12 }}><strong>{formatZar(total)}</strong><span className="muted">of {formatZar(goal)}</span></div><div className="progress"><span style={{ width: `${Math.min(100, total / goal * 100)}%` }} /></div></div>{can(current.role as Role, "proposal") && <form onSubmit={proposeGoal} style={{ marginTop: 18, display: "flex", gap: 8 }}><input className="field" type="number" placeholder="New goal" aria-label="New fund goal" /><button className="button button-secondary" type="submit">Propose</button></form>}{goalProposal && <div className="card" style={{ padding: 12, marginTop: 14, background: "#fff8ea", borderColor: "#f0d59d", fontSize: 11 }}><strong>Awaiting unanimous co-sign</strong><p style={{ margin: "4px 0 0", color: "#6d7885" }}>{formatZar(goalProposal)} proposed by {current.name}. {activeMembers.length} signatures required.</p></div>}</section><section className="card card-pad"><span className="card-kicker">Leaderboard</span><h2 className="card-title" style={{ marginTop: 6 }}>This year’s contributors</h2>{["Tlangelani Mkhabela", "Thabo Nkosi", "Lerato Dube"].map((name, index) => <div className="list-row" key={name}><span><strong>{index + 1}. {name}</strong><small>{index === 0 ? "Lead contributor" : "Member"}</small></span><span className="tag tag-green">{formatZar([36000, 24000, 7000][index])}</span></div>)}</section></div></div>
    {showRecord && <div className="modal-scrim" role="dialog" aria-modal="true"><form className="modal-card" onSubmit={recordContribution}><div className="split"><div><span className="card-kicker">Capital fund</span><h2 className="card-title" style={{ marginTop: 6 }}>Record contribution</h2></div><button type="button" className="icon-button" onClick={() => setShowRecord(false)}>×</button></div><label className="field-label" style={{ marginTop: 22 }}>Amount (ZAR)<input className="field" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" required /></label><label className="field-label" style={{ marginTop: 14 }}>Note<input className="field" value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="button button-primary" style={{ width: "100%", marginTop: 22 }}>Save contribution</button></form></div>}
  </div>;
}
