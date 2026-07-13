"use client";
import Link from "next/link";
import type { ParcelAnalysis } from "@/lib/parcel";

const DOLOMITE_COLORS: Record<string, string> = {
  LOW: "text-accent-green",
  MEDIUM: "text-accent-amber",
  HIGH: "text-accent-red",
  VERY_HIGH: "text-accent-red",
  UNKNOWN: "text-text-muted",
};

function ScoreBar({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value ?? null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-text-muted tracking-widest uppercase">{label}</span>
        <span className="text-text-primary">{v == null ? "—" : v}</span>
      </div>
      <div className="h-1.5 rounded-pill bg-border overflow-hidden">
        <div
          className="portal-transition h-full bg-accent-blue rounded-pill"
          style={{ width: `${v == null ? 0 : Math.max(0, Math.min(100, v))}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-base border border-border rounded-card px-3 py-2">
      <div className="text-[9px] font-mono text-text-muted tracking-widest uppercase">{label}</div>
      <div className="text-text-primary font-mono text-sm mt-0.5">{value}</div>
    </div>
  );
}

const num = (n: number | null | undefined, unit = "") =>
  n == null ? "—" : `${Math.round(n).toLocaleString("en-ZA")}${unit}`;

export function ParcelDetail({ data }: { data: ParcelAnalysis }) {
  if (!data.found) {
    return (
      <div className="bg-bg-surface border border-border rounded-panel p-5">
        <p className="text-text-muted font-mono text-sm">
          No parcel or zoning data found at this coordinate. Try a point inside a mapped erf.
        </p>
      </div>
    );
  }

  const dolomiteColor = DOLOMITE_COLORS[data.dolomite_risk] ?? "text-text-muted";

  return (
    <div className="bg-bg-surface border border-border rounded-panel p-5 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-heading text-xl font-bold text-text-primary">
            {data.erf_number ?? "Unknown erf"}
          </div>
          <div className="text-text-muted font-mono text-xs mt-0.5">
            {[data.township, data.municipality].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        {data.zone_code && (
          <span className="bg-accent-blue/15 text-accent-blue font-mono text-xs font-semibold px-3 py-1 rounded-pill">
            {data.zone_code}
            {data.zone_label ? ` · ${data.zone_label}` : ""}
          </span>
        )}
      </div>

      <div className="portal-grid-4" style={{ gap: 8 }}>
        <Stat label="Erf size" value={num(data.size_sqm, " m²")} />
        <Stat label="Coverage" value={data.coverage_pct == null ? "—" : `${data.coverage_pct}%`} />
        <Stat label="FAR" value={data.far == null ? "—" : String(data.far)} />
        <Stat label="Max storeys" value={data.max_storeys == null ? "—" : String(data.max_storeys)} />
        <Stat label="Max footprint" value={num(data.max_footprint_sqm, " m²")} />
        <Stat label="Max buildable" value={num(data.max_buildable_sqm, " m²")} />
        <Stat label="Net buildable" value={num(data.net_buildable_sqm, " m²")} />
        <Stat label="Max units" value={data.max_units == null ? "—" : String(data.max_units)} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono">
        <span>
          <span className="text-text-muted tracking-widest uppercase mr-2">Dolomite</span>
          <span className={dolomiteColor}>{data.dolomite_risk}</span>
          {data.cgs_reference ? <span className="text-text-dim"> ({data.cgs_reference})</span> : null}
        </span>
        {data.rezoning_difficulty && (
          <span>
            <span className="text-text-muted tracking-widest uppercase mr-2">Rezoning</span>
            <span className="text-text-primary">{data.rezoning_difficulty}</span>
          </span>
        )}
      </div>

      <div className="portal-grid-4" style={{ gap: 12 }}>
        <ScoreBar label="Schools" value={data.score_schools} />
        <ScoreBar label="Transport" value={data.score_transport} />
        <ScoreBar label="Amenities" value={data.score_amenities} />
        <ScoreBar label="Composite" value={data.score_composite} />
      </div>

      {data.forms_required && data.forms_required.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.forms_required.map((f) => (
            <span key={f} className="bg-border text-text-muted font-mono text-[10px] px-2 py-1 rounded-pill">
              {f}
            </span>
          ))}
        </div>
      )}

      {data.amenities.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-2">
            Nearest amenities
          </div>
          <div className="flex flex-col gap-1 max-h-48 overflow-auto">
            {data.amenities.map((a, i) => (
              <div key={`${a.name}-${i}`} className="flex justify-between text-xs font-mono">
                <span className="text-text-primary truncate mr-3">
                  {a.name} <span className="text-text-dim">· {a.subtype ?? a.type}</span>
                </span>
                <span className="text-text-muted flex-shrink-0">
                  {a.dist_km == null ? "—" : `${a.dist_km} km`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="split" style={{ paddingTop: 3 }}><Link className="button button-secondary" href="/evaluate">Evaluate this parcel →</Link><Link className="button button-quiet" href="/scout">Back to Scout pipeline</Link></div>
    </div>
  );
}
