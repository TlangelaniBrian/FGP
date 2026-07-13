import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  const absolutePath = path.join(root, relativePath);
  assert.ok(existsSync(absolutePath), `Missing signature-view file: ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

async function main(): Promise<void> {
const rootPackage = JSON.parse(source("package.json")) as { scripts?: Record<string, string> };
assert.equal(rootPackage.scripts?.["test:signature-views"], "tsx scripts/signature-views-smoke.ts");

const webPackage = JSON.parse(source("apps/web/package.json")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
assert.equal(webPackage.dependencies?.["maplibre-gl"], "4.7.1", "MapLibre must be pinned exactly to 4.7.1");
assert.equal(webPackage.dependencies?.three, "0.160.0", "Three.js must be pinned exactly to 0.160.0");
assert.equal(webPackage.devDependencies?.["@types/three"], "0.160.0", "Three.js types must be pinned exactly to 0.160.0");

const selectionPath = path.join(root, "apps/web/lib/scout-selection.ts");
assert.ok(existsSync(selectionPath), "Scout must expose an executable pure selection-state helper");
const selection = await import(pathToFileURL(selectionPath).href);
const listingSelection = selection.selectScoutListing(42);
assert.deepEqual(listingSelection, { selectedListingId: 42, analysisCoordinate: null }, "Listing selection must never create an analysis coordinate");
const manualSelection = selection.selectScoutAnalysisCoordinate({ lat: -25.974, lng: 28.126 });
assert.deepEqual(manualSelection, { selectedListingId: null, analysisCoordinate: { lat: -25.974, lng: 28.126 } }, "Manual/map picking must clear listing selection and retain only the analysis coordinate");
assert.deepEqual(
  selection.reconcileScoutSelection(listingSelection, [7, 9]),
  { selectedListingId: null, analysisCoordinate: null },
  "Filtering out a selected listing must remove selection without retaining listing-derived marker state",
);
assert.equal(selection.reconcileScoutSelection(manualSelection, [7, 9]), manualSelection, "Filtering must not discard an intentional manual analysis coordinate");

const markerPath = path.join(root, "apps/web/lib/scout-marker.ts");
assert.ok(existsSync(markerPath), "Scout must expose executable marker accessibility helpers");
const markerAccessibility = await import(pathToFileURL(markerPath).href);
const markerListing = { id: 42, address: "ERF 1247 · Noordwyk", suburb: "Noordwyk", feasibilityScore: 92 };
const markerLabel = markerAccessibility.listingMarkerAccessibleName(markerListing);
assert.match(markerLabel, /ERF 1247 · Noordwyk/);
assert.match(markerLabel, /92/);
assert.match(markerLabel, /42/);
assert.notEqual(markerLabel, markerAccessibility.listingMarkerAccessibleName({ ...markerListing, id: 43 }), "Accessible marker names must remain unique for duplicate listing text");

const fakeAttributes = new Map<string, string>();
const fakeElement = {
  setAttribute(name: string, value: string) { fakeAttributes.set(name, value); },
  removeAttribute(name: string) { fakeAttributes.delete(name); },
};
const fakeMap = {};
const fakeMarker = {
  addTo(receivedMap: object) {
    assert.equal(receivedMap, fakeMap);
    fakeElement.setAttribute("aria-label", "Map marker");
    fakeElement.setAttribute("tabindex", "0");
    return this;
  },
  getElement() { return fakeElement; },
};
markerAccessibility.addAccessibleListingMarker(fakeMarker, fakeMap, markerListing);
assert.equal(fakeAttributes.get("aria-label"), markerLabel, "Listing label must be restored after MapLibre addTo overwrites it");
assert.equal(fakeAttributes.get("title"), markerLabel, "Listing markers must retain a descriptive tooltip");
assert.equal(fakeAttributes.get("data-listing-id"), "42");

fakeAttributes.set("aria-label", "Map marker");
fakeAttributes.set("tabindex", "0");
markerAccessibility.restoreCoordinateMarkerSemantics(fakeElement);
assert.equal(fakeAttributes.get("aria-hidden"), "true", "Coordinate markers must be intentionally hidden from assistive technology");
assert.equal(fakeAttributes.get("role"), "presentation");
assert.equal(fakeAttributes.has("aria-label"), false);
assert.equal(fakeAttributes.has("tabindex"), false);

const parcelGeometryPath = path.join(root, "apps/web/lib/parcel-geometry.ts");
const parcelGeometry = await import(pathToFileURL(parcelGeometryPath).href);
const polygon = { type: "Polygon", coordinates: [[[28.1, -25.9], [28.2, -25.9], [28.2, -26], [28.1, -25.9]]] };
assert.deepEqual(parcelGeometry.parseSelectedParcelGeoJSON(JSON.stringify(polygon)), polygon, "Valid serialized Polygon geometry must be accepted");
const multiPolygon = { type: "MultiPolygon", coordinates: [[[[28.1, -25.9], [28.2, -25.9], [28.2, -26], [28.1, -25.9]]]] };
assert.deepEqual(parcelGeometry.parseSelectedParcelGeoJSON(multiPolygon), multiPolygon, "Valid MultiPolygon geometry must be accepted");
for (const malformed of [
  "not-json",
  { type: "Point", coordinates: [28.1, -25.9] },
  { type: "Polygon", coordinates: [[[28.1, -25.9], [28.2, -25.9], [28.2, -26]]] },
  { type: "Polygon", coordinates: [[[28.1, -25.9], [28.2, -25.9], [Number.NaN, -26], [28.1, -25.9]]] },
  { type: "Polygon", coordinates: [[[28.1, -25.9], [28.2, -25.9], [28.2, -26], [28.15, -25.95]]] },
]) {
  assert.equal(parcelGeometry.parseSelectedParcelGeoJSON(malformed), null, "Malformed parcel geometry must be ignored safely");
}
assert.equal(parcelGeometry.isGautengCoordinate(-25.974, 28.126), true);
assert.equal(parcelGeometry.isGautengCoordinate(Number.NaN, 28.126), false);
assert.equal(parcelGeometry.isGautengCoordinate(-25.974, Number.POSITIVE_INFINITY), false);
assert.equal(parcelGeometry.isGautengCoordinate(-24.5, 28.126), false);

const intelligenceViewPath = path.join(root, "apps/web/app/scout/[id]/_components/parcel-intelligence-view.ts");
assert.ok(existsSync(intelligenceViewPath), "Parcel intelligence must expose an executable pure degraded-state and owned-facts helper");
const intelligenceView = await import(pathToFileURL(intelligenceViewPath).href);
const ownedListing = {
  address: "ERF 1247, Noordwyk Ext 19",
  suburb: "Noordwyk",
  sizeSqm: 1024,
  price: 980000,
};
const expectedOwnedFacts = [
  { label: "Address", value: "ERF 1247, Noordwyk Ext 19 · Noordwyk" },
  { label: "Land size", value: "1 024 m²" },
  { label: "Price", value: "R 980 000.00" },
  { label: "Price / m²", value: "R 957.03" },
];
const errorView = intelligenceView.buildParcelIntelligenceView({ requestStatus: "error", analysisFound: null, ownedListing });
assert.equal(errorView.mode, "error");
assert.equal(errorView.showOwnedFacts, true, "Non-2xx/error mode must retain actor-owned listing facts");
assert.deepEqual(errorView.ownedFacts, expectedOwnedFacts, "Error facts must include address, size, exact price and derived price/m²");
const noMatchView = intelligenceView.buildParcelIntelligenceView({ requestStatus: "ready", analysisFound: false, ownedListing });
assert.equal(noMatchView.mode, "not-found");
assert.equal(noMatchView.showOwnedFacts, true, "found:false mode must retain actor-owned listing facts");
assert.deepEqual(noMatchView.ownedFacts, expectedOwnedFacts, "No-match facts must include address, size, exact price and derived price/m²");

const spatial = source("apps/web/lib/listing-spatial.ts");
assert.match(spatial, /export\s+type\s+ListingSpatialSummary/);
assert.match(spatial, /ST_Y\s*\(\s*l\.coordinates::geometry\s*\)/i, "Latitude must be derived server-side with ST_Y");
assert.match(spatial, /ST_X\s*\(\s*l\.coordinates::geometry\s*\)/i, "Longitude must be derived server-side with ST_X");
assert.match(spatial, /yield_at_85_occ_pct/i, "Spatial summaries must include saved 85% occupancy yield");
assert.match(spatial, /ORDER BY[\s\S]*created_at\s+DESC/i, "Saved yield must come from the latest feasibility report");
assert.match(spatial, /user_id\s*=\s*\$\{/i, "Spatial queries must be scoped to the authenticated actor");
assert.match(spatial, /listingIds/i, "The helper must accept a parameterized set of owned listing IDs");

const route = source("apps/web/app/api/listings/route.ts");
assert.match(route, /getListingSpatialSummaries\s*\(/, "Listings API must merge server-owned spatial summaries");
for (const field of ["latitude", "longitude", "yieldAt85OccPct"]) {
  assert.match(route, new RegExp(`\\b${field}\\b`), `Listings API must add ${field}`);
}
assert.match(route, /eq\(listings\.userId,\s*actor\.userId\)/, "Existing actor ownership filter must remain intact");
assert.doesNotMatch(route, /\bcoordinates\b/, "Listings API must not select or serialize raw geography values");
for (const filter of ["q", "status", "id"]) {
  assert.match(route, new RegExp(`params\\.get\\(["']${filter}["']\\)`), `Existing ${filter} filter must remain intact`);
}

const scout = source("apps/web/app/scout/page.tsx");
for (const label of ["All", "RES2", "RES3", "RES4", "Low dolomite", "Score ≥ 80"]) {
  assert.match(scout, new RegExp(label.replace("≥", "≥")), `Scout must expose the ${label} filter`);
}
assert.match(scout, /filteredListings/, "Scout must derive one synchronized filtered listing array");
assert.match(scout, /selectScoutListing|selectScoutAnalysisCoordinate/, "Scout production must use the pure selection helper");
assert.match(scout, /<ScoutLeadCard[\s\S]*listing=/, "Scout must render persisted lead cards");
assert.match(scout, /<ScoutMap[\s\S]*listings=\{mapListings\}/, "Scout map must receive the filtered coordinate-bearing leads");

const leadCard = source("apps/web/app/scout/_components/ScoutLeadCard.tsx");
for (const contract of [
  /score-ring/,
  /listing\.address/,
  /listing\.suburb/,
  /listing\.sizeSqm/,
  /formatZar/,
  /pricePerSqm/,
  /listing\.zoneCode/,
  /listing\.dolomiteRisk/,
  /yieldAt85OccPct/,
  />Open</,
]) {
  assert.match(leadCard, contract, `Scout lead card is missing ${contract}`);
}

const map = source("apps/web/app/scout/_components/ScoutMap.tsx");
assert.match(map, /from\s+["']maplibre-gl["']/, "ScoutMap must import the packaged MapLibre runtime");
assert.match(map, /addAccessibleListingMarker/, "ScoutMap must restore listing marker accessibility after MapLibre addTo");
assert.doesNotMatch(map, /cdnjs|createElement\(["']script["']\)|MAPLIBRE_JS|MAPLIBRE_CSS/, "ScoutMap must not inject CDN runtime code");
for (const contract of [
  /listing-marker/,
  /floating-lead-chip/,
  /map-legend/,
  /map-fallback/,
  /aria-label/,
  /marker\.remove\(\)/,
  /map\.remove\(\)/,
]) {
  assert.match(map, contract, `ScoutMap is missing ${contract}`);
}
assert.match(map, /parseSelectedParcelGeoJSON/, "Selected parcel geometry must be parsed through a validating helper");
assert.match(map, /getSource\(SELECTED_PARCEL_SOURCE\)/, "Selected parcel source lifecycle must account for an existing source");
assert.match(map, /removeLayer\(SELECTED_PARCEL_LINE\)/, "Selected parcel line must be removed during cleanup");
assert.match(map, /removeSource\(SELECTED_PARCEL_SOURCE\)/, "Selected parcel source must be removed during cleanup");

const parcelPage = source("apps/web/app/scout/[id]/page.tsx");
assert.match(parcelPage, /getListingSpatialSummaries\s*\(\s*actor\.userId/, "Parcel page coordinates must come from the actor-scoped spatial helper");
assert.match(parcelPage, /<ParcelIntelligence/, "Linked parcel pages must render the live intelligence panel");
assert.match(parcelPage, /<LinkParcelForm/, "Unlinked listings must retain the parcel-link recovery path");
assert.match(parcelPage, /actor\.role\s*!==\s*["']Viewer["']/, "The server page must not render Viewer parcel-link mutation UI");

const parcelIntelligence = source("apps/web/app/scout/[id]/_components/ParcelIntelligence.tsx");
for (const contract of [
  /AbortController/,
  /controller\.abort\(\)/,
  /signal:\s*controller\.signal/,
  /parseSelectedParcelGeoJSON/,
  /<ScoutMap/,
  /selectedParcel=/,
  /<Massing3D/,
  /Parcel facts/,
  /Zoning envelope/,
  /Dolomite/,
  /Coverage/,
  /FAR/,
  /Max storeys/,
  /Max footprint/,
  /Max buildable/,
  /Max units/,
  /Amenity scores/,
  /Forms required/,
  /Evaluate land/,
  /Compliance package/,
  /buildParcelIntelligenceView/,
  /OwnedListingFacts/,
]) {
  assert.match(parcelIntelligence, contract, `Parcel intelligence is missing ${contract}`);
}

const massing = source("apps/web/app/scout/[id]/_components/Massing3D.tsx");
for (const contract of [
  /from\s+["']three["']/,
  /OrbitControls/,
  /WebGLRenderer/,
  /LineDashedMaterial/,
  /#A5132A/i,
  /computeLineDistances\(\)/,
  /matchMedia\(["']\(prefers-reduced-motion: reduce\)["']\)/,
  /building\.scale\.setScalar\(reducedMotion\s*\?\s*1\s*:\s*0\)/,
  /requestAnimationFrame/,
  /cancelAnimationFrame/,
  /ResizeObserver/,
  /controls\.dispose\(\)/,
  /geometry\.dispose\(\)/,
  /material\.dispose\(\)/,
  /renderer\.dispose\(\)/,
  /removeChild/,
  /massing-fallback/,
  /role=["']img["']/,
  /aria-label/,
]) {
  assert.match(massing, contract, `Massing3D is missing ${contract}`);
}
assert.doesNotMatch(massing, /#E61414/i, "Massing boundaries must never use C-mark red");

const layout = source("apps/web/app/layout.tsx");
assert.match(layout, /maplibre-gl\/dist\/maplibre-gl\.css/, "The root layout must import packaged MapLibre CSS");

const costBreakdownPath = path.join(root, "apps/web/app/evaluate/result/_components/CostBreakdownBars.tsx");
assert.ok(existsSync(costBreakdownPath), "Cost Oracle must expose the pure CostBreakdownBars component");
const costBreakdown = await import(pathToFileURL(costBreakdownPath).href);
const costRows = costBreakdown.buildCostBreakdownRows({
  costLand: 250,
  costBuild: 0,
  costProfessionalFees: -20,
  costBulkContributions: 1_500,
  costTransferDuty: 50,
  costTotal: 1_000,
});
assert.deepEqual(
  costRows.map((row: { label: string; formattedValue: string; percentage: number }) => ({
    label: row.label,
    formattedValue: row.formattedValue,
    percentage: row.percentage,
  })),
  [
    { label: "Land", formattedValue: "R 250.00", percentage: 25 },
    { label: "Build", formattedValue: "R 0.00", percentage: 0 },
    { label: "Professional fees", formattedValue: "R -20.00", percentage: 0 },
    { label: "Bulk contributions", formattedValue: "R 1 500.00", percentage: 100 },
    { label: "Transfer duty", formattedValue: "R 50.00", percentage: 5 },
  ],
  "Cost rows must preserve exact money while clamping zero, negative, and over-total widths",
);
assert.deepEqual(
  costBreakdown.buildCostBreakdownRows({
    costLand: 1,
    costBuild: 2,
    costProfessionalFees: 3,
    costBulkContributions: 4,
    costTransferDuty: 5,
    costTotal: 0,
  }).map((row: { percentage: number }) => row.percentage),
  [0, 0, 0, 0, 0],
  "A non-positive trusted total must produce zero-width bars",
);
const costBreakdownSource = source("apps/web/app/evaluate/result/_components/CostBreakdownBars.tsx");
for (const contract of [
  /role=["']progressbar["']/,
  /aria-valuemin=\{0\}/,
  /aria-valuemax=\{100\}/,
  /aria-valuenow=\{row\.percentage\}/,
  /aria-label=\{`\$\{row\.label\}: \$\{row\.formattedValue\}`\}/,
  /formatZar/,
  /cost-bar-fill/,
]) {
  assert.match(costBreakdownSource, contract, `CostBreakdownBars is missing ${contract}`);
}

const resultPage = source("apps/web/app/evaluate/result/page.tsx");
for (const contract of [
  /Analysis subject/,
  /Total investment/,
  /Gross annual income/,
  /Yield @ 100%/,
  /Yield @ 85% occ\./,
  /<CostBreakdownBars/,
  /Income projection/,
  /Decision engine/,
  /actualUnits/,
  /targetUnits/,
  /viabilityNotes/,
  /decisionStatus/,
  /zoningEvidenceAvailable/,
  /Keep this analysis/,
  /Create project/,
  /New analysis/,
]) {
  assert.match(resultPage, contract, `Cost Oracle result is missing ${contract}`);
}
assert.match(resultPage, /body:\s*JSON\.stringify\(formValues\)/, "Save must retain the canonical feasibility input payload");
assert.match(resultPage, /trustedTotal\s*=\s*result\.costTotal[\s\S]*listingId:\s*saved\.listingId[\s\S]*reportId:\s*saved\.reportId[\s\S]*phase1TargetZar:\s*trustedTotal/, "Create-project must retain saved IDs and trusted total");
assert.doesNotMatch(resultPage, /Export report/, "Cost Oracle must not expose a fake report export action");

const globals = source("apps/web/app/globals.css");
for (const className of ["scout-layout", "scout-lead-card", "listing-marker", "floating-lead-chip", "map-legend", "map-fallback", "parcel-detail-layout", "parcel-fact-grid", "massing-shell", "massing-fallback"]) {
  assert.match(globals, new RegExp(`\\.${className}\\b`), `Missing themed ${className} styles`);
}
assert.match(globals, /@media\s*\(max-width:\s*860px\)[\s\S]*\.scout-layout/, "Scout must stack at 860px");
assert.match(globals, /@media\s*\(max-width:\s*360px\)[\s\S]*\.scout-lead-card/, "Scout cards must contain at 320px");
assert.match(globals, /@media\s*\(max-width:\s*860px\)[\s\S]*\.parcel-detail-layout/, "Parcel detail must stack at 860px");
assert.match(globals, /@media\s*\(max-width:\s*360px\)[\s\S]*\.parcel-fact-grid/, "Parcel facts must contain at 320px");
for (const className of ["cost-oracle-head", "cost-analysis-subject", "cost-kpi-grid", "cost-oracle-layout", "cost-breakdown-row", "cost-bar-track", "cost-bar-fill", "cost-decision-card"]) {
  assert.match(globals, new RegExp(`\\.${className}\\b`), `Missing themed ${className} styles`);
}
assert.match(globals, /\.cost-bar-fill\s*\{[^}]*transition:\s*width\s+200ms\s+var\(--motion-easing\)/, "Cost bars must use the prescribed width motion");
assert.match(globals, /@media\s*\(max-width:\s*860px\)[\s\S]*\.cost-oracle-layout/, "Cost Oracle must stack at 860px");
assert.match(globals, /@media\s*\(max-width:\s*360px\)[\s\S]*\.cost-analysis-subject/, "Cost Oracle must contain at 320px");
assert.match(globals, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*transition:\s*none\s*!important/, "Reduced motion must disable cost-bar transitions");

console.log("Signature property views contract smoke passed");
}

void main();
