import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "./_components/AppShell";

export const metadata: Metadata = {
  title: "First Generation Properties",
  description: "Property development feasibility platform for Gauteng",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let projects: { id: number; name: string; status: string }[] = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/projects`,
      { cache: "no-store" }
    );
    if (res.ok) projects = await res.json();
  } catch {}

  return <html lang="en"><body><AppShell projects={projects}>{children}</AppShell></body></html>;
}
