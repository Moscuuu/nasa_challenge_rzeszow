import { useEffect, useState } from "react";

const PHONE = "(max-width: 700px)";

const query = (): MediaQueryList | null =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(PHONE) : null;

/** Texture resolution for the planets: 2k on screens ≤ 700 px wide, 4k otherwise. */
export function useTextureSize(): "2k" | "4k" {
  const [phone, setPhone] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const mql = query();
    if (!mql) return;
    const onChange = (e: { matches: boolean }) => setPhone(e.matches);
    setPhone(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return phone ? "2k" : "4k";
}
