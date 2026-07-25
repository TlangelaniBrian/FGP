import { db, activityEvents } from "@fgp/database";

export async function recordActivity(event: {
  actorUserId?: string;
  actorName?: string;
  eventType: string;
  title: string;
  detail?: string;
  entityType?: string;
  entityId?: string | number;
}) {
  await db.insert(activityEvents).values({ ...event, entityId: event.entityId == null ? undefined : String(event.entityId) });
}
