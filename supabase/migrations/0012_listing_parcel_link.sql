ALTER TABLE listings ADD COLUMN IF NOT EXISTS parcel_id BIGINT REFERENCES parcels(id);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS coordinates GEOGRAPHY(POINT, 4326);
CREATE INDEX IF NOT EXISTS listings_parcel_id_idx ON listings(parcel_id);
