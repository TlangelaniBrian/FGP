import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getRequestOrigin } from "@/lib/request-origin";
import { formatZar } from "@/lib/format";
import { isGautengCoordinate } from "@/lib/parcel-geometry";
import { LinkParcelForm } from "./_components/LinkParcelForm";
import { ParcelIntelligence } from "./_components/ParcelIntelligence";

export default async function ParcelPage({ params }: { params: Promise<{ id: string }> }) {
  const listingId = Number((await params).id);
  if (!Number.isInteger(listingId)) notFound();
  const requestHeaders = await headers();
  const response = await fetch(`${getRequestOrigin(requestHeaders)}/api/listings?id=${listingId}`, { cache: "no-store", headers: { cookie: requestHeaders.get("cookie") ?? "" } });
  if (!response.ok) notFound();
  const listing = (await response.json() as Array<Record<string, unknown>>)[0];
  if (!listing) notFound();
  const latitude = typeof listing.latitude === "number" ? listing.latitude : null;
  const longitude = typeof listing.longitude === "number" ? listing.longitude : null;
  const hasValidCoordinate = isGautengCoordinate(latitude, longitude);
  const sizeSqm = typeof listing.sizeSqm === "number" ? listing.sizeSqm : null;
  const price = typeof listing.price === "number" ? listing.price : null;
  const address = typeof listing.address === "string" ? listing.address : null;
  return <div className="portal-page">
    <Link href="/scout" className="parcel-back-link">← Back to Scout</Link>
    <div className="portal-page-head parcel-page-head"><div><p className="eyebrow">Scout · Parcel detail</p><h1 className="page-title">{address ?? `Listing #${listingId}`}</h1><p className="page-subtitle">{[listing.suburb, listing.city, listing.municipality].filter(Boolean).join(" · ") || "Gauteng lead"}</p></div><span className={`tag ${hasValidCoordinate ? "tag-green" : "tag-amber"}`}>{hasValidCoordinate ? "Live spatial link" : "Coordinate required"}</span></div>
    {hasValidCoordinate && latitude != null && longitude != null ? <ParcelIntelligence listingId={listingId} latitude={latitude} longitude={longitude} address={address} suburb={typeof listing.suburb === "string" ? listing.suburb : null} sizeSqm={sizeSqm} price={price} /> : <div className="portal-grid-2 parcel-unlinked-layout"><section className="card card-pad"><span className="card-kicker">Listing context</span><h2 className="card-title">Spatial intelligence is not linked</h2><p className="muted">Link the real parcel to load zoning, dolomite, amenity and massing evidence.</p><dl className="parcel-fact-grid parcel-unlinked-facts"><div className="parcel-fact"><dt>Address</dt><dd>{address ?? "Not supplied"}</dd></div><div className="parcel-fact"><dt>Land size</dt><dd>{sizeSqm == null ? "—" : `${sizeSqm.toLocaleString("en-ZA")} m²`}</dd></div><div className="parcel-fact"><dt>Price</dt><dd>{price == null ? "—" : formatZar(price)}</dd></div><div className="parcel-fact"><dt>Source</dt><dd>{String(listing.source ?? "manual")}</dd></div></dl></section><section className="card card-pad"><span className="card-kicker">Parcel recovery</span><h2 className="card-title">Attach the real parcel</h2><p className="muted">Coordinates are resolved by the server against PostGIS before anything is persisted.</p><LinkParcelForm listingId={listingId} parcelId={typeof listing.parcelId === "number" ? listing.parcelId : null} /></section></div>}
  </div>;
}
