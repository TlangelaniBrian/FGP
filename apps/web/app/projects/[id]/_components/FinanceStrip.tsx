import { formatZar } from "@/lib/format";

type Milestone = { targetDate: string; milestone: string; status: string; isMajor: boolean };
type Project = { monthlySavingZar: string | null; phase1TargetZar: string | null };

export function FinanceStrip({ project, milestones, savedToDate = 0 }: { project: Project; milestones: Milestone[]; savedToDate?: number }) {
  const saved = savedToDate; // summed from weekly check-in deposits
  const nextMajor = milestones.find(m => m.isMajor && m.status === "PENDING");
  const breakGround = milestones.find(m => m.milestone.includes("BREAK GROUND"));

  const monthly = Number(project.monthlySavingZar ?? 3000);
  const monthlyTarget = Number(project.phase1TargetZar ?? 210_000);
  const monthsToTarget = Math.ceil(monthlyTarget / monthly);

  const statCard = "bg-bg-surface border border-border rounded-card p-4";
  const label = "text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1";

  return (
    <div className="portal-grid-3">
      <div className={statCard}>
        <p className={label}>Saved to Date</p>
        <p className="font-mono text-2xl font-bold text-accent-green">{formatZar(saved)}</p>
        <p className="text-text-muted font-mono text-xs mt-1">{formatZar(monthly)}/mo combined</p>
      </div>
      <div className={statCard}>
        <p className={label}>Next Milestone</p>
        <p className="font-mono text-sm font-semibold text-accent-amber leading-tight">
          {nextMajor?.milestone.replace("★ ", "") ?? "—"}
        </p>
        <p className="text-text-muted font-mono text-xs mt-1">{nextMajor?.targetDate ?? "—"}</p>
      </div>
      <div className={statCard}>
        <p className={label}>Break Ground</p>
        <p className="font-mono text-sm font-semibold text-text-primary">{breakGround?.targetDate ?? "Oct 2028"}</p>
        <p className="text-text-muted font-mono text-xs mt-1">{monthsToTarget} months total</p>
      </div>
    </div>
  );
}
