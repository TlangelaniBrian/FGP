import { sql } from "drizzle-orm";
import { db } from "@fgp/database";

export type ListingSpatialSummary = {
  latitude: number | null;
  longitude: number | null;
  yieldAt85OccPct: number | null;
};

type ListingSpatialRow = {
  listing_id: number;
  latitude: number | string | null;
  longitude: number | string | null;
  yield_at_85_occ_pct: number | string | null;
};

function nullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getListingSpatialSummaries(
  actorUserId: string,
  listingIds: number[],
): Promise<Map<number, ListingSpatialSummary>> {
  const ownedListingIds = [...new Set(listingIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ownedListingIds.length === 0) return new Map();

  const rows = await db.execute<ListingSpatialRow>(sql`
    SELECT
      l.id AS listing_id,
      ST_Y(l.coordinates::geometry) AS latitude,
      ST_X(l.coordinates::geometry) AS longitude,
      latest_report.yield_at_85_occ_pct
    FROM listings l
    LEFT JOIN LATERAL (
      SELECT fr.yield_at_85_occ_pct
      FROM feasibility_reports fr
      WHERE fr.listing_id = l.id
        AND fr.user_id = ${actorUserId}
      ORDER BY fr.created_at DESC NULLS LAST, fr.id DESC
      LIMIT 1
    ) latest_report ON TRUE
    WHERE l.user_id = ${actorUserId}
      AND l.id IN (${sql.join(ownedListingIds.map((id) => sql`${id}`), sql`, `)})
  `);

  return new Map(rows.map((row) => [
    Number(row.listing_id),
    {
      latitude: nullableNumber(row.latitude),
      longitude: nullableNumber(row.longitude),
      yieldAt85OccPct: nullableNumber(row.yield_at_85_occ_pct),
    },
  ]));
}
