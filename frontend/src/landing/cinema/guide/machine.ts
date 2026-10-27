/* ============================================================
   cinema/guide/machine.ts — WP-GUIDE entry build: the dock state
   machine (§3.3: arrival / rest / transit / idleRest / idleMid / back /
   fling / lifted / hidden), onboarding + Flip, rail, on-dark
   inversion, aria-live, dock-button scroll; it also builds the reducer
   and the snap controller (one entry build per package).

   WP0 stub:
   - reveal hook: the dock ROOT (`.lp-scrollcue`) is owned here; it
     fades in 0.35 s after reveal (G3), instantly on a quiet entry;
   - the verb line follows beats.VERB_SEGMENTS (written on change);
   - settle: start = root hidden, end = root hidden (teleport).
   From Ch5 start the existing cue-off trigger in Landing is the sole
   owner of the root's "off" state.
   ============================================================ */

import gsap from "gsap";
import { FrameOrder, type CinemaCtx } from "../types";
import { GATEWAY_TIMING, MARKS, segmentAt } from "../beats";
import { build as buildReducer } from "./reducer";
import { build as buildSnap } from "./snap";

const ROOT = ".lp-scrollcue";

export function build(ctx: CinemaCtx): void {
  buildReducer(ctx);
  buildSnap(ctx);

  const root = document.querySelector<HTMLElement>(ROOT);
  const verbEl = root?.querySelector<HTMLElement>(".cx-guide__verb") ?? null;
  let revealTween: gsap.core.Tween | null = null;

  ctx.onReveal(({ quiet }) => {
    revealTween?.kill();
    revealTween = gsap.to(ROOT, {
      autoAlpha: 1,
      duration: quiet ? 0 : 0.35,
      delay: quiet ? 0 : GATEWAY_TIMING.G3.dockAt,
      ease: "rk-settle",
      overwrite: "auto",
    });
  });
  ctx.onPhase((p) => {
    if (p !== "radar") revealTween?.kill();
  });

  let lastVerb = verbEl?.textContent ?? "";
  let aboveCta = false;
  ctx.frame.add(FrameOrder.Guide, (vh) => {
    if (!root || !verbEl) return;
    const verb = segmentAt(vh).verb;
    if (verb !== lastVerb) {
      verbEl.textContent = verb;
      lastVerb = verb;
    }
    // mobile: once the CTA is up (755), the dock stacks above its row
    const above = ctx.isMobile && vh >= MARKS.ctaVisible;
    if (above !== aboveCta) {
      root.classList.toggle("is-above-cta", above);
      aboveCta = above;
    }
  });

  const hide = () => {
    revealTween?.kill();
    gsap.set(ROOT, { autoAlpha: 0, overwrite: "auto" });
  };
  ctx.settle.register("guide.dock", { start: hide, end: hide }, ROOT);
  ctx.onDestroy(() => revealTween?.kill());
}
