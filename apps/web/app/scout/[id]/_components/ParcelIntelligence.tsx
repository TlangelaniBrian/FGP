"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatZar } from "@/lib/format";
import type { ParcelAnalysis } from "@/lib/parcel";
import { parseSelectedParcelGeoJSON } from "@/lib/parcel-geometry";
import { ScoutMap, type ScoutMapListing } from "../../_components/ScoutMap";
import { Massing3D } from "./Massing3D";
import {
  buildParcelIntelligenceView,
  type OwnedListingFact,
} from "./parcel-intelligence-view";

interface ParcelIntelligenceProps {
  listingId: number;
  latitude: number;
  longitude: number;
  address: string | null;
  suburb: string | null;
  sizeSqm: number | null;
  price: number | null;
}

function metric(value: number | null | undefined, suffix = ""): string {
  return value == null || !Number.isFinite(value)
    ? "—"
    : `${Math.round(value).toLocaleString("en-ZA")}${suffix}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="parcel-fact"><dt>{label}</dt><dd>{value}</dd></div>;
}

function OwnedListingFacts({ facts }: { facts: OwnedListingFact[] }) {
  return (
    <section className="card">
      <header className="parcel-card-head"><h2>Owned listing facts</h2></header>
      <dl className="parcel-fact-grid parcel-degraded-facts">
        {facts.map((fact) => <Fact key={fact.label} label={fact.label} value={fact.value} />)}
      </dl>
    </section>
  );
}

function Score({ label, value }: { label: string; value: number | null | undefined }) {
  const safeValue = value == null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className="parcel-score">
      <span>{label}<strong>{value ?? "—"}</strong></span>
      <div role="progressbar" aria-label={`${label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
        <i style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function responseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error: unknown }).error;
    if (typeof error === "string") return error;
  }
  return `Parcel analysis failed (HTTP ${status}).`;
}

export function ParcelIntelligence(props: ParcelIntelligenceProps) {
  const [analysis, setAnalysis] = useState<ParcelAnalysis | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestSequence.current;
    let active = true;
    void fetch("/api/parcel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: props.latitude, lng: props.longitude }),
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json().catch(() => null) as ParcelAnalysis | { error?: unknown } | null;
      if (!active || requestId !== requestSequence.current) return;
      if (!response.ok) {
        setAnalysis(null);
        setError(responseError(payload, response.status));
        setStatus("error");
        return;
      }
      setAnalysis(payload as ParcelAnalysis);
      setStatus("ready");
    }).catch((reason: unknown) => {
      if (!active || requestId !== requestSequence.current || controller.signal.aborted) return;
      setAnalysis(null);
      setError(reason instanceof Error ? reason.message : "Could not load parcel analysis.");
      setStatus("error");
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [props.latitude, props.longitude]);

  const selectedParcel = useMemo(
    () => parseSelectedParcelGeoJSON(analysis?.boundary_geojson),
    [analysis?.boundary_geojson],
  );
  const selectedListing = useMemo<ScoutMapListing[]>(() => [{
    id: props.listingId,
    address: props.address,
    suburb: props.suburb,
    zoneCode: analysis?.zone_code ?? null,
    dolomiteRisk: analysis?.dolomite_risk ?? null,
    feasibilityScore: analysis?.score_composite ?? null,
    latitude: props.latitude,
    longitude: props.longitude,
  }], [analysis, props.address, props.latitude, props.listingId, props.longitude, props.suburb]);
  const view = useMemo(() => buildParcelIntelligenceView({
    requestStatus: status,
    analysisFound: analysis?.found ?? null,
    ownedListing: {
      address: props.address,
      suburb: props.suburb,
      sizeSqm: props.sizeSqm,
      price: props.price,
    },
  }), [analysis?.found, props.address, props.price, props.sizeSqm, props.suburb, status]);

  if (view.mode === "loading") {
    return <section className="card parcel-intelligence-state" role="status">Loading live parcel intelligence…</section>;
  }

  if (view.mode === "error") {
    return (
      <div className="stack parcel-degraded-state">
        <section className="card card-pad status-banner-warning" role="alert">
          <strong>Live parcel intelligence is unavailable</strong>
          <p>{error}</p>
          <p>The actor-owned listing facts remain available. Refresh to retry the spatial analysis.</p>
        </section>
        {view.showOwnedFacts && <OwnedListingFacts facts={view.ownedFacts} />}
      </div>
    );
  }

  if (view.mode === "not-found" || !analysis?.found) {
    return (
      <div className="stack parcel-degraded-state">
        <section className="card card-pad status-banner-warning" role="status">
          <strong>No mapped parcel found</strong>
          <p>This owned listing has a valid coordinate, but the current spatial layers did not return a parcel or zoning match.</p>
        </section>
        {view.showOwnedFacts && <OwnedListingFacts facts={view.ownedFacts} />}
      </div>
    );
  }

  const erfSqm = analysis.size_sqm ?? props.sizeSqm ?? 0;
  const maxFootprintSqm = analysis.max_footprint_sqm ?? (analysis.coverage_pct == null ? 0 : erfSqm * analysis.coverage_pct / 100);
  const maxBuildableSqm = analysis.max_buildable_sqm ?? (analysis.far == null ? maxFootprintSqm : erfSqm * analysis.far);
  const storeys = Math.max(1, analysis.max_storeys ?? Math.ceil(maxBuildableSqm / Math.max(maxFootprintSqm, 1)));
  const unitCount = Math.max(0, analysis.max_units ?? Math.floor((analysis.net_buildable_sqm ?? maxBuildableSqm * 0.85) / 55));
  const pricePerSqm = props.price != null && erfSqm > 0 ? props.price / erfSqm : null;
  const dolomiteClass = analysis.dolomite_risk === "LOW" ? "tag-green" : analysis.dolomite_risk === "UNKNOWN" ? "tag-amber" : "tag-red";

  return (
    <section className="parcel-intelligence" aria-label="Live parcel intelligence">
      <div className="parcel-action-row">
        <div className="parcel-tags">
          {analysis.zone_code && <span className="tag tag-blue">{analysis.zone_code}{analysis.zone_label ? ` · ${analysis.zone_label}` : ""}</span>}
          <span className={`tag ${dolomiteClass}`} aria-label="Dolomite risk">{analysis.dolomite_risk} dolomite risk</span>
        </div>
        <div className="parcel-actions">
          <Link href={`/scout/${props.listingId}/zoning`} className="button button-quiet">Compliance package</Link>
          <Link href="/evaluate" className="button button-primary">Evaluate land</Link>
        </div>
      </div>

      <div className="parcel-detail-layout">
        <div className="parcel-detail-main">
          <section className="card">
            <header className="parcel-card-head"><h2>Parcel facts</h2></header>
            <dl className="parcel-fact-grid">
              <Fact label="Erf size" value={metric(erfSqm, " m²")} />
              <Fact label="Price" value={props.price == null ? "—" : formatZar(props.price)} />
              <Fact label="Price / m²" value={pricePerSqm == null ? "—" : formatZar(pricePerSqm)} />
              <Fact label="Municipality" value={analysis.municipality ?? "—"} />
              <Fact label="Zone" value={analysis.zone_code ?? "—"} />
              <Fact label="Township" value={analysis.township ?? props.suburb ?? "—"} />
            </dl>
          </section>

          <section className="card">
            <header className="parcel-card-head"><h2>Zoning envelope{analysis.zone_code ? ` · ${analysis.zone_code}` : ""}</h2></header>
            <dl className="parcel-fact-grid">
              <Fact label="Coverage" value={analysis.coverage_pct == null ? "—" : `${analysis.coverage_pct}%`} />
              <Fact label="FAR" value={analysis.far == null ? "—" : String(analysis.far)} />
              <Fact label="Max storeys" value={String(storeys)} />
              <Fact label="Max footprint" value={metric(maxFootprintSqm, " m²")} />
              <Fact label="Max buildable" value={metric(maxBuildableSqm, " m²")} />
              <Fact label="Max units" value={String(unitCount)} />
            </dl>
            <div className="parcel-derived status-banner-success">
              <strong>Derived potential</strong>
              <span>{unitCount} units · {metric(maxBuildableSqm, " m²")} buildable · {metric(maxFootprintSqm, " m²")} footprint</span>
            </div>
          </section>

          <section className="card card-pad parcel-supporting-facts">
            <div>
              <span className="card-kicker">Amenity scores</span>
              <div className="parcel-score-grid">
                <Score label="Schools" value={analysis.score_schools} />
                <Score label="Transport" value={analysis.score_transport} />
                <Score label="Amenities" value={analysis.score_amenities} />
              </div>
            </div>
            <div>
              <span className="card-kicker">Forms required</span>
              <div className="parcel-forms">
                {analysis.forms_required?.length
                  ? analysis.forms_required.map((form) => <span className="tag tag-blue" key={form}>{form.replaceAll("_", " ")}</span>)
                  : <span className="muted">No forms returned by the current scheme rule.</span>}
              </div>
            </div>
          </section>
        </div>

        <aside className="parcel-detail-aside">
          <ScoutMap
            marker={null}
            onPick={() => undefined}
            listings={selectedListing}
            selectedListingId={props.listingId}
            selectedParcel={selectedParcel}
            height="240px"
          />
          {!selectedParcel && <p className="parcel-map-note">The selected coordinate is shown; this parcel response did not include a valid Polygon or MultiPolygon boundary.</p>}
          <section className="card">
            <header className="parcel-card-head"><h2>Parametric massing</h2></header>
            <div className="parcel-massing-content">
              <div className="massing-metrics">
                <span><strong>{unitCount}</strong> units</span>
                <span><strong>{storeys}</strong> storeys</span>
                <span><strong>{metric(maxFootprintSqm, " m²")}</strong> footprint</span>
              </div>
              <Massing3D erfSqm={erfSqm} maxFootprintSqm={maxFootprintSqm} maxBuildableSqm={maxBuildableSqm} storeys={storeys} unitCount={unitCount} />
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
