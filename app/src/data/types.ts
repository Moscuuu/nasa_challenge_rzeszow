// Contract v0.3 (analysis -> GUI). Source: docs/contracts/analysis-to-gui/CONTRACT.md on branch contract-v0.3.

export type LayerId = "0-1m" | "1-5m" | "gt5m";
export type FeatureId = "temperature" | "ground_ice" | "polygons";
export type FeatureStatus = "ok" | "no_data" | "not_relevant" | "pending";

export interface ManifestLayer {
  id: LayerId;
  label: string;
  available: boolean;
}

export interface ManifestFeature {
  id: FeatureId;
  label: string;
  comparison: "rank" | "position" | "presence";
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
    validation: string;
  };
  sources: ManifestSource[];
}

/** One Mars-site feature block (shape varies per feature; see contract). */
export interface MarsSiteFeature {
  value?: number | null;
  rank?: number | null;
  tmin_K?: number;
  tmax_K?: number;
  amp_K?: number;
  unit: string | null;
  source: string | null;
  status?: FeatureStatus;
}

export interface MarsSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  coords_status: string;
  description: string;
  citation: string;
  features: Record<FeatureId, MarsSiteFeature>;
}

export interface SiteFeatures {
  temperature: number | null;
  ground_ice: number | null;
  strengths: FeatureId[];
  breaks_down: FeatureId[];
}

export interface CellFeature {
  score: number | null;
  parts?: Record<string, number>;
  earth_value: Record<string, number> | null;
  mars_value: Record<string, number> | null;
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
  /** null = no data for that site in this cell (never ranked). */
  site_scores: Record<string, number | null>;
  features: Record<FeatureId, CellFeature>;
  site_features: Record<string, SiteFeatures>;
  strengths: FeatureId[];
  breaks_down: FeatureId[];
  known_analog: string | null;
  place: string | null;
  experiment_window: Record<string, ExperimentWindow | null> | null;
}

export interface ValidationCheck {
  name: string;
  role: "known_analog" | "contrast";
  median_percentile: number | null;
  passed: boolean | null;
  bbox: [number, number, number, number];
}
