import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createDataSource } from "./data/source";
import { useMotion } from "./motion/useMotion";
import { appStore } from "./state/store";
import type { EarthGlobeHandle } from "./scene/EarthGlobe";
import type { MarsGlobeHandle } from "./scene/MarsGlobe";
import { Effects } from "./scene/Effects";
import { hasWebGL, NO_WEBGL_MESSAGE } from "./scene/webgl";
import { AnalogCard } from "./ui/AnalogCard";
import { Footer } from "./ui/Footer";
import { HoldToDrill } from "./ui/HoldToDrill";
import { MapLegend } from "./ui/MapLegend";
import { ShowAllToggle } from "./ui/ShowAllToggle";
import { SitePicker } from "./ui/SitePicker";
import { SoilPicker } from "./ui/SoilPicker";
import { ValidationPanel } from "./ui/ValidationPanel";
import "./ui/ui.css";

// three.js and the scene load in their own chunk, after first paint.
const Stage = lazy(() => import("./scene/Stage").then((m) => ({ default: m.Stage })));

export default function App() {
  const root = useRef<HTMLDivElement>(null!);
  const mars = useRef<HTMLElement>(null!);
  const marsGlobe = useRef<MarsGlobeHandle>(null);
  const earth = useRef<HTMLElement>(null!);
  const earthGlobe = useRef<EarthGlobeHandle>(null);
  const [webgl] = useState(hasWebGL);
  const [error, setError] = useState<string | null>(null);
  const veil = useMotion(marsGlobe, earthGlobe, webgl, error !== null);

  useEffect(() => {
    // Dev-only hooks for browser checks (Playwright / console).
    if (import.meta.env.DEV) Object.assign(window, { __store: appStore, __mars: marsGlobe, __earth: earthGlobe });
    appStore
      .getState()
      .init(createDataSource(import.meta.env.VITE_DATA_BASE ?? "/data/"))
      .catch((e: unknown) => {
        console.error("Failed to load data", e);
        setError("Could not load the data. Reload the page to try again.");
      });
  }, []);

  return (
    <div className="layout" ref={root}>
      <header>
        <div className="brand">
          <h1>Analog Finder</h1>
          <p className="tagline">Find places on Earth whose frozen ground behaves like Mars</p>
        </div>
        <ValidationPanel />
      </header>
      <section data-slot="mars" ref={mars} aria-label="Mars, pick a base site">
        <SitePicker />
        {!webgl && <p className="no-webgl">{NO_WEBGL_MESSAGE}</p>}
      </section>
      <section data-slot="soil" aria-label="Soil depth layer">
        <SoilPicker />
      </section>
      <section data-slot="earth" ref={earth} aria-label="Earth, similarity map">
        <div className="panel-head panel-head--row" data-ui>
          <h2 className="panel-title">
            <span className="step">3</span> Matches on Earth
          </h2>
          <ShowAllToggle />
        </div>
        <MapLegend />
      </section>
      <aside data-slot="card">
        <AnalogCard error={error} />
      </aside>
      <Footer />
      <Effects />
      {webgl && <HoldToDrill />}
      {veil && (
        <div className="intro-veil" role="status">
          <p>Loading Earth and Mars…</p>
        </div>
      )}
      {webgl && (
        <Suspense fallback={null}>
          <Stage eventSource={root} slots={{ mars, earth }} marsGlobe={marsGlobe} earthGlobe={earthGlobe} />
        </Suspense>
      )}
    </div>
  );
}
