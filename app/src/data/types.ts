// Contract v0.8 (analysis -> GUI). Source: docs/contracts/analysis-to-gui/CONTRACT.md; ground truth: repo out/.

export type LayerId = "0-1m" | "1-5m" | "gt5m";
export type FeatureId = "temperature" | "ground_ice" | "polygons" | "dryness";
export type FeatureStatus = "ok" | "no_data" | "no_data_penalized" | "not_relevant" | "pending";
// no_data_penalized (v0.7): score stays null, but the overall score counts the feature as 0.

export interface ManifestLayer {
  id: LayerId;
  label: string;
  available: boolean;
}

export interface ManifestFeature {
  id: FeatureId;
  label: string;
  comparison: "rank" | "position" | "presence"; // v0.8: polygons = "position"
}

export interface ManifestSource {
  id: string;
  label: string;
  url: string | null;
}

export interface Manifest {
  contract_version: string;
  generated_at: string;
  mock?: boolean;
  cell_size_deg: number;
  layers: ManifestLayer[];
  features: ManifestFeature[];
  sites: string[];
  files: {
    mars_sites: string;
    cells_top: Partial<Record<LayerId, string>>;
    score_maps: Partial<Record<LayerId, Record<string, string>>>;
    validation: Partial<Record<LayerId, string>>;
  };
  sources: ManifestSource[];
}

/** Mars temperature block. Keys beyond the three base ones vary (summer_*, t_1_5_K, t_gt5_K): iterate, don't assume. */
export interface MarsSiteTemperature {
  tmin_K?: number;
  tmax_K?: number;
  amp_K?: number;
  summer_tmin_K?: number;
  summer_tmax_K?: number;
  summer_amp_K?: number;
  t_1_5_K?: number;
  t_gt5_K?: number;
  unit: string | null;
  source: string | null;
}

export interface MarsSiteIce {
  value: number | null;
  rank: number | null;
}

export interface MarsSitePolygons {
  value: number | null;
  rank: number | null;
  status?: FeatureStatus;
  unit?: string | null;
  source?: string | null;
}

export interface MarsSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  coords_status: string;
  description: string;
  citation: string;
  chlorine_wt_pct?: number | null;
  features: {
    temperature: MarsSiteTemperature;
    /** per-layer values, plus unit/source */
    ground_ice: Partial<Record<LayerId, MarsSiteIce>> & { unit?: string | null; source?: string | null };
    polygons: MarsSitePolygons;
  };
}

export interface SiteFeatures {
  temperature: number | null;
  ground_ice: number | null;
  polygons?: number | null;
  dryness?: number | null;
  strengths: FeatureId[];
  breaks_down: FeatureId[];
}

export interface CellFeature {
  score: number | null;
  /** temperature only; keys vary per layer */
  parts?: Record<string, number | null>;
  /** keys vary per feature and layer */
  earth_value: Record<string, number | null> | null;
  mars_value: Record<string, number | null> | null;
  unit: string | null;
  status: FeatureStatus;
  source: string | null;
}

export interface ExperimentWindow {
  months: number[];
  hours_local: number[];
  hours_per_year: number;
  mars_range_K: [number, number];
}

/** Flattened from GeoJSON by the data source (lat/lon from coordinates). */
export interface Cell {
  id: string;
  lat: number;
  lon: number;
  rank: number;
  percentile: number;
  score: number;
  best_site_id: string;
  /** all sites within 0.001 of the best score; includes best_site_id */
  tied_site_ids: string[];
  /** null = no data for that site in this cell (never ranked). */
  site_scores: Record<string, number | null>;
  /** dryness is absent in v0.5 data and not_relevant below 1 m */
  features: Record<"temperature" | "ground_ice" | "polygons", CellFeature> & { dryness?: CellFeature };
  /** absent in real v0.5-v0.8 data (present in v0.3 mocks) */
  site_features?: Record<string, SiteFeatures>;
  strengths: FeatureId[];
  breaks_down: FeatureId[];
  known_analog: string | null;
  place: string | null;
  experiment_window: Record<string, ExperimentWindow | null> | null;
}

export interface ValidationCheck {
  name: string;
  role: "known_analog" | "contrast";
  cells?: number;
  median_percentile: number | null;
  passed: boolean | null;
  /** false for contrast checks in deeper layers: do not show as a failure */
  applicable?: boolean;
  bbox?: [number, number, number, number];
}

export interface Validation {
  layer: LayerId;
  checks: ValidationCheck[];
  weights: Partial<Record<FeatureId, number>>;
  notes: string;
}
