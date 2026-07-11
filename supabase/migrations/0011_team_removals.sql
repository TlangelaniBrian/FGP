ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_status_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_status_check CHECK (status IN ('invited', 'active', 'suspended', 'removed'));
