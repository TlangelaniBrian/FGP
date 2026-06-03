import type { Metadata } from "next";
import { Playfair_Display, DM_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./_components/Sidebar";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-playfair",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

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

  return (
    <html lang="en" className={`${playfair.variable} ${dmMono.variable}`}>
      <body className="bg-bg-base text-text-primary min-h-screen font-mono">
        <header className="bg-bg-header border-b border-border sticky top-0 z-50 h-[58px] px-8 flex items-center gap-10">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-accent-blue-dark flex items-center justify-center text-sm">
              🏗
            </div>
            <div>
              <div className="font-heading text-sm text-text-primary font-bold leading-none">First Generation</div>
              <div className="font-mono text-[9px] text-text-muted tracking-[1.5px] uppercase">Properties</div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-xs font-bold">TM</div>
            <span className="font-mono text-xs text-text-muted">T. Mkhabela</span>
          </div>
        </header>
        <div className="flex min-h-[calc(100vh-58px)]">
          <Sidebar projects={projects} />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
