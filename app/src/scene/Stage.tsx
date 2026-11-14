import { Suspense, type MutableRefObject, type Ref } from "react";
import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
import { EarthGlobe, type EarthGlobeHandle } from "./EarthGlobe";
import { MarsGlobe, type MarsGlobeHandle } from "./MarsGlobe";

interface Props {
  /** App root: receives pointer events for every view. */
  eventSource: MutableRefObject<HTMLElement>;
  /** DOM slots the 3D views are drawn into. */
  slots: { mars: MutableRefObject<HTMLElement>; earth: MutableRefObject<HTMLElement> };
  marsGlobe?: Ref<MarsGlobeHandle>;
  earthGlobe?: Ref<EarthGlobeHandle>;
}

/** One full-window canvas; each 3D scene is a drei View scissored onto its DOM slot. */
export function Stage({ eventSource, slots, marsGlobe, earthGlobe }: Props) {
  return (
    <Canvas
      className="stage"
      eventSource={eventSource}
      style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <View track={slots.mars}>
        <Suspense fallback={null}>
          <MarsGlobe ref={marsGlobe} slot={slots.mars} />
        </Suspense>
      </View>
      <View track={slots.earth}>
        <Suspense fallback={null}>
          <EarthGlobe ref={earthGlobe} slot={slots.earth} />
        </Suspense>
      </View>
    </Canvas>
  );
}
