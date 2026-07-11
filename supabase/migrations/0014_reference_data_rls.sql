-- Reference GIS and tariff layers are readable inputs, never client-writable.
-- The worker and server routes use the database owner connection for writes.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'parcels', 'zoning_designations', 'zoning_scheme_rules',
    'dolomite_zones', 'land_use_hexagons', 'amenities', 'tariffs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_public_read ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_public_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', table_name, table_name);
  END LOOP;
END $$;
