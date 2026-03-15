# CLAUDE.md — First Generation Properties (v2.0)
## Claude Code Project Specification

---

## 0. PRIME DIRECTIVE

You are building **First Generation Properties** — a vertical SaaS platform that
automates property development feasibility for the Gauteng property market
(South Africa). Every feature must serve one goal: take a raw land listing and
produce a go/no-go investment decision with supporting compliance documents in
under 10 seconds.

When in doubt, optimise for **data accuracy**, **spatial precision**, and
**form completeness** — in that order.

---

## 1. PROJECT OVERVIEW

| Item | Value |
|---|---|
| Product | First Generation Properties |
| Version | 2.0 |
| Primary Market | Gauteng, South Africa (Midrand + Pretoria pilot, full province scope) |
| Target Year | 2026 |
| Stack Philosophy | 100% open source |
| Owner | Tlangelani Mkhabela |

---

## 2. MONOREPO STRUCTURE

```
first-gen-properties/
├── apps/
│   ├── web/                    # Next.js 14 (App Router) — main dashboard
│   └── worker/                 # Python FastAPI — geo processing + scrapers
├── packages/
│   ├── database/               # Drizzle ORM schema + migrations
│   ├── geo/                    # PostGIS query helpers (shared types)
│   ├── forms/                  # PDF template engine (WeasyPrint/Jinja2)
│   └── ui/                     # Shared React component library
├── infra/
│   ├── docker-compose.yml      # Local dev (PostGIS + Redis + worker)
│   └── terraform/              # AWS deployment config
├── scripts/
│   ├── seed/                   # GIS data ingestion scripts
│   └── scrapers/               # Playwright scraper configs per site
├── CLAUDE.md                   # This file
└── .env.example
```

---

## 3. TECHNOLOGY STACK

### Frontend — `apps/web`
```
Framework:     Next.js 14 (App Router, TypeScript)
Styling:       Tailwind CSS (utility only, no component libs)
UI Components: Custom (see packages/ui — match the dark fintech aesthetic from mockups)
Maps:          MapLibre GL JS (custom dark style, no Mapbox dependency)
3D Engine:     Three.js r160 (massing/volume studies)
State:         Zustand (client) + TanStack Query (server state)
Forms:         React Hook Form + Zod
Auth:          Supabase Auth (JWT, row-level security)
PDF Client:    react-pdf (render previews in browser)
Fonts:         Playfair Display (headings) + DM Mono (data/labels)
```

### Backend — `apps/worker`
```
Framework:     FastAPI (Python 3.12)
Geo Engine:    PostGIS via psycopg3 + shapely + geopandas
Scrapers:      Playwright (async, rotating user-agents)
Task Queue:    Celery + Redis (async scrape jobs)
PDF Generator: WeasyPrint + Jinja2 (form population)
HTTP Client:   httpx (async)
Caching:       Redis (geo query results, 24h TTL)
```

### Database — Supabase (hosted PostGIS)
```
Engine:        PostgreSQL 15 + PostGIS 3.4
ORM:           Drizzle (TypeScript, for web) + psycopg3 (Python, for worker)
Hosting:       Supabase (free tier for dev, Pro for production)
Backups:       Supabase automated + daily pg_dump to S3
```

### Infrastructure
```
Hosting:       Vercel (web app) + AWS ECS Fargate (Python worker)
CDN:           Cloudfront (for generated PDFs stored in S3)
Object Store:  AWS S3 (generated PDFs, GIS data backups)
CI/CD:         GitHub Actions
Local Dev:     Docker Compose (PostGIS + Redis + worker)
Package Mgr:   pnpm (Node) + uv (Python)
```

---

## 4. DATABASE SCHEMA

### Core Tables

```sql
-- =============================================
-- SPATIAL LAYERS (populated from open data)
-- =============================================

-- Erf/parcel boundaries from Chief Surveyor General (CSG)
CREATE TABLE parcels (
  id              BIGSERIAL PRIMARY KEY,
  erf_number      TEXT NOT NULL,
  township        TEXT,
  province        TEXT DEFAULT 'Gauteng',
  municipality    TEXT, -- 'johannesburg' | 'tshwane' | 'ekurhuleni'
  size_sqm        NUMERIC,
  boundary        GEOGRAPHY(POLYGON, 4326) NOT NULL,
  centroid        GEOGRAPHY(POINT, 4326),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX parcels_boundary_idx ON parcels USING GIST(boundary);
CREATE INDEX parcels_centroid_idx ON parcels USING GIST(centroid);

-- Zoning designations from municipal GIS portals
CREATE TABLE zoning_designations (
  id              BIGSERIAL PRIMARY KEY,
  municipality    TEXT NOT NULL,
  zone_code       TEXT NOT NULL, -- 'RES1' | 'RES2' | 'RES3' | 'RES4' | 'COM1' etc
  zone_label      TEXT,
  geometry        GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  scheme_year     INTEGER, -- e.g. 2018
  source_url      TEXT,
  last_updated    DATE
);
CREATE INDEX zoning_geometry_idx ON zoning_designations USING GIST(geometry);

-- Scheme rules lookup — ONE-TIME DATA CAPTURE, HIGH VALUE
CREATE TABLE zoning_scheme_rules (
  id                      SERIAL PRIMARY KEY,
  municipality            TEXT NOT NULL,
  zone_code               TEXT NOT NULL,
  zone_label              TEXT,
  -- Density
  max_units_per_ha        INTEGER,
  max_units_per_erf       INTEGER,
  -- Building envelope
  coverage_pct            NUMERIC, -- 40 = 40% of erf
  far                     NUMERIC, -- Floor Area Ratio
  max_height_m            NUMERIC,
  max_storeys             INTEGER,
  -- Setbacks (metres)
  building_line_front_m   NUMERIC,
  building_line_side_m    NUMERIC,
  building_line_rear_m    NUMERIC,
  -- Uses
  permitted_uses          TEXT[],
  consent_uses            TEXT[],
  -- Rezoning
  rezoning_possible_to    TEXT[],
  rezoning_difficulty     TEXT CHECK (rezoning_difficulty IN ('low', 'medium', 'high')),
  rezoning_approval_rate  NUMERIC, -- historical %, if known
  -- Required forms
  forms_required          TEXT[],
  -- Reference
  scheme_document         TEXT,
  scheme_year             INTEGER,
  last_updated            DATE,
  UNIQUE(municipality, zone_code)
);

-- Dolomite risk layer from Council for Geoscience (CGS)
CREATE TABLE dolomite_zones (
  id              BIGSERIAL PRIMARY KEY,
  risk_class      TEXT NOT NULL CHECK (risk_class IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7')),
  geometry        GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  cgs_reference   TEXT,
  notes           TEXT
);
CREATE INDEX dolomite_geometry_idx ON dolomite_zones USING GIST(geometry);

-- GCRO land use hexagons
CREATE TABLE land_use_hexagons (
  id              BIGSERIAL PRIMARY KEY,
  h3_index        TEXT UNIQUE, -- H3 index at resolution 8
  land_use_class  TEXT,
  pop_2026_est    INTEGER,
  socioeco_risk   NUMERIC,
  new_dev_flag    BOOLEAN DEFAULT FALSE,
  geometry        GEOGRAPHY(POLYGON, 4326),
  year            INTEGER
);

-- Amenity points (schools, malls, transport, hospitals)
CREATE TABLE amenities (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL, -- 'school' | 'mall' | 'hospital' | 'taxi_rank' | 'highway_on_ramp'
  subtype         TEXT, -- 'private_school' | 'government_school' | 'regional_mall'
  geometry        GEOGRAPHY(POINT, 4326) NOT NULL,
  source          TEXT -- 'osm' | 'dbe' | 'manual'
);
CREATE INDEX amenities_geometry_idx ON amenities USING GIST(geometry);

-- =============================================
-- LISTINGS (from scrapers + manual import)
-- =============================================

CREATE TABLE listings (
  id              BIGSERIAL PRIMARY KEY,
  -- Source metadata
  source          TEXT NOT NULL, -- 'property24' | 'private_property' | 'propdata' | 'gumtree' | 'manual' | 'immo_africa'
  source_id       TEXT, -- original listing ID on source platform
  source_url      TEXT,
  scraped_at      TIMESTAMPTZ,
  -- Location
  address         TEXT,
  suburb          TEXT,
  city            TEXT,
  municipality    TEXT,
  coordinates     GEOGRAPHY(POINT, 4326),
  -- Property details
  size_sqm        NUMERIC,
  price           NUMERIC,
  price_per_sqm   NUMERIC GENERATED ALWAYS AS (
    CASE WHEN size_sqm > 0 THEN price / size_sqm ELSE NULL END
  ) STORED,
  listing_type    TEXT DEFAULT 'vacant_land', -- 'vacant_land' | 'distressed' | 'agricultural'
  description     TEXT,
  -- Matched spatial data (populated by worker after scrape)
  parcel_id       BIGINT REFERENCES parcels(id),
  zone_code       TEXT,
  dolomite_risk   TEXT,
  -- Status
  status          TEXT DEFAULT 'new' CHECK (status IN ('new', 'analyzing', 'analyzed', 'active_project', 'dismissed', 'sold')),
  feasibility_score INTEGER CHECK (feasibility_score BETWEEN 0 AND 100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FEASIBILITY ANALYSIS RESULTS
-- =============================================

CREATE TABLE feasibility_reports (
  id                    BIGSERIAL PRIMARY KEY,
  listing_id            BIGINT REFERENCES listings(id) NOT NULL,
  user_id               UUID REFERENCES auth.users(id),
  -- Inputs used
  unit_type             TEXT NOT NULL, -- 'bachelor' | '1bed' | '2bed'
  target_units          INTEGER NOT NULL,
  build_rate_per_sqm    NUMERIC NOT NULL DEFAULT 13500,
  tariff_year           INTEGER NOT NULL DEFAULT 2026,
  -- Spatial results
  max_units_allowed     INTEGER,
  max_buildable_sqm     NUMERIC,
  max_footprint_sqm     NUMERIC,
  rezoning_required     BOOLEAN DEFAULT FALSE,
  -- Cost breakdown (ZAR)
  cost_land             NUMERIC,
  cost_build            NUMERIC,
  cost_professional_fees NUMERIC,
  cost_bulk_contributions NUMERIC,
  cost_transfer_duty    NUMERIC,
  cost_total            NUMERIC,
  -- Income projection
  rent_per_unit_monthly NUMERIC,
  gross_monthly_income  NUMERIC,
  gross_annual_income   NUMERIC,
  -- Yields
  yield_gross_pct       NUMERIC,
  yield_at_85_occ_pct   NUMERIC,
  -- Decision
  viable                BOOLEAN,
  viability_notes       TEXT,
  -- Amenity scores
  score_schools         INTEGER,
  score_transport       INTEGER,
  score_amenities       INTEGER,
  -- Generated docs
  pdf_package_url       TEXT, -- S3 URL
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FORM TEMPLATES & GENERATED DOCUMENTS
-- =============================================

CREATE TABLE compliance_documents (
  id              BIGSERIAL PRIMARY KEY,
  report_id       BIGINT REFERENCES feasibility_reports(id),
  listing_id      BIGINT REFERENCES listings(id),
  doc_type        TEXT NOT NULL, -- 'zoning_certificate' | 'splum_form' | 'motivation_letter' | 'dolomite_declaration' | 'building_plan_checklist'
  municipality    TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'submitted', 'approved', 'rejected')),
  prefilled_data  JSONB, -- all auto-populated field values
  pdf_url         TEXT,
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROJECTS (active developments)
-- =============================================

CREATE TABLE projects (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id),
  listing_id      BIGINT REFERENCES listings(id),
  report_id       BIGINT REFERENCES feasibility_reports(id),
  name            TEXT,
  status          TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'compliance', 'approved', 'construction', 'complete', 'stalled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SCRAPER JOBS
-- =============================================

CREATE TABLE scrape_jobs (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  search_params   JSONB, -- {location, min_sqm, max_price, property_type}
  status          TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  listings_found  INTEGER DEFAULT 0,
  listings_new    INTEGER DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API ROUTES

### Next.js API Routes (`apps/web/app/api/`)

```
POST   /api/listings/import          # Manual CSV upload
GET    /api/listings                 # Paginated list with filters
GET    /api/listings/:id             # Single listing with spatial data
POST   /api/listings/:id/analyze     # Trigger feasibility analysis (calls worker)

GET    /api/parcels/search           # Search parcels by address/erf
GET    /api/parcels/:id              # Parcel detail + zoning + dolomite overlay

GET    /api/zoning/rules             # Get rules for zone+municipality combo
GET    /api/zoning/check             # POST lat/lng → returns zone designation

POST   /api/feasibility              # Run full ROI calculation
GET    /api/feasibility/:id          # Fetch saved report

GET    /api/documents/:reportId      # List compliance documents for report
POST   /api/documents/generate       # Generate PDF package for a report
GET    /api/documents/:id/download   # Download individual PDF

POST   /api/scrape/trigger           # Queue a new scrape job
GET    /api/scrape/jobs              # List scrape job history
GET    /api/scrape/jobs/:id          # Job status (for polling)

GET    /api/projects                 # User's active projects
POST   /api/projects                 # Create project from listing
PATCH  /api/projects/:id             # Update project status
```

### FastAPI Routes (`apps/worker/`)

```
POST   /analyze/parcel               # Spatial join: coordinates → zone + dolomite + amenities
POST   /analyze/feasibility          # Full cost + yield calculation
POST   /forms/generate               # WeasyPrint PDF generation for compliance docs
POST   /scrape/property24            # Playwright scraper — Property24
POST   /scrape/private_property      # Playwright scraper — Private Property
POST   /scrape/propdata              # PropData vacant land
POST   /scrape/gumtree               # Gumtree property
POST   /scrape/immo_africa           # Immo Africa
POST   /scrape/entegral              # Entegral/ooba listings
POST   /geo/import/dolomite          # Ingest CGS dolomite SHP into PostGIS
POST   /geo/import/zoning            # Ingest municipal zoning SHP into PostGIS
POST   /geo/import/parcels           # Ingest CSG parcel SHP into PostGIS
POST   /geo/import/gcro              # Ingest GCRO hexagon dataset
GET    /health
```

---

## 6. SCRAPER SPECIFICATIONS

Each scraper lives in `scripts/scrapers/` as an async Playwright class.

### Base Scraper Interface

```python
class BaseScraper:
    source_name: str
    base_url: str
    rate_limit_seconds: float = 2.0  # min delay between requests
    rotate_user_agents: bool = True
    
    async def search(self, params: SearchParams) -> list[RawListing]
    async def get_detail(self, url: str) -> RawListing
    async def run_job(self, job_id: int, params: SearchParams) -> ScrapeResult
```

### SearchParams

```python
@dataclass
class SearchParams:
    location: str           # e.g. "Midrand" or "Pretoria"
    radius_km: float = 20
    min_size_sqm: int = 300
    max_size_sqm: int = 5000
    min_price: int = 200_000
    max_price: int = 5_000_000
    listing_types: list[str] = ["vacant_land"]
    max_pages: int = 10
```

### Target Scraper Sites

| Scraper | URL | Focus | Notes |
|---|---|---|---|
| Property24 | property24.com | Vacant land, distressed | Primary source, anti-bot measures |
| Private Property | privateproperty.co.za | Vacant land | Less aggressive blocking |
| PropData | propdata.net | Commercial data | May require API key |
| Gumtree | gumtree.co.za | Cheap land, off-market | High noise, low signal |
| Immo Africa | immoafrica.net | SA-specific | Good Gauteng coverage |
| Entegral | entegral.net | Agent listings | Less known, less blocked |

### Anti-Detection Strategy

```python
# Implement in BaseScraper
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
    # ... 10+ agents
]
PROXY_CONFIG = {
    # Use environment variable SCRAPER_PROXY_URL if set
    # Otherwise run without proxy (acceptable for low-volume scraping)
}
# Random delay between requests: uniform(rate_limit, rate_limit * 2.5)
# Simulate scroll behaviour before extracting listings
# Clear cookies between sessions
```

---

## 7. GEO ANALYSIS ENGINE

### Core Spatial Query (FastAPI `/analyze/parcel`)

```python
async def analyze_parcel(lat: float, lng: float) -> ParcelAnalysis:
    point = f"ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)"
    
    # 1. Match parcel boundary
    parcel = await db.fetchrow(f"""
        SELECT erf_number, township, size_sqm, municipality,
               ST_AsGeoJSON(boundary) as boundary_geojson
        FROM parcels
        WHERE ST_Contains(boundary::geometry, {point}::geometry)
        LIMIT 1
    """)
    
    # 2. Get zoning designation
    zone = await db.fetchrow(f"""
        SELECT z.zone_code, z.zone_label, z.municipality,
               r.coverage_pct, r.far, r.max_storeys,
               r.building_line_front_m, r.building_line_side_m, r.building_line_rear_m,
               r.max_units_per_ha, r.max_units_per_erf,
               r.permitted_uses, r.consent_uses,
               r.rezoning_possible_to, r.rezoning_difficulty, r.rezoning_approval_rate,
               r.forms_required
        FROM zoning_designations z
        LEFT JOIN zoning_scheme_rules r ON r.municipality = z.municipality 
                                       AND r.zone_code = z.zone_code
        WHERE ST_Contains(z.geometry::geometry, {point}::geometry)
        LIMIT 1
    """)
    
    # 3. Dolomite risk check
    dolomite = await db.fetchrow(f"""
        SELECT risk_class, cgs_reference
        FROM dolomite_zones
        WHERE ST_Contains(geometry::geometry, {point}::geometry)
        LIMIT 1
    """)
    
    # 4. Nearest amenities (schools, malls, transport within 5km)
    amenities = await db.fetch(f"""
        SELECT name, type, subtype,
               ROUND(ST_Distance(geometry, {point}::geography) / 1000, 2) as dist_km
        FROM amenities
        WHERE ST_DWithin(geometry, {point}::geography, 5000)
        ORDER BY geometry <-> {point}::geography
        LIMIT 20
    """)
    
    # 5. Derive development parameters
    derived = derive_params(parcel.size_sqm, zone)
    
    return ParcelAnalysis(
        parcel=parcel,
        zone=zone,
        dolomite=dolomite or DolomiteResult(risk_class='UNKNOWN'),
        amenities=amenities,
        derived=derived
    )

def derive_params(size_sqm: float, rules: ZoneRules) -> DerivedParams:
    max_footprint = size_sqm * (rules.coverage_pct / 100)
    max_buildable = size_sqm * rules.far
    max_units = min(
        rules.max_units_per_erf or 9999,
        int((size_sqm / 10_000) * rules.max_units_per_ha) if rules.max_units_per_ha else 9999
    )
    return DerivedParams(
        max_footprint_sqm=round(max_footprint, 1),
        max_buildable_sqm=round(max_buildable, 1),
        max_units=max_units,
        net_buildable_sqm=max_buildable - (max_buildable * 0.15),  # 15% circulation
    )
```

---

## 8. FINANCIAL CALCULATIONS

### Cost Oracle Logic

```python
BUILD_RATES_2026 = {
    "bachelor": 13_500,   # R/sqm standard finish
    "1bed":     14_200,
    "2bed":     15_000,
    "luxury":   18_500,
}

UNIT_SIZES = {
    "bachelor": 35,   # sqm GLA
    "1bed":     55,
    "2bed":     85,
}

def calculate_feasibility(
    listing: Listing,
    unit_type: str,
    target_units: int,
    parcel_analysis: ParcelAnalysis,
    tariff_year: int = 2026
) -> FeasibilityReport:

    # Build cost
    unit_sqm = UNIT_SIZES[unit_type]
    total_build_sqm = unit_sqm * target_units
    build_rate = BUILD_RATES_2026[unit_type]
    cost_build = total_build_sqm * build_rate

    # Professional fees (architecture, engineering, project management)
    cost_prof_fees = cost_build * 0.12

    # Transfer duty (SARS 2026 table)
    cost_transfer = calculate_transfer_duty(listing.price, tariff_year)

    # Bulk Service Contributions (municipality-specific 2026 tariffs)
    cost_bulk = calculate_bulk_contributions(
        municipality=parcel_analysis.zone.municipality,
        unit_type=unit_type,
        units=target_units,
        tariff_year=tariff_year
    )

    total_cost = listing.price + cost_build + cost_prof_fees + cost_transfer + cost_bulk

    # Income projection
    rent = get_market_rent(
        unit_type=unit_type,
        suburb=listing.suburb,
        year=tariff_year
    )
    gross_monthly = rent * target_units
    gross_annual = gross_monthly * 12

    yield_100 = (gross_annual / total_cost) * 100
    yield_85 = (gross_annual * 0.85 / total_cost) * 100

    viable = yield_85 >= 10.0  # 10% threshold at 85% occupancy

    return FeasibilityReport(...)


def calculate_transfer_duty(price: float, year: int) -> float:
    """SARS transfer duty — update table annually each March budget"""
    # 2026 table (update from SARS each year)
    brackets = [
        (1_100_000, 0.00),
        (1_512_500, 0.03),
        (2_117_500, 0.06),
        (2_722_500, 0.08),
        (12_100_000, 0.11),
        (float('inf'), 0.13),
    ]
    # ... stepped calculation


def calculate_bulk_contributions(
    municipality: str,
    unit_type: str,
    units: int,
    tariff_year: int
) -> float:
    """
    Municipal Bulk Service Contributions — gazette-updated annually (July).
    Store tariffs in DB table bulk_contribution_tariffs for easy updates.
    Approximate 2026 rates:
    JHB:       R45,000–R65,000 per unit (residential)
    Tshwane:   R38,000–R55,000 per unit
    Ekurhuleni:R40,000–R58,000 per unit
    """
    ...
```

---

## 9. FORM GENERATION ENGINE

### PDF Templates (WeasyPrint + Jinja2)

Location: `packages/forms/templates/`

```
templates/
├── base.html                    # Shared layout, letterhead, fonts
├── zoning_certificate.html      # Municipal zoning certificate application
├── splum_form_ekurhuleni.html   # Ekurhuleni SPLUM consolidation/rezoning
├── building_plan_checklist.html # JHB/Tshwane building plan submission
├── dolomite_declaration.html    # CGS dolomite risk declaration
├── motivation_letter.html       # Pre-application motivation (Res compliance)
└── rezoning_application.html    # Full rezoning motivation letter
```

### Template Variable Contract

Every template receives a `context` dict with this guaranteed structure:

```python
context = {
    # Parcel
    "erf_number":       "ERF 1247",
    "township":         "Noordwyk Ext 19",
    "erf_size_sqm":     1024,
    "municipality":     "City of Johannesburg",
    "municipality_code": "johannesburg",
    # Zoning
    "zone_code":        "RES3",
    "zone_label":       "Residential 3",
    "coverage_pct":     60,
    "far":              1.5,
    "max_storeys":      3,
    # Dolomite
    "dolomite_risk":    "LOW",
    "cgs_reference":    "CGS-GTG-2024-001",
    # Development intent
    "unit_type":        "bachelor",
    "target_units":     8,
    "total_build_sqm":  280,
    # Financial
    "land_price":       980000,
    "build_cost":       3780000,
    "total_investment": 5329120,
    "gross_yield_pct":  12.2,
    # Owner
    "owner_name":       "T. Mkhabela",
    "owner_id_number":  "",  # user fills in
    "owner_contact":    "",
    # Date
    "application_date": "26 February 2026",
    "tariff_year":      2026,
}
```

### PDF Generation Call

```python
async def generate_compliance_package(report_id: int) -> str:
    """Returns S3 URL of zipped PDF package"""
    report = await get_report(report_id)
    context = build_context(report)
    
    pdfs = []
    for template_name in report.zone.forms_required:
        html = render_template(f"{template_name}.html", context)
        pdf_bytes = weasyprint.HTML(string=html).write_pdf()
        pdfs.append((template_name, pdf_bytes))
    
    # Upload to S3, return public URL
    return await upload_package_to_s3(report_id, pdfs)
```

---

## 10. GIS DATA INGESTION SCRIPTS

Location: `scripts/seed/`

### Ingestion Order (run once to populate PostGIS)

```bash
# 1. Parcels (CSG — Chief Surveyor General, Gauteng province SHP)
python scripts/seed/ingest_parcels.py \
  --shp ./data/csg_parcels_gauteng.shp \
  --province gauteng

# 2. Zoning designations (JHB + Tshwane + Ekurhuleni SHPs)
python scripts/seed/ingest_zoning.py \
  --shp ./data/jhb_zoning_2018.shp --municipality johannesburg
python scripts/seed/ingest_zoning.py \
  --shp ./data/tshwane_zoning_2016.shp --municipality tshwane
python scripts/seed/ingest_zoning.py \
  --shp ./data/ekurhuleni_zoning.shp --municipality ekurhuleni

# 3. Dolomite (CGS ENGEODE — download after free account registration)
python scripts/seed/ingest_dolomite.py \
  --shp ./data/cgs_dolomite_gauteng.shp

# 4. GCRO land use hexagons
python scripts/seed/ingest_gcro.py \
  --shp ./data/gcro_hexagons_2023.shp

# 5. Amenities (OpenStreetMap via Geofabrik)
python scripts/seed/ingest_amenities.py \
  --pbf ./data/gauteng-latest.osm.pbf

# 6. Seed zoning_scheme_rules lookup table
python scripts/seed/seed_scheme_rules.py
# This script populates the rules table from a curated YAML file
# (manually transcribed from municipal scheme PDFs — one-time effort)
```

### Data Sources Registry

```python
DATA_SOURCES = {
    "parcels": {
        "name": "CSG — Chief Surveyor General",
        "url": "https://csg.dla.gov.za",
        "format": "SHP",
        "update_cadence": "monthly",
        "cost": "free",
        "license": "open government",
    },
    "zoning_jhb": {
        "name": "City of Johannesburg GIMS",
        "url": "https://gis.joburg.org.za",
        "format": "SHP + REST API",
        "update_cadence": "bi-annual",
        "cost": "free",
    },
    "zoning_tshwane": {
        "name": "City of Tshwane e-Services",
        "url": "https://eservices.tshwane.gov.za",
        "format": "SHP",
        "update_cadence": "bi-annual",
        "cost": "free",
    },
    "dolomite": {
        "name": "Council for Geoscience — ENGEODE",
        "url": "https://maps.geoscience.org.za",
        "format": "SHP (free account required)",
        "update_cadence": "quarterly",
        "cost": "free (Geoscience Act mandates public access)",
    },
    "gcro": {
        "name": "Gauteng City-Region Observatory",
        "url": "https://gcro.ac.za/outputs/datasets/",
        "format": "SHP",
        "update_cadence": "annual",
        "cost": "free (CC SA-BY 4.0)",
        "license": "CC SA-BY 4.0 — attribution required",
    },
    "amenities": {
        "name": "OpenStreetMap via Geofabrik",
        "url": "https://download.geofabrik.de/africa/south-africa.html",
        "format": "PBF / SHP",
        "update_cadence": "weekly auto-sync",
        "cost": "free (ODbL license)",
    },
    "schools": {
        "name": "Department of Basic Education",
        "url": "https://www.education.gov.za",
        "format": "CSV with GPS",
        "update_cadence": "annual",
        "cost": "free",
    },
}
```

---

## 11. FRONTEND SCREENS

### Design System

```
Dark theme only.
Background:  #070d1a
Surface:     #0f172a
Border:      #1e293b
Text primary: #f1f5f9
Text muted:   #64748b
Accent blue:  #3b82f6
Accent green: #22c55e
Accent amber: #f59e0b
Accent red:   #ef4444
Font headers: Playfair Display (700)
Font data:    DM Mono (400, 500, 600)
Font body:    DM Mono
Radius:       8px (cards), 12px (panels), 20px (pills)
```

### Screen Inventory

| Route | Screen | Component File |
|---|---|---|
| `/` | Dashboard | `app/dashboard/page.tsx` |
| `/scout` | Scout (listing search) | `app/scout/page.tsx` |
| `/scout/:id` | Parcel Detail | `app/scout/[id]/page.tsx` |
| `/scout/:id/zoning` | Zoning + Forms | `app/scout/[id]/zoning/page.tsx` |
| `/scout/:id/cost` | Cost Oracle | `app/scout/[id]/cost/page.tsx` |
| `/projects` | Active Projects | `app/projects/page.tsx` |
| `/projects/:id` | Project Detail | `app/projects/[id]/page.tsx` |
| `/settings/scraper` | Scraper Config | `app/settings/scraper/page.tsx` |
| `/settings/tariffs` | Tariff Admin | `app/settings/tariffs/page.tsx` |

### Map Component Spec (`packages/ui/Map.tsx`)

```typescript
// Uses MapLibre GL JS with custom dark style
// Props:
interface MapProps {
  center: [lng: number, lat: number];
  zoom?: number;
  layers: {
    parcels?: boolean;       // CSG parcel boundaries
    zoning?: boolean;        // Municipal zoning overlay
    dolomite?: boolean;      // Dolomite risk zones (red hatch for HIGH)
    amenities?: boolean;     // School/mall/transport pins
    heatmap?: boolean;       // Rental yield heatmap
  };
  selectedParcel?: ParcelFeature;
  listings?: ListingFeature[];
  onParcelClick?: (parcel: ParcelFeature) => void;
  onListingClick?: (listing: ListingFeature) => void;
  height?: string;
}
```

### 3D Massing Component Spec (`packages/ui/Massing3D.tsx`)

```typescript
// Uses Three.js r160
// Renders simplified building volume on a flat ground plane
// Props:
interface Massing3DProps {
  erfSqm: number;
  erfFrontageM: number;      // estimated or from parcel data
  maxFootprintSqm: number;   // from zoning rules
  unitType: 'bachelor' | '1bed' | '2bed';
  unitCount: number;
  storeys: number;
  onUnitTypeChange: (type: string) => void;
}
// Behaviour:
// - Animate in on mount (scale from 0)
// - Show unit count overlay on each floor
// - Orbit controls (mouse drag)
// - Show building lines as red dashed boundary
```

---

## 12. ENVIRONMENT VARIABLES

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (direct connection for worker)
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://localhost:6379

# AWS
AWS_REGION=af-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=first-gen-properties-docs

# Scraper
SCRAPER_PROXY_URL=           # optional — rotating proxy service
SCRAPER_HEADLESS=true

# Worker
WORKER_URL=http://localhost:8000  # internal URL for Next.js → FastAPI calls

# MapLibre
NEXT_PUBLIC_MAPTILER_KEY=    # free tier for base map tiles

# Tariffs (bump these each July)
TARIFF_YEAR=2026
```

---

## 13. PHASED DELIVERY PLAN

### Phase 1 — Data Foundation (Weeks 1–3)
**Goal:** PostGIS fully loaded, a parcel can be queried and return zone + dolomite + rules.

Deliverables:
- [ ] Docker Compose environment (PostGIS + Redis + FastAPI)
- [ ] All 6 GIS ingestion scripts complete and tested
- [ ] `zoning_scheme_rules` table seeded for Tshwane + JHB Res 1–4
- [ ] `GET /analyze/parcel` endpoint returns full spatial analysis
- [ ] Supabase project setup with schema + RLS policies
- [ ] CI/CD pipeline (GitHub Actions → Vercel + AWS ECS)

### Phase 2 — Spatial Intelligence (Weeks 4–5)
**Goal:** Any coordinate in Gauteng returns a scored feasibility signal.

Deliverables:
- [ ] Amenity scoring algorithm (weighted distance to schools/malls/transport)
- [ ] Rental yield heatmap (aggregate listing data + GCRO)
- [ ] Rezoning probability scoring (historical data where available)
- [ ] Map component with all overlay layers functional
- [ ] Scout screen with live map + lead cards

### Phase 3 — Parametric Engine (Weeks 6–7)
**Goal:** Visual unit planning for any parcel.

Deliverables:
- [ ] Three.js massing component (Bachelor/1-Bed/2-Bed toggle)
- [ ] Parcel Detail screen complete
- [ ] Building line visualisation on map
- [ ] Unit fit calculator (how many units actually fit within building envelope)

### Phase 4 — Financial Core (Weeks 8–9)
**Goal:** Full ROI report + compliance PDF package in one click.

Deliverables:
- [ ] Cost Oracle calculation engine
- [ ] Transfer duty + BSC tables loaded and tested
- [ ] All 5 WeasyPrint PDF templates complete
- [ ] Compliance package generation + S3 upload
- [ ] PDF preview in browser (react-pdf)
- [ ] Cost Oracle screen + Decision Engine component

### Phase 5 — Scraper Network (Weeks 10–11)
**Goal:** Automated lead ingestion from all 6 sources.

Deliverables:
- [ ] All 6 Playwright scrapers complete
- [ ] Celery job queue + Redis
- [ ] Scraper admin screen (job history, status, trigger)
- [ ] Auto-analysis pipeline (scrape → spatial match → score → notify)
- [ ] WhatsApp notification via Twilio (new high-score leads)

### Phase 6 — Project Management (Week 12+)
**Goal:** Post-analysis project tracking.

Deliverables:
- [ ] Projects screen + status pipeline
- [ ] Document submission tracker
- [ ] Portfolio dashboard (total investment, blended yield)
- [ ] Tenant tracker (Phase 6b — after first active project)

---

## 14. CODING STANDARDS

### TypeScript
- Strict mode always on
- No `any` — use `unknown` and narrow
- Zod for all API input validation
- Drizzle types flow through — no manual type duplication

### Python
- Type hints on all function signatures
- Pydantic v2 for all request/response models
- Async everywhere in FastAPI
- Never use `except Exception` — be specific

### SQL / PostGIS
- Always use parameterised queries — no f-string SQL in production code
- Every spatial query must have an index (GIST) or explain why not
- Comment all PostGIS function usage with plain-English explanation

### Git
- Branch: `feat/`, `fix/`, `data/`, `infra/`
- Commits: conventional commits (`feat:`, `fix:`, `data:`, `chore:`)
- No direct commits to `main`

### Security
- All user data behind Supabase RLS
- No PII in URLs or query strings
- PDF generation happens server-side only — never expose WeasyPrint to user input unsanitised
- Scraper credentials never in code — always env vars

---

## 15. KNOWN CONSTRAINTS & DECISIONS

| Decision | Choice | Reason |
|---|---|---|
| Supabase vs self-hosted PostGIS | Supabase | Zero infra overhead, free PostGIS, built-in auth + RLS |
| Next.js vs Nuxt | Next.js | React ecosystem matches Three.js + react-pdf better |
| Python worker vs JS-only | Python FastAPI | geopandas/shapely/WeasyPrint have no JS equivalents |
| MapLibre vs Mapbox | MapLibre | Fully open source, no usage fees |
| PDF generation | WeasyPrint | Best HTML→PDF fidelity for form layouts |
| Scraping T&Cs | Owner accepts risk | Platform is for owner's personal investment use |
| Tariff updates | Admin screen | BSC + transfer duty change annually — must not require code deploy |
| Dolomite data | CGS free account | Legally mandated public access under Geoscience Act |
| Zoning rules | Manual capture once | Rules change rarely — maintain in DB, not code |

---

*CLAUDE.md v2.0 — First Generation Properties*  
*Owner: T. Mkhabela | Last updated: 2026-02-26*
