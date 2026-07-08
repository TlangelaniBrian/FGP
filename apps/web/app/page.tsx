import Link from "next/link";

export default function Home() {
  const features = [
    { label: "Evaluate Land", desc: "Cost + yield feasibility in seconds", href: "/evaluate", cta: "Run analysis" },
    { label: "Scout", desc: "Map a coordinate to zoning, dolomite & amenity scores", href: "/scout", cta: "Open scout" },
    { label: "Tariffs", desc: "Build rates, BSC & transfer duty — editable", href: "/settings/tariffs", cta: "Manage tariffs" },
  ];

  return (
    <div className="p-8 flex flex-col gap-8">
      <div>
        <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-2">
          Dashboard
        </p>
        <h1 className="font-heading text-3xl font-bold text-text-primary">
          First Generation Properties
        </h1>
        <p className="text-text-muted font-mono text-sm mt-1">
          Property development feasibility platform · Gauteng, South Africa
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {features.map((f) => (
          <Link
            key={f.label}
            href={f.href}
            className="bg-bg-surface border border-border rounded-card p-5 flex flex-col gap-2 hover:border-accent-blue transition-colors"
          >
            <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase">
              {f.label}
            </div>
            <div className="text-text-primary font-mono text-sm leading-snug flex-1">
              {f.desc}
            </div>
            <div className="text-accent-blue font-mono text-xs font-semibold mt-1">
              {f.cta} →
            </div>
          </Link>
        ))}
      </div>

      <p className="text-text-muted font-mono text-xs">
        Phase 1 (feasibility + projects) live · Phase 2 (spatial intelligence) in progress
      </p>
    </div>
  );
}
