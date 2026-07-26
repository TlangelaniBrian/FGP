import type { Metadata } from "next";
import localFont from "next/font/local";
import "material-symbols/rounded.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { AppShell } from "./_components/AppShell";
import { SessionProvider } from "@/lib/session-context";
import {
  COLOUR_MODES,
  COLOUR_MODE_PREFERENCE_KEY,
  VISUAL_DIRECTIONS,
  VISUAL_DIRECTION_PREFERENCE_KEY,
} from "@/lib/portal-state";

const nunito = localFont({
  src: "./fonts/NunitoSans-Variable.ttf",
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "First Generation Properties",
  description: "Property development feasibility platform for Gauteng",
};

const preferenceBootstrap = `(() => {
  const readPreference = (key, allowed, fallback) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      return allowed.includes(value) ? value : fallback;
    } catch {
      return fallback;
    }
  };
  document.documentElement.dataset.mode = readPreference(${JSON.stringify(COLOUR_MODE_PREFERENCE_KEY)}, ${JSON.stringify(COLOUR_MODES)}, "light");
  document.documentElement.dataset.dir = readPreference(${JSON.stringify(VISUAL_DIRECTION_PREFERENCE_KEY)}, ${JSON.stringify(VISUAL_DIRECTIONS)}, "classic");
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={nunito.variable} data-mode="light" data-dir="classic" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: preferenceBootstrap }} /></head>
    <body>
      <SessionProvider>
        <AppShell projects={[]}>{children}</AppShell>
      </SessionProvider>
    </body>
  </html>;
}
