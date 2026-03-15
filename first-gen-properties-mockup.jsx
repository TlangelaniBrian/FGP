import { useState } from "react";

const SCREENS = ["Dashboard", "Scout", "Parcel Detail", "Zoning + Forms", "Cost Oracle"];

const mockParcel = {
  erf: "ERF 1247",
  township: "Noordwyk Ext 19",
  size: 1024,
  municipality: "City of Johannesburg",
  zone: "Residential 3",
  zoneCode: "RES3",
  dolomite: "LOW",
  address: "14 Glenferness Ave, Midrand, 1685",
  price: 980000,
  pricePerSqm: 957,
  coords: { lat: -25.9989, lng: 28.1234 },
};

const zoningRules = {
  zone: "Residential 3",
  municipality: "City of Johannesburg",
  scheme: "JHB Land Use Scheme 2018",
  coverage: 60,
  far: 1.5,
  maxHeight: 3,
  maxStoreys: 3,
  buildingLineFront: 3,
  buildingLineSide: 2,
  buildingLineRear: 2,
  maxUnitsPerHa: 80,
  permittedUses: ["Flats", "Cluster Housing", "Place of Instruction (Consent)"],
  rezoningOptions: ["RES4"],
  rezoningDifficulty: "medium",
  derivedMaxUnits: 8,
  derivedMaxBuildable: 1536,
  derivedMaxFootprint: 614,
};

const forms = [
  {
    name: "Zoning Certificate Application",
    body: "City of Johannesburg",
    status: "ready",
    fields: ["ERF 1247", "Noordwyk Ext 19", "Residential 3", "1024 m²"],
    icon: "📋",
  },
  {
    name: "Building Plan Submission Checklist",
    body: "JHB Building Control",
    status: "ready",
    fields: ["FAR: 1.5", "Coverage: 60%", "Height: 3 storeys", "Dolomite Risk: LOW"],
    icon: "🏗️",
  },
  {
    name: "Motivation Letter – Res 3 Compliance",
    body: "Pre-filled template",
    status: "ready",
    fields: ["ERF 1247", "8 Bachelor Units", "R4.2M Build Cost", "14.2% Yield"],
    icon: "📝",
  },
  {
    name: "Dolomite Risk Declaration",
    body: "Council for Geoscience",
    status: "ready",
    fields: ["Risk Category: LOW", "CGS ENGEODE Ref", "No sinkhole incidents"],
    icon: "⚠️",
  },
];

const leads = [
  { erf: "ERF 1247", area: "Noordwyk, Midrand", size: 1024, price: 980000, zone: "RES3", dolomite: "LOW", yield: 14.2, score: 92 },
  { erf: "ERF 882", area: "Halfway House, Midrand", size: 800, price: 720000, zone: "RES2", dolomite: "LOW", yield: 11.8, score: 74 },
  { erf: "ERF 3301", area: "Centurion CBD", size: 1500, price: 1800000, zone: "RES4", dolomite: "HIGH", yield: 18.1, score: 61 },
  { erf: "ERF 219", area: "Karenpark, Pretoria", size: 600, price: 390000, zone: "RES1", dolomite: "LOW", yield: 9.4, score: 48 },
  { erf: "ERF 554", area: "Soshanguve Block X", size: 900, price: 510000, zone: "RES2", dolomite: "LOW", yield: 16.7, score: 88 },
];

const costData = {
  landCost: 980000,
  buildCost: 3456000,
  profFees: 414720,
  bulkContribs: 400000,
  transferDuty: 78400,
  total: 5329120,
  rentalPerUnit: 6800,
  units: 8,
  grossMonthly: 54400,
  grossAnnual: 652800,
  yield: 12.2,
  occupancy85: 11.2,
};

function DolomiteBadge({ risk }) {
  const colors = { LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#ef4444" };
  return (
    <span style={{
      background: colors[risk] + "20",
      color: colors[risk],
      border: `1px solid ${colors[risk]}40`,
      borderRadius: 4,
      padding: "2px 8px",
      fontSize: 11,
      fontFamily: "'DM Mono', monospace",
      fontWeight: 600,
      letterSpacing: 1,
    }}>
      {risk} RISK
    </span>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color, fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace"
      }}>
        {score}
      </div>
    </div>
  );
}

function MapPlaceholder({ label }) {
  return (
    <div style={{
      background: "#0f172a",
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
      height: "100%",
      minHeight: 200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* Grid lines */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={`${i * 10}%`} x2="100%" y2={`${i * 10}%`} stroke="#3b82f6" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v${i}`} x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="#3b82f6" strokeWidth="0.5" />
        ))}
      </svg>
      {/* Simulated parcel shapes */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.6 }}>
        <rect x="20%" y="30%" width="15%" height="20%" rx="2" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
        <rect x="37%" y="28%" width="12%" height="18%" rx="2" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
        <rect x="51%" y="32%" width="18%" height="22%" rx="2" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
        <rect x="20%" y="52%" width="25%" height="18%" rx="2" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
        {/* Highlighted parcel */}
        <rect x="37%" y="48%" width="14%" height="20%" rx="2" fill="#1d4ed840" stroke="#3b82f6" strokeWidth="2" />
        {/* Dolomite overlay zone */}
        <ellipse cx="70%" cy="55%" rx="12%" ry="10%" fill="#ef444420" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3" />
      </svg>
      {/* Pin */}
      <div style={{ zIndex: 2, textAlign: "center" }}>
        <div style={{ fontSize: 28 }}>📍</div>
        <div style={{ color: "#3b82f6", fontSize: 12, fontFamily: "'DM Mono', monospace", background: "#00000080", padding: "3px 8px", borderRadius: 4 }}>
          {label}
        </div>
      </div>
      {/* Legend */}
      <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { color: "#3b82f6", label: "Parcel boundary" },
          { color: "#ef4444", label: "Dolomite zone" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color + "40", border: `1px solid ${l.color}` }} />
            {l.label}
          </div>
        ))}
      </div>
      {/* MapLibre watermark sim */}
      <div style={{ position: "absolute", bottom: 8, left: 12, fontSize: 9, color: "#475569", fontFamily: "monospace" }}>
        © MapLibre · © OpenStreetMap
      </div>
    </div>
  );
}

function Dashboard({ onNavigate }) {
  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[
          { label: "Leads Tracked", value: "47", delta: "+12 this week", color: "#3b82f6" },
          { label: "Viable Parcels", value: "18", delta: "Score ≥ 70", color: "#22c55e" },
          { label: "Avg Yield", value: "13.4%", delta: "Across portfolio", color: "#a855f7" },
          { label: "Forms Ready", value: "11", delta: "Pre-filled", color: "#f59e0b" },
        ].map(k => (
          <div key={k.label} style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 12,
            padding: "20px 22px",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: k.color, opacity: 0.7 }} />
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: 0.8, marginBottom: 8 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize: 32, fontFamily: "'Playfair Display', serif", color: "#f1f5f9", fontWeight: 700, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Recent leads + map */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, height: 360 }}>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: 0.8 }}>RECENT LEADS</span>
            <button onClick={() => onNavigate("Scout")} style={{ background: "#3b82f620", border: "1px solid #3b82f640", color: "#3b82f6", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
              VIEW ALL →
            </button>
          </div>
          <div style={{ overflow: "auto", flex: 1 }}>
            {leads.map((lead, i) => (
              <div key={i} onClick={() => onNavigate("Parcel Detail")} style={{
                padding: "12px 20px",
                borderBottom: "1px solid #0d1929",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div>
                  <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{lead.erf}</div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{lead.area} · {lead.size}m²</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <DolomiteBadge risk={lead.dolomite} />
                  <div style={{ color: "#22c55e", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700 }}>{lead.yield}%</div>
                  <ScoreBadge score={lead.score} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b" }}>
          <MapPlaceholder label="Gauteng Coverage" />
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { icon: "🔍", label: "Run Scout", desc: "Pull new listings from Property24", screen: "Scout" },
          { icon: "📄", label: "Generate Forms", desc: "Pre-fill compliance package", screen: "Zoning + Forms" },
          { icon: "💰", label: "Cost Oracle", desc: "Run full ROI analysis", screen: "Cost Oracle" },
        ].map(a => (
          <button key={a.label} onClick={() => onNavigate(a.screen)} style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 12,
            padding: "18px 20px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 14,
            textAlign: "left",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#3b82f640"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}
          >
            <div style={{ fontSize: 28 }}>{a.icon}</div>
            <div>
              <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{a.label}</div>
              <div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>{a.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Scout({ onNavigate }) {
  const [filter, setFilter] = useState("all");
  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ flex: 1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#64748b" }}>🔍</span>
          <span style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Search Midrand, Pretoria... filter by zone, size, price</span>
        </div>
        <button style={{ background: "#3b82f6", border: "none", borderRadius: 10, padding: "12px 22px", color: "white", fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
          SCRAPE NOW
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8 }}>
        {["all", "RES2", "RES3", "RES4", "LOW dolomite", "Score ≥80"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? "#3b82f620" : "transparent",
            border: `1px solid ${filter === f ? "#3b82f6" : "#1e293b"}`,
            color: filter === f ? "#3b82f6" : "#64748b",
            borderRadius: 20,
            padding: "5px 14px",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
          }}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Grid + map */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, minHeight: 420 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {leads.map((lead, i) => (
            <div key={i} onClick={() => onNavigate("Parcel Detail")} style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 10,
              padding: "16px 20px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f660"; e.currentTarget.style.background = "#111827"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.background = "#0f172a"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700 }}>{lead.erf} · {lead.area}</div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{lead.size}m² · R{(lead.price / 1000).toFixed(0)}k · R{lead.price / lead.size}/m²</div>
                </div>
                <ScoreBadge score={lead.score} />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ background: "#1e293b", borderRadius: 4, padding: "3px 8px", fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{lead.zone}</span>
                <DolomiteBadge risk={lead.dolomite} />
                <span style={{ marginLeft: "auto", color: "#22c55e", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700 }}>{lead.yield}% yield</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b", height: "100%" }}>
          <MapPlaceholder label="Midrand / Pretoria Leads" />
        </div>
      </div>
    </div>
  );
}

function ParcelDetail({ onNavigate }) {
  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 6 }}>PARCEL PROFILE</div>
          <h2 style={{ color: "#f1f5f9", fontFamily: "'Playfair Display', serif", fontSize: 26, margin: 0 }}>{mockParcel.erf}, {mockParcel.township}</h2>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{mockParcel.address}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <DolomiteBadge risk={mockParcel.dolomite} />
          <button onClick={() => onNavigate("Zoning + Forms")} style={{ background: "#3b82f6", border: "none", borderRadius: 8, padding: "10px 20px", color: "white", fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
            VIEW FORMS →
          </button>
          <button onClick={() => onNavigate("Cost Oracle")} style={{ background: "#22c55e20", border: "1px solid #22c55e40", borderRadius: 8, padding: "10px 20px", color: "#22c55e", fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
            COST ORACLE →
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        {/* Left col */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Parcel facts */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 14 }}>PARCEL FACTS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "ERF Size", value: `${mockParcel.size} m²` },
                { label: "Price", value: `R${(mockParcel.price / 1000).toFixed(0)}k` },
                { label: "Price/m²", value: `R${mockParcel.pricePerSqm}` },
                { label: "Municipality", value: mockParcel.municipality },
                { label: "Zone", value: mockParcel.zone },
                { label: "Dolomite", value: mockParcel.dolomite + " RISK" },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace", letterSpacing: 0.8 }}>{f.label.toUpperCase()}</div>
                  <div style={{ fontSize: 14, color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontWeight: 600, marginTop: 3 }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Zoning rules summary */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 14 }}>ZONING RULES · {zoningRules.zone}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
              {[
                { label: "Coverage", value: `${zoningRules.coverage}%` },
                { label: "FAR", value: zoningRules.far },
                { label: "Max Storeys", value: zoningRules.maxStoreys },
                { label: "Front Line", value: `${zoningRules.buildingLineFront}m` },
                { label: "Side Line", value: `${zoningRules.buildingLineSide}m` },
                { label: "Rear Line", value: `${zoningRules.buildingLineRear}m` },
              ].map(f => (
                <div key={f.label} style={{ background: "#0d1929", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, color: "#475569", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>{f.label.toUpperCase()}</div>
                  <div style={{ fontSize: 18, color: "#3b82f6", fontFamily: "'DM Mono', monospace", fontWeight: 700, marginTop: 4 }}>{f.value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 12px", background: "#0d2818", border: "1px solid #16a34a30", borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 6 }}>DERIVED POTENTIAL</div>
              <div style={{ display: "flex", gap: 20 }}>
                <div>
                  <div style={{ color: "#22c55e", fontSize: 20, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{zoningRules.derivedMaxUnits}</div>
                  <div style={{ color: "#64748b", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>MAX UNITS</div>
                </div>
                <div>
                  <div style={{ color: "#22c55e", fontSize: 20, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{zoningRules.derivedMaxBuildable}m²</div>
                  <div style={{ color: "#64748b", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>MAX BUILDABLE</div>
                </div>
                <div>
                  <div style={{ color: "#22c55e", fontSize: 20, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{zoningRules.derivedMaxFootprint}m²</div>
                  <div style={{ color: "#64748b", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>MAX FOOTPRINT</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right col: map + unit toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ flex: 1, borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b", minHeight: 200 }}>
            <MapPlaceholder label="ERF 1247 · Noordwyk" />
          </div>
          {/* Unit type selector */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 12 }}>PARAMETRIC UNIT TOGGLE</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { type: "Bachelor", units: 8, sqm: 35, rental: 6800 },
                { type: "1-Bed", units: 6, sqm: 55, rental: 9200 },
                { type: "2-Bed", units: 4, sqm: 85, rental: 13500 },
              ].map((u, i) => (
                <button key={u.type} style={{
                  flex: 1,
                  background: i === 0 ? "#3b82f620" : "#0d1929",
                  border: `1px solid ${i === 0 ? "#3b82f6" : "#1e293b"}`,
                  borderRadius: 8,
                  padding: "10px",
                  cursor: "pointer",
                  textAlign: "center",
                }}>
                  <div style={{ color: i === 0 ? "#3b82f6" : "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700 }}>{u.units}x</div>
                  <div style={{ color: i === 0 ? "#f1f5f9" : "#64748b", fontFamily: "'DM Mono', monospace", fontSize: 11, marginTop: 2 }}>{u.type}</div>
                  <div style={{ color: "#475569", fontSize: 10, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{u.sqm}m² · R{(u.rental / 1000).toFixed(1)}k/mo</div>
                </button>
              ))}
            </div>
            {/* 3D massing preview */}
            <div style={{ background: "#060f1e", borderRadius: 8, height: 90, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
              <svg viewBox="0 0 200 80" style={{ width: "100%", height: "100%" }}>
                {/* Ground plane */}
                <ellipse cx="100" cy="65" rx="80" ry="12" fill="#1e293b" />
                {/* Building blocks */}
                {[0,1,2,3].map(i => (
                  <g key={i} transform={`translate(${30 + i * 38}, 0)`}>
                    <rect x="0" y="25" width="30" height="38" fill="#1d4ed8" opacity="0.8" />
                    <rect x="0" y="23" width="30" height="5" fill="#3b82f6" opacity="0.9" />
                    <rect x="30" y="26" width="6" height="37" fill="#1e40af" opacity="0.7" />
                    <rect x="0" y="23" width="30" height="2" fill="#60a5fa" opacity="0.6" />
                  </g>
                ))}
                {/* Shadow */}
                <ellipse cx="100" cy="65" rx="75" ry="8" fill="#000" opacity="0.3" />
              </svg>
              <div style={{ position: "absolute", bottom: 6, right: 10, fontSize: 9, color: "#3b82f6", fontFamily: "'DM Mono', monospace" }}>3D MASSING · THREE.JS</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoningForms({ onNavigate }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 6 }}>COMPLIANCE PACKAGE</div>
          <h2 style={{ color: "#f1f5f9", fontFamily: "'Playfair Display', serif", fontSize: 24, margin: 0 }}>Zoning & Required Forms</h2>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>ERF 1247, Noordwyk · City of Johannesburg · Res 3</div>
        </div>
        <button style={{ background: "#f59e0b", border: "none", borderRadius: 8, padding: "10px 22px", color: "#000", fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
          ↓ EXPORT ALL PDFs
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        {/* Forms list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 2 }}>AUTO-POPULATED FORMS ({forms.length})</div>
          {forms.map((form, i) => (
            <div key={i} style={{
              background: "#0f172a",
              border: `1px solid ${expanded === i ? "#3b82f6" : "#1e293b"}`,
              borderRadius: 12,
              overflow: "hidden",
            }}>
              <div
                onClick={() => setExpanded(expanded === i ? null : i)}
                style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
              >
                <div style={{ fontSize: 22 }}>{form.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{form.name}</div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{form.body}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#22c55e20", color: "#22c55e", border: "1px solid #22c55e40", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>
                    READY
                  </span>
                  <span style={{ color: "#64748b" }}>{expanded === i ? "▲" : "▼"}</span>
                </div>
              </div>
              {expanded === i && (
                <div style={{ padding: "0 20px 16px 20px", borderTop: "1px solid #1e293b" }}>
                  <div style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 8, marginTop: 12 }}>PRE-FILLED FIELDS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {form.fields.map(f => (
                      <span key={f} style={{ background: "#1e293b", borderRadius: 4, padding: "4px 10px", fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
                        {f}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button style={{ background: "#3b82f620", border: "1px solid #3b82f640", color: "#3b82f6", borderRadius: 6, padding: "7px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
                      PREVIEW PDF
                    </button>
                    <button style={{ background: "#f59e0b20", border: "1px solid #f59e0b40", color: "#f59e0b", borderRadius: 6, padding: "7px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
                      DOWNLOAD
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Compliance checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 14 }}>COMPLIANCE CHECKLIST</div>
            {[
              { step: "Obtain Zoning Certificate", done: true, time: "5-10 days" },
              { step: "Dolomite Stability Report", done: true, time: "CGS verified" },
              { step: "Pre-application Consult", done: false, time: "Book with JHB" },
              { step: "Submit Building Plans", done: false, time: "After consent" },
              { step: "Eng. Services Impact Check", done: false, time: "30-60 days" },
              { step: "Final HOA Consent", done: false, time: "If applicable" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: i < 5 ? "1px solid #0d1929" : "none" }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4, marginTop: 1,
                  background: item.done ? "#22c55e" : "transparent",
                  border: `2px solid ${item.done ? "#22c55e" : "#334155"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {item.done && <span style={{ color: "white", fontSize: 11 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: item.done ? "#94a3b8" : "#f1f5f9", fontSize: 12, fontFamily: "'DM Mono', monospace", textDecoration: item.done ? "line-through" : "none" }}>
                    {item.step}
                  </div>
                  <div style={{ color: "#475569", fontSize: 10, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{item.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Rezoning opportunity */}
          <div style={{ background: "#0d1929", border: "1px solid #3b82f630", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, color: "#3b82f6", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 10 }}>REZONING OPPORTUNITY</div>
            <div style={{ color: "#f1f5f9", fontSize: 13, fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>RES3 → RES4 possible</div>
            <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>
              Rezoning to Res 4 (up to 41-120 units/ha) would unlock up to 12 units on this erf. Difficulty rated MEDIUM — similar applications in Noordwyk have a 68% approval rate.
            </div>
            <button style={{ marginTop: 12, background: "#3b82f620", border: "1px solid #3b82f640", color: "#3b82f6", borderRadius: 6, padding: "8px 16px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
              GENERATE REZONING APPLICATION →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CostOracle({ onNavigate }) {
  const fmt = (n) => `R${n.toLocaleString()}`;
  const bars = [
    { label: "Land", value: costData.landCost, color: "#3b82f6" },
    { label: "Build", value: costData.buildCost, color: "#a855f7" },
    { label: "Prof. Fees", value: costData.profFees, color: "#f59e0b" },
    { label: "Bulk Levy", value: costData.bulkContribs, color: "#ef4444" },
    { label: "Transfer", value: costData.transferDuty, color: "#64748b" },
  ];
  const maxVal = Math.max(...bars.map(b => b.value));

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 6 }}>COST ORACLE · ROI ANALYSIS</div>
          <h2 style={{ color: "#f1f5f9", fontFamily: "'Playfair Display', serif", fontSize: 24, margin: 0 }}>ERF 1247 · 8 Bachelor Units</h2>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>Build rate: R13,500/m² · 2026 Gauteng tariffs</div>
        </div>
        <button style={{ background: "#f59e0b", border: "none", borderRadius: 8, padding: "10px 22px", color: "#000", fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
          ↓ EXPORT PDF REPORT
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Investment", value: fmt(costData.total), color: "#3b82f6", sub: "All-in cost" },
          { label: "Gross Annual Income", value: fmt(costData.grossAnnual), color: "#22c55e", sub: "100% occupied" },
          { label: "Yield @ 100%", value: `${costData.yield}%`, color: "#22c55e", sub: "Before expenses" },
          { label: "Yield @ 85%", value: `${costData.occupancy85}%`, color: "#f59e0b", sub: "Realistic occupancy" },
        ].map(k => (
          <div key={k.label} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: k.color }} />
            <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 8 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize: 24, fontFamily: "'Playfair Display', serif", color: k.color, fontWeight: 700 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Cost breakdown */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 16 }}>COST BREAKDOWN</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {bars.map(b => (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{b.label}</span>
                  <span style={{ fontSize: 12, color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{fmt(b.value)}</span>
                </div>
                <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(b.value / maxVal) * 100}%`, background: b.color, borderRadius: 3, transition: "width 0.5s" }} />
                </div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>TOTAL</span>
              <span style={{ fontSize: 13, color: "#3b82f6", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{fmt(costData.total)}</span>
            </div>
          </div>
        </div>

        {/* Income + sensitivity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 14 }}>INCOME PROJECTION</div>
            {[
              { label: "Rent per unit", value: `R${costData.rentalPerUnit.toLocaleString()}/mo` },
              { label: "Units", value: costData.units },
              { label: "Gross monthly", value: fmt(costData.grossMonthly) },
              { label: "Gross annual", value: fmt(costData.grossAnnual) },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #0d1929" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>{r.label}</span>
                <span style={{ fontSize: 12, color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{r.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "#0d2818", border: "1px solid #16a34a30", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, color: "#22c55e", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 12 }}>DECISION ENGINE</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 42, fontFamily: "'Playfair Display', serif", color: "#22c55e", fontWeight: 700 }}>✓</div>
              <div>
                <div style={{ color: "#f1f5f9", fontSize: 14, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>VIABLE INVESTMENT</div>
                <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Score: 92/100 · LOW risk</div>
              </div>
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.7 }}>
              12.2% yield exceeds the 10% threshold. Low dolomite risk. 8 bachelor units viable under Res 3 without rezoning. Bulk levies estimated at R400k — confirm with JHB.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button style={{ flex: 1, background: "#22c55e", border: "none", borderRadius: 8, padding: "10px", color: "#000", fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                MARK ACTIVE PROJECT
              </button>
              <button onClick={() => onNavigate("Zoning + Forms")} style={{ background: "#ffffff10", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 14px", color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: "pointer" }}>
                FORMS →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState("Dashboard");

  const screens = {
    Dashboard: <Dashboard onNavigate={setActiveScreen} />,
    Scout: <Scout onNavigate={setActiveScreen} />,
    "Parcel Detail": <ParcelDetail onNavigate={setActiveScreen} />,
    "Zoning + Forms": <ZoningForms onNavigate={setActiveScreen} />,
    "Cost Oracle": <CostOracle onNavigate={setActiveScreen} />,
  };

  return (
    <div style={{
      fontFamily: "system-ui, sans-serif",
      background: "#070d1a",
      minHeight: "100vh",
      color: "#f1f5f9",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Topbar */}
      <div style={{
        background: "#0a1120",
        borderBottom: "1px solid #1e293b",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        gap: 40,
        height: 58,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
            🏗
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: "#f1f5f9", fontWeight: 700, lineHeight: 1 }}>First Generation</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#64748b", letterSpacing: 1.5 }}>PROPERTIES</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 4, flex: 1 }}>
          {SCREENS.map(screen => (
            <button
              key={screen}
              onClick={() => setActiveScreen(screen)}
              style={{
                background: activeScreen === screen ? "#1e293b" : "transparent",
                border: "none",
                color: activeScreen === screen ? "#f1f5f9" : "#64748b",
                borderRadius: 8,
                padding: "7px 14px",
                fontFamily: "'DM Mono', monospace",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: activeScreen === screen ? 700 : 400,
                letterSpacing: 0.5,
              }}
            >
              {screen.toUpperCase()}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
            TM
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#64748b" }}>T. Mkhabela</div>
        </div>
      </div>

      {/* Screen content */}
      <div style={{ minHeight: "calc(100vh - 58px)" }}>
        {screens[activeScreen]}
      </div>
    </div>
  );
}
