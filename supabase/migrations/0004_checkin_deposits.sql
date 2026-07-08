-- supabase/migrations/0004_checkin_deposits.sql
-- Record the actual cash deposited at each weekly check-in so the project
-- FinanceStrip can show a real "saved to date" total instead of a placeholder.

ALTER TABLE project_checkins ADD COLUMN IF NOT EXISTS deposit_zar NUMERIC;
