import Link from "next/link";

export default function SettingsPage() {
  const items = [
    {
      label: "Tariffs",
      desc: "Build rates, unit sizes, market rents, bulk contributions, SARS transfer-duty brackets and professional fees. Updated annually without a code deploy.",
      href: "/settings/tariffs",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto p-8 flex flex-col gap-6">
      <div>
        <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-2">Settings</p>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Configuration</h1>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="bg-bg-surface border border-border rounded-card p-5 hover:border-accent-blue transition-colors"
          >
            <div className="text-text-primary font-mono text-sm font-semibold">{it.label}</div>
            <div className="text-text-muted font-mono text-xs mt-1 leading-relaxed">{it.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
