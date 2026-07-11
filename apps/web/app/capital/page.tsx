"use client";

import { useEffect, useMemo, useState } from "react";
import { actorHeaders } from "@/lib/portal-client";
import { can, formatZar, readPortalPreference, team, type Role } from "@/lib/portal-state";

type Contribution = { id: number; member: string; date: string; amount: number; note: string };
type GoalProposal = { id: number; newAmount: string; approvals: string[]; proposedBy: string };
type Correction = { id: number; contributionId: number; action: string; approvals: string[]; proposedBy: string; proposedAmount: string | null };
type Governance = { requiredMembers: string[]; members: Array<{ name: string; role: string; status: string }> };

export default function CapitalPage() {
  const current = readPortalPreference("fgp_user", team[0]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [governance, setGovernance] = useState<Governance>({ requiredMembers: [], members: [] });
  const [goal, setGoal] = useState(760000);
  const [goalProposal, setGoalProposal] = useState<GoalProposal | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [correctionFor, setCorrectionFor] = useState<Contribution | null>(null);
  const [correctionAction, setCorrectionAction] = useState<"edit" | "remove">("edit");
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("Monthly contribution");
  const [showRecord, setShowRecord] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const total = useMemo(() => contributions.reduce((sum, item) => sum + item.amount, 0), [contributions]);
  const leaderboard = useMemo(() => Array.from(contributions.reduce((totals, item) => totals.set(item.member, (totals.get(item.member) ?? 0) + item.amount), new Map<string, number>())).sort((a, b) => b[1] - a[1]), [contributions]);

  useEffect(() => {
    fetch("/api/capital", { headers: actorHeaders() }).then(async (response) => {
      if (!response.ok) throw new Error("Capital fund is not connected. Apply migration 0006 to enable the live ledger.");
      const payload = await response.json() as { contributions: Array<{ id: number; memberName: string; contributionDate: string; amount: string; note: string | null }>; goal: number; goalProposal: { id: number; newAmount: string; approvals: unknown; proposedBy: string } | null; corrections: Array<{ id: number; contributionId: number; action: string; approvals: unknown; proposedBy: string; proposedAmount: string | null }>; governance: Governance };
      setContributions(payload.contributions.map((item) => ({ id: item.id, member: item.memberName, date: item.contributionDate, amount: Number(item.amount), note: item.note ?? "Contribution" })));
      setGoal(payload.goal);
      if (payload.goalProposal) setGoalProposal({ id: payload.goalProposal.id, newAmount: payload.goalProposal.newAmount, approvals: Array.isArray(payload.goalProposal.approvals) ? payload.goalProposal.approvals as string[] : [], proposedBy: payload.goalProposal.proposedBy });
      setCorrections(payload.corrections.map((item) => ({ id: item.id, contributionId: item.contributionId, action: item.action, approvals: Array.isArray(item.approvals) ? item.approvals as string[] : [], proposedBy: item.proposedBy, proposedAmount: item.proposedAmount })));
      setGovernance(payload.governance);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  async function recordContribution(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!value || value < 1) return;
    const response = await fetch("/api/capital", { method: "POST", headers: actorHeaders(), body: JSON.stringify({ action: "contribution", amount: value, note }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Could not record contribution"); return; }
    setContributions((items) => [{ id: payload.id, member: payload.memberName, date: payload.contributionDate, amount: Number(payload.amount), note: payload.note ?? note }, ...items]);
    setAmount(""); setShowRecord(false); setMessage("Contribution recorded in the live ledger.");
  }

  async function proposeGoal(event: React.FormEvent) {
    event.preventDefault();
    const value = Number((event.currentTarget as HTMLFormElement).querySelector("input")?.value);
    if (!value || value < total) return;
    const response = await fetch("/api/capital", { method: "POST", headers: actorHeaders(), body: JSON.stringify({ action: "goal", newAmount: value }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Could not create goal proposal"); return; }
    setGoalProposal({ id: payload.id, newAmount: payload.newAmount, approvals: payload.approvals, proposedBy: payload.proposedBy });
    setMessage("Goal proposal created. Every active governing member must co-sign before it applies.");
  }

  async function approveGoal() {
    if (!goalProposal) return;
    const response = await fetch("/api/capital", { method: "POST", headers: actorHeaders(), body: JSON.stringify({ action: "approve-goal", proposalId: goalProposal.id }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Could not co-sign proposal"); return; }
    if (payload.approved) { setGoal(Number(goalProposal.newAmount)); setGoalProposal(null); setMessage("Goal approved and applied."); }
    else { setGoalProposal({ ...goalProposal, approvals: payload.approvals }); setGovernance((current) => ({ ...current, requiredMembers: payload.requiredMembers ?? current.requiredMembers })); setMessage("Your co-sign was recorded."); }
  }

  async function proposeCorrection(event: React.FormEvent) {
    event.preventDefault();
    if (!correctionFor) return;
    const response = await fetch("/api/capital", { method: "POST", headers: actorHeaders(), body: JSON.stringify({ action: "correction", contributionId: correctionFor.id, correctionAction, amount: correctionAction === "edit" ? Number(correctionAmount) : undefined, proposedNote: correctionNote }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Could not create correction proposal"); return; }
    setCorrections((items) => [...items, { id: payload.id, contributionId: payload.contributionId, action: payload.action, approvals: payload.approvals, proposedBy: payload.proposedBy, proposedAmount: payload.proposedAmount }]); setCorrectionFor(null); setMessage("Correction proposal created. Another governing member must co-sign.");
  }

  async function approveCorrection(proposal: Correction) {
    const response = await fetch("/api/capital", { method: "POST", headers: actorHeaders(), body: JSON.stringify({ action: "approve-correction", proposalId: proposal.id }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Could not co-sign correction"); return; }
    setCorrections((items) => items.map((item) => item.id === proposal.id ? { ...item, approvals: payload.approvals } : item)); setMessage(payload.approved ? "Correction approved and applied." : "Your co-sign was recorded.");
  }

  return <div className="portal-page">
    <div className="portal-page-head"><div><p className="eyebrow">Governance · Shared capital</p><h1 className="page-title">Capital fund</h1><p className="page-subtitle">Durable contributions, accountable approvals, and a shared path to the next build.</p></div>{can(current.role as Role, "record") && <button className="button button-primary" onClick={() => setShowRecord(true)}>＋ Record contribution</button>}</div>
    {message && <div className="card" style={{ padding: "12px 16px", marginBottom: 16, color: "#16653d", background: "#effaf3", borderColor: "#b9e6c9", fontSize: 12, fontWeight: 800 }}>{message}</div>}
    <div className="stat-grid" style={{ marginBottom: 18 }}><div className="card stat-card"><span className="card-kicker">Current balance</span><div className="stat-value">{formatZar(total)}</div><div className="stat-note">{contributions.length} posted contributions</div></div><div className="card stat-card"><span className="card-kicker">Current goal</span><div className="stat-value">{formatZar(goal)}</div><div className="stat-note">{Math.round(total / goal * 100)}% funded</div></div><div className="card stat-card"><span className="card-kicker">Members contributing</span><div className="stat-value">{new Set(contributions.map((item) => item.member)).size} / {governance.members.length || "—"}</div><div className="stat-note">Active governing members</div></div><div className="card stat-card"><span className="card-kicker">Next milestone</span><div className="stat-value">R 500k</div><div className="stat-note">{formatZar(Math.max(0, 500000 - total))} to go</div></div></div>
    <div className="grid-2"><section className="card card-pad"><div className="split"><div><span className="card-kicker">Contributions ledger</span><h2 className="card-title" style={{ marginTop: 6 }}>Every rand accounted for</h2></div><button className="button button-quiet" onClick={() => setMessage("Account details copied to your clipboard.")}>Share account details</button></div><div style={{ marginTop: 14 }}>{contributions.length ? contributions.map((item) => <div className="list-row" key={item.id}><span><strong>{item.member}</strong><small>{item.date} · {item.note}</small></span><span className="split"><strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatZar(item.amount)}</strong>{can(current.role as Role, "proposal") && <button className="button button-quiet" style={{ minHeight: 28, padding: "0 9px", marginLeft: 10 }} onClick={() => { setCorrectionFor(item); setCorrectionAmount(String(item.amount)); setCorrectionNote(item.note); }}>Correct</button>}</span></div>) : <div className="empty-state">No contributions have been posted yet.</div>}</div>{corrections.length > 0 && <div style={{ marginTop: 18 }}><span className="card-kicker">Pending corrections</span>{corrections.map((proposal) => <div className="list-row" key={proposal.id}><span><strong>{proposal.action === "remove" ? "Removal" : "Edit"} · contribution #{proposal.contributionId}</strong><small>Proposed by {proposal.proposedBy} · {proposal.approvals.length} co-signs</small></span>{!proposal.approvals.includes(current.name) && <button className="button button-secondary" onClick={() => approveCorrection(proposal)}>Co-sign</button>}</div>)}</div>}</section><div className="stack"><section className="card card-pad"><div className="split"><div><span className="card-kicker">Goal progress</span><h2 className="card-title" style={{ marginTop: 6 }}>Soshanguve acquisition</h2></div><span className="tag tag-blue">2026</span></div><div style={{ marginTop: 24 }}><div className="split" style={{ marginBottom: 7, fontSize: 12 }}><strong>{formatZar(total)}</strong><span className="muted">of {formatZar(goal)}</span></div><div className="progress"><span style={{ width: `${Math.min(100, total / goal * 100)}%` }} /></div></div>{can(current.role as Role, "proposal") && <form onSubmit={proposeGoal} style={{ marginTop: 18, display: "flex", gap: 8 }}><input className="field" type="number" placeholder="New goal" aria-label="New fund goal" /><button className="button button-secondary" type="submit">Propose</button></form>}{goalProposal && <div className="card" style={{ padding: 12, marginTop: 14, background: "#fff8ea", borderColor: "#f0d59d", fontSize: 11 }}><strong>Awaiting unanimous co-sign</strong><p style={{ margin: "4px 0 0", color: "#6d7885" }}>{formatZar(Number(goalProposal.newAmount))} proposed by {goalProposal.proposedBy}. {goalProposal.approvals.length} of {governance.requiredMembers.length} signatures recorded.</p><div style={{ marginTop: 10 }}>{governance.requiredMembers.map((member) => <div className="split" key={member} style={{ fontSize: 11, padding: "3px 0" }}><span>{member}</span><span className={goalProposal.approvals.includes(member) ? "tag tag-green" : "tag tag-amber"}>{goalProposal.approvals.includes(member) ? "Signed" : "Pending"}</span></div>)}</div>{!goalProposal.approvals.includes(current.name) && <button className="button button-secondary" style={{ marginTop: 10 }} onClick={approveGoal}>Co-sign proposal</button>}</div>}</section><section className="card card-pad"><span className="card-kicker">Leaderboard</span><h2 className="card-title" style={{ marginTop: 6 }}>This year’s contributors</h2>{leaderboard.length ? leaderboard.map(([name, amount], index) => <div className="list-row" key={name}><span><strong>{index + 1}. {name}</strong><small>{index === 0 ? "Lead contributor" : "Member"}</small></span><span className="tag tag-green">{formatZar(amount)}</span></div>) : <div className="empty-state" style={{ marginTop: 14 }}>Leaderboard appears after the first posted contribution.</div>}</section></div></div>
    {corrections.length > 0 && <section className="card card-pad" style={{ marginTop: 18 }}><span className="card-kicker">Governance audit</span><h2 className="card-title" style={{ marginTop: 6 }}>Correction co-sign status</h2>{corrections.map((proposal) => <div className="list-row" key={`audit-${proposal.id}`}><span><strong>{proposal.action === "remove" ? "Removal" : "Edit"} · contribution #{proposal.contributionId}</strong><small>{proposal.proposedBy} · {proposal.approvals.length} signatures</small></span><span className="split">{governance.requiredMembers.map((member) => <span className={proposal.approvals.includes(member) ? "tag tag-green" : "tag tag-amber"} key={`${proposal.id}-${member}`}>{member.split(" ")[0]}: {proposal.approvals.includes(member) ? "✓" : "…"}</span>)}</span></div>)}</section>}
    {showRecord && <div className="modal-scrim" role="dialog" aria-modal="true"><form className="modal-card" onSubmit={recordContribution}><div className="split"><div><span className="card-kicker">Capital fund</span><h2 className="card-title" style={{ marginTop: 6 }}>Record contribution</h2></div><button type="button" className="icon-button" onClick={() => setShowRecord(false)}>×</button></div><label className="field-label" style={{ marginTop: 22 }}>Amount (ZAR)<input className="field" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" required /></label><label className="field-label" style={{ marginTop: 14 }}>Note<input className="field" value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="button button-primary" style={{ width: "100%", marginTop: 22 }}>Save contribution</button></form></div>}
    {correctionFor && <div className="modal-scrim" role="dialog" aria-modal="true"><form className="modal-card" onSubmit={proposeCorrection}><div className="split"><div><span className="card-kicker">Maker-checker</span><h2 className="card-title" style={{ marginTop: 6 }}>Propose correction</h2></div><button type="button" className="icon-button" onClick={() => setCorrectionFor(null)}>×</button></div><p className="muted" style={{ fontSize: 12 }}>Contribution by {correctionFor.member} · {formatZar(correctionFor.amount)}</p><label className="field-label">Action<select className="field" value={correctionAction} onChange={(event) => setCorrectionAction(event.target.value as "edit" | "remove")}><option value="edit">Edit contribution</option><option value="remove">Remove contribution</option></select></label>{correctionAction === "edit" && <label className="field-label" style={{ marginTop: 12 }}>Correct amount<input className="field" value={correctionAmount} onChange={(event) => setCorrectionAmount(event.target.value)} type="number" min="1" required /></label>}<label className="field-label" style={{ marginTop: 12 }}>Reason<textarea className="field" value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} required /></label><button className="button button-primary" style={{ width: "100%", marginTop: 18 }}>Submit for co-sign</button></form></div>}
  </div>;
}
