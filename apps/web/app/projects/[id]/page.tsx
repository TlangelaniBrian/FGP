import { notFound } from "next/navigation";
import { ThisWeek } from "./_components/ThisWeek";
import { FinanceStrip } from "./_components/FinanceStrip";
import { MilestonesTimeline } from "./_components/MilestonesTimeline";
import { BudgetTable } from "./_components/BudgetTable";
import { ContactsTable } from "./_components/ContactsTable";
import { DecisionLog } from "./_components/DecisionLog";
import { ProjectActions } from "./_components/ProjectActions";

async function getProject(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/projects/${id}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProject(id);
  if (!data) notFound();

  const { project, budget, contacts, decisions, milestones, latestCheckin, savedToDate } = data;

  return (
    <div className="p-8 flex flex-col gap-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-1">Project</p>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{project.name}</h1>
          {project.township && (
            <p className="text-text-muted font-mono text-xs mt-1">ERF {project.erfNumber} · {project.township}</p>
          )}
        </div>
        <div className="split"><span className="tag tag-amber">{project.status}</span><ProjectActions project={project} /></div>
      </div>

      <ThisWeek projectId={project.id} latestCheckin={latestCheckin} />
      <FinanceStrip project={project} milestones={milestones} savedToDate={savedToDate ?? 0} />
      <MilestonesTimeline milestones={milestones} />
      <BudgetTable items={budget} />
      <ContactsTable contacts={contacts} />
      <DecisionLog decisions={decisions} />
    </div>
  );
}
