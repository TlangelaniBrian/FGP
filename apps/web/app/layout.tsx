import type { Metadata } from "next";
import { Playfair_Display, DM_Mono } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmMono.variable}`}>
      <body className="bg-bg-base text-text-primary min-h-screen font-mono">
        {/* Topbar */}
        <header className="bg-[#0a1120] border-b border-border sticky top-0 z-50 h-[58px] px-8 flex items-center gap-10">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-[#1d4ed8] flex items-center justify-center text-sm">
              🏗
            </div>
            <div>
              <div className="font-heading text-sm text-text-primary font-bold leading-none">
                First Generation
              </div>
              <div className="font-mono text-[9px] text-text-muted tracking-[1.5px] uppercase">
                Properties
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex gap-1 flex-1">
            {[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Scout", href: "/scout" },
              { label: "Projects", href: "/projects" },
              { label: "Settings", href: "/settings/scraper" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-text-muted hover:text-text-primary hover:bg-border transition-colors"
              >
                {item.label.toUpperCase()}
              </a>
            ))}
          </nav>

          {/* User */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-purple-600 flex items-center justify-center text-xs font-bold">
              TM
            </div>
            <span className="font-mono text-xs text-text-muted">
              T. Mkhabela
            </span>
          </div>
        </header>

        <main className="min-h-[calc(100vh-58px)]">{children}</main>
      </body>
    </html>
  );
}
