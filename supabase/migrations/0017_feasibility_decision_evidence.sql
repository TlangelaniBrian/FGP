ALTER TABLE feasibility_reports
  ADD COLUMN IF NOT EXISTS actual_units INTEGER,
  ADD COLUMN IF NOT EXISTS decision_status TEXT,
  ADD COLUMN IF NOT EXISTS zoning_evidence_available BOOLEAN,
  ADD COLUMN IF NOT EXISTS capacity_density_units INTEGER,
  ADD COLUMN IF NOT EXISTS capacity_far_units INTEGER,
  ADD COLUMN IF NOT EXISTS capacity_footprint_storey_units INTEGER;

UPDATE feasibility_reports
SET
  actual_units = LEAST(target_units, COALESCE(max_units_allowed, target_units)),
  decision_status = 'degraded',
  zoning_evidence_available = FALSE
WHERE actual_units IS NULL
   OR decision_status IS NULL
   OR zoning_evidence_available IS NULL;

ALTER TABLE feasibility_reports
  ALTER COLUMN actual_units SET NOT NULL,
  ALTER COLUMN decision_status SET NOT NULL,
  ALTER COLUMN decision_status SET DEFAULT 'degraded',
  ALTER COLUMN zoning_evidence_available SET NOT NULL,
  ALTER COLUMN zoning_evidence_available SET DEFAULT FALSE;

ALTER TABLE feasibility_reports
  DROP CONSTRAINT IF EXISTS feasibility_reports_decision_status_check,
  ADD CONSTRAINT feasibility_reports_decision_status_check
    CHECK (decision_status IN ('definitive', 'degraded'));
