import { useEffect, useRef } from "react";
import { pickLayerTimeline } from "../motion/timelines";
import { useAppStore } from "../state/store";

const HEIGHTS = [22, 34, 48];

export function SoilPicker() {
  const layers = useAppStore((s) => s.manifest?.layers ?? []);
  const layer = useAppStore((s) => s.layer);
  const selectLayer = useAppStore((s) => s.selectLayer);
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
    <div className="soil" role="group" aria-label="Depth layer">
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
          {!l.available && <em>coming</em>}
        </button>
      ))}
    </div>
  );
}
