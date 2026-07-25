-- Make active workspace membership the common boundary for direct PostgREST
-- access as well as the Next.js API. The SECURITY DEFINER lookup avoids RLS
-- recursion when it is used by the team_members policy itself.
CREATE OR REPLACE FUNCTION public.fgp_is_active_member()
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
  );
$$;

REVOKE ALL ON FUNCTION public.fgp_is_active_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fgp_is_active_member() TO authenticated;

DROP POLICY IF EXISTS team_members_read ON team_members;
CREATE POLICY team_members_read ON team_members
  FOR SELECT TO authenticated USING (public.fgp_is_active_member());

DROP POLICY IF EXISTS settings_members_read ON portal_settings;
CREATE POLICY settings_members_read ON portal_settings
  FOR SELECT TO authenticated USING (public.fgp_is_active_member());

DROP POLICY IF EXISTS capital_members_read ON capital_contributions;
CREATE POLICY capital_members_read ON capital_contributions
  FOR SELECT TO authenticated USING (public.fgp_is_active_member());

DROP POLICY IF EXISTS goals_members_read ON capital_goal_proposals;
CREATE POLICY goals_members_read ON capital_goal_proposals
  FOR SELECT TO authenticated USING (public.fgp_is_active_member());

DROP POLICY IF EXISTS corrections_members_read ON capital_correction_proposals;
CREATE POLICY corrections_members_read ON capital_correction_proposals
  FOR SELECT TO authenticated USING (public.fgp_is_active_member());

DROP POLICY IF EXISTS activity_authenticated_members ON activity_events;
DROP POLICY IF EXISTS activity_active_members ON activity_events;
CREATE POLICY activity_active_members ON activity_events
  FOR SELECT TO authenticated USING (public.fgp_is_active_member());

DROP POLICY IF EXISTS projects_authenticated_owner ON projects;
CREATE POLICY projects_authenticated_owner ON projects FOR ALL TO authenticated
  USING (public.fgp_is_active_member() AND user_id = auth.uid())
  WITH CHECK (public.fgp_is_active_member() AND user_id = auth.uid());

DROP POLICY IF EXISTS listings_authenticated_owner ON listings;
CREATE POLICY listings_authenticated_owner ON listings FOR ALL TO authenticated
  USING (public.fgp_is_active_member() AND user_id = auth.uid())
  WITH CHECK (public.fgp_is_active_member() AND user_id = auth.uid());

DROP POLICY IF EXISTS reports_authenticated_owner ON feasibility_reports;
CREATE POLICY reports_authenticated_owner ON feasibility_reports FOR ALL TO authenticated
  USING (public.fgp_is_active_member() AND user_id = auth.uid())
  WITH CHECK (public.fgp_is_active_member() AND user_id = auth.uid());

DROP POLICY IF EXISTS documents_authenticated_owner ON compliance_documents;
CREATE POLICY documents_authenticated_owner ON compliance_documents FOR ALL TO authenticated
  USING (public.fgp_is_active_member() AND user_id = auth.uid())
  WITH CHECK (public.fgp_is_active_member() AND user_id = auth.uid());

DROP POLICY IF EXISTS scrape_jobs_authenticated_owner ON scrape_jobs;
CREATE POLICY scrape_jobs_authenticated_owner ON scrape_jobs FOR ALL TO authenticated
  USING (public.fgp_is_active_member() AND user_id = auth.uid())
  WITH CHECK (public.fgp_is_active_member() AND user_id = auth.uid());

DROP POLICY IF EXISTS owner_only ON project_budget_items;
CREATE POLICY owner_only ON project_budget_items TO authenticated
  USING (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS owner_only ON project_contacts;
CREATE POLICY owner_only ON project_contacts TO authenticated
  USING (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS owner_only ON project_decisions;
CREATE POLICY owner_only ON project_decisions TO authenticated
  USING (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS owner_only ON project_checkins;
CREATE POLICY owner_only ON project_checkins TO authenticated
  USING (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS owner_only ON milestones;
CREATE POLICY owner_only ON milestones TO authenticated
  USING (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Legacy pending approval arrays contain display names. Reset them so no name
-- collision can satisfy a future ID-based approval check.
UPDATE capital_goal_proposals SET approvals = '[]'::jsonb WHERE status = 'pending';
UPDATE capital_correction_proposals SET approvals = '[]'::jsonb WHERE status = 'pending';
