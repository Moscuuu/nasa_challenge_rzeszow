import { useEffect, useRef } from "react";
import { pickLayerTimeline } from "../motion/timelines";
import { useAppStore } from "../state/store";

const HEIGHTS = [22, 34, 48];

export function SoilPicker() {
  const layers = useAppStore((s) => s.manifest?.layers ?? []);
  const layer = useAppStore((s) => s.layer);
  const selectLayer = useAppStore((s) => s.selectLayer);
  const choosing = useAppStore((s) => s.stage === "depth");
  const siteName = useAppStore((s) => s.sites.find((x) => x.id === s.siteId)?.name);
  const first = useRef(true);
  const count = layers.length;
  // Picking a layer splits the block like a core sample (the first run just sets the resting state).
  useEffect(() => {
    if (count === 0) return;
    const tl = pickLayerTimeline(layer);
    if (first.current) tl.progress(1);
    first.current = false;
  }, [layer, count]);
  return (
    <div className="soil" role="group" aria-labelledby="soil-title">
      {choosing && siteName && <p className="soil-site">{siteName}</p>}
      <h2 className="panel-title" id="soil-title">
        <span className="step">2</span> Choose soil depth
      </h2>
      {choosing && <p className="panel-hint">Pick a depth to see the matches on Earth</p>}
      {layers.map((l, i) => (
        <button
          key={l.id}
          type="button"
          data-layer={l.id}
          className={`slab${l.available ? "" : " slab--soon"}`}
          style={{ height: HEIGHTS[i] ?? 48 }}
          aria-pressed={l.id === layer}
          onClick={() => void selectLayer(l.id)}
        >
          <span>{l.label}</span>
          {!l.available && <em>coming soon</em>}
        </button>
      ))}
    </div>
  );
}
