import { useEffect, useRef, type KeyboardEvent } from "react";
import { motion } from "../motion/registry";
import { cardBuildTimeline } from "../motion/timelines";
import { featuresFor, formatCoords, placeLabel } from "../data/cells";
import type { FeatureRow } from "../data/cells";
import type { FeatureId, FeatureStatus } from "../data/types";
import { currentCell, useAppStore } from "../state/store";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUS_TEXT: Record<FeatureStatus, string> = {
  ok: "No data",
  pending: "Pending",
  no_data: "No data",
  no_data_penalized: "No data (counted as 0)",
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

/** Plain-word verdict for a 0..1 similarity score. */
export function verdict(score: number): string {
  if (score >= 0.8) return "Strong match";
  if (score >= 0.6) return "Good match";
  if (score >= 0.4) return "Fair match";
  return "Weak match";
}

/** Short feature name: the manifest label up to its first parenthesis. */
export function shortLabel(label: string): string {
  return label.replace(/\s*\(.*$/, "");
}

/** "tmin_K" -> "tmin", "K"; "active_layer_m" -> "active layer", "m". */
function valueRow(key: string, v: number | null): { name: string; text: string } {
  const m = key.match(/^(.*)_(K|m|mm_yr)$/);
  const name = (m ? m[1] : key).replace(/_/g, " ");
  const unit = m ? ` ${m[2] === "mm_yr" ? "mm/yr" : m[2]}` : "";
  if (v === null || v === undefined) return { name, text: "—" };
  const num = Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2);
  return { name, text: num + unit };
}

type Vals = Record<string, number | null> | null;

/**
 * Earth vs Mars raw values. Same keys on both planets (temperature) -> one table, side by side;
 * different keys (each planet measured its own way) -> one block per planet.
 */
export function ValuesTable({ earth, mars, marsName }: { earth: Vals; mars: Vals; marsName: string }) {
  const ek = Object.keys(earth ?? {});
  const mk = Object.keys(mars ?? {});
  const same = ek.length > 0 && ek.length === mk.length && ek.every((k) => mk.includes(k));
  const block = (title: string, v: Vals) => {
    const keys = Object.keys(v ?? {});
    if (keys.length === 0) return null;
    return (
      <>
        <tr className="f-values-sub">
          <th colSpan={2}>{title}</th>
        </tr>
        {keys.map((k) => {
          const r = valueRow(k, v![k]);
          return (
            <tr key={title + k}>
              <th>{r.name}</th>
              <td>{r.text}</td>
            </tr>
          );
        })}
      </>
    );
  };
  return (
    <table className="f-values">
      {same ? (
        <>
          <thead>
            <tr>
              <th />
              <th>Earth</th>
              <th>Mars</th>
            </tr>
          </thead>
          <tbody>
            {ek.map((k) => (
              <tr key={k}>
                <th>{valueRow(k, null).name}</th>
                <td>{valueRow(k, earth![k]).text}</td>
                <td>{valueRow(k, mars![k]).text}</td>
              </tr>
            ))}
          </tbody>
        </>
      ) : (
        <tbody>
          {block("Earth", earth)}
          {block(`Mars · ${marsName}`, mars)}
        </tbody>
      )}
    </table>
  );
}

export function AnalogCard({ error }: { error?: string | null }) {
  const s = useAppStore((st) => st);
  const manifest = s.manifest;
  const cell = currentCell(s);
  const cardEl = useRef<HTMLDivElement>(null);
  const buildKey = `${s.siteId}|${s.layer}|${cell ? `${cell.lat},${cell.lon}` : ""}|${s.earthHit?.kind ?? ""}`;
  // Card build each time the shown cell changes (the intro runs its own build).
  useEffect(() => {
    const el = cardEl.current;
    if (!el || !cell || motion.introActive) return;
    const tl = cardBuildTimeline(el);
    return () => {
      tl.progress(1);
      tl.kill();
    };
  }, [buildKey]); // eslint-disable-line react-hooks/exhaustive-deps
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
        <p className="card-score card-score--mini">Similarity {s.earthHit.score.toFixed(2)}</p>
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
        <h2 className="card-place">{placeLabel(cell)}</h2>
        <p className="card-sub">
          {placeLabel(cell) !== formatCoords(cell.lat, cell.lon) && <>{formatCoords(cell.lat, cell.lon)} · </>}
          Global rank #{cell.rank}
        </p>
        <div className="card-scorebox">
          <span className="card-label">Similarity to Mars</span>
          <p className="card-score">{score === null ? <small>no data</small> : score.toFixed(2)}</p>
          {score !== null && (
            <p className="card-verdict">
              {verdict(score)}
              {isTop && <> · better than {Math.min(cell.percentile, 99.9).toFixed(1)}% of permafrost</>}
            </p>
          )}
          <p className="card-caption">0 = nothing alike · 1 = identical. One weak feature pulls it down.</p>
        </div>
        {f.vsSiteId && <p className="card-caption">Compared with {siteName(f.vsSiteId)}</p>}
        {f.tiedSiteIds.length > 1 && <p className="card-caption">Tied: {f.tiedSiteIds.map(siteName).join(", ")}</p>}
        <div className="features-head">
          <span>
            Features
            {f.featureCount.ok < f.featureCount.total && (
              <>
                {" "}
                · {f.featureCount.ok} of {f.featureCount.total} with data
              </>
            )}
          </span>
          <span className="features-key">✓ strong · ✗ weak</span>
        </div>
        <ul className="features">
          {f.rows.map((r: FeatureRow) => {
            const full = featLabel(r.id);
            const data = cell.features[r.id];
            const hasValues = !!(data?.earth_value || data?.mars_value);
            const mark = f.strengths.includes(r.id) ? "✓" : f.breaks.includes(r.id) ? "✗" : "";
            const head = (
              <>
                <span className="f-mark" aria-hidden="true">
                  {mark}
                </span>
                <span className="f-name" title={full}>
                  {shortLabel(full)}
                </span>
                {r.status === "ok" && r.score !== null ? (
                  <span className="f-score">
                    <span className="f-bar" role="img" aria-label={`${full} ${r.score.toFixed(2)}`}>
                      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, r.score)) * 100)}%` }} />
                    </span>
                    <span className="f-num">{r.score.toFixed(2)}</span>
                  </span>
                ) : (
                  <span className="f-text">{STATUS_TEXT[r.status]}</span>
                )}
              </>
            );
            return (
              <li key={r.id} data-break={f.breaks.includes(r.id) ? "true" : undefined}>
                {hasValues ? (
                  <details>
                    <summary className="f-row">{head}</summary>
                    <div className="f-detail">
                      <ValuesTable earth={data!.earth_value} mars={data!.mars_value} marsName={siteName(cell.best_site_id)} />
                      <small className="f-unit">
                        Mars values: {siteName(cell.best_site_id)}
                        {data!.unit && <> · {data!.unit}</>}
                      </small>
                    </div>
                  </details>
                ) : (
                  <div className="f-row">{head}</div>
                )}
                {r.id === "polygons" && r.status === "ok" && (
                  <small className="f-note">estimated from ground temperature</small>
                )}
              </li>
            );
          })}
        </ul>
        <p className="features-tip">Click a feature to compare Earth and Mars values.</p>
        {cell.known_analog && <span className="chip">{cell.known_analog}</span>}
        {win && (
          <p className="card-window">
            Test window: {monthsLabel(win.months)} · {win.hours_per_year} h/yr
          </p>
        )}
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
          <span className="card-nav-count">
            Match {s.index + 1} of {s.list.length}
            <small>← → keys to browse</small>
          </span>
          <button type="button" aria-label="Next cell" onClick={() => s.step(1)}>
            →
          </button>
        </nav>
      )}
    </div>
  );
}
