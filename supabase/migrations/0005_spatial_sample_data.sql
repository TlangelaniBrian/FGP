-- supabase/migrations/0005_spatial_sample_data.sql
-- Representative sample spatial data so the /analyze/parcel endpoint and the
-- Scout map work end-to-end before the full provincial SHP layers are ingested
-- (see scripts/seed/ingest_*.py). All geometries are WGS84 (SRID 4326).
--
-- Coverage: Soshanguve South Ext 13 (Tshwane, demo project ERF 14201),
-- Noordwyk Ext 19 (Johannesburg / Midrand) and Clayville Ext 45 (Ekurhuleni).
-- Re-runnable: removes prior sample rows (tagged via known keys) before insert.

-- ---------------------------------------------------------------------------
-- Clean up any previous sample rows so this migration is idempotent in dev
-- ---------------------------------------------------------------------------
DELETE FROM amenities WHERE source = 'sample';
DELETE FROM dolomite_zones WHERE cgs_reference LIKE 'SAMPLE-%';
DELETE FROM zoning_designations WHERE source_url = 'sample';
DELETE FROM parcels WHERE erf_number IN ('ERF 14201', 'ERF 2087', 'ERF 551');

-- ---------------------------------------------------------------------------
-- Parcels (~100 m boxes around each centroid)
-- ---------------------------------------------------------------------------
INSERT INTO parcels (erf_number, township, province, municipality, size_sqm, boundary, centroid) VALUES
(
  'ERF 14201', 'Soshanguve South Ext 13', 'Gauteng', 'tshwane', 1024,
  ST_GeogFromText('SRID=4326;POLYGON((28.0845 -25.5405, 28.0855 -25.5405, 28.0855 -25.5395, 28.0845 -25.5395, 28.0845 -25.5405))'),
  ST_GeogFromText('SRID=4326;POINT(28.0850 -25.5400)')
),
(
  'ERF 2087', 'Noordwyk Ext 19', 'Gauteng', 'johannesburg', 980,
  ST_GeogFromText('SRID=4326;POLYGON((28.1295 -25.9765, 28.1305 -25.9765, 28.1305 -25.9755, 28.1295 -25.9755, 28.1295 -25.9765))'),
  ST_GeogFromText('SRID=4326;POINT(28.1300 -25.9760)')
),
(
  'ERF 551', 'Clayville Ext 45', 'Gauteng', 'ekurhuleni', 1500,
  ST_GeogFromText('SRID=4326;POLYGON((28.2095 -25.9405, 28.2107 -25.9405, 28.2107 -25.9395, 28.2095 -25.9395, 28.2095 -25.9405))'),
  ST_GeogFromText('SRID=4326;POINT(28.2100 -25.9400)')
);

-- ---------------------------------------------------------------------------
-- Zoning designations (~600 m boxes covering each parcel)
-- ---------------------------------------------------------------------------
INSERT INTO zoning_designations (municipality, zone_code, zone_label, geometry, scheme_year, source_url, last_updated) VALUES
(
  'tshwane', 'RES3', 'Residential 3',
  ST_GeogFromText('SRID=4326;MULTIPOLYGON(((28.0820 -25.5430, 28.0880 -25.5430, 28.0880 -25.5370, 28.0820 -25.5370, 28.0820 -25.5430)))'),
  2016, 'sample', '2026-06-01'
),
(
  'johannesburg', 'RES3', 'Residential 3',
  ST_GeogFromText('SRID=4326;MULTIPOLYGON(((28.1270 -25.9790, 28.1330 -25.9790, 28.1330 -25.9730, 28.1270 -25.9730, 28.1270 -25.9790)))'),
  2018, 'sample', '2026-06-01'
),
(
  'ekurhuleni', 'RES2', 'Residential 2',
  ST_GeogFromText('SRID=4326;MULTIPOLYGON(((28.2070 -25.9430, 28.2130 -25.9430, 28.2130 -25.9370, 28.2070 -25.9370, 28.2070 -25.9430)))'),
  2014, 'sample', '2026-06-01'
);

-- ---------------------------------------------------------------------------
-- Dolomite risk zones (CGS-style). The Tshwane / Centurion belt is dolomitic;
-- Soshanguve sample sits in a HIGH zone. Midrand sample is LOW.
-- ---------------------------------------------------------------------------
INSERT INTO dolomite_zones (risk_class, geometry, cgs_reference, notes) VALUES
(
  'HIGH',
  ST_GeogFromText('SRID=4326;MULTIPOLYGON(((28.0000 -25.6000, 28.2000 -25.6000, 28.2000 -25.4500, 28.0000 -25.4500, 28.0000 -25.6000)))'),
  'SAMPLE-CGS-TSH-001', 'Sample dolomite belt — Soshanguve/Tshwane. Requires geotechnical investigation.'
),
(
  'LOW',
  ST_GeogFromText('SRID=4326;MULTIPOLYGON(((28.1000 -25.9900, 28.1600 -25.9900, 28.1600 -25.9600, 28.1000 -25.9600, 28.1000 -25.9900)))'),
  'SAMPLE-CGS-JHB-002', 'Sample low-risk zone — Midrand/Noordwyk.'
);

-- ---------------------------------------------------------------------------
-- Amenities near the Soshanguve and Midrand parcels (within ~5 km)
-- ---------------------------------------------------------------------------
INSERT INTO amenities (name, type, subtype, geometry, source) VALUES
('Soshanguve Secondary School', 'school', 'government_school', ST_GeogFromText('SRID=4326;POINT(28.0870 -25.5382)'), 'sample'),
('Kgabo Village Mall', 'mall', 'community_mall', ST_GeogFromText('SRID=4326;POINT(28.0905 -25.5421)'), 'sample'),
('Soshanguve Crossing Taxi Rank', 'taxi_rank', NULL, ST_GeogFromText('SRID=4326;POINT(28.0838 -25.5411)'), 'sample'),
('Odirile Primary School', 'school', 'government_school', ST_GeogFromText('SRID=4326;POINT(28.0801 -25.5358)'), 'sample'),
('Mall of the North Express', 'mall', 'regional_mall', ST_GeogFromText('SRID=4326;POINT(28.1320 -25.9805)'), 'sample'),
('Noordwyk Primary School', 'school', 'private_school', ST_GeogFromText('SRID=4326;POINT(28.1278 -25.9742)'), 'sample'),
('Midrand Gautrain Station', 'transport', 'rail', ST_GeogFromText('SRID=4326;POINT(28.1380 -25.9870)'), 'sample'),
('N1 Buccleuch On-ramp', 'highway_on_ramp', NULL, ST_GeogFromText('SRID=4326;POINT(28.1100 -26.0300)'), 'sample');
