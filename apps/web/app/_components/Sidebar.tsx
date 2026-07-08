"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Project = { id: number; name: string; status: string };

export function Sidebar({ projects }: { projects: Project[] }) {
  const path = usePathname();
  const active = (href: string) =>
    path === href || path.startsWith(href + "/")
      ? "text-text-primary bg-border"
      : "text-text-muted hover:text-text-primary hover:bg-border/50";

  return (
    <aside className="w-52 flex-shrink-0 bg-bg-header border-r border-border min-h-[calc(100vh-58px)] px-3 py-4 flex flex-col gap-1">
      <p className="text-[9px] font-mono text-text-dim tracking-widest uppercase px-2 mb-2">Projects</p>
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/projects/${p.id}`}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-xs font-mono transition-colors ${active(`/projects/${p.id}`)}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            p.status === "planning" ? "bg-accent-amber"
            : p.status === "construction" ? "bg-accent-green"
            : "bg-text-dim"
          }`} />
          {p.name}
        </Link>
      ))}
      <Link
        href="/evaluate"
        className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-xs font-mono transition-colors ${active("/evaluate")}`}
      >
        <span className="text-text-dim">+</span>
        <span>Evaluate land</span>
      </Link>
      <Link
        href="/scout"
        className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-xs font-mono transition-colors ${active("/scout")}`}
      >
        <span className="text-text-dim">⌖</span>
        <span>Scout</span>
      </Link>

      <div className="mt-auto pt-4 border-t border-border flex flex-col gap-1">
        <p className="text-[9px] font-mono text-text-dim tracking-widest uppercase px-2 mb-1">Tools</p>
        <Link
          href="/settings"
          className={`px-2 py-1.5 rounded-[6px] text-xs font-mono transition-colors ${active("/settings")}`}
        >
          Settings
        </Link>
      </div>
    </aside>
  );
}
