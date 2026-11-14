/**
 * Ambient film grain and vignette (spec 6.5). A CSS overlay rather than a postprocessing pass:
 * the single canvas draws two scissored drei Views, which an EffectComposer would fight with,
 * and the overlay costs no GPU frame time and paints on the first frame, before three.js loads.
 */
export function Effects() {
  return (
    <div className="fx" aria-hidden="true">
      <div className="fx-grain" />
      <div className="fx-vignette" />
    </div>
  );
}
