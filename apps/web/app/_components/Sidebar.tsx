"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PortalIcon } from "./PortalIcon";

type Project = { id: number; name: string; status: string };
const nav = [
  { href: "/", label: "Dashboard", icon: "space_dashboard" }, { href: "/scout", label: "Scout", icon: "travel_explore", badge: "5" },
  { href: "/evaluate", label: "Evaluate land", icon: "calculate" }, { href: "/evaluate/result", label: "Cost oracle", icon: "insights" },
  { href: "/projects", label: "Projects", icon: "account_balance" }, { href: "/capital", label: "Capital fund", icon: "savings" },
  { href: "/settings/tariffs", label: "Tariffs", icon: "receipt_long" }, { href: "/settings", label: "Settings", icon: "settings" },
];

export function Sidebar({ projects }: { projects: Project[] }) {
  const path = usePathname();
  const isActive = (href: string) => href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
  return <aside className="portal-sidebar">
    <div className="brand-lockup"><div className="brand-mark"><PortalIcon name="domain" /></div><div><strong>First Generation</strong><span>PROPERTIES</span></div></div>
    <nav className="portal-nav" aria-label="Main navigation">
      {nav.slice(0, 2).map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "nav-item is-active" : "nav-item"}><PortalIcon name={item.icon} className="nav-icon" /><span>{item.label}</span>{item.badge && <span className="nav-badge">{item.badge}</span>}</Link>)}
      <span className="nav-section">Analysis</span>
      {nav.slice(2, 4).map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "nav-item is-active" : "nav-item"}><PortalIcon name={item.icon} className="nav-icon" /><span>{item.label}</span></Link>)}
      <span className="nav-section">Workspace</span>
      {nav.slice(4, 6).map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "nav-item is-active" : "nav-item"}><PortalIcon name={item.icon} className="nav-icon" /><span>{item.label}</span></Link>)}
      <span className="nav-section">Admin</span>
      {nav.slice(6).map((item) => <Link key={item.href} href={item.href} className={isActive(item.href) ? "nav-item is-active" : "nav-item"}><PortalIcon name={item.icon} className="nav-icon" /><span>{item.label}</span></Link>)}
      <Link href="/settings/scraper" className={isActive("/settings/scraper") ? "nav-item is-active" : "nav-item"}><PortalIcon name="sync" className="nav-icon" /><span>Scraper jobs</span></Link>
    </nav>
    <div className="sidebar-projects"><span className="nav-section">Active projects</span>{projects.slice(0, 3).map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="project-link"><i className={`status-dot ${project.status}`} />{project.name}</Link>)}</div>
    <div className="sidebar-footer"><Image className="capitec-mark" src="/brand/capitec-c-mark.svg" alt="" width={36} height={19} /><span>Built on Capitec DS</span></div>
  </aside>;
}
