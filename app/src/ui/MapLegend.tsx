/** Key for the Earth view: what the pins, the glowing areas and the rings mean. */
export function MapLegend() {
  return (
    <div className="legend" aria-label="Map legend">
      <div className="legend-row">
        <span className="legend-pin" aria-hidden="true"><i>1</i></span>
        <span>
          Analog region, ranked
          <small>×7 = analogs inside. Click to zoom in</small>
        </span>
      </div>
      <div className="legend-row">
        <span className="legend-area" aria-hidden="true" />
        <span>Region of interest</span>
      </div>
      <div className="legend-row">
        <span className="legend-rings" aria-hidden="true" />
        <span>Rings = match shown in the card</span>
      </div>
    </div>
  );
}
