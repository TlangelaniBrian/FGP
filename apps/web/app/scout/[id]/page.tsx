import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, listings } from "@fgp/database";
import { getAuthenticatedActor } from "@/lib/portal-auth";
import { formatZar } from "@/lib/format";
import { getListingSpatialSummaries } from "@/lib/listing-spatial";
import { isGautengCoordinate } from "@/lib/parcel-geometry";
import { LinkParcelForm } from "./_components/LinkParcelForm";
import { ParcelIntelligence } from "./_components/ParcelIntelligence";

export default async function ParcelPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthenticatedActor();
  if (!actor) notFound();
  const listingId = Number((await params).id);
  if (!Number.isInteger(listingId)) notFound();

  const [listing] = await db.select().from(listings).where(and(
    eq(listings.id, listingId),
    eq(listings.userId, actor.userId),
  )).limit(1);
  if (!listing) notFound();

  const spatialSummaries = await getListingSpatialSummaries(actor.userId, [listing.id]);
  const spatial = spatialSummaries.get(listing.id);
  const hasValidCoordinate = isGautengCoordinate(spatial?.latitude, spatial?.longitude);
  const sizeSqm = listing.sizeSqm == null ? null : Number(listing.sizeSqm);
  const price = listing.price == null ? null : Number(listing.price);

  return (
    <div className="portal-page">
      <Link href="/scout" className="parcel-back-link">
        <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
        Back to Scout
      </Link>
      <div className="portal-page-head parcel-page-head">
        <div>
          <p className="eyebrow">Scout · Parcel detail</p>
          <h1 className="page-title">{listing.address ?? `Listing #${listing.id}`}</h1>
          <p className="page-subtitle">
            {[listing.suburb, listing.city, listing.municipality].filter(Boolean).join(" · ") || "Gauteng lead"}
          </p>
        </div>
        <span className={`tag ${hasValidCoordinate ? "tag-green" : "tag-amber"}`}>
          {hasValidCoordinate ? "Live spatial link" : "Coordinate required"}
        </span>
      </div>

      {hasValidCoordinate && spatial?.latitude != null && spatial.longitude != null ? (
        <ParcelIntelligence
          listingId={listing.id}
          latitude={spatial.latitude}
          longitude={spatial.longitude}
          address={listing.address}
          suburb={listing.suburb}
          sizeSqm={Number.isFinite(sizeSqm) ? sizeSqm : null}
          price={Number.isFinite(price) ? price : null}
        />
      ) : (
        <div className="portal-grid-2 parcel-unlinked-layout">
          <section className="card card-pad">
            <span className="card-kicker">Listing context</span>
            <h2 className="card-title">Spatial intelligence is not linked</h2>
            <p className="muted">This actor-owned listing has no valid Gauteng coordinate. Link the real parcel to load zoning, dolomite, amenity and massing evidence.</p>
            <dl className="parcel-fact-grid parcel-unlinked-facts">
              <div className="parcel-fact"><dt>Address</dt><dd>{listing.address ?? "Not supplied"}</dd></div>
              <div className="parcel-fact"><dt>Land size</dt><dd>{sizeSqm == null ? "—" : `${sizeSqm.toLocaleString("en-ZA")} m²`}</dd></div>
              <div className="parcel-fact"><dt>Price</dt><dd>{price == null ? "—" : formatZar(price)}</dd></div>
              <div className="parcel-fact"><dt>Source</dt><dd>{listing.source}</dd></div>
            </dl>
          </section>
          <section className="card card-pad">
            <span className="card-kicker">Parcel recovery</span>
            <h2 className="card-title">Attach the real parcel</h2>
            <p className="muted">Coordinates are resolved by the server against PostGIS before anything is persisted.</p>
            {actor.role !== "Viewer" ? (
              <LinkParcelForm listingId={listing.id} parcelId={null} />
            ) : (
              <div className="status-banner-warning viewer-link-notice" role="status">
                Viewer access is read-only. Ask a write-capable member to link this parcel.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
