-- Active members may read their workspace records, but direct PostgREST writes
-- must match the non-Viewer record/project capability boundary used by the API.

DROP POLICY IF EXISTS projects_authenticated_owner ON projects;
DROP POLICY IF EXISTS projects_owner_read ON projects;
DROP POLICY IF EXISTS projects_owner_write ON projects;
CREATE POLICY projects_owner_read ON projects
  FOR SELECT TO authenticated
  USING (public.fgp_is_active_member() AND user_id = auth.uid());
CREATE POLICY projects_owner_write ON projects
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND user_id = auth.uid())
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND user_id = auth.uid());

DROP POLICY IF EXISTS listings_authenticated_owner ON listings;
DROP POLICY IF EXISTS listings_owner_read ON listings;
DROP POLICY IF EXISTS listings_owner_write ON listings;
CREATE POLICY listings_owner_read ON listings
  FOR SELECT TO authenticated
  USING (public.fgp_is_active_member() AND user_id = auth.uid());
CREATE POLICY listings_owner_write ON listings
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND user_id = auth.uid())
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND user_id = auth.uid());

DROP POLICY IF EXISTS reports_authenticated_owner ON feasibility_reports;
DROP POLICY IF EXISTS reports_owner_read ON feasibility_reports;
DROP POLICY IF EXISTS reports_owner_write ON feasibility_reports;
CREATE POLICY reports_owner_read ON feasibility_reports
  FOR SELECT TO authenticated
  USING (public.fgp_is_active_member() AND user_id = auth.uid());
CREATE POLICY reports_owner_write ON feasibility_reports
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND user_id = auth.uid())
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND user_id = auth.uid());

DROP POLICY IF EXISTS documents_authenticated_owner ON compliance_documents;
DROP POLICY IF EXISTS documents_owner_read ON compliance_documents;
DROP POLICY IF EXISTS documents_owner_write ON compliance_documents;
CREATE POLICY documents_owner_read ON compliance_documents
  FOR SELECT TO authenticated
  USING (public.fgp_is_active_member() AND user_id = auth.uid());
CREATE POLICY documents_owner_write ON compliance_documents
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND user_id = auth.uid())
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND user_id = auth.uid());

DROP POLICY IF EXISTS scrape_jobs_authenticated_owner ON scrape_jobs;
DROP POLICY IF EXISTS scrape_jobs_owner_read ON scrape_jobs;
DROP POLICY IF EXISTS scrape_jobs_owner_write ON scrape_jobs;
CREATE POLICY scrape_jobs_owner_read ON scrape_jobs
  FOR SELECT TO authenticated
  USING (public.fgp_is_active_member() AND user_id = auth.uid());
CREATE POLICY scrape_jobs_owner_write ON scrape_jobs
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND user_id = auth.uid())
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND user_id = auth.uid());

DROP POLICY IF EXISTS owner_only ON project_budget_items;
DROP POLICY IF EXISTS project_budget_items_owner_read ON project_budget_items;
DROP POLICY IF EXISTS project_budget_items_owner_write ON project_budget_items;
CREATE POLICY project_budget_items_owner_read ON project_budget_items
  FOR SELECT TO authenticated
  USING (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY project_budget_items_owner_write ON project_budget_items
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS owner_only ON project_contacts;
DROP POLICY IF EXISTS project_contacts_owner_read ON project_contacts;
DROP POLICY IF EXISTS project_contacts_owner_write ON project_contacts;
CREATE POLICY project_contacts_owner_read ON project_contacts
  FOR SELECT TO authenticated
  USING (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY project_contacts_owner_write ON project_contacts
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS owner_only ON project_decisions;
DROP POLICY IF EXISTS project_decisions_owner_read ON project_decisions;
DROP POLICY IF EXISTS project_decisions_owner_write ON project_decisions;
CREATE POLICY project_decisions_owner_read ON project_decisions
  FOR SELECT TO authenticated
  USING (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY project_decisions_owner_write ON project_decisions
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS owner_only ON project_checkins;
DROP POLICY IF EXISTS project_checkins_owner_read ON project_checkins;
DROP POLICY IF EXISTS project_checkins_owner_write ON project_checkins;
CREATE POLICY project_checkins_owner_read ON project_checkins
  FOR SELECT TO authenticated
  USING (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY project_checkins_owner_write ON project_checkins
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS owner_only ON milestones;
DROP POLICY IF EXISTS milestones_owner_read ON milestones;
DROP POLICY IF EXISTS milestones_owner_write ON milestones;
CREATE POLICY milestones_owner_read ON milestones
  FOR SELECT TO authenticated
  USING (public.fgp_is_active_member() AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY milestones_owner_write ON milestones
  FOR ALL TO authenticated
  USING (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (public.fgp_has_role(ARRAY['Owner', 'Chairperson', 'Treasurer', 'Analyst']) AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Convert pending UUID-based approvals to stable team member IDs. Already
-- migrated numeric IDs remain intact; legacy display names are discarded.
UPDATE capital_goal_proposals proposal
SET approvals = COALESCE((
  SELECT jsonb_agg(member.id ORDER BY member.id)
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(proposal.approvals) = 'array' THEN proposal.approvals ELSE '[]'::jsonb END
  ) approval(value)
  JOIN team_members member ON member.id::text = approval.value OR member.user_id::text = approval.value
), '[]'::jsonb)
WHERE status = 'pending';

UPDATE capital_correction_proposals proposal
SET approvals = COALESCE((
  SELECT jsonb_agg(member.id ORDER BY member.id)
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(proposal.approvals) = 'array' THEN proposal.approvals ELSE '[]'::jsonb END
  ) approval(value)
  JOIN team_members member ON member.id::text = approval.value OR member.user_id::text = approval.value
), '[]'::jsonb)
WHERE status = 'pending';
