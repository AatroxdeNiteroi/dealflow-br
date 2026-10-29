/* ============================================================
   cinema/prewarm.ts — GPU-process shader prewarm (QA PERF-4; v3 WP5).

   Chrome compiles the Skia/ANGLE programs for a CSS blur the first time
   it draws one at a new sigma bucket (~0.5, 1, 1.5–2, 3, 4, 5–6 px), and
   for a gradient mask-image the first time it draws one: 40–90 ms GPU
   stalls each on a first visit, which landed in the first scroll notch
   (dock verb swaps, 2 px), J4 (respiro words, ≤ 6 px), C4b (odometer
   motion blur, ≤ 1.5 px) and the Ch4 reels' mask. While the Gateway sits
   idle (after its boot, before the click) ONE tiny drawn element steps
   through those buckets, one every 140 ms, so each compile lands where
   nothing moves; a second one carries a reel-like gradient mask. Both
   are 2×2 px at 1 % opacity in the top-left corner (invisible), and are
   removed on completion or the moment the exit starts (the returned
   cleanup). Desktop only: mobile draws no blur (§9.2).

   v3 (spec rev 3.1 §10 WP5) adds the liquid shapes' first draws, so
   they never compile mid-scroll either:
   - `clip-path: inset(… round 999px)` — capsule wipes, the card's
     `inset(… round r)` after 850, the dock pill's visual-width clip;
   - `clip-path: path(evenodd, …)` with arcs — the J6 card paper with its
     capsule hole and the 1 px evenodd rim (802–850);
   - the feathered `--scan-x` mask that sharpens "R$ 24,3 mi" behind the
     C3c scan (a hard-ish gradient whose stops follow a custom property);
   - the glyph layer's blur on a promoted layer (word-level INK 4 → 0 and
     EVAPORATE 0 → 3 px ride `will-change: transform` cells' parent).
   Each is a 4×4 px element at 1 % opacity, drawn for two buckets' time.
   ============================================================ */

const STEPS_PX = [0.5, 1, 1.5, 2, 3, 4, 5, 6] as const;
const EVERY_MS = 140;

/** A 4×4 even-odd path with round outer corners and a capsule hole (the J6 paper's shape). */
const EVENODD_PATH =
  "path(evenodd, 'M 1 0 L 3 0 A 1 1 0 0 1 4 1 L 4 3 A 1 1 0 0 1 3 4 L 1 4 A 1 1 0 0 1 0 3 L 0 1 A 1 1 0 0 1 1 0 Z " +
  "M 1.5 1.5 L 2.5 1.5 A 0.5 0.5 0 0 1 2.5 2.5 L 1.5 2.5 A 0.5 0.5 0 0 1 1.5 1.5 Z')";

export function prewarmFilters(host: HTMLElement): () => void {
  const touch = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 720;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return () => {};

  const base = "position:fixed;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;background:#1f1812;";
  const tiny = "position:fixed;top:0;width:4px;height:4px;opacity:0.01;pointer-events:none;background:#1f1812;";
  const made: HTMLElement[] = [];
  const add = (css: string): HTMLElement => {
    const el = document.createElement("span");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = css;
    made.push(el);
    return el;
  };

  // v3 liquid clips + the scan mask: on every pointer (phones draw them too)
  add(tiny + "left:6px;clip-path:inset(0 0 0 0 round 999px);");
  add(tiny + `left:11px;clip-path:${EVENODD_PATH};`);
  const scanGrad = "linear-gradient(90deg, #000 calc(var(--scan-x, 2px) - 1px), transparent calc(var(--scan-x, 2px) + 1px))";
  add(tiny + `left:16px;--scan-x:2px;-webkit-mask-image:${scanGrad};mask-image:${scanGrad};`);

  // v2 blur buckets + the reel mask (desktop only: mobile draws no blur)
  let blur: HTMLElement | null = null;
  let layerBlur: HTMLElement | null = null;
  if (!touch) {
    blur = add(base + "left:0;will-change:filter;");
    const grad = "linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)";
    add(base + `left:3px;-webkit-mask-image:${grad};mask-image:${grad};`);
    // a promoted glyph layer (will-change: transform) carrying the word blur
    layerBlur = add(tiny + "left:21px;will-change:transform;");
  }
  host.append(...made);

  let i = 0;
  let timer = 0;
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    made.forEach((el) => el.remove());
  };
  const step = () => {
    if (done) return;
    if (!blur || i >= STEPS_PX.length) {
      // let the last bucket (and the clips) be drawn once before removing them
      timer = window.setTimeout(cleanup, EVERY_MS * 2);
      return;
    }
    const px = STEPS_PX[i++];
    blur.style.filter = `blur(${px}px)`;
    if (layerBlur && px <= 4) layerBlur.style.filter = `blur(${px}px)`;
    timer = window.setTimeout(step, EVERY_MS);
  };
  timer = window.setTimeout(step, EVERY_MS);
  return cleanup;
}
