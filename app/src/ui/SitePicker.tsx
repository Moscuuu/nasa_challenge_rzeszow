import { useAppStore } from "../state/store";

/** Panel heading for Mars, with a dropdown that mirrors the pins (easier than hitting a small pin). */
export function SitePicker() {
  const sites = useAppStore((s) => s.sites);
  const siteId = useAppStore((s) => s.siteId);
  const selectSite = useAppStore((s) => s.selectSite);
  const stage = useAppStore((s) => s.stage);
  if (stage === "pick") {
    // Pick step: Mars alone; the pulsing pins are the only control (they are buttons, reachable with Tab).
    return (
      <div className="panel-head" data-ui>
        <h2 className="panel-title">
          <span className="step">1</span> Pick a site on Mars
        </h2>
        <p className="panel-hint">Click a pulsing site to find its analogs on Earth</p>
      </div>
    );
  }
  return (
    <div className="panel-head" data-ui>
      <h2 className="panel-title">
        <span className="step">1</span> Pick a site on Mars
      </h2>
      <label className="site-select">
        <span className="sr-only">Mars site</span>
        <select value={siteId ?? ""} onChange={(e) => void selectSite(e.target.value || null)} disabled={sites.length === 0}>
          <option value="">Any site (best overall)</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {siteId === null && <p className="panel-hint">Click a pin on the globe, or choose from the list</p>}
    </div>
  );
}
