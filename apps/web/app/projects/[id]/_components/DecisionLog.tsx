type Decision = {
  id: number;
  decidedAt: string;
  decision: string;
  rationale: string | null;
  impact: string | null;
};

export function DecisionLog({ decisions }: { decisions: Decision[] }) {
  return (
    <div className="bg-bg-surface border border-border rounded-card p-5">
      <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-4">Decision Log</p>
      <div className="flex flex-col gap-4">
        {decisions.map(d => (
          <div key={d.id} className="border-l-2 border-border pl-4">
            <p className="text-[10px] font-mono text-text-dim mb-1">{d.decidedAt}</p>
            <p className="font-mono text-sm text-text-primary">{d.decision}</p>
            {d.rationale && <p className="font-mono text-xs text-text-muted mt-1">{d.rationale}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
