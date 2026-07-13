import Link from "next/link";
import { headers } from "next/headers";
import { getRequestOrigin } from "@/lib/request-origin";

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
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") ?? "";
  const origin = getRequestOrigin(requestHeaders);
  const res = await fetch(
    `${origin}/api/projects`,
    { cache: "no-store", headers: { cookie } }
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
    <div className="portal-page">
      <div className="portal-page-head"><div><p className="eyebrow">Workspace · Delivery pipeline</p><h1 className="page-title">Projects</h1><p className="page-subtitle">Track live developments from first feasibility signal to completion.</p></div><Link className="button button-primary" href="/evaluate">＋ New project analysis</Link></div>
      <div className="grid-3">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="card card-pad hover:border-accent-blue transition-colors flex justify-between items-start"
          >
            <div>
              <div className="card-title" style={{ fontSize: 17 }}>{p.name}</div>
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
