import { clearSeen } from "../motion/intro";

export function Footer() {
  return (
    <footer className="footer">
      <button
        type="button"
        className="footer-replay"
        onClick={() => {
          clearSeen();
          location.reload();
        }}
      >
        Replay intro
      </button>
    </footer>
  );
}
