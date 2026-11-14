import { useAppStore } from "../state/store";

export function ShowAllToggle() {
  const showAll = useAppStore((s) => s.showAll);
  const toggle = useAppStore((s) => s.toggleShowAll);
  return (
    <button type="button" className="show-all" onClick={toggle}>
      {showAll ? "Top 10 %" : "Show all"}
    </button>
  );
}
