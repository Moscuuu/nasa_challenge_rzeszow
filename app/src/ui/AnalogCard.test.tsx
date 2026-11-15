import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Cell, CellFeature, MarsSite } from "../data/types";
import { appStore } from "../state/store";
import { AnalogCard, formatValues, shortLabel } from "./AnalogCard";

const feat = (score: number | null, status: CellFeature["status"] = "ok"): CellFeature => ({
  score, earth_value: null, mars_value: null, unit: null, status, source: null,
});
const cell: Cell = {
  id: "c1", lat: -77.55, lon: 160.85, rank: 3, percentile: 99, score: 0.8,
  best_site_id: "arcadia", tied_site_ids: ["arcadia"], site_scores: { arcadia: 0.8, hellas: 0.6 },
  features: { temperature: feat(0.9), ground_ice: feat(0.5), polygons: feat(null, "pending") },
  strengths: ["temperature"], breaks_down: ["ground_ice"], known_analog: null, place: null,
  experiment_window: { hellas: { months: [6, 7, 8], hours_local: [12], hours_per_year: 120, mars_range_K: [150, 250] } },
};
const sites = [
  { id: "arcadia", name: "Arcadia Planitia" },
  { id: "hellas", name: "Hellas Rim" },
] as MarsSite[];
const manifest = { features: [{ id: "temperature", label: "Temperature" }, { id: "ground_ice", label: "Ground ice" }, { id: "polygons", label: "Polygons" }, { id: "dryness", label: "Dryness" }], layers: [] } as never;

beforeEach(() =>
  appStore.setState({ manifest, sites, siteId: null, list: [cell], index: 0, earthHit: null, layerPending: false }),
);

describe("AnalogCard", () => {
  it("shows rank, coordinates as title when place is null, and a dash for features without values", () => {
    render(<AnalogCard />);
    expect(screen.getByText("Rank #3")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("77.55°S 160.85°E")).toBeInTheDocument();
    expect(screen.getByText("Polygons")).toBeInTheDocument();
    expect(screen.getByText(/Match 1 of 1/)).toBeInTheDocument();
  });

  it("shows the place as title with coordinates under it and no mention of the Mars site", () => {
    appStore.setState({ siteId: "hellas", list: [{ ...cell, place: "Peary Land, Greenland" }] });
    render(<AnalogCard />);
    expect(screen.getByText("Peary Land, Greenland")).toBeInTheDocument();
    expect(screen.getByText("77.55°S 160.85°E")).toBeInTheDocument();
    expect(screen.queryByText(/Hellas|Arcadia/)).toBeNull();
    expect(screen.queryByText(/Similarity to Mars/)).toBeNull();
  });

  it("shows Earth value with muted Mars value next to it", () => {
    const withValues: Cell = {
      ...cell,
      features: {
        ...cell.features,
        temperature: { ...feat(0.9), earth_value: { tmin_K: 221.4 }, mars_value: { tmin_K: 150.2 } },
      },
    };
    appStore.setState({ list: [withValues] });
    const { container } = render(<AnalogCard />);
    expect(container.querySelector(".f-val")?.textContent).toBe("221 K150 K");
    expect(container.querySelector(".f-mars")?.textContent).toBe("150 K");
  });

  it("none hit shows 'No permafrost here' and no score", () => {
    appStore.setState({ earthHit: { kind: "none", lat: 10, lon: 20 } });
    const { container } = render(<AnalogCard />);
    expect(screen.getByText("No permafrost here")).toBeInTheDocument();
    expect(container.querySelector(".card-score")).toBeNull();
  });

  it("score hit shows the mini card; pending layer dims", () => {
    appStore.setState({ earthHit: { kind: "score", score: 0.42, lat: 10, lon: 20 }, layerPending: true });
    const { container } = render(<AnalogCard />);
    expect(screen.getByText("Similarity 42%")).toBeInTheDocument();
    expect(screen.getByText("Outside top cells — no feature details")).toBeInTheDocument();
    expect(screen.getByText("Layer not delivered yet")).toBeInTheDocument();
    expect(container.querySelector(".card--dim")).not.toBeNull();
  });
});

describe("card helpers", () => {
  it("shortLabel drops the parenthesis", () => {
    expect(shortLabel("Dryness (dry permafrost vs wet tundra)")).toBe("Dryness");
    expect(shortLabel("Ground ice")).toBe("Ground ice");
  });
  it("formatValues joins keys and formats units", () => {
    expect(formatValues({ tmin_K: 221.4, active_layer_m: 0.5 })).toBe("221 K · 0.50 m");
    expect(formatValues({ x_K: null })).toBe("—");
    expect(formatValues(null)).toBe("");
  });
});
