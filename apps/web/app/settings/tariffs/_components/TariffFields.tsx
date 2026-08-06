"use client";

export const UNIT_TYPES = ["bachelor", "1bed", "2bed", "luxury"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_LABELS: Record<UnitType, string> = {
  bachelor: "Bachelor (studio)",
  "1bed": "1 Bed",
  "2bed": "2 Bed",
  luxury: "Luxury",
};

export const MUNICIPALITIES = ["johannesburg", "tshwane", "ekurhuleni"] as const;
export type Municipality = (typeof MUNICIPALITIES)[number];

export const MUNICIPALITY_LABELS: Record<Municipality, string> = {
  johannesburg: "Johannesburg",
  tshwane: "Tshwane",
  ekurhuleni: "Ekurhuleni",
};

export function UnitValueFields({
  canEdit,
  unit,
  suffix,
  values,
  onChange,
}: {
  canEdit: boolean;
  unit: string;
  suffix: string;
  values: Record<UnitType, string>;
  onChange: (unit: UnitType, value: string) => void;
}) {
  const field =
    "bg-bg-surface border border-border rounded-card px-3 py-2 text-text-primary font-mono text-xs w-32 text-right focus:outline-none focus:border-accent-blue disabled:opacity-60";
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {UNIT_TYPES.map((unitType) => (
        <label
          key={unitType}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-text-primary font-mono text-xs">
            {UNIT_LABELS[unitType]}
          </span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              step="any"
              min="0"
              value={values[unitType]}
              disabled={!canEdit}
              aria-label={`${unit} ${UNIT_LABELS[unitType]}`}
              onChange={(event) => onChange(unitType, event.target.value)}
              className={field}
            />
            <span className="text-text-dim font-mono text-[10px]">{suffix}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function BulkContributionFields({
  canEdit,
  unit,
  values,
  onChange,
}: {
  canEdit: boolean;
  unit: string;
  values: Record<Municipality, Record<UnitType, { min: string; max: string }>>;
  onChange: (
    municipality: Municipality,
    unitType: UnitType,
    bound: "min" | "max",
    value: string,
  ) => void;
}) {
  const field =
    "bg-bg-surface border border-border rounded-card px-3 py-2 text-text-primary font-mono text-xs w-24 text-right focus:outline-none focus:border-accent-blue disabled:opacity-60";
  return (
    <div className="flex flex-col gap-4">
      {MUNICIPALITIES.map((municipality) => (
        <div key={municipality}>
          <div className="text-text-dim font-mono text-[10px] tracking-widest uppercase mb-2">
            {MUNICIPALITY_LABELS[municipality]}
          </div>
          <div className="flex flex-col gap-2">
            {UNIT_TYPES.map((unitType) => (
              <div
                key={unitType}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-text-primary font-mono text-xs">
                  {UNIT_LABELS[unitType]}
                </span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={values[municipality][unitType].min}
                    disabled={!canEdit}
                    aria-label={`${unit} ${municipality} ${unitType} min`}
                    onChange={(event) =>
                      onChange(municipality, unitType, "min", event.target.value)
                    }
                    className={field}
                  />
                  <span className="text-text-dim font-mono text-[10px]">to</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={values[municipality][unitType].max}
                    disabled={!canEdit}
                    aria-label={`${unit} ${municipality} ${unitType} max`}
                    onChange={(event) =>
                      onChange(municipality, unitType, "max", event.target.value)
                    }
                    className={field}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DutyBracketFields({
  canEdit,
  unit,
  rows,
  onChange,
  onAddRow,
  onRemoveLast,
}: {
  canEdit: boolean;
  unit: string;
  rows: Array<{ upper: string; rate: string; base: string }>;
  onChange: (
    index: number,
    field: "upper" | "rate" | "base",
    value: string,
  ) => void;
  onAddRow: () => void;
  onRemoveLast: () => void;
}) {
  const field =
    "bg-bg-surface border border-border rounded-card px-3 py-2 text-text-primary font-mono text-xs w-full text-right focus:outline-none focus:border-accent-blue disabled:opacity-60";
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_140px_140px] gap-2 px-1">
        <span className="text-text-dim font-mono text-[10px] tracking-widest uppercase">
          Upper bound (R)
        </span>
        <span className="text-text-dim font-mono text-[10px] tracking-widest uppercase text-right">
          Marginal rate
        </span>
        <span className="text-text-dim font-mono text-[10px] tracking-widest uppercase text-right">
          Cumulative base (R)
        </span>
      </div>
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-[1fr_140px_140px] gap-2 items-center"
        >
          <input
            type="number"
            step="any"
            min="0"
            placeholder={index === rows.length - 1 ? "Final (above)" : "Upper"}
            value={row.upper}
            disabled={!canEdit}
            aria-label={`${unit} bracket ${index + 1} upper`}
            onChange={(event) => onChange(index, "upper", event.target.value)}
            className={field}
          />
          <input
            type="number"
            step="any"
            min="0"
            max="1"
            value={row.rate}
            disabled={!canEdit}
            aria-label={`${unit} bracket ${index + 1} rate`}
            onChange={(event) => onChange(index, "rate", event.target.value)}
            className={field}
          />
          <input
            type="number"
            step="any"
            min="0"
            value={row.base}
            disabled={!canEdit}
            aria-label={`${unit} bracket ${index + 1} base`}
            onChange={(event) => onChange(index, "base", event.target.value)}
            className={field}
          />
        </div>
      ))}
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          disabled={!canEdit}
          className="button button-secondary disabled:opacity-60"
          onClick={onAddRow}
        >
          Add bracket
        </button>
        {rows.length > 2 && (
          <button
            type="button"
            disabled={!canEdit}
            className="button button-secondary disabled:opacity-60"
            onClick={onRemoveLast}
          >
            Remove last
          </button>
        )}
      </div>
    </div>
  );
}

export function FeeFields({
  canEdit,
  unit,
  value,
  onChange,
}: {
  canEdit: boolean;
  unit: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const field =
    "bg-bg-surface border border-border rounded-card px-3 py-2 text-text-primary font-mono text-xs w-32 text-right focus:outline-none focus:border-accent-blue disabled:opacity-60";
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-text-primary font-mono text-xs">
        Professional fee %
      </span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          step="any"
          min="0"
          max="0.3"
          value={value}
          disabled={!canEdit}
          aria-label={`${unit} professional fee percent`}
          onChange={(event) => onChange(event.target.value)}
          className={field}
        />
        <span className="text-text-dim font-mono text-[10px]">e.g. 0.12</span>
      </span>
    </label>
  );
}
