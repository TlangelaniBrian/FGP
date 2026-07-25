-- Authenticated workspace boundary and durable team/activity records.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE compliance_documents ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS team_members (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Owner', 'Chairperson', 'Treasurer', 'Analyst', 'Viewer')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS activity_events (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id),
  actor_name TEXT,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  entity_type TEXT,
  entity_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO team_members (email, name, role, status) VALUES
  ('tlangelani@fgproperties.co.za', 'Tlangelani Mkhabela', 'Treasurer', 'invited'),
  ('thabo@fgproperties.co.za', 'Thabo Nkosi', 'Chairperson', 'invited'),
  ('lerato@fgproperties.co.za', 'Lerato Dube', 'Analyst', 'invited'),
  ('mpho@fgproperties.co.za', 'Mpho Molefe', 'Viewer', 'invited')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feasibility_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_goal_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_correction_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_authenticated_owner ON projects;
CREATE POLICY projects_authenticated_owner ON projects FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS listings_authenticated_owner ON listings;
CREATE POLICY listings_authenticated_owner ON listings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS reports_authenticated_owner ON feasibility_reports;
CREATE POLICY reports_authenticated_owner ON feasibility_reports FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS documents_authenticated_owner ON compliance_documents;
CREATE POLICY documents_authenticated_owner ON compliance_documents FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS capital_authenticated_members ON capital_contributions;
CREATE POLICY capital_authenticated_members ON capital_contributions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS goals_authenticated_members ON capital_goal_proposals;
CREATE POLICY goals_authenticated_members ON capital_goal_proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS corrections_authenticated_members ON capital_correction_proposals;
CREATE POLICY corrections_authenticated_members ON capital_correction_proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS settings_authenticated_members ON portal_settings;
CREATE POLICY settings_authenticated_members ON portal_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS team_authenticated_members ON team_members;
CREATE POLICY team_authenticated_members ON team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS activity_authenticated_members ON activity_events;
CREATE POLICY activity_authenticated_members ON activity_events FOR SELECT TO authenticated USING (true);
