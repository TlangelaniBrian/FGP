import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

async function main(): Promise<void> {
  const requiredAssets = [
    "apps/web/public/brand/capitec-c-mark.svg",
    "apps/web/public/brand/capitec-logo-full.svg",
    "apps/web/public/brand/capitec-wordmark.svg",
    "apps/web/app/fonts/NunitoSans-Variable.ttf",
  ];

  for (const relativePath of requiredAssets) {
    assert.ok(existsSync(path.join(root, relativePath)), `Missing visual-foundation asset: ${relativePath}`);
  }

  const formatterPath = "apps/web/lib/format.ts";
  assert.ok(existsSync(path.join(root, formatterPath)), `Missing visual-foundation formatter: ${formatterPath}`);
  const { formatZar } = await import(pathToFileURL(path.join(root, formatterPath)).href);
  assert.equal(formatZar(1234.5), "R 1 234.50", "formatZar must use spaces and exactly two decimals");

  const appShell = source("apps/web/app/_components/AppShell.tsx");
  assert.match(appShell, /fgp_colour_mode/, "AppShell must persist colour mode independently");
  assert.match(appShell, /fgp_visual_direction/, "AppShell must persist visual direction independently");
  assert.match(appShell, /useState<ColourMode>/, "AppShell must expose ColourMode state");
  assert.match(appShell, /useState<VisualDirection>/, "AppShell must expose VisualDirection state");

  const portalChrome = source("apps/web/app/_components/PortalChrome.tsx");
  assert.match(portalChrome, /\bColourMode\b/, "PortalChrome must expose a colour-mode control");
  assert.match(portalChrome, /<PortalIcon\b/, "PortalChrome controls must render through PortalIcon");
  assert.match(portalChrome, /aria-pressed=/, "The colour-mode control must expose its pressed state");
  assert.match(portalChrome, /aria-label=[^>\n]*(?:colour|dark|light)/i, "The colour-mode control must have an explicit accessible name");

  const globals = source("apps/web/app/globals.css");
  assert.match(globals, /\[data-mode=["']?dark["']?\]/, "globals.css must define dark-mode tokens");
  assert.match(globals, /@media\s*\(max-width:\s*860px\)/, "globals.css must use the 860px portal breakpoint");
  assert.match(globals, /cubic-bezier\(0\.2,\s*0,\s*0,\s*1\)/, "globals.css must use the prescribed easing");
  assert.match(globals, /@keyframes\s+[\w-]+[\s\S]*translateY\(8px\)/, "globals.css must define the 8px entry animation");
  assert.match(globals, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*animation/, "globals.css must override animation for reduced-motion preferences");

  console.log("UI foundation contract smoke passed");
}

void main();
