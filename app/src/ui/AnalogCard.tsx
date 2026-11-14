import type { KeyboardEvent } from "react";
import { featuresFor, formatCoords, placeLabel } from "../data/cells";
import type { FeatureRow } from "../data/cells";
import type { FeatureId, FeatureStatus } from "../data/types";
import { currentCell, useAppStore } from "../state/store";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUS_TEXT: Record<FeatureStatus, string> = {
  ok: "No data",
  pending: "Pending",
  no_data: "No data",
  not_relevant: "Not relevant",
};

export function monthsLabel(months: number[]): string {
  const m = [...months].sort((a, b) => a - b);
  if (m.length === 0) return "";
  const name = (n: number) => MONTHS[n - 1] ?? String(n);
  // A window that wraps the year (Nov–Mar) is contiguous modulo 12: start after the largest gap.
  const gaps = m.map((x, i) => ((m[(i + 1) % m.length] - x + 11) % 12) + (m.length === 1 ? 1 : 0));
  const start = m.length > 1 ? (gaps.indexOf(Math.max(...gaps)) + 1) % m.length : 0;
  m.push(...m.splice(0, start));
  const contiguous = m.every((x, i) => i === 0 || (x - m[i - 1] + 12) % 12 === 1);
  return contiguous && m.length > 1 ? `${name(m[0])}–${name(m[m.length - 1])}` : m.map(name).join(", ");
}

export function AnalogCard({ error }: { error?: string | null }) {
  const s = useAppStore((st) => st);
  const manifest = s.manifest;
  const cell = currentCell(s);
  const siteName = (id: string) => s.sites.find((x) => x.id === id)?.name ?? id;
  const featLabel = (id: FeatureId) => manifest?.features.find((f) => f.id === id)?.label ?? id;

  let body;
  if (error) {
    body = (
      <p className="card-note" role="alert">
        {error}
      </p>
    );
  } else if (s.earthHit?.kind === "none") {
    body = (
      <>
        <p className="card-place">{formatCoords(s.earthHit.lat, s.earthHit.lon)}</p>
        <p className="card-note">No permafrost here</p>
      </>
    );
  } else if (s.earthHit?.kind === "score") {
    body = (
      <>
        <p className="card-place">{formatCoords(s.earthHit.lat, s.earthHit.lon)}</p>
        <p className="card-score">Similarity {s.earthHit.score.toFixed(2)}</p>
        <p className="card-note">Outside top cells — no feature details</p>
      </>
    );
  } else if (cell) {
    const f = featuresFor(cell, s.siteId);
    const score = s.siteId ? (cell.site_scores[s.siteId] ?? null) : cell.score;
    const win = s.siteId ? cell.experiment_window?.[s.siteId] : null;
    const isTop = s.earthHit === null;
    body = (
      <>
        <p className="card-rank">
          {isTop ? (s.siteId ? `#${s.index + 1} for ${siteName(s.siteId)}` : "Best overall") : "Selected cell"}
        </p>
        <p className="card-sub">Global rank #{cell.rank}</p>
        <h2 className="card-place">{placeLabel(cell)}</h2>
        <p className="card-score">{score === null ? <small>no data</small> : score.toFixed(2)}</p>
        {f.vsSiteId && <p className="card-caption">vs {siteName(f.vsSiteId)}</p>}
        {f.tiedSiteIds.length > 1 && <p className="card-caption">Tied: {f.tiedSiteIds.map(siteName).join(", ")}</p>}
        {f.featureCount.ok < f.featureCount.total && (
          <p className="card-caption">
            {f.featureCount.ok} of {f.featureCount.total} features
          </p>
        )}
        <ul className="features">
          {f.rows.map((r: FeatureRow) => (
            <li key={r.id}>
              <span className="f-mark" aria-hidden="true">
                {f.strengths.includes(r.id) ? "✓" : f.breaks.includes(r.id) ? "✗" : ""}
              </span>
              <span className="f-name">{featLabel(r.id)}</span>
              {r.status === "ok" && r.score !== null ? (
                <span className="f-bar" role="img" aria-label={`${featLabel(r.id)} ${r.score.toFixed(2)}`}>
                  <i style={{ width: `${Math.round(Math.max(0, Math.min(1, r.score)) * 100)}%` }} />
                </span>
              ) : (
                <span className="f-text">{STATUS_TEXT[r.status]}</span>
              )}
              {r.id === "polygons" && r.status === "ok" && (
                <small className="f-note">estimated from ground temperature</small>
              )}
            </li>
          ))}
        </ul>
        {cell.known_analog && <span className="chip">{cell.known_analog}</span>}
        {win && (
          <p className="card-window">
            Test window: {monthsLabel(win.months)} · {win.hours_per_year} h/yr
          </p>
        )}
      </>
    );
  } else {
    body = <p className="card-note">{manifest ? "Pick a base site on Mars" : "Loading…"}</p>;
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") s.step(-1);
    else if (e.key === "ArrowRight") s.step(1);
  };
  return (
    <div className={`card${s.layerPending ? " card--dim" : ""}`} tabIndex={0} onKeyDown={onKey} aria-label="Analog card">
      {s.layerPending && <p className="card-pending">Layer not delivered yet</p>}
      <div className="card-body">{body}</div>
      {s.list.length > 0 && (
        <nav className="card-nav" aria-label="Step through cells">
          <button type="button" aria-label="Previous cell" onClick={() => s.step(-1)}>
            ←
          </button>
          <span>
            {s.index + 1} / {s.list.length}
          </span>
          <button type="button" aria-label="Next cell" onClick={() => s.step(1)}>
            →
          </button>
        </nav>
      )}
    </div>
  );
}
