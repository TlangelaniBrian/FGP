import type { Metadata } from "next";
import localFont from "next/font/local";
import "material-symbols/rounded.css";
import "./globals.css";
import { AppShell } from "./_components/AppShell";
import { db, projects } from "@fgp/database";
import { desc, sql } from "drizzle-orm";
import { getAuthenticatedActor } from "@/lib/portal-auth";

const nunito = localFont({
  src: "./fonts/NunitoSans-Variable.ttf",
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "First Generation Properties",
  description: "Property development feasibility platform for Gauteng",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let projectRows: { id: number; name: string | null; status: string | null }[] = [];
  let actor = null;
  try {
    actor = await getAuthenticatedActor();
    if (actor) projectRows = await db.select({ id: projects.id, name: projects.name, status: projects.status }).from(projects).where(sql`${projects.userId} = ${actor.userId}`).orderBy(desc(projects.createdAt)).limit(20);
  } catch {}

  return <html lang="en" className={nunito.variable}><body><AppShell actor={actor} projects={projectRows.map((project) => ({ id: project.id, name: project.name ?? "Untitled project", status: project.status ?? "planning" }))}>{children}</AppShell></body></html>;
}
