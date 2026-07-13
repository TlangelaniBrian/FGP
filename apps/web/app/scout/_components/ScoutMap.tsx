"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  type Marker,
  type StyleSpecification,
} from "maplibre-gl";

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

const DEFAULT_CENTER: [number, number] = [28.13, -25.99];
const SELECTED_PARCEL_SOURCE = "selected-parcel";
const SELECTED_PARCEL_FILL = "selected-parcel-fill";
const SELECTED_PARCEL_LINE = "selected-parcel-line";

export type ScoutMapListing = {
  id: number;
  address: string | null;
  suburb: string | null;
  zoneCode: string | null;
  dolomiteRisk: string | null;
  feasibilityScore: number | null;
  latitude: number;
  longitude: number;
};

export type SelectedParcelGeoJSON = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
};

type Coord = { lat: number; lng: number };

function scoreBand(score: number | null): "high" | "medium" | "low" | "unscored" {
  if (score === null) return "unscored";
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function createListingMarker(
  listing: ScoutMapListing,
  selected: boolean,
  onListingClick: (listingId: number) => void,
): HTMLButtonElement {
  const element = document.createElement("button");
  const score = listing.feasibilityScore;
  element.type = "button";
  element.className = `listing-marker listing-marker-${scoreBand(score)}${selected ? " is-selected" : ""}`;
  element.textContent = score === null ? "—" : String(score);
  element.setAttribute("aria-label", `Select ${listing.address || listing.suburb || `listing ${listing.id}`}, score ${score ?? "not available"}`);
  element.addEventListener("click", (event) => {
    event.stopPropagation();
    onListingClick(listing.id);
  });
  return element;
}

function isSelectedParcelGeoJSON(value: SelectedParcelGeoJSON | null | undefined): value is SelectedParcelGeoJSON {
  return Boolean(value && (value.type === "Polygon" || value.type === "MultiPolygon") && Array.isArray(value.coordinates));
}

export function ScoutMap({
  marker,
  onPick,
  listings = [],
  selectedListingId = null,
  onListingClick = () => undefined,
  selectedParcel,
  height = "440px",
}: {
  marker: Coord | null;
  onPick: (coord: Coord) => void;
  listings?: ScoutMapListing[];
  selectedListingId?: number | null;
  onListingClick?: (listingId: number) => void;
  selectedParcel?: SelectedParcelGeoJSON | null;
  height?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const coordinateMarkerRef = useRef<Marker | null>(null);
  const listingMarkersRef = useRef<Marker[]>([]);
  const onPickRef = useRef(onPick);
  const onListingClickRef = useRef(onListingClick);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === selectedListingId) ?? null,
    [listings, selectedListingId],
  );

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);
  useEffect(() => { onListingClickRef.current = onListingClick; }, [onListingClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;

    const markUnavailable = () => {
      if (cancelled) return;
      listingMarkersRef.current.forEach((marker) => marker.remove());
      listingMarkersRef.current = [];
      coordinateMarkerRef.current?.remove();
      coordinateMarkerRef.current = null;
      if (map) {
        map.remove();
        map = null;
        mapRef.current = null;
      }
      setStatus("unavailable");
    };

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: DEFAULT_CENTER,
        zoom: 10.5,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("click", (event) => onPickRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng }));
      map.once("load", () => {
        if (!cancelled) setStatus("ready");
      });
      map.on("error", markUnavailable);
    } catch {
      markUnavailable();
    }

    return () => {
      cancelled = true;
      listingMarkersRef.current.forEach((marker) => marker.remove());
      listingMarkersRef.current = [];
      coordinateMarkerRef.current?.remove();
      coordinateMarkerRef.current = null;
      if (map) map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;

    listingMarkersRef.current.forEach((marker) => marker.remove());
    listingMarkersRef.current = listings.map((listing) => new maplibregl.Marker({
      element: createListingMarker(listing, listing.id === selectedListingId, (listingId) => onListingClickRef.current(listingId)),
      anchor: "center",
    })
      .setLngLat([listing.longitude, listing.latitude])
      .addTo(map));

    return () => {
      listingMarkersRef.current.forEach((marker) => marker.remove());
      listingMarkersRef.current = [];
    };
  }, [listings, selectedListingId, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    if (!marker) {
      coordinateMarkerRef.current?.remove();
      coordinateMarkerRef.current = null;
      return;
    }
    if (coordinateMarkerRef.current) {
      coordinateMarkerRef.current.setLngLat([marker.lng, marker.lat]);
    } else {
      const element = document.createElement("span");
      element.className = "coordinate-marker";
      element.setAttribute("aria-label", "Selected analysis coordinate");
      coordinateMarkerRef.current = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([marker.lng, marker.lat])
        .addTo(map);
    }
  }, [marker, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !selectedListing) return;
    map.flyTo({
      center: [selectedListing.longitude, selectedListing.latitude],
      zoom: Math.max(map.getZoom(), 13.5),
      essential: false,
    });
  }, [selectedListing, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !isSelectedParcelGeoJSON(selectedParcel)) return;
    map.addSource(SELECTED_PARCEL_SOURCE, {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry: selectedParcel } as GeoJSON.Feature,
    });
    map.addLayer({ id: SELECTED_PARCEL_FILL, type: "fill", source: SELECTED_PARCEL_SOURCE, paint: { "fill-color": "#2f70ef", "fill-opacity": 0.16 } });
    map.addLayer({ id: SELECTED_PARCEL_LINE, type: "line", source: SELECTED_PARCEL_SOURCE, paint: { "line-color": "#0033a0", "line-width": 3 } });

    return () => {
      if (mapRef.current !== map) return;
      if (map.getLayer(SELECTED_PARCEL_LINE)) map.removeLayer(SELECTED_PARCEL_LINE);
      if (map.getLayer(SELECTED_PARCEL_FILL)) map.removeLayer(SELECTED_PARCEL_FILL);
      if (map.getSource(SELECTED_PARCEL_SOURCE)) map.removeSource(SELECTED_PARCEL_SOURCE);
    };
  }, [selectedParcel, status]);

  if (status === "unavailable") {
    return (
      <div className="map-fallback" style={{ height }} role="status">
        <span className="material-symbols-rounded" aria-hidden="true">map</span>
        <strong>Map temporarily unavailable</strong>
        <p>Search and lead cards still work. Enter coordinates below to run parcel analysis.</p>
      </div>
    );
  }

  return (
    <div className="scout-map-shell" style={{ height }}>
      <div ref={containerRef} className="scout-map-canvas" role="region" aria-label="Persisted Gauteng listing map" />
      <div className="floating-lead-chip">
        <span className="material-symbols-rounded" aria-hidden="true">location_city</span>
        {selectedListing?.address || selectedListing?.suburb || `${listings.length} mapped leads`}
      </div>
      <div className="map-legend" aria-label="Map legend">
        <span><i className="legend-score-high" />Score ≥ 80</span>
        <span><i className="legend-score-review" />Score &lt; 80</span>
        <span><b>RES</b>Zone</span>
        <span><i className="legend-dolomite" />Dolomite</span>
      </div>
      {status === "loading" && <div className="scout-map-loading" role="status">Loading map…</div>}
    </div>
  );
}
