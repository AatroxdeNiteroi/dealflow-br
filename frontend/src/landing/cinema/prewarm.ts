/* ============================================================
   cinema/prewarm.ts — GPU-process shader prewarm (QA PERF-4).

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
   ============================================================ */

const STEPS_PX = [0.5, 1, 1.5, 2, 3, 4, 5, 6] as const;
const EVERY_MS = 140;

export function prewarmFilters(host: HTMLElement): () => void {
  const touch = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 720;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (touch || reduced) return () => {};

  const base = "position:fixed;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;background:#1f1812;";
  const blur = document.createElement("span");
  blur.setAttribute("aria-hidden", "true");
  blur.style.cssText = base + "left:0;will-change:filter;";
  const mask = document.createElement("span");
  mask.setAttribute("aria-hidden", "true");
  const grad = "linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)";
  mask.style.cssText = base + `left:3px;-webkit-mask-image:${grad};mask-image:${grad};`;
  host.append(blur, mask);

  let i = 0;
  let timer = 0;
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    blur.remove();
    mask.remove();
  };
  const step = () => {
    if (done) return;
    if (i >= STEPS_PX.length) {
      // let the last bucket be drawn once before removing it
      timer = window.setTimeout(cleanup, EVERY_MS);
      return;
    }
    blur.style.filter = `blur(${STEPS_PX[i++]}px)`;
    timer = window.setTimeout(step, EVERY_MS);
  };
  timer = window.setTimeout(step, EVERY_MS);
  return cleanup;
}
