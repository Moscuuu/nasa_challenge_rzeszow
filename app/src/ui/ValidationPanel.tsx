import { useAppStore } from "../state/store";

export function ValidationPanel() {
  const checks = useAppStore((s) => s.checks);
  const open = useAppStore((s) => s.validationOpen);
  const openValidation = useAppStore((s) => s.openValidation);
  const focusCheck = useAppStore((s) => s.focusCheck);
  if (checks.length === 0) return null;
  const counted = checks.filter((c) => c.applicable !== false);
  const passed = counted.filter((c) => c.passed === true).length;
  return (
    <div className="validation">
      <button
        type="button"
        className={`badge${passed < counted.length ? " badge--warn" : ""}`}
        aria-expanded={open}
        title="Does the method rank known Mars-like places high and unlike places low?"
        onClick={() => openValidation(!open)}
      >
        <span>Method check</span>
        <span className="badge-num">
          {passed} of {counted.length} passed
        </span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <ul className="checks">
          <li className="checks-intro">
            Sanity test: places known to resemble Mars should rank high (known analog), unlike places low
            (contrast). Click a row to fly there.
          </li>
          {checks.map((c) => {
            const na = c.applicable === false;
            return (
              <li key={c.name}>
                <button type="button" onClick={() => focusCheck(c)}>
                  <span className="check-name">{c.name}</span>
                  <span className="check-role">{c.role === "known_analog" ? "known analog" : "contrast"}</span>
                  <span className="check-pct">
                    {na || c.median_percentile === null ? "no data" : `median ${c.median_percentile.toFixed(0)}%`}
                  </span>
                  <span className="check-mark" aria-label={na ? "not applicable" : c.passed ? "passed" : "failed"}>
                    {na ? "n/a" : c.passed ? "✓" : "✗"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
