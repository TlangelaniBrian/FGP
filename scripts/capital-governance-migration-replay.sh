#!/usr/bin/env bash
set -euo pipefail

container="fgp-task4-migration-replay"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=postgres \
  public.ecr.aws/supabase/postgres:17.6.1.131 >/dev/null

for _ in $(seq 1 30); do
  if [[ "$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null)" == "healthy" ]]; then
    break
  fi
  sleep 1
done
sleep 3

docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false
);
GRANT ALL ON storage.buckets TO postgres;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT null::uuid';
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT ''{}''::jsonb';
GRANT EXECUTE ON FUNCTION auth.uid() TO public;
GRANT EXECUTE ON FUNCTION auth.jwt() TO public;
SQL

for migration in supabase/migrations/*.sql; do
  [[ "$migration" == *0018_atomic_capital_governance.sql ]] && break
  docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$migration"
done

docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
INSERT INTO team_members (email, name, role, status) VALUES
  ('legacy-owner@example.com', 'Legacy Owner', 'Owner', 'active'),
  ('legacy-treasurer@example.com', 'Legacy Treasurer', 'Treasurer', 'active');

INSERT INTO capital_goal_proposals (proposed_by, proposed_by_role, new_amount, approvals, status) VALUES
  ('Legacy Owner', 'Owner', 900000, '["Legacy Owner", "Legacy Treasurer"]', 'approved'),
  ('Legacy Owner', 'Owner', 910000, '["Legacy Owner", "Legacy Treasurer"]', 'rejected');

INSERT INTO capital_contributions (member_name, member_role, amount, contribution_date)
VALUES ('Legacy Owner', 'Owner', 100, CURRENT_DATE);

INSERT INTO capital_correction_proposals
  (contribution_id, proposed_by, proposed_by_role, action, proposed_amount, approvals, status)
VALUES
  ((SELECT max(id) FROM capital_contributions), 'Legacy Owner', 'Owner', 'edit', 110, '["Legacy Treasurer"]', 'approved'),
  ((SELECT max(id) FROM capital_contributions), 'Legacy Owner', 'Owner', 'edit', 120, '["Legacy Treasurer"]', 'rejected'),
  ((SELECT max(id) FROM capital_contributions), 'Unknown Legacy Maker', 'Owner', 'remove', NULL, '["Legacy Treasurer"]', 'pending');
SQL

docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
  < supabase/migrations/0018_atomic_capital_governance.sql

docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
DECLARE
  approved_goal bigint;
  rejected_goal bigint;
  approved_correction bigint;
  rejected_correction bigint;
  unresolved_correction bigint;
BEGIN
  SELECT id INTO approved_goal FROM capital_goal_proposals WHERE status = 'approved';
  SELECT id INTO rejected_goal FROM capital_goal_proposals WHERE status = 'rejected' ORDER BY id LIMIT 1;
  SELECT id INTO approved_correction FROM capital_correction_proposals WHERE status = 'approved';
  SELECT id INTO rejected_correction FROM capital_correction_proposals WHERE status = 'rejected';
  SELECT id INTO unresolved_correction FROM capital_correction_proposals WHERE proposed_by = 'Unknown Legacy Maker';

  IF (SELECT count(*) FROM capital_goal_approvals WHERE proposal_id = approved_goal) <> 2 THEN
    RAISE EXCEPTION 'approved goal approvals were not preserved';
  END IF;
  IF (SELECT count(*) FROM capital_goal_approvals WHERE proposal_id = rejected_goal) <> 2 THEN
    RAISE EXCEPTION 'rejected goal approvals were not preserved';
  END IF;
  IF (SELECT count(*) FROM capital_correction_approvals WHERE proposal_id = approved_correction) <> 1 THEN
    RAISE EXCEPTION 'approved correction approvals were not preserved';
  END IF;
  IF (SELECT count(*) FROM capital_correction_approvals WHERE proposal_id = rejected_correction) <> 1 THEN
    RAISE EXCEPTION 'rejected correction approvals were not preserved';
  END IF;
  IF (SELECT status FROM capital_correction_proposals WHERE id = unresolved_correction) <> 'rejected' THEN
    RAISE EXCEPTION 'unresolved pending correction maker was not quarantined';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('capital_goal_proposals', 'capital_correction_proposals')
      AND column_name = 'approvals'
  ) THEN
    RAISE EXCEPTION 'legacy JSON approval columns remain';
  END IF;
END $$;
SQL

echo "Capital governance migrations 0001-0018 replayed with legacy backfill assertions."
