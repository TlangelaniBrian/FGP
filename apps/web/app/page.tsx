export default function Home() {
  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-2">
          System Status
        </p>
        <h1 className="font-heading text-3xl font-bold text-text-primary">
          First Generation Properties
        </h1>
        <p className="text-text-muted font-mono text-sm mt-1">
          Property development feasibility platform · Gauteng, South Africa
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Web App", status: "running", port: ":3000" },
          { label: "Worker API", status: "check manually", port: ":8000" },
          { label: "PostGIS", status: "check manually", port: ":5432" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-bg-surface border border-border rounded-card p-5"
          >
            <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-2">
              {s.label}
            </div>
            <div className="text-accent-green font-mono text-sm font-semibold">
              {s.status}
            </div>
            <div className="text-text-dim font-mono text-xs mt-1">
              {s.port}
            </div>
          </div>
        ))}
      </div>

      <p className="text-text-muted font-mono text-xs">
        Phase 0 scaffold · No features implemented yet
      </p>
    </div>
  );
}
