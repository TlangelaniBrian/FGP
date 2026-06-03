type Milestone = {
  id: number;
  targetDate: string;
  milestone: string;
  status: string;
  owner: string | null;
  isMajor: boolean;
};

const statusDot: Record<string, string> = {
  IN_PROGRESS: "bg-accent-amber",
  COMPLETED: "bg-accent-green",
  PENDING: "bg-bg-surface border border-border",
};

export function MilestonesTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="bg-bg-surface border border-border rounded-card p-5">
      <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-5">Milestones</p>
      <div className="flex flex-col gap-0">
        {milestones.map((m, i) => (
          <div key={m.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${statusDot[m.status] ?? statusDot.PENDING}`} />
              {i < milestones.length - 1 && <div className="w-px flex-1 bg-border min-h-[28px]" />}
            </div>
            <div className="pb-5">
              <p className={`font-mono text-sm ${m.status === "PENDING" && !m.isMajor ? "text-text-muted" : "text-text-primary"}`}>
                {m.milestone}
              </p>
              <p className="font-mono text-xs text-text-muted mt-0.5">
                {m.targetDate}{m.owner ? ` · ${m.owner}` : ""}
                {m.status === "IN_PROGRESS" && <span className="ml-2 text-accent-amber">IN PROGRESS</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
