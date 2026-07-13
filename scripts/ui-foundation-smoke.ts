import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function sourceFiles(relativeDirectory: string): string[] {
  const absoluteDirectory = path.join(root, relativeDirectory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
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
  assert.match(appShell, /appearanceReady/, "AppShell must gate preference-dependent UI until validated preferences are adopted");
  assert.match(appShell, /data-mode=\{appearanceReady\s*\?\s*colourMode\s*:\s*undefined\}/, ".portal-app must not expose a stale colour-mode attribute before appearance readiness");
  assert.match(appShell, /data-dir=\{appearanceReady\s*\?\s*visualDirection\s*:\s*undefined\}/, ".portal-app must not expose a stale direction attribute before appearance readiness");
  assert.doesNotMatch(appShell, /queueMicrotask/, "Appearance adoption must not add a second stale-state paint via a queued microtask");

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
  assert.match(portalChrome, /appearanceReady\s*\?/, "PortalChrome must hide preference-dependent controls until appearance readiness");
  assert.match(portalChrome, /appearance-controls-placeholder/, "PortalChrome must reserve control dimensions while appearance preferences become ready");

  const darkTokens = blocksAfter(globals, /\[data-mode=["']?dark["']?\]\s*(?=\{)/)[0];
  assert.ok(darkTokens, "globals.css must define a dark-mode token block");
  assert.match(darkTokens, /--[\w-]*(?:canvas|bg-base)[\w-]*\s*:/, "Dark mode must override the canvas token");
  assert.match(darkTokens, /--[\w-]*surface[\w-]*\s*:/, "Dark mode must override a surface token");
  assert.match(darkTokens, /--[\w-]*(?:ink|text-primary)[\w-]*\s*:/, "Dark mode must override the primary text token");
  assert.match(darkTokens, /--[\w-]*(?:line|border)[\w-]*\s*:/, "Dark mode must override a border token");
  assert.match(globals, /@media\s*\(max-width:\s*860px\)/, "globals.css must use the 860px portal breakpoint");
  assert.match(globals, /cubic-bezier\(0\.2,\s*0,\s*0,\s*1\)/, "globals.css must use the prescribed easing");

  for (const columns of [2, 3, 4]) {
    assert.match(
      globals,
      new RegExp(`\\.portal-grid-${columns}\\s*\\{[^}]*grid-template-columns:\\s*repeat\\(${columns},\\s*minmax\\(0,\\s*1fr\\)\\)`, "s"),
      `.portal-grid-${columns} must define an explicit ${columns}-column portal grid`,
    );
  }

  const responsivePortalGrids = blocksAfter(globals, /@media\s*\(max-width:\s*860px\)\s*/)[0];
  assert.ok(responsivePortalGrids, "globals.css must define the 860px responsive contract");
  for (const columns of [2, 3, 4]) {
    assert.match(
      responsivePortalGrids,
      new RegExp(`\\.portal-grid-${columns}`),
      `.portal-grid-${columns} must participate in the 860px responsive contract`,
    );
  }
  assert.match(
    responsivePortalGrids,
    /\.portal-grid-2[\s\S]*grid-template-columns:\s*1fr|\.portal-grid-2\s*,[\s\S]*grid-template-columns:\s*1fr/,
    "Portal grids must stack to one column at 860px",
  );
  assert.match(responsivePortalGrids, /\.portal-toolbar\s*\{[^}]*flex-wrap:\s*wrap/s, "The narrow portal toolbar must intentionally wrap its controls");
  assert.match(responsivePortalGrids, /\.mode-switch\s*\{[^}]*flex(?:-basis|:)\s*:\s*100%/s, "The narrow direction selector must receive a complete row");
  assert.match(globals, /\.portal-page[^{}]*\{[^}]*min-width:\s*0/s, ".portal-page must opt out of intrinsic-width overflow");
  assert.match(globals, /\.card[^{}]*\{[^}]*min-width:\s*0/s, "Cards must opt out of intrinsic-width overflow");
  assert.match(globals, /\.grid-2[^{}]*\{[^}]*min-width:\s*0/s, "Dense two-column grids must opt out of intrinsic-width overflow");
  assert.match(responsivePortalGrids, /\.split[^{}]*\{[^}]*flex-wrap:\s*wrap/s, "Dense split rows must wrap at the portal breakpoint");
  assert.match(responsivePortalGrids, /\.list-row[^{}]*\{[^}]*flex-wrap:\s*wrap/s, "Dense list rows must wrap at the portal breakpoint");

  const semanticStatusConsumers = [
    "apps/web/app/settings/page.tsx",
    "apps/web/app/settings/tariffs/page.tsx",
    "apps/web/app/capital/page.tsx",
  ];
  for (const relativePath of semanticStatusConsumers) {
    const consumer = source(relativePath);
    assert.doesNotMatch(consumer, /#(?:0033a0|16653d|effaf3|b9e6c9|fff8ea|f0d59d|845300|6d7885)/i, `${relativePath} must use semantic status and ink tokens instead of listed light-only colours`);
  }
  for (const relativePath of ["apps/web/app/scout/[id]/page.tsx", "apps/web/app/scout/[id]/_components/LinkParcelForm.tsx"]) {
    assert.doesNotMatch(source(relativePath), /#(?:6d7885|16834b|effaf3|b9e6c9|4c6656)/i, `${relativePath} must not leak representative hard-coded neutral/status colours`);
  }
  assert.match(globals, /--status-success-(?:surface|ink|line)\s*:/, "globals.css must define semantic success status tokens");
  assert.match(globals, /--status-warning-(?:surface|ink|line)\s*:/, "globals.css must define semantic warning status tokens");
  assert.match(darkTokens, /--status-success-(?:surface|ink|line)\s*:/, "Dark mode must override semantic success status tokens");
  assert.match(darkTokens, /--status-warning-(?:surface|ink|line)\s*:/, "Dark mode must override semantic warning status tokens");
  assert.match(globals, /\.status-banner-success\s*\{/, "globals.css must expose a semantic success banner class");
  assert.match(globals, /\.status-banner-warning\s*\{/, "globals.css must expose a semantic warning banner class");

  const gridConsumers: Record<string, string[]> = {
    "apps/web/app/page.tsx": ["portal-grid-2"],
    "apps/web/app/scout/[id]/page.tsx": ["portal-grid-2"],
    "apps/web/app/evaluate/page.tsx": ["portal-grid-2"],
    "apps/web/app/evaluate/result/page.tsx": ["portal-grid-3"],
    "apps/web/app/projects/page.tsx": ["portal-grid-3"],
    "apps/web/app/projects/[id]/_components/FinanceStrip.tsx": ["portal-grid-3"],
    "apps/web/app/scout/_components/ParcelDetail.tsx": ["portal-grid-4"],
  };
  for (const [relativePath, classes] of Object.entries(gridConsumers)) {
    const consumer = source(relativePath);
    for (const className of classes) {
      assert.match(consumer, new RegExp(`\\b${className}\\b`), `${relativePath} must consume ${className}`);
    }
  }

  const moneyConsumers = [
    "apps/web/app/page.tsx",
    "apps/web/app/scout/page.tsx",
    "apps/web/app/scout/[id]/page.tsx",
    "apps/web/app/evaluate/result/page.tsx",
    "apps/web/app/projects/page.tsx",
    "apps/web/app/projects/[id]/_components/FinanceStrip.tsx",
    "apps/web/app/projects/[id]/_components/BudgetTable.tsx",
  ];
  for (const relativePath of moneyConsumers) {
    const consumer = source(relativePath);
    assert.match(consumer, /import\s*\{\s*formatZar\s*\}\s*from\s*["']@\/lib\/format["']/, `${relativePath} must import formatZar directly`);
    assert.doesNotMatch(consumer, /const\s+fmt\s*=|`R\s+\$\{|>R\s*\{/, `${relativePath} must not define or render page-local ZAR formatting`);
  }

  const motionConsumers = [
    "apps/web/app/scout/page.tsx",
    "apps/web/app/evaluate/page.tsx",
    "apps/web/app/evaluate/result/page.tsx",
    "apps/web/app/projects/page.tsx",
    "apps/web/app/scout/_components/ParcelDetail.tsx",
  ];
  for (const relativePath of motionConsumers) {
    assert.doesNotMatch(source(relativePath), /\btransition-(?:all|colors)\b/, `${relativePath} must not use generic Tailwind transitions`);
  }
  assert.doesNotMatch(globals, /\.button:hover\s*\{[^}]*translateY/, "Buttons must not translate on hover");

  const genericMotionClass = /\b(?:transition-(?:colors|all)|ease-[\w-]+)\b/;
  for (const relativePath of sourceFiles("apps/web/app")) {
    for (const [index, line] of source(relativePath).split("\n").entries()) {
      if (!genericMotionClass.test(line)) continue;
      assert.match(
        line,
        /\b(?:portal-transition|button)\b/,
        `${relativePath}:${index + 1} must use the shared portal-transition/button contract instead of generic Tailwind motion`,
      );
    }
  }
  for (const relativePath of [
    "apps/web/app/settings/tariffs/page.tsx",
    "apps/web/app/projects/[id]/_components/ThisWeek.tsx",
    "apps/web/app/projects/[id]/_components/CheckInModal.tsx",
  ]) {
    assert.doesNotMatch(source(relativePath), genericMotionClass, `${relativePath} must not retain generic Tailwind motion classes`);
  }
  assert.match(
    globals,
    /\.stat-value\.status-ink-success\s*\{[^}]*color:\s*var\(--status-success-ink\)/s,
    "A stronger stat-value success selector must preserve semantic success colour through the cascade",
  );

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

  const taskReport = source(".superpowers/sdd/task-5-report.md");
  assert.match(taskReport, /canonical Capitec C-mark SVG[^\n]*byte-identical/i, "Task 5 report must document the canonical SVG byte-identity exception");
  assert.match(taskReport, /git diff --check[^\n]*--[^\n]*:\(exclude\)apps\/web\/public\/brand\/capitec-c-mark\.svg/, "Task 5 report must record the exact scoped diff-check command");
  assert.doesNotMatch(taskReport, /`git diff --check`\s*\|\s*PASS/i, "Task 5 report must not claim an unqualified git diff --check pass");

  console.log("UI foundation contract smoke passed");
}

void main();
