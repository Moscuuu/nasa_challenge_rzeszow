import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createDataSource } from "./data/source";
import { appStore } from "./state/store";
import type { EarthGlobeHandle } from "./scene/EarthGlobe";
import type { MarsGlobeHandle } from "./scene/MarsGlobe";
import { hasWebGL, NO_WEBGL_MESSAGE } from "./scene/webgl";

// three.js and the scene load in their own chunk, after first paint.
const Stage = lazy(() => import("./scene/Stage").then((m) => ({ default: m.Stage })));

export default function App() {
  const root = useRef<HTMLDivElement>(null!);
  const mars = useRef<HTMLElement>(null!);
  const marsGlobe = useRef<MarsGlobeHandle>(null);
  const earth = useRef<HTMLElement>(null!);
  const earthGlobe = useRef<EarthGlobeHandle>(null);
  const [webgl] = useState(hasWebGL);

  useEffect(() => {
    // Dev-only hooks for browser checks (Playwright / console).
    if (import.meta.env.DEV) Object.assign(window, { __store: appStore, __mars: marsGlobe, __earth: earthGlobe });
    appStore
      .getState()
      .init(createDataSource(import.meta.env.VITE_DATA_BASE ?? "/data/"))
      .catch((e: unknown) => console.error("Failed to load data", e));
  }, []);

  return (
    <div className="layout" ref={root}>
      <header>
        <h1>Analog Finder</h1>
      </header>
      <section data-slot="mars" ref={mars} aria-label="Mars, pick a base site">
        {!webgl && <p className="no-webgl">{NO_WEBGL_MESSAGE}</p>}
      </section>
      <section data-slot="soil" />
      <section data-slot="earth" ref={earth} aria-label="Earth, similarity map" />
      <aside data-slot="card" />
      {webgl && (
        <Suspense fallback={null}>
          <Stage eventSource={root} slots={{ mars, earth }} marsGlobe={marsGlobe} earthGlobe={earthGlobe} />
        </Suspense>
      )}
    </div>
  );
}
