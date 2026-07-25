-- Keep direct Supabase access aligned with the API capability matrix. Server
-- routes still perform ownership checks; these policies protect the same
-- boundary when a client talks to PostgREST directly.
CREATE OR REPLACE FUNCTION public.fgp_has_role(allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members member
    WHERE (member.user_id = auth.uid()
       OR lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      AND member.status = 'active'
      AND member.role = ANY(allowed_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.fgp_has_role(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fgp_has_role(TEXT[]) TO authenticated;

DROP POLICY IF EXISTS team_authenticated_members ON team_members;
DROP POLICY IF EXISTS team_members_read ON team_members;
DROP POLICY IF EXISTS team_members_manage ON team_members;
CREATE POLICY team_members_read ON team_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY team_members_manage ON team_members
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson']))
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson']));

DROP POLICY IF EXISTS settings_authenticated_members ON portal_settings;
DROP POLICY IF EXISTS settings_members_read ON portal_settings;
DROP POLICY IF EXISTS settings_members_manage ON portal_settings;
CREATE POLICY settings_members_read ON portal_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_members_manage ON portal_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']));
CREATE POLICY settings_members_update ON portal_settings
  FOR UPDATE TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']))
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']));

DROP POLICY IF EXISTS capital_authenticated_members ON capital_contributions;
DROP POLICY IF EXISTS capital_members_read ON capital_contributions;
DROP POLICY IF EXISTS capital_members_write ON capital_contributions;
CREATE POLICY capital_members_read ON capital_contributions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY capital_members_write ON capital_contributions
  FOR INSERT TO authenticated
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']));

DROP POLICY IF EXISTS goals_authenticated_members ON capital_goal_proposals;
DROP POLICY IF EXISTS goals_members_read ON capital_goal_proposals;
DROP POLICY IF EXISTS goals_members_write ON capital_goal_proposals;
CREATE POLICY goals_members_read ON capital_goal_proposals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY goals_members_write ON capital_goal_proposals
  FOR INSERT TO authenticated
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer']));
CREATE POLICY goals_members_update ON capital_goal_proposals
  FOR UPDATE TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']))
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']));

DROP POLICY IF EXISTS corrections_authenticated_members ON capital_correction_proposals;
DROP POLICY IF EXISTS corrections_members_read ON capital_correction_proposals;
DROP POLICY IF EXISTS corrections_members_write ON capital_correction_proposals;
CREATE POLICY corrections_members_read ON capital_correction_proposals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY corrections_members_write ON capital_correction_proposals
  FOR INSERT TO authenticated
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer']));
CREATE POLICY corrections_members_update ON capital_correction_proposals
  FOR UPDATE TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']))
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']));
