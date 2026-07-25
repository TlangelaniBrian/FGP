import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_PORTAL_SETTINGS,
  mergePortalSettings,
  portalSettingsSchema,
} from "../apps/web/lib/portal-settings";

const valid = {
  autoAnalyze: true,
  scoreThreshold: 75,
  email: true,
  whatsapp: true,
  weekly: false,
  digest: true,
  scrapers: {
    property24: true,
    private_property: true,
    propdata: false,
    gumtree: false,
    immo_africa: true,
    entegral: true,
  },
};

assert.deepEqual(portalSettingsSchema.parse(valid).scrapers, {
  property24: true,
  private_property: true,
  propdata: false,
  gumtree: false,
  immo_africa: true,
  entegral: true,
});
assert.equal(
  portalSettingsSchema.safeParse({ ...valid, capital_goal: 1 }).success,
  false,
);
assert.equal(
  portalSettingsSchema.safeParse({ ...valid, scoreThreshold: 49 }).success,
  false,
);
assert.equal(
  portalSettingsSchema.safeParse({
    ...valid,
    scrapers: { ...valid.scrapers, unknown: true },
  }).success,
  false,
);
assert.equal(portalSettingsSchema.safeParse({ autoAnalyze: true }).success, false);

assert.deepEqual(
  mergePortalSettings([
    { key: "autoAnalyze", value: false },
    { key: "scoreThreshold", value: 95 },
    { key: "email", value: "yes" },
    { key: "capital_goal", value: 1 },
    {
      key: "scrapers",
      value: { ...valid.scrapers, unknown: true },
    },
  ]),
  {
    ...DEFAULT_PORTAL_SETTINGS,
    autoAnalyze: false,
    scoreThreshold: 95,
  },
);

async function main() {
  const page = await readFile(
    new URL("../apps/web/app/settings/page.tsx", import.meta.url),
    "utf8",
  );

  for (const label of [
    "Email alerts",
    "WhatsApp alerts",
    "Weekly digest",
    "Document status",
    "Property24",
    "Private Property",
    "PropData",
    "Gumtree",
    "Immo Africa",
    "Entegral",
    "Auto-score new leads",
    "Alert threshold",
  ]) {
    assert.match(page, new RegExp(label), `Settings page is missing ${label}`);
  }

  assert.match(
    page,
    /sourceStatuses\.map[\s\S]*className={`toggle/,
    "Scraper rows must render enabled-state toggles",
  );
  assert.match(
    page,
    /aria-pressed=/,
    "Settings toggles must expose pressed state",
  );
  assert.match(
    page,
    /disabled={!canEditSettings}/,
    "Settings toggles must be disabled for read-only actors",
  );

  const route = await readFile(
    new URL("../apps/web/app/api/settings/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    route,
    /db\.transaction/,
    "The complete settings write and its activity event must be atomic",
  );
  assert.doesNotMatch(
    route,
    /Promise\.all/,
    "Approved settings keys must be persisted in one bulk statement",
  );

  console.log("Settings controls smoke passed.");
}

void main();
