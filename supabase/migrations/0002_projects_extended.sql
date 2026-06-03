-- supabase/migrations/0002_projects_extended.sql

ALTER TABLE projects ADD COLUMN IF NOT EXISTS erf_number TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS township TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS partners TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS monthly_saving_zar NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase1_target_zar NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS scenario TEXT DEFAULT 'base'
  CHECK (scenario IN ('base', 'lump_sum'));

CREATE TABLE IF NOT EXISTS project_budget_items (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  item          TEXT NOT NULL,
  description   TEXT,
  unit          TEXT,
  quantity      NUMERIC,
  unit_cost     NUMERIC,
  total_cost    NUMERIC,
  actual_cost   NUMERIC,
  status        TEXT DEFAULT 'estimate'
    CHECK (status IN ('estimate', 'quoted', 'approved', 'paid')),
  timeline      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_contacts (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  name          TEXT,
  phone         TEXT,
  email         TEXT,
  status        TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'inactive')),
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS project_decisions (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  decided_at    DATE NOT NULL,
  decision      TEXT NOT NULL,
  rationale     TEXT,
  impact        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_checkins (
  id                  BIGSERIAL PRIMARY KEY,
  project_id          BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  week_of             DATE NOT NULL,
  attorney_status     TEXT,
  savings_confirmed   BOOLEAN,
  supplier_progress   TEXT,
  open_issues         TEXT,
  actions_next_call   TEXT,
  decisions_needed    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: all project-related tables locked to owner
ALTER TABLE project_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only" ON project_budget_items
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "owner_only" ON project_contacts
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "owner_only" ON project_decisions
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "owner_only" ON project_checkins
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Zoning scheme rules (no RLS — public reference data)
CREATE TABLE IF NOT EXISTS zoning_scheme_rules (
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

CREATE TABLE IF NOT EXISTS milestones (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  target_date TEXT NOT NULL,
  milestone   TEXT NOT NULL,
  status      TEXT DEFAULT 'PENDING',
  owner       TEXT,
  is_major    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON milestones
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
