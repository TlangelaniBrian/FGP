import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, listings } from "@fgp/database";
import { getAuthenticatedActor } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

const coordinateSchema = z.object({ lat: z.number().min(-27).max(-25), lng: z.number().min(27).max(29.5) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthenticatedActor(req);
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const listingId = Number((await params).id);
  if (!Number.isInteger(listingId)) return NextResponse.json({ error: "invalid listing id" }, { status: 400 });
  const [listing] = await db.select().from(listings).where(and(eq(listings.id, listingId), eq(listings.userId, actor.userId))).limit(1);
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  const parsed = coordinateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const workerUrl = process.env.WORKER_URL ?? "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetch(`${workerUrl}/analyze/parcel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
  } catch {
    return NextResponse.json({ error: "Spatial worker unreachable" }, { status: 502 });
  }
  const analysis = await response.json().catch(() => null) as { found?: boolean; parcel_id?: number | null; zone_code?: string | null; dolomite_risk?: string | null; score_composite?: number | null } | null;
  if (!response.ok) return NextResponse.json({ error: analysis }, { status: 502 });
  if (!analysis?.found || !analysis.parcel_id) return NextResponse.json({ error: "No parcel found at these coordinates" }, { status: 404 });

  await db.execute(sql`UPDATE listings
    SET parcel_id = ${analysis.parcel_id},
        coordinates = ST_SetSRID(ST_MakePoint(${parsed.data.lng}, ${parsed.data.lat}), 4326)::geography,
        zone_code = COALESCE(${analysis.zone_code ?? null}, zone_code),
        dolomite_risk = COALESCE(${analysis.dolomite_risk ?? null}, dolomite_risk),
        feasibility_score = COALESCE(${analysis.score_composite ?? null}, feasibility_score),
        updated_at = NOW()
    WHERE id = ${listingId} AND user_id = ${actor.userId}`);
  await recordActivity({ actorUserId: actor.userId, actorName: actor.name, eventType: "listing_parcel_linked", title: "Listing linked to parcel", detail: `${listing.address ?? `Listing #${listingId}`} · parcel #${analysis.parcel_id}`, entityType: "listing", entityId: listingId });
  return NextResponse.json({ listingId, parcelId: analysis.parcel_id, analysis });
}
