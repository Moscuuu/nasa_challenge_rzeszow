import { useAppStore } from "../state/store";

export function Footer() {
  const sources = useAppStore((s) => s.manifest?.sources ?? []);
  return (
    <footer className="footer">
      <span>Sources</span>
      {sources.map((s) =>
        s.url ? (
          <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
            {s.label}
          </a>
        ) : (
          <span key={s.id}>{s.label}</span>
        ),
      )}
    </footer>
  );
}
