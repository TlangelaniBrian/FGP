import { NextRequest, NextResponse } from "next/server";
import { activityEvents, db, portalSettings } from "@fgp/database";
import { sql } from "drizzle-orm";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import {
  mergePortalSettings,
  portalSettingsSchema,
  type PortalSettings,
} from "@/lib/portal-settings";

export async function GET(req: NextRequest) {
  if (!await getAuthenticatedActor(req)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const rows = await db
    .select({ key: portalSettings.key, value: portalSettings.value })
    .from(portalSettings);
  return NextResponse.json(mergePortalSettings(rows));
}

export async function PUT(req: NextRequest) {
  const guard = await requireSessionCapability("settings", req);
  if (guard.response) return guard.response;

  const body: unknown = await req.json().catch(() => null);
  const parsed = portalSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const entries = Object.entries(parsed.data) as [keyof PortalSettings, unknown][];
  const updatedAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .insert(portalSettings)
      .values(
        entries.map(([key, value]) => ({
          key,
          value,
          updatedBy: guard.actor!.name,
          updatedAt,
        })),
      )
      .onConflictDoUpdate({
        target: portalSettings.key,
        set: {
          value: sql`excluded.value`,
          updatedBy: guard.actor!.name,
          updatedAt,
        },
      });
    await transaction.insert(activityEvents).values({
      actorUserId: guard.actor!.userId,
      actorName: guard.actor!.name,
      eventType: "settings_update",
      title: "Workspace settings updated",
      detail: entries.map(([key]) => key).join(", "),
      entityType: "portal_settings",
    });
  });
  return NextResponse.json(parsed.data);
}
