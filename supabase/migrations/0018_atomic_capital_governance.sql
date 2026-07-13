-- Stable-member, transactional capital governance. Authenticated clients can
-- read governance state, but only the trusted Next.js database connection may
-- mutate proposals, electorates, approvals, or the reserved capital goal.

ALTER TABLE capital_goal_proposals
  ADD COLUMN IF NOT EXISTS proposed_by_member_id BIGINT REFERENCES team_members(id);
ALTER TABLE capital_correction_proposals
  ADD COLUMN IF NOT EXISTS proposed_by_member_id BIGINT REFERENCES team_members(id);

CREATE TABLE IF NOT EXISTS capital_goal_electorate (
  proposal_id BIGINT NOT NULL REFERENCES capital_goal_proposals(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES team_members(id),
  member_name TEXT NOT NULL,
  member_role TEXT NOT NULL,
  PRIMARY KEY (proposal_id, member_id)
);

CREATE TABLE IF NOT EXISTS capital_goal_approvals (
  proposal_id BIGINT NOT NULL REFERENCES capital_goal_proposals(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES team_members(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (proposal_id, member_id),
  FOREIGN KEY (proposal_id, member_id)
    REFERENCES capital_goal_electorate(proposal_id, member_id)
);

CREATE TABLE IF NOT EXISTS capital_correction_approvals (
  proposal_id BIGINT NOT NULL REFERENCES capital_correction_proposals(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES team_members(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (proposal_id, member_id)
);

-- Resolve legacy display metadata conservatively. Duplicate names prefer a
-- matching role and lowest stable member ID; unresolved makers remain NULL.
UPDATE capital_goal_proposals proposal
SET proposed_by_member_id = (
  SELECT member.id
  FROM team_members member
  WHERE lower(member.name) = lower(proposal.proposed_by)
    AND (
      (member.role = proposal.proposed_by_role AND (
        SELECT count(*) FROM team_members candidate
        WHERE lower(candidate.name) = lower(proposal.proposed_by)
          AND candidate.role = proposal.proposed_by_role
      ) = 1)
      OR (
        SELECT count(*) FROM team_members candidate
        WHERE lower(candidate.name) = lower(proposal.proposed_by)
      ) = 1
    )
  ORDER BY (member.role = proposal.proposed_by_role) DESC, member.id
  LIMIT 1
)
WHERE proposal.proposed_by_member_id IS NULL;

UPDATE capital_correction_proposals proposal
SET proposed_by_member_id = (
  SELECT member.id
  FROM team_members member
  WHERE lower(member.name) = lower(proposal.proposed_by)
    AND (
      (member.role = proposal.proposed_by_role AND (
        SELECT count(*) FROM team_members candidate
        WHERE lower(candidate.name) = lower(proposal.proposed_by)
          AND candidate.role = proposal.proposed_by_role
      ) = 1)
      OR (
        SELECT count(*) FROM team_members candidate
        WHERE lower(candidate.name) = lower(proposal.proposed_by)
      ) = 1
    )
  ORDER BY (member.role = proposal.proposed_by_role) DESC, member.id
  LIMIT 1
)
WHERE proposal.proposed_by_member_id IS NULL;

-- Preserve the newest legacy pending goal and reject older competing rows.
-- No pending proposal is silently promoted to approved during backfill.
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC, id DESC) AS position
  FROM capital_goal_proposals
  WHERE status = 'pending'
)
UPDATE capital_goal_proposals proposal
SET status = 'rejected'
FROM ranked
WHERE proposal.id = ranked.id AND ranked.position > 1;

INSERT INTO capital_goal_electorate (proposal_id, member_id, member_name, member_role)
SELECT proposal.id, member.id, member.name, member.role
FROM capital_goal_proposals proposal
JOIN team_members member ON member.status = 'active' AND member.role <> 'Viewer'
WHERE proposal.status = 'pending'
ON CONFLICT DO NOTHING;

INSERT INTO capital_goal_electorate (proposal_id, member_id, member_name, member_role)
SELECT proposal.id, member.id, member.name, member.role
FROM capital_goal_proposals proposal
JOIN team_members member ON member.id = proposal.proposed_by_member_id
ON CONFLICT DO NOTHING;

-- Preserve completed legacy audit evidence by adding each recognizable
-- approval member to that proposal's historical electorate before the
-- normalized approval foreign key is enforced.
INSERT INTO capital_goal_electorate (proposal_id, member_id, member_name, member_role)
SELECT DISTINCT proposal.id, member.id, current_member.name, current_member.role
FROM capital_goal_proposals proposal
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(proposal.approvals) = 'array' THEN proposal.approvals ELSE '[]'::jsonb END
) legacy(value)
JOIN LATERAL (
  SELECT candidate.id
  FROM team_members candidate
  WHERE candidate.id::text = legacy.value
    OR candidate.user_id::text = legacy.value
    OR (
      lower(candidate.name) = lower(legacy.value)
      AND (
        SELECT count(*) FROM team_members named
        WHERE lower(named.name) = lower(legacy.value)
      ) = 1
    )
  ORDER BY
    (candidate.id::text = legacy.value OR candidate.user_id::text = legacy.value) DESC,
    candidate.id
  LIMIT 1
) member ON true
JOIN team_members current_member ON current_member.id = member.id
ON CONFLICT DO NOTHING;

INSERT INTO capital_goal_approvals (proposal_id, member_id)
SELECT DISTINCT proposal.id, member.id
FROM capital_goal_proposals proposal
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(proposal.approvals) = 'array' THEN proposal.approvals ELSE '[]'::jsonb END
) legacy(value)
JOIN LATERAL (
  SELECT candidate.id
  FROM team_members candidate
  WHERE candidate.id::text = legacy.value
    OR candidate.user_id::text = legacy.value
    OR (
      lower(candidate.name) = lower(legacy.value)
      AND (
        SELECT count(*) FROM team_members named
        WHERE lower(named.name) = lower(legacy.value)
      ) = 1
    )
  ORDER BY
    (candidate.id::text = legacy.value OR candidate.user_id::text = legacy.value) DESC,
    candidate.id
  LIMIT 1
) member ON true
JOIN capital_goal_electorate electorate
  ON electorate.proposal_id = proposal.id AND electorate.member_id = member.id
ON CONFLICT DO NOTHING;

-- A pending correction without a stable maker cannot satisfy maker-checker.
-- Quarantine it instead of allowing an arbitrary active member to approve it.
UPDATE capital_correction_proposals
SET status = 'rejected'
WHERE status = 'pending' AND proposed_by_member_id IS NULL;

INSERT INTO capital_correction_approvals (proposal_id, member_id)
SELECT DISTINCT proposal.id, member.id
FROM capital_correction_proposals proposal
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(proposal.approvals) = 'array' THEN proposal.approvals ELSE '[]'::jsonb END
) legacy(value)
JOIN LATERAL (
  SELECT candidate.id
  FROM team_members candidate
  WHERE candidate.id::text = legacy.value
    OR candidate.user_id::text = legacy.value
    OR (
      lower(candidate.name) = lower(legacy.value)
      AND (
        SELECT count(*) FROM team_members named
        WHERE lower(named.name) = lower(legacy.value)
      ) = 1
    )
  ORDER BY
    (candidate.id::text = legacy.value OR candidate.user_id::text = legacy.value) DESC,
    candidate.id
  LIMIT 1
) member ON true
WHERE member.id IS DISTINCT FROM proposal.proposed_by_member_id
ON CONFLICT DO NOTHING;

ALTER TABLE capital_goal_proposals DROP COLUMN approvals;
ALTER TABLE capital_correction_proposals DROP COLUMN approvals;

CREATE UNIQUE INDEX IF NOT EXISTS capital_goal_one_pending_idx
  ON capital_goal_proposals ((status)) WHERE status = 'pending';

ALTER TABLE capital_goal_electorate ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_goal_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_correction_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_members_manage ON portal_settings;
DROP POLICY IF EXISTS settings_members_update ON portal_settings;
CREATE POLICY settings_members_manage ON portal_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    key <> 'capital_goal'
    AND public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst'])
  );
CREATE POLICY settings_members_update ON portal_settings
  FOR UPDATE TO authenticated
  USING (
    key <> 'capital_goal'
    AND public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst'])
  )
  WITH CHECK (
    key <> 'capital_goal'
    AND public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst'])
  );

DROP POLICY IF EXISTS goals_members_write ON capital_goal_proposals;
DROP POLICY IF EXISTS goals_members_update ON capital_goal_proposals;
DROP POLICY IF EXISTS corrections_members_write ON capital_correction_proposals;
DROP POLICY IF EXISTS corrections_members_update ON capital_correction_proposals;

DROP POLICY IF EXISTS goal_electorate_members_read ON capital_goal_electorate;
CREATE POLICY goal_electorate_members_read ON capital_goal_electorate
  FOR SELECT TO authenticated USING (public.fgp_is_active_member());
DROP POLICY IF EXISTS goal_approvals_members_read ON capital_goal_approvals;
CREATE POLICY goal_approvals_members_read ON capital_goal_approvals
  FOR SELECT TO authenticated USING (public.fgp_is_active_member());
DROP POLICY IF EXISTS correction_approvals_members_read ON capital_correction_approvals;
CREATE POLICY correction_approvals_members_read ON capital_correction_approvals
  FOR SELECT TO authenticated USING (public.fgp_is_active_member());

GRANT SELECT ON capital_goal_electorate, capital_goal_approvals, capital_correction_approvals TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON capital_goal_electorate, capital_goal_approvals, capital_correction_approvals FROM authenticated;

NOTIFY pgrst, 'reload schema';
