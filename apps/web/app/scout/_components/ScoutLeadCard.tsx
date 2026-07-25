import Link from "next/link";
import { formatZar } from "@/lib/format";

export type ScoutListing = {
  id: number;
  address: string | null;
  suburb: string | null;
  municipality: string | null;
  sizeSqm: string | null;
  price: string | null;
  zoneCode: string | null;
  dolomiteRisk: string | null;
  feasibilityScore: number | null;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  yieldAt85OccPct: number | null;
};

function numberOrNull(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ScoutLeadCard({
  listing,
  selected,
  onSelect,
  formatPrice = formatZar,
}: {
  listing: ScoutListing;
  selected: boolean;
  onSelect: (listingId: number) => void;
  formatPrice?: (value: number) => string;
}) {
  const size = numberOrNull(listing.sizeSqm);
  const price = numberOrNull(listing.price);
  const pricePerSqm = size && price !== null ? price / size : null;
  const score = listing.feasibilityScore;
  const scoreBand = score === null ? "unscored" : score >= 80 ? "high" : score >= 60 ? "medium" : "low";
  const address = listing.address?.trim() || "Untitled listing";
  const location = listing.suburb?.trim() || listing.municipality?.trim() || "Gauteng";

  return (
    <article className={`scout-lead-card${selected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="scout-lead-select"
        onClick={() => onSelect(listing.id)}
        aria-label={`Show ${address} on the map`}
        aria-pressed={selected}
      >
        <span className="scout-lead-copy">
          <strong>{address}</strong>
          <span className="scout-lead-location">{location}</span>
        </span>
        <span className={`score-ring score-ring-${scoreBand}`} aria-label={score === null ? "Not yet scored" : `Feasibility score ${score} out of 100`}>
          <span>{score ?? "—"}</span>
        </span>
      </button>

      <dl className="scout-lead-facts">
        <div><dt>Size</dt><dd>{size === null ? "Pending" : `${size.toLocaleString("en-ZA")} m²`}</dd></div>
        <div><dt>Price</dt><dd>{price === null ? "Pending" : formatPrice(price)}</dd></div>
        <div><dt>Price / m²</dt><dd>{pricePerSqm === null ? "Pending" : formatPrice(pricePerSqm)}</dd></div>
      </dl>

      <div className="scout-lead-footer">
        <div className="scout-lead-tags" aria-label="Listing classifications">
          <span className="tag tag-blue">{listing.zoneCode || "Zone pending"}</span>
          <span className={listing.dolomiteRisk?.toLowerCase() === "low" ? "tag tag-green" : "tag tag-amber"}>
            {listing.dolomiteRisk ? `${listing.dolomiteRisk} dolomite` : "Dolomite pending"}
          </span>
          {listing.yieldAt85OccPct !== null && <span className="tag tag-green">{listing.yieldAt85OccPct.toFixed(1)}% yield</span>}
        </div>
        <Link href={`/scout/${listing.id}`} className="button button-quiet scout-open-action">Open</Link>
      </div>
    </article>
  );
}
