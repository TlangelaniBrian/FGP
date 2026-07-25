import { formatZar } from "../../../../lib/format";

export type CostBreakdown = {
  costLand: number;
  costBuild: number;
  costProfessionalFees: number;
  costBulkContributions: number;
  costTransferDuty: number;
  costTotal: number;
};

const DEFINITIONS = [
  { key: "costLand", label: "Land", tone: "land" },
  { key: "costBuild", label: "Build", tone: "build" },
  { key: "costProfessionalFees", label: "Professional fees", tone: "fees" },
  { key: "costBulkContributions", label: "Bulk contributions", tone: "bulk" },
  { key: "costTransferDuty", label: "Transfer duty", tone: "duty" },
] as const;

export function buildCostBreakdownRows(costs: CostBreakdown) {
  const total = Number.isFinite(costs.costTotal) && costs.costTotal > 0 ? costs.costTotal : 0;

  return DEFINITIONS.map(({ key, label, tone }) => {
    const inputValue = costs[key];
    const value = Number.isFinite(inputValue) && inputValue >= 0 ? inputValue : 0;
    const rawPercentage = total > 0 ? (value / total) * 100 : 0;
    const percentage = Math.min(100, Math.max(0, rawPercentage));
    return { label, tone, value, formattedValue: formatZar(value), percentage };
  });
}

export function CostBreakdownBars({ costs }: { costs: CostBreakdown }) {
  return (
    <div className="cost-breakdown-list">
      {buildCostBreakdownRows(costs).map((row) => (
        <div className="cost-breakdown-row" key={row.label}>
          <div className="cost-breakdown-label">
            <span>{row.label}</span>
            <strong>{row.formattedValue}</strong>
          </div>
          <div
            className="cost-bar-track"
            role="progressbar"
            aria-label={`${row.label}: ${row.formattedValue}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={row.percentage}
          >
            <span className={`cost-bar-fill cost-bar-${row.tone}`} style={{ width: `${row.percentage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
