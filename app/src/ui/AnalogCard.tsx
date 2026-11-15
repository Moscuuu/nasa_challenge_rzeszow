import { useEffect, useRef, type KeyboardEvent } from "react";
import { motion } from "../motion/registry";
import { cardBuildTimeline } from "../motion/timelines";
import { featuresFor, formatCoords, placeLabel } from "../data/cells";
import type { FeatureRow } from "../data/cells";
import type { FeatureId } from "../data/types";
import { currentCell, useAppStore } from "../state/store";

/** Short feature name: the manifest label up to its first parenthesis. */
export function shortLabel(label: string): string {
  return label.replace(/\s*\(.*$/, "");
}

/** "tmin_K" -> "5 K"-style text; several keys joined with " · "; null -> "—". */
export function formatValues(values: Record<string, number | null> | null | undefined): string {
  return Object.entries(values ?? {})
    .map(([key, v]) => {
      if (v === null || v === undefined) return "—";
      const m = key.match(/_(K|m|mm_yr)$/);
      const unit = m ? ` ${m[1] === "mm_yr" ? "mm/yr" : m[1]}` : "";
      return (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2)) + unit;
    })
    .join(" · ");
}

export function AnalogCard({ error }: { error?: string | null }) {
  const s = useAppStore((st) => st);
  const manifest = s.manifest;
  const cell = currentCell(s);
  const cardEl = useRef<HTMLDivElement>(null);
  const buildKey = `${s.cardOpen}|${s.siteId}|${s.layer}|${cell ? `${cell.lat},${cell.lon}` : ""}|${s.earthHit?.kind ?? ""}`;
  // Card build when it opens and each time the shown cell changes (never while hidden or in the intro).
  useEffect(() => {
    const el = cardEl.current;
    if (!el || !cell || !s.cardOpen || motion.introActive) return;
    const tl = cardBuildTimeline(el);
    return () => {
      tl.progress(1);
      tl.kill();
    };
  }, [buildKey]); // eslint-disable-line react-hooks/exhaustive-deps
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
        <p className="card-score card-score--mini">Similarity {Math.round(s.earthHit.score * 100)}%</p>
        <p className="card-note">Outside top cells — no feature details</p>
      </>
    );
  } else if (cell) {
    const f = featuresFor(cell, s.siteId);
    const score = s.siteId ? (cell.site_scores[s.siteId] ?? null) : cell.score;
    const place = placeLabel(cell);
    const coords = formatCoords(cell.lat, cell.lon);
    body = (
      <>
        <p className="card-rank">Rank #{cell.rank}</p>
        {score !== null && (
          <div className="card-score-row">
            <span className="card-score">{Math.round(score * 100)}%</span>
            <small>similar to Mars</small>
          </div>
        )}
        <h2 className="card-place">{place}</h2>
        {place !== coords && <p className="card-sub">{coords}</p>}
        <ul className="features">
          {f.rows.map((r: FeatureRow) => {
            const full = featLabel(r.id);
            const data = cell.features[r.id];
            const earth = formatValues(data?.earth_value) || (r.score !== null ? r.score.toFixed(2) : "—");
            const mars = formatValues(data?.mars_value);
            return (
              <li key={r.id}>
                <span className="f-name" title={full}>
                  {shortLabel(full)}
                </span>
                <span className="f-val">
                  {earth}
                  {mars && <small className="f-mars">{mars}</small>}
                </span>
              </li>
            );
          })}
        </ul>
      </>
    );
  } else {
    body = <p className="card-note">{manifest ? "Pick a base site on Mars to see its Earth matches" : "Loading…"}</p>;
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") s.step(-1);
    else if (e.key === "ArrowRight") s.step(1);
  };
  return (
    <div ref={cardEl} className={`card${s.layerPending ? " card--dim" : ""}`} tabIndex={0} onKeyDown={onKey} aria-label="Analog card">
      {s.layerPending && <p className="card-pending">Layer not delivered yet</p>}
      <div className="card-body">{body}</div>
      {s.list.length > 0 && (
        <nav className="card-nav" aria-label="Step through cells">
          <button type="button" aria-label="Previous cell" onClick={() => s.step(-1)}>
            ←
          </button>
          <span className="card-nav-count" title="← → keys to browse">
            Match {s.index + 1} of {s.list.length}
          </span>
          <button type="button" aria-label="Next cell" onClick={() => s.step(1)}>
            →
          </button>
        </nav>
      )}
    </div>
  );
}
