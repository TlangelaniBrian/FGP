import fs from "node:fs";

const required = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "WORKER_URL",
  "NEXT_PUBLIC_SITE_URL",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing production environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const localMarkers = ["localhost", "127.0.0.1", "::1", "postgres:postgres@postgis", "redis://redis"];
const localValues = [process.env.DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.WORKER_URL, process.env.NEXT_PUBLIC_SITE_URL];
const localKeys = localValues.flatMap((value, index) => localMarkers.some((marker) => value.includes(marker)) ? [required[[0, 1, 3, 4][index]]] : []);
if (localKeys.length) {
  console.error(`Production endpoints still point to local infrastructure: ${[...new Set(localKeys)].join(", ")}`);
  process.exit(1);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "WORKER_URL", "NEXT_PUBLIC_SITE_URL"]) {
  if (!/^https:\/\//.test(process.env[key])) {
    console.error(`${key} must use https:// in production`);
    process.exit(1);
  }
}

const migrations = fs.readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort();
if (!migrations.length) {
  console.error("No Supabase migrations found");
  process.exit(1);
}

console.log(`Production preflight passed with ${migrations.length} Supabase migrations.`);
