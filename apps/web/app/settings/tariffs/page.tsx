"use client";
import { useCallback, useEffect, useState } from "react";

const CATEGORIES = [
  { key: "build_rates", label: "Build rates", hint: "R/m² by unit type" },
  { key: "unit_sizes", label: "Unit sizes", hint: "m² GLA by unit type" },
  { key: "market_rents", label: "Market rents", hint: "Monthly R by unit type" },
  { key: "bulk_contributions", label: "Bulk contributions", hint: "R per unit by municipality → unit type [min, max]" },
  { key: "transfer_duty_brackets", label: "Transfer duty brackets", hint: "[upper | null, rate, cumulative base]" },
  { key: "fees", label: "Fees", hint: "professional_fee_pct (e.g. 0.12)" },
] as const;

type CatKey = (typeof CATEGORIES)[number]["key"];

export default function TariffsAdminPage() {
  const [year, setYear] = useState(2026);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setLoadError(null);
    setStatus({});
    try {
      const res = await fetch(`/api/tariffs?year=${y}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { tariffs: Record<string, unknown> };
      const next: Record<string, string> = {};
      for (const { key } of CATEGORIES) {
        next[key] = key in json.tariffs ? JSON.stringify(json.tariffs[key], null, 2) : "";
      }
      setDrafts(next);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load tariffs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(year);
  }, [year, load]);

  async function save(category: CatKey) {
    setStatus((s) => ({ ...s, [category]: "" }));

    let data: unknown;
    try {
      data = JSON.parse(drafts[category] || "");
    } catch {
      setStatus((s) => ({ ...s, [category]: "Invalid JSON — fix and retry" }));
      return;
    }

    setSaving(category);
    try {
      const res = await fetch("/api/tariffs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, category, data }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
        } catch {
          /* non-JSON */
        }
        throw new Error(msg);
      }
      setStatus((s) => ({ ...s, [category]: "Saved ✓" }));
    } catch (e) {
      setStatus((s) => ({ ...s, [category]: e instanceof Error ? e.message : "Save failed" }));
    } finally {
      setSaving(null);
    }
  }

  const field =
    "bg-bg-surface border border-border rounded-card px-3 py-2 text-text-primary font-mono text-xs w-full focus:outline-none focus:border-accent-blue";

  return (
    <div className="max-w-3xl mx-auto p-8 flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-2">Settings · Tariffs</p>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Tariff Administration</h1>
          <p className="text-text-muted font-mono text-xs mt-1">
            SARS transfer duty changes each March budget · municipal BSC each July gazette.
          </p>
        </div>
        <div>
          <label className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1 block">Year</label>
          <input
            type="number"
            value={year}
            min={2000}
            max={2100}
            onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
            className={`${field} w-24`}
          />
        </div>
      </div>

      {loading && <p className="text-text-muted font-mono text-sm">Loading…</p>}
      {loadError && (
        <div role="alert" className="border border-accent-red/40 bg-accent-red/10 text-accent-red rounded-card px-3 py-2 text-xs font-mono">
          {loadError}
        </div>
      )}

      {!loading &&
        !loadError &&
        CATEGORIES.map(({ key, label, hint }) => (
          <div key={key} className="bg-bg-surface border border-border rounded-card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-text-primary font-mono text-sm font-semibold">{label}</div>
                <div className="text-text-dim font-mono text-[10px] mt-0.5">{hint}</div>
              </div>
              {!drafts[key] && <span className="text-accent-amber font-mono text-[10px]">not set for {year}</span>}
            </div>
            <textarea
              value={drafts[key] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
              rows={key === "bulk_contributions" || key === "transfer_duty_brackets" ? 9 : 5}
              spellCheck={false}
              placeholder={`{ ... } for ${year}`}
              className={`${field} resize-y`}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => save(key)}
                disabled={saving === key}
                className="bg-accent-blue text-white font-mono text-xs font-semibold px-4 py-1.5 rounded-card disabled:opacity-50 hover:opacity-90 transition-colors"
              >
                {saving === key ? "Saving…" : "Save"}
              </button>
              {status[key] && (
                <span
                  className={`font-mono text-xs ${
                    status[key].startsWith("Saved") ? "text-accent-green" : "text-accent-red"
                  }`}
                >
                  {status[key]}
                </span>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
