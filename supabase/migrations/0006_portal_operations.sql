-- Durable portal workflows from the handoff: capital governance, compliance,
-- and workspace preferences.

CREATE TABLE IF NOT EXISTS compliance_documents (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT REFERENCES feasibility_reports(id) ON DELETE CASCADE,
  listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  municipality TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'submitted', 'approved', 'rejected')),
  prefilled_data JSONB,
  pdf_url TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capital_contributions (
  id BIGSERIAL PRIMARY KEY,
  member_name TEXT NOT NULL,
  member_role TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  contribution_date DATE NOT NULL,
  note TEXT,
  status TEXT DEFAULT 'posted' CHECK (status IN ('posted', 'corrected', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capital_goal_proposals (
  id BIGSERIAL PRIMARY KEY,
  proposed_by TEXT NOT NULL,
  proposed_by_role TEXT NOT NULL,
  new_amount NUMERIC NOT NULL CHECK (new_amount > 0),
  approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capital_correction_proposals (
  id BIGSERIAL PRIMARY KEY,
  contribution_id BIGINT REFERENCES capital_contributions(id) ON DELETE CASCADE,
  proposed_by TEXT NOT NULL,
  proposed_by_role TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('edit', 'remove')),
  proposed_amount NUMERIC CHECK (proposed_amount IS NULL OR proposed_amount > 0),
  proposed_note TEXT,
  approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portal_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
