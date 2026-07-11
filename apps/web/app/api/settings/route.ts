import { NextRequest, NextResponse } from "next/server";
import { db, portalSettings } from "@fgp/database";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

export async function GET() {
  if (!await getAuthenticatedActor()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const rows = await db.select().from(portalSettings);
  return NextResponse.json(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}

export async function PUT(req: NextRequest) {
  const guard = await requireSessionCapability("settings");
  if (guard.response) return guard.response;
  const body = await req.json() as Record<string, unknown>;
  const entries = await Promise.all(Object.entries(body).map(([key, value]) => db.insert(portalSettings).values({ key, value, updatedBy: guard.actor!.name }).onConflictDoUpdate({ target: portalSettings.key, set: { value, updatedBy: guard.actor!.name, updatedAt: new Date() } }).returning()));
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "settings_update", title: "Workspace settings updated", detail: Object.keys(body).join(", "), entityType: "portal_settings" });
  return NextResponse.json(Object.fromEntries(entries.map(([row]) => [row.key, row.value])));
}
