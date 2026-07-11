import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db, listings } from "@fgp/database";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const actor = await getAuthenticatedActor(req);
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const query = params.get("q")?.trim();
  const status = params.get("status");
  const filters = [eq(listings.userId, actor.userId)];
  if (query) filters.push(or(ilike(listings.address, `%${query}%`), ilike(listings.suburb, `%${query}%`))!);
  if (status) filters.push(eq(listings.status, status));
  const rows = await db.select().from(listings).where(and(...filters)).orderBy(desc(listings.feasibilityScore), desc(listings.createdAt)).limit(100);
  return NextResponse.json(rows);
}

const listingSchema = z.object({ address: z.string().min(2).max(500), municipality: z.enum(["johannesburg", "tshwane", "ekurhuleni"]), sizeSqm: z.number().min(100), price: z.number().positive(), sourceUrl: z.string().url().optional(), description: z.string().max(5000).optional() });

export async function POST(req: NextRequest) {
  const guard = await requireSessionCapability("record", req);
  if (guard.response) return guard.response;
  const parsed = listingSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const data = parsed.data;
  const [row] = await db.insert(listings).values({ userId: guard.actor!.userId, source: "manual", address: data.address, municipality: data.municipality, sizeSqm: String(data.sizeSqm), price: String(data.price), sourceUrl: data.sourceUrl, description: data.description, status: "new" }).returning();
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "listing_imported", title: "Listing imported", detail: data.address, entityType: "listing", entityId: row.id });
  return NextResponse.json(row, { status: 201 });
}
