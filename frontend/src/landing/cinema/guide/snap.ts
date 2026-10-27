/* ============================================================
   cinema/guide/snap.ts — directional snap controller (§4.7). Owner:
   WP-GUIDE. Provides `LIVE_KEYS.guideSnap`; CinemaHandle.snap.start /
   stop delegate here (teleport, return home, overlay, Historia /
   Boletim, phase changes).

   - Desktop only: `(pointer: fine) and (prefers-reduced-motion:
     no-preference)` AND FLAGS.SNAP (kill switch). Never on touch.
   - Trigger: 220 ms after the last wheel event AND |lenis.velocity| <
     0.2 px/frame AND !blocked(). One decision per wheel gesture.
   - Candidates R1–R7 only (never R0, never a target ≥ 1800: the
     handoff and Ch5 are never snapped). Rest px = master.start +
     (R/1900)·(master.end − master.start), read live from the master's
     trigger (ctx.vhToPx), so it is always the post-refresh value.
   - Rule: inside a plateau → nothing; else the nearest rest AHEAD in
     the last direction of travel within 30 vh → snap; else any rest
     within 6 vh (rest-centre distance) → snap; else nothing.
     (With 8 vh plateaus the 6 vh rule can only fire if PLATEAU_HALF is
     ever retuned below 6 — kept as the spec's safety net.)
   - Motion: lenis.scrollTo(px, { duration: clamp(.35, |Δvh|/100·1.2,
     .7), easing: easeOutCubic }). Any wheel input interrupts it (Lenis
     retargets from the animated position).
   - Rejected on purpose: ScrollTrigger snap (double-eases against
     Lenis), lenis/snap proximity (non-directional), auto-complete.
   ============================================================ */

import { FrameOrder, LIVE_KEYS, type CinemaCtx, type SnapController } from "../types";
import { MARKS, MASTER_END, RESTS, type Rest } from "../beats";
import { clamp } from "../geometry";
import { runtime } from "../runtime";
import type { GuideBus } from "./machine";

const CANDIDATES: readonly Rest[] = RESTS.filter((r) => r.plateau !== null && r.at < MARKS.snap.maxVh);

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

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

export function build(ctx: CinemaCtx, bus: GuideBus): void {
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
    // px per 60 Hz frame, so the threshold means the same at 120 Hz
    const v60 = Math.abs(lenis.velocity) / Math.max(dt * 60, 0.25);
    if (v60 >= MARKS.snap.maxVelocity) return;
    gesture = false; // one decision per gesture, whatever it is
    if (vh >= MASTER_END) return; // Ch5 zone: never pulled back into the cinema
    const r = snapTarget(vh, bus.lastDir);
    if (!r) return;
    const duration = clamp((Math.abs(r.at - vh) / 100) * 1.2, 0.35, 0.7);
    lenis.scrollTo(ctx.vhToPx(r.at), { duration, easing: easeOutCubic });
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
