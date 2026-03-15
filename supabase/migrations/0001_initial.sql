-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- =============================================
-- SPATIAL LAYERS
-- =============================================

CREATE TABLE parcels (
  id              BIGSERIAL PRIMARY KEY,
  erf_number      TEXT NOT NULL,
  township        TEXT,
  province        TEXT DEFAULT 'Gauteng',
  municipality    TEXT,
  size_sqm        NUMERIC,
  boundary        GEOGRAPHY(POLYGON, 4326) NOT NULL,
  centroid        GEOGRAPHY(POINT, 4326),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX parcels_boundary_idx ON parcels USING GIST(boundary);
CREATE INDEX parcels_centroid_idx ON parcels USING GIST(centroid);

CREATE TABLE zoning_designations (
  id              BIGSERIAL PRIMARY KEY,
  municipality    TEXT NOT NULL,
  zone_code       TEXT NOT NULL,
  zone_label      TEXT,
  geometry        GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  scheme_year     INTEGER,
  source_url      TEXT,
  last_updated    DATE
);
CREATE INDEX zoning_geometry_idx ON zoning_designations USING GIST(geometry);

CREATE TABLE zoning_scheme_rules (
  id                      SERIAL PRIMARY KEY,
  municipality            TEXT NOT NULL,
  zone_code               TEXT NOT NULL,
  zone_label              TEXT,
  max_units_per_ha        INTEGER,
  max_units_per_erf       INTEGER,
  coverage_pct            NUMERIC,
  far                     NUMERIC,
  max_height_m            NUMERIC,
  max_storeys             INTEGER,
  building_line_front_m   NUMERIC,
  building_line_side_m    NUMERIC,
  building_line_rear_m    NUMERIC,
  permitted_uses          TEXT[],
  consent_uses            TEXT[],
  rezoning_possible_to    TEXT[],
  rezoning_difficulty     TEXT CHECK (rezoning_difficulty IN ('low', 'medium', 'high')),
  rezoning_approval_rate  NUMERIC,
  forms_required          TEXT[],
  scheme_document         TEXT,
  scheme_year             INTEGER,
  last_updated            DATE,
  UNIQUE(municipality, zone_code)
);

CREATE TABLE dolomite_zones (
  id              BIGSERIAL PRIMARY KEY,
  risk_class      TEXT NOT NULL CHECK (risk_class IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7')),
  geometry        GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  cgs_reference   TEXT,
  notes           TEXT
);
CREATE INDEX dolomite_geometry_idx ON dolomite_zones USING GIST(geometry);

CREATE TABLE land_use_hexagons (
  id              BIGSERIAL PRIMARY KEY,
  h3_index        TEXT UNIQUE,
  land_use_class  TEXT,
  pop_2026_est    INTEGER,
  socioeco_risk   NUMERIC,
  new_dev_flag    BOOLEAN DEFAULT FALSE,
  geometry        GEOGRAPHY(POLYGON, 4326),
  year            INTEGER
);

CREATE TABLE amenities (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  subtype         TEXT,
  geometry        GEOGRAPHY(POINT, 4326) NOT NULL,
  source          TEXT
);
CREATE INDEX amenities_geometry_idx ON amenities USING GIST(geometry);

-- =============================================
-- LISTINGS
-- =============================================

CREATE TABLE listings (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  source_id       TEXT,
  source_url      TEXT,
  scraped_at      TIMESTAMPTZ,
  address         TEXT,
  suburb          TEXT,
  city            TEXT,
  municipality    TEXT,
  coordinates     GEOGRAPHY(POINT, 4326),
  size_sqm        NUMERIC,
  price           NUMERIC,
  price_per_sqm   NUMERIC GENERATED ALWAYS AS (
    CASE WHEN size_sqm > 0 THEN price / size_sqm ELSE NULL END
  ) STORED,
  listing_type    TEXT DEFAULT 'vacant_land',
  description     TEXT,
  parcel_id       BIGINT REFERENCES parcels(id),
  zone_code       TEXT,
  dolomite_risk   TEXT,
  status          TEXT DEFAULT 'new' CHECK (status IN ('new', 'analyzing', 'analyzed', 'active_project', 'dismissed', 'sold')),
  feasibility_score INTEGER CHECK (feasibility_score BETWEEN 0 AND 100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FEASIBILITY
-- =============================================

CREATE TABLE feasibility_reports (
  id                    BIGSERIAL PRIMARY KEY,
  listing_id            BIGINT REFERENCES listings(id) NOT NULL,
  user_id               UUID,
  unit_type             TEXT NOT NULL,
  target_units          INTEGER NOT NULL,
  build_rate_per_sqm    NUMERIC NOT NULL DEFAULT 13500,
  tariff_year           INTEGER NOT NULL DEFAULT 2026,
  max_units_allowed     INTEGER,
  max_buildable_sqm     NUMERIC,
  max_footprint_sqm     NUMERIC,
  rezoning_required     BOOLEAN DEFAULT FALSE,
  cost_land             NUMERIC,
  cost_build            NUMERIC,
  cost_professional_fees NUMERIC,
  cost_bulk_contributions NUMERIC,
  cost_transfer_duty    NUMERIC,
  cost_total            NUMERIC,
  rent_per_unit_monthly NUMERIC,
  gross_monthly_income  NUMERIC,
  gross_annual_income   NUMERIC,
  yield_gross_pct       NUMERIC,
  yield_at_85_occ_pct   NUMERIC,
  viable                BOOLEAN,
  viability_notes       TEXT,
  score_schools         INTEGER,
  score_transport       INTEGER,
  score_amenities       INTEGER,
  pdf_package_url       TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- COMPLIANCE DOCUMENTS
-- =============================================

CREATE TABLE compliance_documents (
  id              BIGSERIAL PRIMARY KEY,
  report_id       BIGINT REFERENCES feasibility_reports(id),
  listing_id      BIGINT REFERENCES listings(id),
  doc_type        TEXT NOT NULL,
  municipality    TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'submitted', 'approved', 'rejected')),
  prefilled_data  JSONB,
  pdf_url         TEXT,
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROJECTS
-- =============================================

CREATE TABLE projects (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID,
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
  search_params   JSONB,
  status          TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  listings_found  INTEGER DEFAULT 0,
  listings_new    INTEGER DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
