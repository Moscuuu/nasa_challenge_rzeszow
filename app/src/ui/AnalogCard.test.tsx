import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Cell, CellFeature, MarsSite } from "../data/types";
import { appStore } from "../state/store";
import { AnalogCard, monthsLabel, shortLabel, verdict } from "./AnalogCard";

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
  it("shows coordinates when place is null, Pending for polygons and Best overall", () => {
    render(<AnalogCard />);
    expect(screen.getByText("77.55°S 160.85°E")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Best overall")).toBeInTheDocument();
    expect(screen.getByText(/Match 1 of 1/)).toBeInTheDocument();
  });

  it("shows the dryness row, penalised no-data text and the place as title", () => {
    appStore.setState({
      list: [{ ...cell, place: "Peary Land, Greenland", features: { ...cell.features, polygons: { ...cell.features.polygons, status: "no_data_penalized" }, dryness: { ...cell.features.ground_ice, score: 0.8 } } }],
    });
    render(<AnalogCard />);
    expect(screen.getByText("Dryness")).toBeInTheDocument();
    expect(screen.getByText("Peary Land, Greenland")).toBeInTheDocument();
    expect(screen.getByText("No data (counted as 0)")).toBeInTheDocument();
    expect(screen.getByText(/3 of 4 with data/)).toBeInTheDocument();
  });

  it("captions vs best site and shows the test window for a fallback site", () => {
    appStore.setState({ siteId: "hellas" });
    render(<AnalogCard />);
    expect(screen.getByText("Compared with Arcadia Planitia")).toBeInTheDocument();
    expect(screen.getByText("#1 for Hellas Rim")).toBeInTheDocument();
    expect(screen.getByText("Test window: Jun–Aug · 120 h/yr")).toBeInTheDocument();
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
    expect(screen.getByText("Similarity 0.42")).toBeInTheDocument();
    expect(screen.getByText("Outside top cells — no feature details")).toBeInTheDocument();
    expect(screen.getByText("Layer not delivered yet")).toBeInTheDocument();
    expect(container.querySelector(".card--dim")).not.toBeNull();
  });

  it("formats months", () => {
    expect(monthsLabel([8, 6, 7])).toBe("Jun–Aug");
    expect(monthsLabel([1, 3])).toBe("Jan, Mar");
    expect(monthsLabel([1, 2, 3, 11, 12])).toBe("Nov–Mar");
  });
});

describe("card helpers", () => {
  it("verdict words by score band", () => {
    expect(verdict(0.86)).toBe("Strong match");
    expect(verdict(0.6)).toBe("Good match");
    expect(verdict(0.45)).toBe("Fair match");
    expect(verdict(0.1)).toBe("Weak match");
  });
  it("shortLabel drops the parenthesis", () => {
    expect(shortLabel("Dryness (dry permafrost vs wet tundra)")).toBe("Dryness");
    expect(shortLabel("Ground ice")).toBe("Ground ice");
  });
});
