import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "./_components/AppShell";
import { db, projects } from "@fgp/database";
import { desc, sql } from "drizzle-orm";
import { getAuthenticatedActor } from "@/lib/portal-auth";

export const metadata: Metadata = {
  title: "First Generation Properties",
  description: "Property development feasibility platform for Gauteng",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let projectRows: { id: number; name: string | null; status: string | null }[] = [];
  try {
    const actor = await getAuthenticatedActor();
    if (actor) projectRows = await db.select({ id: projects.id, name: projects.name, status: projects.status }).from(projects).where(sql`${projects.userId} = ${actor.userId}`).orderBy(desc(projects.createdAt)).limit(20);
  } catch {}

  return <html lang="en"><body><AppShell projects={projectRows.map((project) => ({ id: project.id, name: project.name ?? "Untitled project", status: project.status ?? "planning" }))}>{children}</AppShell></body></html>;
}
