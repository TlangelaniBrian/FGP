import { formatZar } from "@/lib/format";

type BudgetItem = {
  id: number;
  category: string;
  item: string;
  unit: string | null;
  quantity: string | null;
  unitCost: string | null;
  totalCost: string | null;
  actualCost: string | null;
  status: string;
};

export function BudgetTable({ items }: { items: BudgetItem[] }) {
  const categories = [...new Set(items.map(i => i.category))];
  const total = items.reduce((s, i) => s + Number(i.totalCost ?? 0), 0);

  return (
    <div className="bg-bg-surface border border-border rounded-card p-5">
      <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-4">Budget</p>
      {categories.map(cat => {
        const rows = items.filter(i => i.category === cat);
        const catTotal = rows.reduce((s, i) => s + Number(i.totalCost ?? 0), 0);
        return (
          <div key={cat} className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <p className="text-[9px] font-mono text-text-dim tracking-widest uppercase">{cat}</p>
              <p className="text-[10px] font-mono text-text-muted">{formatZar(catTotal)}</p>
            </div>
            {rows.map(row => (
              <div key={row.id} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                <div className="flex gap-3">
                  <span className="font-mono text-xs text-text-primary w-36 truncate">{row.item}</span>
                  <span className="font-mono text-xs text-text-muted">
                    {row.quantity ? `${row.quantity} ${row.unit ?? ""}` : row.unit ?? ""}
                  </span>
                </div>
                <div className="flex gap-4 items-center">
                  <span className="font-mono text-xs text-text-muted w-24 text-right">{row.totalCost ? formatZar(Number(row.totalCost)) : "—"}</span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    row.status === "paid" ? "bg-accent-green/10 text-accent-green"
                    : row.status === "quoted" ? "bg-accent-blue/10 text-accent-blue"
                    : "text-text-dim"
                  }`}>
                    {row.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <div className="border-t border-border pt-3 flex justify-between">
        <span className="font-mono text-sm font-bold text-text-muted">Total</span>
        <span className="font-mono text-sm font-bold text-text-primary">{formatZar(total)}</span>
      </div>
    </div>
  );
}
