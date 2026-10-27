/* ============================================================
   cinema/director.ts — the master timeline (WP0, §4.2).

   ONE timeline, time unit = 1 vh, duration fixed at MASTER_END
   (1900). One ScrollTrigger: .lp-scroll "top top" → .ch4-track
   "bottom bottom" (= .ch5-track "top bottom", so Ch5 chains
   unchanged), scrub: true → no catch-up tween: ScrollTrigger.update()
   alone sets the exact progress, getTween() is undefined, and the
   teleport loop skips it safely.

   Created inside Landing's mount gsap.context BEFORE the Ch5 block
   (teleport's creation-order settle depends on it).
   ============================================================ */

import gsap from "gsap";
import { BEATS, MASTER_END, RESTS } from "./beats";

export interface Director {
  tl: gsap.core.Timeline;
  st: ScrollTrigger;
  /** Current master time (vh). */
  vh(): number;
  /** Master vh → document scroll px (valid after the trigger's refresh). */
  vhToPx(vh: number): number;
  /** Document scroll px → master vh (unclamped). */
  pxToVh(px: number): number;
  /** Fan-out of the trigger's onUpdate (acts + guide bookkeeping only). */
  listen(fn: (vh: number) => void): () => void;
  /** Set the master to an exact progress outside of scrolling (settle). */
  setProgress(p: 0 | 1): void;
}

export function createDirector(): Director {
  const listeners = new Set<(vh: number) => void>();
  const tl = gsap.timeline({
    defaults: { ease: "none" }, // local; global gsap.defaults stays rk-settle for Ch5
    scrollTrigger: {
      trigger: ".lp-scroll",
      start: "top top",
      endTrigger: ".ch4-track",
      end: "bottom bottom",
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: () => {
        const vh = tl.time();
        listeners.forEach((fn) => fn(vh));
      },
    },
  });
  // fixes the duration: 1 timeline second = 1 vh
  tl.to({}, { duration: MASTER_END }, 0);
  for (const r of RESTS) tl.addLabel(r.id, r.at);
  for (const b of BEATS) tl.addLabel(b.id, b.start);

  const st = tl.scrollTrigger!;
  return {
    tl,
    st,
    vh: () => tl.time(),
    vhToPx: (vh) => st.start + (vh / MASTER_END) * (st.end - st.start),
    pxToVh: (px) => (st.end === st.start ? 0 : ((px - st.start) / (st.end - st.start)) * MASTER_END),
    listen(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setProgress(p) {
      tl.progress(p);
      const vh = tl.time();
      listeners.forEach((fn) => fn(vh));
    },
  };
}
