// Mirror of the worker's ParcelAnalysisResponse (apps/worker/routers/parcel.py),
// returned through the /api/parcel proxy.
export interface Amenity {
  name: string;
  type: string;
  subtype?: string | null;
  dist_km?: number | null;
}

export interface ParcelAnalysis {
  found: boolean;
  erf_number?: string | null;
  township?: string | null;
  municipality?: string | null;
  size_sqm?: number | null;
  boundary_geojson?: string | null;
  zone_code?: string | null;
  zone_label?: string | null;
  coverage_pct?: number | null;
  far?: number | null;
  max_storeys?: number | null;
  rezoning_difficulty?: string | null;
  forms_required?: string[] | null;
  dolomite_risk: string;
  cgs_reference?: string | null;
  max_footprint_sqm?: number | null;
  max_buildable_sqm?: number | null;
  net_buildable_sqm?: number | null;
  max_units?: number | null;
  score_schools?: number | null;
  score_transport?: number | null;
  score_amenities?: number | null;
  score_composite?: number | null;
  amenities: Amenity[];
}
