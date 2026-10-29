/* ============================================================
   cinema/guide/snap.ts — directional snap controller (§4.7). Owner:
   WP-GUIDE. Provides `LIVE_KEYS.guideSnap`; CinemaHandle.snap.start /
   stop delegate here (teleport, return home, overlay, Historia /
   Boletim, phase changes).

   - Desktop only: `(pointer: fine) and (prefers-reduced-motion:
     no-preference)` AND FLAGS.SNAP (kill switch). Never on touch.
   - Trigger: 220 ms after the last wheel event AND !blocked(). One
     decision per wheel gesture. QA fix (SNAP-STOP-LURCH): it no longer
     waits for the Lenis glide to die (|velocity| < 0.2 px/frame made it
     stop → pause → lurch). The decision is taken on WHERE THE GLIDE WILL
     LAND (lenis.targetScroll), and the snap continues the glide at its
     current speed (velocity-matched cubic Hermite).
   - Candidates R1–R7 only (never R0, never a target ≥ 1800: the
     handoff and Ch5 are never snapped). Rest px = master.start +
     (R/1900)·(master.end − master.start), read live from the master's
     trigger (ctx.vhToPx), so it is always the post-refresh value.
   - Rule: inside a plateau → nothing; else the nearest rest AHEAD in
     the last direction of travel within 30 vh → snap; else any rest
     within 6 vh (rest-centre distance) → snap; else nothing.
     (With 8 vh plateaus the 6 vh rule can only fire if PLATEAU_HALF is
     ever retuned below 6 — kept as the spec's safety net.)
   - Motion: lenis.scrollTo(px, { duration: clamp(.45, |Δvh|/100·1.6,
     .7), easing: hermite(m0) }) — an in-out curve whose start slope m0 =
     v0·D/Δ (clamped 0..3, so monotone) matches the glide's speed: one
     continuous move per gesture; from rest (m0 = 0) it is a smoothstep,
     never a full-speed start. Any wheel input interrupts it (Lenis
     retargets from the animated position).
   - Rejected on purpose: ScrollTrigger snap (double-eases against
     Lenis), lenis/snap proximity (non-directional), auto-complete.
   ============================================================ */

import { FrameOrder, LIVE_KEYS, type CinemaCtx, type GuideSnapBus, type SnapController } from "../types";
import { MARKS, MASTER_END, RESTS, type Rest } from "../beats";
import { clamp } from "../geometry";
import { runtime } from "../runtime";

const CANDIDATES: readonly Rest[] = RESTS.filter((r) => r.plateau !== null && r.at < MARKS.snap.maxVh);

/** Cubic Hermite from (0, slope m0) to (1, slope 0): monotone for 0 ≤ m0 ≤ 3. */
const hermite =
  (m0: number) =>
  (t: number): number =>
    m0 * (t * t * t - 2 * t * t + t) + (3 * t * t - 2 * t * t * t);

/** The rest to snap to from `vh` after travelling in `dir`, or null (§4.7 rule). */
export function snapTarget(vh: number, dir: 1 | -1): Rest | null {
  for (const r of CANDIDATES) {
    const p = r.plateau!;
    if (vh >= p[0] && vh <= p[1]) return null; // already resting
  }
  let best: Rest | null = null;
  let bestD = Infinity;
  for (const r of CANDIDATES) {
    const d = (r.at - vh) * dir; // > 0 = ahead in the direction of travel
    if (d > 0 && d <= MARKS.snap.aheadVh && d < bestD) {
      best = r;
      bestD = d;
    }
  }
  if (best) return best;
  for (const r of CANDIDATES) {
    const d = Math.abs(r.at - vh);
    if (d <= MARKS.snap.anyVh && d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

export function build(ctx: CinemaCtx, bus: GuideSnapBus): void {
  const mql = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
  let capable = mql.matches;
  const onMql = () => {
    capable = mql.matches;
  };
  mql.addEventListener("change", onMql);

  let stopped = false; // external stop (teleport, return, overlay, phase)
  let gesture = false; // a wheel gesture is awaiting its one decision
  let lastWheelAt = -1e9;

  const onWheel = () => {
    lastWheelAt = performance.now();
    gesture = true;
  };
  window.addEventListener("wheel", onWheel, { passive: true, capture: true });

  const controller: SnapController = {
    start() {
      stopped = false;
    },
    stop() {
      stopped = true;
      gesture = false;
    },
  };
  ctx.live.provide<SnapController>(LIVE_KEYS.guideSnap, controller);

  // the handle stops the snap on every non-radar phase; re-arm on radar
  // (after a return home nobody else calls start() once the radar opens)
  ctx.onPhase((p) => {
    gesture = false;
    if (p === "radar") stopped = false;
  });

  ctx.frame.add(FrameOrder.Guide, (vh, _t, dt) => {
    if (!gesture) return;
    if (!ctx.flags.SNAP || !capable || stopped || bus.phase !== "radar" || bus.flying || runtime.blocked()) {
      gesture = false;
      return;
    }
    const lenis = runtime.lenis();
    if (!lenis || lenis.isStopped) {
      gesture = false;
      return;
    }
    if (performance.now() - lastWheelAt < MARKS.snap.idleMs) return;
    gesture = false; // one decision per gesture, whatever it is
    // px per 60 Hz frame (signed), so the numbers mean the same at 120 Hz
    const v60 = lenis.velocity / Math.max(dt * 60, 0.25);
    // where the glide will land (= vh once it has died out)
    const pxPerVh = (ctx.vhToPx(MASTER_END) - ctx.vhToPx(0)) / MASTER_END;
    const gliding = Math.abs(v60) >= MARKS.snap.maxVelocity && pxPerVh > 0;
    const landVh = gliding ? vh + (lenis.targetScroll - lenis.animatedScroll) / pxPerVh : vh;
    if (vh >= MASTER_END || landVh >= MASTER_END) return; // Ch5 zone: never pulled back into the cinema
    const r = snapTarget(landVh, bus.lastDir);
    if (!r) return;
    const dVh = r.at - vh;
    if (Math.abs(dVh) < 0.05) return;
    const duration = clamp((Math.abs(dVh) / 100) * 1.6, 0.45, 0.7);
    // continue the glide at its own speed when it heads toward the rest
    const v0 = gliding && Math.sign(v60) === Math.sign(dVh) ? (Math.abs(v60) * 60) / pxPerVh : 0; // vh per s
    const m0 = clamp((v0 * duration) / Math.abs(dVh), 0, 3);
    lenis.scrollTo(ctx.vhToPx(r.at), { duration, easing: hermite(m0) });
  });

  ctx.settle.register("guide.snap", {
    start() {
      gesture = false;
    },
    end() {
      gesture = false;
    },
  });

  ctx.onDestroy(() => {
    mql.removeEventListener("change", onMql);
    window.removeEventListener("wheel", onWheel, { capture: true });
  });
}
