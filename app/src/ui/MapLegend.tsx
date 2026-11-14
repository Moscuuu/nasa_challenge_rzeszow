import { useAppStore } from "../state/store";

/** Key for the Earth view: what the white heat, the outlines and the rings mean. */
export function MapLegend() {
  const showAll = useAppStore((s) => s.showAll);
  return (
    <div className="legend" aria-label="Map legend">
      <div className="legend-row">
        <span className="legend-ramp" aria-hidden="true" />
        <span>
          Brighter = more Mars-like
          <small>{showAll ? "all permafrost shown" : "only the top 10% of permafrost shown"}</small>
        </span>
      </div>
      <div className="legend-row">
        <span className="legend-outline" aria-hidden="true" />
        <span>Outline = best-match region</span>
      </div>
      <div className="legend-row">
        <span className="legend-rings" aria-hidden="true" />
        <span>Rings = match shown in the card</span>
      </div>
    </div>
  );
}
