import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function blocksAfter(sourceText: string, startPattern: RegExp): string[] {
  const flags = startPattern.flags.includes("g") ? startPattern.flags : `${startPattern.flags}g`;
  const matcher = new RegExp(startPattern.source, flags);
  const blocks: string[] = [];

  for (const match of sourceText.matchAll(matcher)) {
    const openingBrace = sourceText.indexOf("{", match.index + match[0].length);
    if (openingBrace === -1) continue;

    let depth = 0;
    for (let index = openingBrace; index < sourceText.length; index += 1) {
      if (sourceText[index] === "{") depth += 1;
      if (sourceText[index] === "}") depth -= 1;
      if (depth === 0) {
        blocks.push(sourceText.slice(openingBrace + 1, index));
        break;
      }
    }
  }

  return blocks;
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

  const globals = source("apps/web/app/globals.css");
  assert.doesNotMatch(globals, /#e61414/i, "Production CSS must reserve #E61414 for immutable Capitec SVG assets");

  const formatterPath = "apps/web/lib/format.ts";
  assert.ok(existsSync(path.join(root, formatterPath)), `Missing visual-foundation formatter: ${formatterPath}`);
  const { formatZar } = await import(pathToFileURL(path.join(root, formatterPath)).href);
  assert.equal(formatZar(1234.5), "R 1 234.50", "formatZar must use spaces and exactly two decimals");

  const portalStatePath = "apps/web/lib/portal-state.ts";
  const portalState = source(portalStatePath);
  const appShell = source("apps/web/app/_components/AppShell.tsx");
  assert.match(`${appShell}\n${portalState}`, /fgp_colour_mode/, "AppShell must persist colour mode independently");
  assert.match(`${appShell}\n${portalState}`, /fgp_visual_direction/, "AppShell must persist visual direction independently");
  assert.match(appShell, /useState<ColourMode>/, "AppShell must expose ColourMode state");
  assert.match(appShell, /useState<VisualDirection>/, "AppShell must expose VisualDirection state");
  assert.match(appShell, /useState<ColourMode>\(["']light["']\)/, "AppShell colour state must render deterministically as light");
  assert.match(appShell, /useState<VisualDirection>\(["']classic["']\)/, "AppShell direction state must render deterministically as classic");
  assert.doesNotMatch(appShell, /useState<(?:ColourMode|VisualDirection)>\([^)]*readPortalPreference/, "AppShell state initializers must not read browser storage");
  assert.match(appShell, /useEffect\([\s\S]*readColourModePreference\(\)[\s\S]*readVisualDirectionPreference\(\)/, "AppShell must load validated preferences after mount");

  const rootLayout = source("apps/web/app/layout.tsx");
  assert.match(rootLayout, /suppressHydrationWarning/, "Root layout must tolerate the validated pre-paint preference attributes");
  assert.match(rootLayout, /data-mode=["']light["']/, "Root layout must render a deterministic light default");
  assert.match(rootLayout, /data-dir=["']classic["']/, "Root layout must render a deterministic classic default");
  assert.match(rootLayout, /COLOUR_MODE_PREFERENCE_KEY[\s\S]*VISUAL_DIRECTION_PREFERENCE_KEY/, "Root layout must bootstrap both presentation preferences before paint");
  assert.match(rootLayout, /localStorage[\s\S]*(?:includes|Set)[\s\S]*dataset\.mode[\s\S]*dataset\.dir/, "Pre-paint bootstrap must validate and apply both root attributes");

  assert.match(portalState, /isColourMode/, "portal-state must expose a runtime colour-mode guard");
  assert.match(portalState, /isVisualDirection/, "portal-state must expose a runtime visual-direction guard");
  const preferenceModule = await import(pathToFileURL(path.join(root, portalStatePath)).href);
  assert.equal(typeof preferenceModule.isColourMode, "function", "Colour-mode validation must be executable at runtime");
  assert.equal(typeof preferenceModule.isVisualDirection, "function", "Direction validation must be executable at runtime");
  assert.equal(preferenceModule.isColourMode("dark"), true, "dark must be a valid colour mode");
  assert.equal(preferenceModule.isColourMode("sepia"), false, "unknown colour modes must be rejected");
  assert.equal(preferenceModule.isVisualDirection("bold"), true, "bold must be a valid visual direction");
  assert.equal(preferenceModule.isVisualDirection("compact"), false, "unknown visual directions must be rejected");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem(key: string) {
          return key === "fgp_colour_mode" ? JSON.stringify("sepia") : JSON.stringify("compact");
        },
      },
    },
  });
  try {
    assert.equal(preferenceModule.readColourModePreference(), "light", "Invalid stored colour modes must fall back to light");
    assert.equal(preferenceModule.readVisualDirectionPreference(), "classic", "Invalid stored directions must fall back to classic");
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }

  const portalChrome = source("apps/web/app/_components/PortalChrome.tsx");
  const colourModeControl = portalChrome.match(/<button\b[\s\S]*?<\/button>/g)?.find((button) => (
    /\bcolourMode\b/.test(button)
    && /onClick=[\s\S]*?(?:onColourModeChange|setColourMode)/.test(button)
  ));
  assert.ok(colourModeControl, "PortalChrome must render one button whose handler toggles ColourMode");
  assert.match(colourModeControl, /aria-pressed=/, "The colour-mode button must expose its pressed state");
  assert.match(colourModeControl, /aria-label=["']Dark colour mode["']/, "The colour-mode button must have a stable accessible name");
  assert.match(colourModeControl, /<PortalIcon\b[\s\S]*\/?>/, "The colour-mode button must contain PortalIcon");
  assert.match(portalChrome, /\bColourMode\b/, "PortalChrome must type the colour-mode control with ColourMode");

  const darkTokens = blocksAfter(globals, /\[data-mode=["']?dark["']?\]\s*(?=\{)/)[0];
  assert.ok(darkTokens, "globals.css must define a dark-mode token block");
  assert.match(darkTokens, /--[\w-]*(?:canvas|bg-base)[\w-]*\s*:/, "Dark mode must override the canvas token");
  assert.match(darkTokens, /--[\w-]*surface[\w-]*\s*:/, "Dark mode must override a surface token");
  assert.match(darkTokens, /--[\w-]*(?:ink|text-primary)[\w-]*\s*:/, "Dark mode must override the primary text token");
  assert.match(darkTokens, /--[\w-]*(?:line|border)[\w-]*\s*:/, "Dark mode must override a border token");
  assert.match(globals, /@media\s*\(max-width:\s*860px\)/, "globals.css must use the 860px portal breakpoint");
  assert.match(globals, /cubic-bezier\(0\.2,\s*0,\s*0,\s*1\)/, "globals.css must use the prescribed easing");

  const portalPage = blocksAfter(globals, /\.portal-page\s*(?=\{)/).find((block) => /\banimation(?:-name)?\s*:/.test(block));
  assert.ok(portalPage, ".portal-page must apply the entry animation");
  const entryAnimation = [...globals.matchAll(/@keyframes\s+([\w-]+)/g)]
    .map((match) => match[1])
    .find((name) => new RegExp(`\\banimation(?:-name)?\\s*:[^;}]*\\b${name}\\b`).test(portalPage));
  assert.ok(entryAnimation, ".portal-page must reference a named @keyframes entry animation");

  const entryKeyframes = blocksAfter(globals, new RegExp(`@keyframes\\s+${entryAnimation}\\s*`))[0];
  assert.ok(entryKeyframes, "globals.css must define the entry animation referenced by .portal-page");
  const entryStart = blocksAfter(entryKeyframes, /(?:from|0%)\s*/)[0];
  const entryEnd = blocksAfter(entryKeyframes, /(?:to|100%)\s*/)[0];
  assert.ok(entryStart && entryEnd, "The entry animation must define start and end frames");
  assert.match(entryStart, /opacity\s*:\s*0\b/, "The entry animation must fade in from opacity 0");
  assert.match(entryStart, /translateY\(8px\)/, "The entry animation must start 8px below its resting position");
  assert.match(entryEnd, /opacity\s*:\s*1\b/, "The entry animation must fade to opacity 1");
  assert.match(entryEnd, /(?:translateY\(0(?:px)?\)|transform\s*:\s*none)/, "The entry animation must finish at its resting position");

  const reducedMotion = blocksAfter(globals, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*/)[0];
  assert.ok(reducedMotion, "globals.css must define a reduced-motion override");
  assert.match(reducedMotion, /animation\s*:\s*none\b/, "Reduced motion must disable animation");
  assert.match(reducedMotion, /transition\s*:\s*none\b/, "Reduced motion must disable nonessential transitions");

  console.log("UI foundation contract smoke passed");
}

void main();
