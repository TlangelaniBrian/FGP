"use client";
import { useCallback, useEffect, useState } from "react";
import { actorHeaders } from "@/lib/portal-client";
import { useSession } from "@/lib/session-context";
import { RequireSession } from "../../_components/RequireSession";
import { TariffActions } from "./_components/TariffActions";
import {
  BulkContributionFields,
  DutyBracketFields,
  FeeFields,
  MUNICIPALITIES,
  UNIT_TYPES,
  UnitValueFields,
  type Municipality,
  type UnitType,
} from "./_components/TariffFields";

const YEARS = [2025, 2026, 2027] as const;

type UnitValues = Record<UnitType, string>;
type BulkValues = Record<Municipality, Record<UnitType, { min: string; max: string }>>;
type DutyRows = Array<{ upper: string; rate: string; base: string }>;
type FeesValue = { professionalFeePct: string };

type Drafts = {
  build_rates: UnitValues;
  unit_sizes: UnitValues;
  market_rents: UnitValues;
  bulk_contributions: BulkValues;
  transfer_duty_brackets: DutyRows;
  fees: FeesValue;
};

function emptyUnitValues(): UnitValues {
  return { bachelor: "", "1bed": "", "2bed": "", luxury: "" };
}

function emptyBulkValues(): BulkValues {
  return Object.fromEntries(
    MUNICIPALITIES.map((municipality) => [
      municipality,
      { bachelor: { min: "", max: "" }, "1bed": { min: "", max: "" }, "2bed": { min: "", max: "" }, luxury: { min: "", max: "" } },
    ]),
  ) as BulkValues;
}

function parseUnitValues(data: Record<string, unknown> | undefined): UnitValues {
  const values = emptyUnitValues();
  for (const unit of UNIT_TYPES) {
    const raw = data?.[unit];
    values[unit] = typeof raw === "number" ? String(raw) : "";
  }
  return values;
}

function parseBulkValues(data: Record<string, unknown> | undefined): BulkValues {
  const values = emptyBulkValues();
  for (const municipality of MUNICIPALITIES) {
    const row = data?.[municipality] as Record<string, unknown> | undefined;
    for (const unit of UNIT_TYPES) {
      const range = row?.[unit];
      if (Array.isArray(range)) {
        values[municipality][unit] = {
          min: typeof range[0] === "number" ? String(range[0]) : "",
          max: typeof range[1] === "number" ? String(range[1]) : "",
        };
      }
    }
  }
  return values;
}

function parseDutyRows(data: unknown): DutyRows {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => ({
      upper: typeof row[0] === "number" ? String(row[0]) : "",
      rate: typeof row[1] === "number" ? String(row[1]) : "",
      base: typeof row[2] === "number" ? String(row[2]) : "",
    }));
}

function parseFees(data: Record<string, unknown> | undefined): FeesValue {
  const raw = data?.professional_fee_pct;
  return { professionalFeePct: typeof raw === "number" ? String(raw) : "" };
}

function emptyDrafts(): Drafts {
  return {
    build_rates: emptyUnitValues(),
    unit_sizes: emptyUnitValues(),
    market_rents: emptyUnitValues(),
    bulk_contributions: emptyBulkValues(),
    transfer_duty_brackets: [],
    fees: { professionalFeePct: "" },
  };
}

function buildUnitData(values: UnitValues): Record<string, number> {
  return Object.fromEntries(
    UNIT_TYPES.map((unit) => [unit, Number(values[unit])]),
  );
}

function buildBulkData(values: BulkValues): Record<string, Record<string, [number, number]>> {
  return Object.fromEntries(
    MUNICIPALITIES.map((municipality) => [
      municipality,
      Object.fromEntries(
        UNIT_TYPES.map((unit) => [
          unit,
          [Number(values[municipality][unit].min), Number(values[municipality][unit].max)],
        ]),
      ),
    ]),
  );
}

function buildDutyData(rows: DutyRows): Array<[number | null, number, number]> {
  return rows.map((row) => [
    row.upper === "" ? null : Number(row.upper),
    Number(row.rate),
    Number(row.base),
  ]);
}

function TariffsAdminContent() {
  const { activeOrganization, capabilities } = useSession();
  const canEdit = capabilities.includes("EditTariffs");
  const [year, setYear] = useState(2026);
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts);
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
      const json = (await res.json()) as {
        tariffs: Record<string, Record<string, unknown> | unknown[]>;
      };
      setDrafts({
        build_rates: parseUnitValues(json.tariffs.build_rates as Record<string, unknown> | undefined),
        unit_sizes: parseUnitValues(json.tariffs.unit_sizes as Record<string, unknown> | undefined),
        market_rents: parseUnitValues(json.tariffs.market_rents as Record<string, unknown> | undefined),
        bulk_contributions: parseBulkValues(json.tariffs.bulk_contributions as Record<string, unknown> | undefined),
        transfer_duty_brackets: parseDutyRows(json.tariffs.transfer_duty_brackets),
        fees: parseFees(json.tariffs.fees as Record<string, unknown> | undefined),
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load tariffs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(year);
  }, [year, load]);

  function patch(category: keyof Drafts, updater: (current: Drafts) => Drafts) {
    setDrafts((current) => updater(current));
    setStatus((current) => ({ ...current, [category]: "" }));
  }

  function setUnit(
    category: "build_rates" | "unit_sizes" | "market_rents",
    unit: UnitType,
    value: string,
  ) {
    patch(category, (current) => ({
      ...current,
      [category]: { ...current[category], [unit]: value },
    }));
  }

  function setBulk(
    municipality: Municipality,
    unit: UnitType,
    bound: "min" | "max",
    value: string,
  ) {
    patch("bulk_contributions", (current) => ({
      ...current,
      bulk_contributions: {
        ...current.bulk_contributions,
        [municipality]: {
          ...current.bulk_contributions[municipality],
          [unit]: { ...current.bulk_contributions[municipality][unit], [bound]: value },
        },
      },
    }));
  }

  function setDuty(index: number, field: "upper" | "rate" | "base", value: string) {
    patch("transfer_duty_brackets", (current) => {
      const rows = current.transfer_duty_brackets.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      );
      return { ...current, transfer_duty_brackets: rows };
    });
  }

  function validateAndBuild(category: keyof Drafts): unknown | null {
    const data = drafts[category];
    switch (category) {
      case "build_rates":
      case "unit_sizes":
      case "market_rents": {
        const values = data as UnitValues;
        for (const unit of UNIT_TYPES) {
          const value = Number(values[unit]);
          if (!values[unit] || !Number.isFinite(value) || value <= 0) {
            return null;
          }
        }
        return buildUnitData(values);
      }
      case "bulk_contributions": {
        const values = data as BulkValues;
        for (const municipality of MUNICIPALITIES) {
          for (const unit of UNIT_TYPES) {
            const minimum = Number(values[municipality][unit].min);
            const maximum = Number(values[municipality][unit].max);
            if (
              !values[municipality][unit].min ||
              !values[municipality][unit].max ||
              !Number.isFinite(minimum) ||
              !Number.isFinite(maximum) ||
              minimum <= 0 ||
              maximum <= 0 ||
              minimum > maximum
            ) {
              return null;
            }
          }
        }
        return buildBulkData(values);
      }
      case "transfer_duty_brackets": {
        const rows = data as DutyRows;
        if (rows.length < 2) return null;
        let previousUpper = 0;
        let previousBase = 0;
        for (let index = 0; index < rows.length; index++) {
          const row = rows[index];
          const isFinal = index === rows.length - 1;
          if (row.upper !== "") {
            const upper = Number(row.upper);
            if (!Number.isFinite(upper) || upper <= previousUpper) return null;
            previousUpper = upper;
          } else if (!isFinal) {
            return null;
          }
          const rate = Number(row.rate);
          const base = Number(row.base);
          if (!Number.isFinite(rate) || rate < 0 || rate > 1) return null;
          if (!Number.isFinite(base) || base < 0 || base < previousBase) return null;
          previousBase = base;
        }
        if (rows[rows.length - 1].upper !== "") return null;
        return buildDutyData(rows);
      }
      case "fees": {
        const fee = Number((data as FeesValue).professionalFeePct);
        if (!Number.isFinite(fee) || fee <= 0 || fee > 0.3) return null;
        return { professional_fee_pct: fee };
      }
    }
  }

  async function save(category: keyof Drafts) {
    const data = validateAndBuild(category);
    if (data === null) {
      setStatus((s) => ({ ...s, [category]: "Invalid values — fix and retry" }));
      return;
    }

    setSaving(category);
    try {
      const res = await fetch("/api/tariffs", {
        method: "PUT",
        headers: actorHeaders(),
        body: JSON.stringify({ year, category, data }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error)
            msg =
              typeof body.error === "string"
                ? body.error
                : JSON.stringify(body.error);
        } catch {
          /* non-JSON */
        }
        throw new Error(msg);
      }
      setStatus((s) => ({ ...s, [category]: "Saved ✓" }));
    } catch (e) {
      setStatus((s) => ({
        ...s,
        [category]: e instanceof Error ? e.message : "Save failed",
      }));
    } finally {
      setSaving(null);
    }
  }

  const field =
    "bg-bg-surface border border-border rounded-card px-3 py-2 text-text-primary font-mono text-xs w-full focus:outline-none focus:border-accent-blue";

  const card = "card card-pad";
  const cardHeader = "flex items-center justify-between";
  const cardTitle = "text-text-primary font-mono text-sm font-semibold";
  const cardHint = "text-text-dim font-mono text-[10px] mt-0.5";

  return (
    <div className="portal-page" style={{ maxWidth: 1080 }}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Admin · Municipal inputs</p>
          <h1 className="page-title">Tariff administration</h1>
          <p className="page-subtitle">
            Build rates and bulk contributions feed the Cost Oracle live —
            change a value and re-run an analysis to see the effect.
          </p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-text-muted tracking-widest uppercase">
            Tariff year
          </span>
          <select
            value={year}
            disabled={!canEdit}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className={`${field} w-28`}
          >
            {YEARS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!canEdit && (
        <div
          className="card status-banner-warning"
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 12,
            fontWeight: 800,
          }}
          role="status"
        >
          Tariffs are locked for {activeOrganization?.role ?? "this account"}.
          Contact a Chairperson or Owner to make changes.
        </div>
      )}

      {loading && <p className="text-text-muted font-mono text-sm">Loading…</p>}
      {loadError && (
        <div
          role="alert"
          className="border border-accent-red/40 bg-accent-red/10 text-accent-red rounded-card px-3 py-2 text-xs font-mono"
        >
          {loadError}
        </div>
      )}

      {!loading &&
        !loadError &&
        (
          [
            {
              key: "build_rates",
              title: "Build rates",
              hint: "R / m² by unit type",
              body: (
                <UnitValueFields
                  canEdit={canEdit}
                  unit="build rate"
                  suffix="R/m²"
                  values={drafts.build_rates}
                  onChange={(unit, value) => setUnit("build_rates", unit, value)}
                />
              ),
            },
            {
              key: "bulk_contributions",
              title: "Bulk contributions",
              hint: "R / unit by municipality → unit type [min, max]",
              body: (
                <BulkContributionFields
                  canEdit={canEdit}
                  unit="bulk contribution"
                  values={drafts.bulk_contributions}
                  onChange={setBulk}
                />
              ),
            },
            {
              key: "unit_sizes",
              title: "Unit sizes",
              hint: "m² GLA by unit type",
              body: (
                <UnitValueFields
                  canEdit={canEdit}
                  unit="unit size"
                  suffix="m²"
                  values={drafts.unit_sizes}
                  onChange={(unit, value) => setUnit("unit_sizes", unit, value)}
                />
              ),
            },
            {
              key: "market_rents",
              title: "Market rents",
              hint: "Monthly R by unit type",
              body: (
                <UnitValueFields
                  canEdit={canEdit}
                  unit="market rent"
                  suffix="R/mo"
                  values={drafts.market_rents}
                  onChange={(unit, value) => setUnit("market_rents", unit, value)}
                />
              ),
            },
            {
              key: "transfer_duty_brackets",
              title: "Transfer duty — SARS",
              hint: "[upper | final, marginal rate, cumulative base]",
              body: (
                <DutyBracketFields
                  canEdit={canEdit}
                  unit="transfer duty"
                  rows={drafts.transfer_duty_brackets}
                  onChange={setDuty}
                  onAddRow={() =>
                    patch("transfer_duty_brackets", (current) => ({
                      ...current,
                      transfer_duty_brackets: [
                        ...current.transfer_duty_brackets,
                        { upper: "", rate: "", base: "" },
                      ],
                    }))
                  }
                  onRemoveLast={() =>
                    patch("transfer_duty_brackets", (current) => ({
                      ...current,
                      transfer_duty_brackets:
                        current.transfer_duty_brackets.slice(0, -1),
                    }))
                  }
                />
              ),
            },
            {
              key: "fees",
              title: "Fees",
              hint: "Professional fee as a decimal fraction",
              body: (
                <FeeFields
                  canEdit={canEdit}
                  unit="fees"
                  value={drafts.fees.professionalFeePct}
                  onChange={(value) =>
                    patch("fees", (current) => ({
                      ...current,
                      fees: { professionalFeePct: value },
                    }))
                  }
                />
              ),
            },
          ] as Array<{
            key: keyof Drafts;
            title: string;
            hint: string;
            body: React.ReactNode;
          }>
        ).map(({ key, title, hint, body }) => (
          <div key={key} className={card} style={{ marginBottom: 14 }}>
            <div className={cardHeader}>
              <div>
                <div className={cardTitle}>{title}</div>
                <div className={cardHint}>{hint}</div>
              </div>
            </div>
            <div className="mt-4">{body}</div>
            <div className="flex items-center gap-3 mt-4">
              <TariffActions
                capabilities={capabilities}
                disabled={saving === key}
                onSave={() => void save(key)}
              />
              {status[key] && (
                <span
                  className={`font-mono text-xs ${
                    status[key].startsWith("Saved")
                      ? "text-accent-green"
                      : "text-accent-red"
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

export default function TariffsAdminPage() {
  return (
    <RequireSession pathname="/settings/tariffs">
      <TariffsAdminContent />
    </RequireSession>
  );
}
