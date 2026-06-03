import { db, zoningSchemeRules } from "@fgp/database";

const rules = [
  // JHB
  { municipality: "johannesburg", zoneCode: "RES1", zoneLabel: "Residential 1", maxUnitsPerErf: 1, coveragePct: "40", far: "0.5", maxStoreys: 2, buildingLineFrontM: "4.5", buildingLineSideM: "1.5", buildingLineRearM: "3", permittedUses: ["single_dwelling"] },
  { municipality: "johannesburg", zoneCode: "RES2", zoneLabel: "Residential 2", maxUnitsPerErf: 2, coveragePct: "50", far: "0.75", maxStoreys: 2, buildingLineFrontM: "4.5", buildingLineSideM: "1.5", buildingLineRearM: "3", permittedUses: ["dwelling_units", "second_dwelling"] },
  { municipality: "johannesburg", zoneCode: "RES3", zoneLabel: "Residential 3", maxUnitsPerHa: 80, coveragePct: "60", far: "1.5", maxStoreys: 3, buildingLineFrontM: "3", buildingLineSideM: "1.5", buildingLineRearM: "2", permittedUses: ["flats", "dwelling_units"] },
  { municipality: "johannesburg", zoneCode: "RES4", zoneLabel: "Residential 4", maxUnitsPerHa: 120, coveragePct: "70", far: "2.5", maxStoreys: 4, buildingLineFrontM: "2", buildingLineSideM: "1", buildingLineRearM: "2", permittedUses: ["flats", "dwelling_units"] },
  // Tshwane
  { municipality: "tshwane", zoneCode: "RES1", zoneLabel: "Residential 1", maxUnitsPerErf: 1, coveragePct: "40", far: "0.4", maxStoreys: 2, buildingLineFrontM: "4.5", buildingLineSideM: "1.5", buildingLineRearM: "3", permittedUses: ["single_dwelling"] },
  { municipality: "tshwane", zoneCode: "RES2", zoneLabel: "Residential 2", maxUnitsPerErf: 2, coveragePct: "50", far: "0.6", maxStoreys: 2, buildingLineFrontM: "4.5", buildingLineSideM: "1.5", buildingLineRearM: "3", permittedUses: ["dwelling_units"] },
  { municipality: "tshwane", zoneCode: "RES3", zoneLabel: "Residential 3", maxUnitsPerHa: 60, coveragePct: "55", far: "1.2", maxStoreys: 3, buildingLineFrontM: "3", buildingLineSideM: "1.5", buildingLineRearM: "2", permittedUses: ["flats", "dwelling_units"] },
  { municipality: "tshwane", zoneCode: "RES4", zoneLabel: "Residential 4", maxUnitsPerHa: 100, coveragePct: "65", far: "2.0", maxStoreys: 4, buildingLineFrontM: "2", buildingLineSideM: "1", buildingLineRearM: "2", permittedUses: ["flats", "dwelling_units"] },
];

async function main() {
  await db.insert(zoningSchemeRules).values(rules).onConflictDoNothing();
  console.log(`Seeded ${rules.length} zoning scheme rules`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
