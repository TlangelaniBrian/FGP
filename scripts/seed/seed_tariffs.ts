import { db, tariffs } from "@fgp/database";

// Seeds the tariffs table with the 2026 baseline values. These mirror the
// constants the worker previously hard-coded, so feasibility results are
// unchanged immediately after migrating — but they can now be edited via
// /settings/tariffs (SARS transfer duty in March, municipal BSC in July).
//
// transfer_duty_brackets rows are [upper_threshold | null, rate, cumulative_base];
// null upper_threshold means "no upper bound" (the top bracket).
const TARIFF_YEAR = 2026;

const rows = [
  {
    tariffYear: TARIFF_YEAR,
    category: "build_rates",
    data: { bachelor: 13500, "1bed": 14200, "2bed": 15000, luxury: 18500 },
  },
  {
    tariffYear: TARIFF_YEAR,
    category: "unit_sizes",
    data: { bachelor: 35, "1bed": 55, "2bed": 85, luxury: 120 },
  },
  {
    tariffYear: TARIFF_YEAR,
    category: "market_rents",
    data: { bachelor: 4500, "1bed": 6500, "2bed": 9500, luxury: 18000 },
  },
  {
    tariffYear: TARIFF_YEAR,
    category: "bulk_contributions",
    data: {
      johannesburg: { bachelor: [45000, 65000], "1bed": [50000, 65000], "2bed": [55000, 65000], luxury: [65000, 80000] },
      tshwane: { bachelor: [38000, 55000], "1bed": [42000, 55000], "2bed": [46000, 55000], luxury: [55000, 70000] },
      ekurhuleni: { bachelor: [40000, 58000], "1bed": [44000, 58000], "2bed": [48000, 58000], luxury: [58000, 73000] },
    },
  },
  {
    tariffYear: TARIFF_YEAR,
    category: "transfer_duty_brackets",
    data: [
      [1100000, 0.0, 0],
      [1512500, 0.03, 0],
      [2117500, 0.06, 12375],
      [2722500, 0.08, 49125],
      [12100000, 0.11, 97125],
      [null, 0.13, 1128600],
    ],
  },
  {
    tariffYear: TARIFF_YEAR,
    category: "fees",
    data: { professional_fee_pct: 0.12 },
  },
];

async function main() {
  for (const row of rows) {
    await db
      .insert(tariffs)
      .values(row)
      .onConflictDoUpdate({
        target: [tariffs.tariffYear, tariffs.category],
        set: { data: row.data, updatedAt: new Date() },
      });
  }
  console.log(`Seeded ${rows.length} tariff categories for ${TARIFF_YEAR}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
