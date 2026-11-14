import { useAppStore } from "../state/store";

const HEIGHTS = [22, 34, 48];

export function SoilPicker() {
  const layers = useAppStore((s) => s.manifest?.layers ?? []);
  const layer = useAppStore((s) => s.layer);
  const selectLayer = useAppStore((s) => s.selectLayer);
  return (
    <div className="soil" role="group" aria-label="Depth layer">
      {layers.map((l, i) => (
        <button
          key={l.id}
          type="button"
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
