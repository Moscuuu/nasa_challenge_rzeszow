import { useAppStore } from "../state/store";

/** Two-option switch for the Earth heat map: only the top 10 % of permafrost, or all of it. */
export function ShowAllToggle() {
  const showAll = useAppStore((s) => s.showAll);
  const toggle = useAppStore((s) => s.toggleShowAll);
  const pick = (all: boolean) => {
    if (all !== showAll) toggle();
  };
  return (
    <div className="seg" role="group" aria-label="Heat map coverage">
      <button type="button" aria-pressed={!showAll} onClick={() => pick(false)}>
        Top 10%
      </button>
      <button type="button" aria-pressed={showAll} onClick={() => pick(true)}>
        All permafrost
      </button>
    </div>
  );
}
