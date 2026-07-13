"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScoutMap } from "./_components/ScoutMap";
import { ParcelDetail } from "./_components/ParcelDetail";
import type { ParcelAnalysis } from "@/lib/parcel";
import { formatZar } from "@/lib/format";

type Coord = { lat: number; lng: number };
type Listing = { id: number; address: string | null; suburb: string | null; municipality: string | null; sizeSqm: string | null; price: string | null; zoneCode: string | null; dolomiteRisk: string | null; feasibilityScore: number | null; status: string | null };

// Gauteng-ish bounds; mirror the worker/proxy guards so we fail fast client-side.
const LAT_MIN = -27, LAT_MAX = -25, LNG_MIN = 27, LNG_MAX = 29.5;
const inBounds = (c: Coord) =>
  c.lat >= LAT_MIN && c.lat <= LAT_MAX && c.lng >= LNG_MIN && c.lng <= LNG_MAX;

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const e = (payload as { error: unknown }).error;
    if (typeof e === "string") return e;
    if (e) return JSON.stringify(e);
  }
  return `Request failed (HTTP ${status}).`;
}

export default function ScoutPage() {
  const [marker, setMarker] = useState<Coord | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [data, setData] = useState<ParcelAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [listingStatus, setListingStatus] = useState("all");

  useEffect(() => { fetch("/api/listings").then((response) => response.ok ? response.json() : []).then(setListings).catch(() => setListings([])); }, []);

  const analyze = useCallback(async (coord: Coord) => {
    if (!inBounds(coord)) {
      setError("Coordinate is outside Gauteng (lat -27…-25, lng 27…29.5).");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/parcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coord),
      });
      if (!res.ok) {
        let payload: unknown = null;
        try {
          payload = await res.json();
        } catch {
          /* non-JSON */
        }
        setError(errorMessage(payload, res.status));
        return;
      }
      setData((await res.json()) as ParcelAnalysis);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Map click → drop marker, fill inputs, analyze.
  const handlePick = useCallback(
    (coord: Coord) => {
      setMarker(coord);
      setLatInput(coord.lat.toFixed(6));
      setLngInput(coord.lng.toFixed(6));
      analyze(coord);
    },
    [analyze]
  );

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Enter valid numeric coordinates.");
      return;
    }
    const coord = { lat, lng };
    setMarker(coord);
    analyze(coord);
  }

  const field =
    "bg-bg-surface border border-border rounded-card px-3 py-2 text-text-primary font-mono text-sm w-full focus:outline-none focus:border-accent-blue";

  return (
    <div className="portal-page">
      <div>
        <p className="eyebrow">Scout · Gauteng lead discovery</p>
        <h1 className="page-title">Find the next viable parcel</h1>
        <p className="page-subtitle">
          Click the map or enter a coordinate to resolve zoning, dolomite risk, building envelope and amenity scores.
        </p>
      </div>

      <section className="card card-pad" style={{ marginBottom: 18 }}><div className="split"><div><span className="card-kicker">Persisted leads</span><h2 className="card-title" style={{ marginTop: 6 }}>Scout pipeline</h2></div><span className="tag tag-blue">{listings.length} listings</span></div><div className="split" style={{ marginTop: 16 }}><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search suburb or address" /><select className="field" style={{ maxWidth: 180, marginLeft: 10 }} value={listingStatus} onChange={(event) => setListingStatus(event.target.value)}><option value="all">All statuses</option><option value="new">New</option><option value="analyzed">Analysed</option><option value="active_project">Project</option></select></div>{listings.filter((listing) => listingStatus === "all" || listing.status === listingStatus).filter((listing) => `${listing.address ?? ""} ${listing.suburb ?? ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6).map((listing) => <div className="list-row" key={listing.id}><span><strong>{listing.address ?? "Untitled listing"}</strong><small>{listing.suburb ?? listing.municipality ?? "Gauteng"} · {listing.sizeSqm ? `${Number(listing.sizeSqm).toLocaleString("en-ZA")} m²` : "Size pending"} · {listing.price ? formatZar(Number(listing.price)) : "Price pending"}</small></span><span className="split"><span className="tag tag-blue">{listing.zoneCode ?? "Unmatched"}</span>{listing.feasibilityScore != null && <span className="score-ring"><span>{listing.feasibilityScore}</span></span>}<Link href={`/scout/${listing.id}`} className="button button-quiet" style={{ minHeight: 30, padding: "0 9px" }}>Open</Link></span></div>)}{listings.length === 0 && <p className="muted" style={{ margin: "16px 0 0", fontSize: 12 }}>No persisted listings yet. Save an evaluation or import a listing to start the pipeline.</p>}</section>
      <ScoutMap marker={marker} onPick={handlePick} />

      <form onSubmit={handleManualSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1 block">Latitude</label>
          <input value={latInput} onChange={(e) => setLatInput(e.target.value)} placeholder="-25.99" className={field} />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1 block">Longitude</label>
          <input value={lngInput} onChange={(e) => setLngInput(e.target.value)} placeholder="28.13" className={field} />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="portal-transition bg-accent-blue text-white font-mono text-sm font-semibold px-5 py-2 rounded-card disabled:opacity-50 hover:opacity-90"
        >
          {loading ? "Analysing…" : "Analyse"}
        </button>
      </form>

      {error && (
        <div role="alert" className="border border-accent-red/40 bg-accent-red/10 text-accent-red rounded-card px-3 py-2 text-xs font-mono">
          {error}
        </div>
      )}

      {data && <ParcelDetail data={data} />}
    </div>
  );
}
