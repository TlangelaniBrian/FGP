import Link from "next/link";

type Project = {
  id: number;
  name: string;
  status: string;
  township: string | null;
  erfNumber: string | null;
  phase1TargetZar: string | null;
  monthlySavingZar: string | null;
};

async function getProjects(): Promise<Project[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/projects`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  return res.json();
}

const statusColour: Record<string, string> = {
  planning: "text-accent-amber border-accent-amber",
  compliance: "text-accent-blue border-accent-blue",
  construction: "text-accent-green border-accent-green",
  complete: "text-text-muted border-text-muted",
};

export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <div className="p-8">
      <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-2">Active</p>
      <h1 className="font-heading text-2xl font-bold text-text-primary mb-6">Projects</h1>
      <div className="grid grid-cols-1 gap-4 max-w-2xl">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="bg-bg-surface border border-border rounded-card p-5 hover:border-accent-blue/50 transition-colors flex justify-between items-start"
          >
            <div>
              <div className="font-heading text-lg text-text-primary font-bold mb-1">{p.name}</div>
              {p.township && (
                <div className="text-text-muted font-mono text-xs">ERF {p.erfNumber} · {p.township}</div>
              )}
              {p.phase1TargetZar && (
                <div className="text-text-muted font-mono text-xs mt-1">
                  Target: R {Number(p.phase1TargetZar).toLocaleString("en-ZA")} · Saving: R {Number(p.monthlySavingZar ?? 0).toLocaleString("en-ZA")}/mo
                </div>
              )}
            </div>
            <span className={`text-[10px] font-mono border px-2 py-0.5 rounded-[20px] uppercase tracking-widest ${statusColour[p.status] ?? "text-text-muted border-text-muted"}`}>
              {p.status}
            </span>
          </Link>
        ))}
        {projects.length === 0 && (
          <p className="text-text-muted font-mono text-sm">No projects yet. Use &quot;Evaluate land&quot; to start.</p>
        )}
      </div>
    </div>
  );
}
