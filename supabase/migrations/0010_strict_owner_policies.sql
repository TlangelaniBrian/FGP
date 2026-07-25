DROP POLICY IF EXISTS projects_authenticated_owner ON projects;
CREATE POLICY projects_authenticated_owner ON projects FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS listings_authenticated_owner ON listings;
CREATE POLICY listings_authenticated_owner ON listings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS documents_authenticated_owner ON compliance_documents;
CREATE POLICY documents_authenticated_owner ON compliance_documents FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
