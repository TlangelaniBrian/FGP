import { NextRequest, NextResponse } from "next/server";
import { db, portalSettings } from "@fgp/database";
import { requireCapability } from "@/lib/portal-auth";

export async function GET() {
  const rows = await db.select().from(portalSettings);
  return NextResponse.json(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}

export async function PUT(req: NextRequest) {
  const guard = requireCapability(req, "settings");
  if (guard.response) return guard.response;
  const body = await req.json() as Record<string, unknown>;
  const entries = await Promise.all(Object.entries(body).map(([key, value]) => db.insert(portalSettings).values({ key, value, updatedBy: guard.actor!.name }).onConflictDoUpdate({ target: portalSettings.key, set: { value, updatedBy: guard.actor!.name, updatedAt: new Date() } }).returning()));
  return NextResponse.json(Object.fromEntries(entries.map(([row]) => [row.key, row.value])));
}
