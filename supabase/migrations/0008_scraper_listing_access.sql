ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scrape_jobs_authenticated_owner ON scrape_jobs;
CREATE POLICY scrape_jobs_authenticated_owner ON scrape_jobs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
