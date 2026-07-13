"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ParcelDetail } from "./_components/ParcelDetail";
import { ScoutLeadCard, type ScoutListing } from "./_components/ScoutLeadCard";
import { ScoutMap, type ScoutMapListing } from "./_components/ScoutMap";
import type { ParcelAnalysis } from "@/lib/parcel";
import { formatZar } from "@/lib/format";

type Coord = { lat: number; lng: number };
type ScoutFilter = "all" | "res2" | "res3" | "res4" | "low-dolomite" | "score-80";

const FILTERS: Array<{ value: ScoutFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "res2", label: "RES2" },
  { value: "res3", label: "RES3" },
  { value: "res4", label: "RES4" },
  { value: "low-dolomite", label: "Low dolomite" },
  { value: "score-80", label: "Score ≥ 80" },
];

// Gauteng-ish bounds; mirror the worker/proxy guards so we fail fast client-side.
const LAT_MIN = -27;
const LAT_MAX = -25;
const LNG_MIN = 27;
const LNG_MAX = 29.5;
const inBounds = (coord: Coord) => coord.lat >= LAT_MIN && coord.lat <= LAT_MAX && coord.lng >= LNG_MIN && coord.lng <= LNG_MAX;

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error: unknown }).error;
    if (typeof error === "string") return error;
    if (error) return JSON.stringify(error);
  }
  return `Request failed (HTTP ${status}).`;
}

function matchesFilter(listing: ScoutListing, filter: ScoutFilter): boolean {
  if (filter === "all") return true;
  if (filter === "low-dolomite") return listing.dolomiteRisk?.toLowerCase() === "low";
  if (filter === "score-80") return (listing.feasibilityScore ?? -1) >= 80;
  return listing.zoneCode?.toLowerCase() === filter;
}

export default function ScoutPage() {
  const [marker, setMarker] = useState<Coord | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [data, setData] = useState<ParcelAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<ScoutListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ScoutFilter>("all");
  const [selectedListingId, setSelectedListingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/listings")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load listings (HTTP ${response.status}).`);
        return await response.json() as ScoutListing[];
      })
      .then((rows) => {
        if (!cancelled) setListings(Array.isArray(rows) ? rows : []);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setListings([]);
          setListingsError(reason instanceof Error ? reason.message : "Could not load persisted listings.");
        }
      })
      .finally(() => {
        if (!cancelled) setListingsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return listings.filter((listing) => {
      const searchable = [listing.address, listing.suburb, listing.municipality, listing.zoneCode, listing.dolomiteRisk]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && matchesFilter(listing, activeFilter);
    });
  }, [activeFilter, listings, query]);

  const mapListings = useMemo<ScoutMapListing[]>(() => filteredListings.flatMap((listing) => (
    listing.latitude === null || listing.longitude === null
      ? []
      : [{
          id: listing.id,
          address: listing.address,
          suburb: listing.suburb,
          zoneCode: listing.zoneCode,
          dolomiteRisk: listing.dolomiteRisk,
          feasibilityScore: listing.feasibilityScore,
          latitude: listing.latitude,
          longitude: listing.longitude,
        }]
  )), [filteredListings]);

  useEffect(() => {
    if (selectedListingId !== null && !filteredListings.some((listing) => listing.id === selectedListingId)) {
      setSelectedListingId(null);
    }
  }, [filteredListings, selectedListingId]);

  const analyze = useCallback(async (coord: Coord) => {
    if (!inBounds(coord)) {
      setError("Coordinate is outside Gauteng (lat -27…-25, lng 27…29.5).");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const response = await fetch("/api/parcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coord),
      });
      if (!response.ok) {
        let payload: unknown = null;
        try { payload = await response.json(); } catch { /* non-JSON response */ }
        setError(errorMessage(payload, response.status));
        return;
      }
      setData(await response.json() as ParcelAnalysis);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePick = useCallback((coord: Coord) => {
    setMarker(coord);
    setSelectedListingId(null);
    setLatInput(coord.lat.toFixed(6));
    setLngInput(coord.lng.toFixed(6));
    void analyze(coord);
  }, [analyze]);

  const handleListingSelect = useCallback((listingId: number) => {
    setSelectedListingId(listingId);
    const listing = mapListings.find((item) => item.id === listingId);
    if (listing) {
      setMarker({ lat: listing.latitude, lng: listing.longitude });
      setLatInput(listing.latitude.toFixed(6));
      setLngInput(listing.longitude.toFixed(6));
    }
  }, [mapListings]);

  function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    const lat = Number.parseFloat(latInput);
    const lng = Number.parseFloat(lngInput);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Enter valid numeric coordinates.");
      return;
    }
    const coord = { lat, lng };
    setMarker(coord);
    setSelectedListingId(null);
    void analyze(coord);
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <div>
          <p className="eyebrow">Scout · Gauteng lead discovery</p>
          <h1 className="page-title">Scout</h1>
          <p className="page-subtitle">Search persisted opportunities, compare signals and inspect their exact map positions.</p>
        </div>
        <span className="tag tag-blue">{listings.length} listings</span>
      </div>

      <label className="scout-search">
        <span className="material-symbols-rounded" aria-hidden="true">search</span>
        <span className="sr-only">Search listings</span>
        <input
          className="field"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by suburb, address, zone or dolomite"
        />
      </label>

      <div className="scout-filter-tabs" role="group" aria-label="Filter persisted listings">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={activeFilter === filter.value ? "is-active" : undefined}
            aria-pressed={activeFilter === filter.value}
            onClick={() => setActiveFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="scout-layout">
        <section className="scout-leads" aria-labelledby="scout-results-heading">
          <div className="scout-results-heading">
            <h2 id="scout-results-heading">Persisted leads</h2>
            <span>{filteredListings.length} of {listings.length} listings</span>
          </div>
          {listingsLoading && <p className="scout-empty" role="status">Loading persisted listings…</p>}
          {listingsError && <p className="scout-empty status-banner-warning" role="alert">{listingsError}</p>}
          {!listingsLoading && !listingsError && filteredListings.length === 0 && (
            <p className="scout-empty">No listings match this search and filter.</p>
          )}
          {filteredListings.map((listing) => (
            <ScoutLeadCard
              key={listing.id}
              listing={listing}
              selected={listing.id === selectedListingId}
              onSelect={handleListingSelect}
              formatPrice={formatZar}
            />
          ))}
        </section>

        <aside className="scout-map-column" aria-label="Lead map and coordinate analysis">
          <ScoutMap
            marker={marker}
            onPick={handlePick}
            listings={mapListings}
            selectedListingId={selectedListingId}
            onListingClick={handleListingSelect}
          />
          <form onSubmit={handleManualSubmit} className="card card-pad scout-coordinate-form">
            <div>
              <label className="field-label" htmlFor="scout-latitude">Latitude</label>
              <input id="scout-latitude" value={latInput} onChange={(event) => setLatInput(event.target.value)} placeholder="-25.990000" className="field" inputMode="decimal" />
            </div>
            <div>
              <label className="field-label" htmlFor="scout-longitude">Longitude</label>
              <input id="scout-longitude" value={lngInput} onChange={(event) => setLngInput(event.target.value)} placeholder="28.130000" className="field" inputMode="decimal" />
            </div>
            <button type="submit" disabled={loading} className="button button-primary">
              {loading ? "Analysing…" : "Analyse coordinate"}
            </button>
          </form>
          {error && <div role="alert" className="card card-pad status-banner-warning">{error}</div>}
        </aside>
      </div>

      {data && <ParcelDetail data={data} />}
    </div>
  );
}
