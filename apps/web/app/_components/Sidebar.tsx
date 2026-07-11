"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Project = { id: number; name: string; status: string };
const nav = [
  { href: "/", label: "Dashboard", icon: "▦" }, { href: "/scout", label: "Scout", icon: "⌖", badge: "5" },
  { href: "/evaluate", label: "Evaluate land", icon: "＋" }, { href: "/evaluate/result", label: "Cost oracle", icon: "↗" },
  { href: "/projects", label: "Projects", icon: "▤" }, { href: "/capital", label: "Capital fund", icon: "◉" },
  { href: "/settings/tariffs", label: "Tariffs", icon: "▥" }, { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar({ projects }: { projects: Project[] }) {
  const path = usePathname();
  const isActive = (href: string) => href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
  return <aside className="portal-sidebar">
    <div className="brand-lockup"><div className="brand-mark">⌂</div><div><strong>First Generation</strong><span>PROPERTIES</span></div></div>
    <nav className="portal-nav" aria-label="Main navigation">
      {nav.slice(0, 2).map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "nav-item is-active" : "nav-item"}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.badge && <span className="nav-badge">{item.badge}</span>}</Link>)}
      <span className="nav-section">Analysis</span>
      {nav.slice(2, 4).map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "nav-item is-active" : "nav-item"}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></Link>)}
      <span className="nav-section">Workspace</span>
      {nav.slice(4, 6).map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "nav-item is-active" : "nav-item"}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></Link>)}
      <span className="nav-section">Admin</span>
      {nav.slice(6).map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "nav-item is-active" : "nav-item"}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></Link>)}
    </nav>
    <div className="sidebar-projects"><span className="nav-section">Active projects</span>{projects.slice(0, 3).map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="project-link"><i className={`status-dot ${project.status}`} />{project.name}</Link>)}</div>
    <div className="sidebar-footer"><span className="capitec-mark">C</span><span>Built on Capitec DS</span></div>
  </aside>;
}
