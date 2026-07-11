"use client";
import { useEffect, useRef, useState } from "react";

// MapLibre GL is loaded from a CDN at runtime so the dependency stays out of the
// lockfile (per the project's "no Mapbox / keep deps lean" stance). If the CDN
// is unreachable the component degrades to a coordinate-only panel — the parent
// still works via manual lat/lng entry.
const MAPLIBRE_VERSION = "4.7.1";
const MAPLIBRE_JS = `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MAPLIBRE_VERSION}/maplibre-gl.min.js`;
const MAPLIBRE_CSS = `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MAPLIBRE_VERSION}/maplibre-gl.min.css`;

// CARTO light raster basemap — free, no API key, aligned to the portal theme.
const LIGHT_STYLE = {
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

// Midrand — centre of the pilot area.
const DEFAULT_CENTER: [number, number] = [28.13, -25.99];

type MapEvent = { lngLat: { lat: number; lng: number } };
type MapMarker = { setLngLat: (position: [number, number]) => MapMarker; addTo: (map: MapInstance) => MapMarker };
type MapInstance = { addControl: (control: unknown, position: string) => void; on: (event: "click" | "load", handler: (event?: MapEvent) => void) => void; flyTo: (options: { center: [number, number]; zoom: number }) => void; getZoom: () => number; remove: () => void };
type MapLibre = { Map: new (options: { container: HTMLDivElement; style: typeof LIGHT_STYLE; center: [number, number]; zoom: number; attributionControl: boolean }) => MapInstance; NavigationControl: new (options: { showCompass: boolean }) => unknown; Marker: new (options: { color: string }) => MapMarker };

declare global { interface Window { maplibregl?: MapLibre } }

let loaderPromise: Promise<MapLibre> | null = null;
function loadMapLibre(): Promise<MapLibre> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[data-maplibre]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = MAPLIBRE_CSS;
      link.setAttribute("data-maplibre", "");
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.onload = () =>
      window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibre missing after load"));
    script.onerror = () => reject(new Error("failed to load maplibre-gl from CDN"));
    document.head.appendChild(script);

    // Don't hang forever if the network is blocked.
    setTimeout(() => reject(new Error("maplibre-gl load timed out")), 12000);
  });
  return loaderPromise;
}

export function ScoutMap({
  marker,
  onPick,
  height = "440px",
}: {
  marker: { lat: number; lng: number } | null;
  onPick: (coord: { lat: number; lng: number }) => void;
  height?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<MapMarker | null>(null);
  const onPickRef = useRef(onPick);

  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  // Initialise the map once.
  useEffect(() => {
    let cancelled = false;
    loadMapLibre()
      .then((maplibregl) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: LIGHT_STYLE,
          center: DEFAULT_CENTER,
          zoom: 11,
          attributionControl: true,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.on("click", (event) => {
          if (event) onPickRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
        });
        map.on("load", () => !cancelled && setStatus("ready"));
        mapRef.current = map;
      })
      .catch(() => !cancelled && setStatus("unavailable"));

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync the marker + recenter when the parent changes the coordinate.
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = window.maplibregl;
    if (!map || !maplibregl || !marker) return;
    if (markerRef.current) {
      markerRef.current.setLngLat([marker.lng, marker.lat]);
    } else {
      markerRef.current = new maplibregl.Marker({ color: "#2f70ef" })
        .setLngLat([marker.lng, marker.lat])
        .addTo(map);
    }
    map.flyTo({ center: [marker.lng, marker.lat], zoom: Math.max(map.getZoom(), 14) });
  }, [marker, status]);

  if (status === "unavailable") {
    return (
      <div
        style={{ height }}
        className="rounded-panel border border-border bg-bg-surface flex items-center justify-center text-center p-6"
      >
        <p className="text-text-muted font-mono text-xs leading-relaxed">
          Map unavailable (could not load MapLibre).<br />
          Enter coordinates manually to run the analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-panel overflow-hidden border border-border" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-surface/80">
          <p className="text-text-muted font-mono text-xs">Loading map…</p>
        </div>
      )}
    </div>
  );
}
