-- supabase/migrations/0003_tariffs.sql
-- Move feasibility tariffs out of worker code and into the database so they can
-- be updated annually (SARS transfer duty in March, municipal BSC in July) via
-- the /settings/tariffs admin screen — no code deploy required.

CREATE TABLE IF NOT EXISTS tariffs (
  id            SERIAL PRIMARY KEY,
  tariff_year   INTEGER NOT NULL,
  category      TEXT NOT NULL
    CHECK (category IN (
      'build_rates', 'unit_sizes', 'market_rents',
      'bulk_contributions', 'transfer_duty_brackets', 'fees'
    )),
  data          JSONB NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tariff_year, category)
);

CREATE INDEX IF NOT EXISTS tariffs_year_idx ON tariffs (tariff_year);
