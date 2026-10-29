/* ============================================================
   cinema/guide/snap.ts — directional snap as a RETARGET (spec rev 3.1
   §6.4; WP1). Provides `LIVE_KEYS.guideSnap`; CinemaHandle.snap.start /
   stop delegate here (teleport, return home, overlay, Historia /
   Boletim, phase changes). Built by guide/machine.ts with the frozen
   GuideSnapBus (phase, flying, lastInputAt, lastDir).

   - Desktop only: `(pointer: fine) and (prefers-reduced-motion:
     no-preference)` AND FLAGS.SNAP (kill switch). Never on touch.
   - Trigger: 420 ms after the last wheel event (MARKS.snapV3.idleMs),
     one decision per wheel gesture, and only if the mean wheel input
     over the last 1 s of input is below 2 notches/s: Σ|deltaY| < 200 px
     after normalising deltaMode (lines × 16 px, pages × innerHeight), so
     trackpads and Firefox line mode count. The second is the one that
     ENDED WITH THE LAST WHEEL EVENT (the gesture's own rate; a window
     ending at the decision would be 42 % idle and let a 3 notches/s
     burst through), integrated with the trapezoid rule (the last event
     counts half). A reader who keeps the wheel going is never pulled.
   - Never while the playhead (or the landing point) is in a read
     window's text hold AFTER its rest (D4 1168–1186, D7 1568–1590,
     D9 1798–1848): a reader who stops on a close is never pulled.
   - Decision in master and s units: landVh = pxToVh(lenis.targetScroll)
     (where the wheel glide will land). Distances are s-vh from
     s(landVh) to the NEAR EDGE of the candidate's plateau, so the
     dilated rests R4 / R6 / R7 (half-plateaus of 30–34 s-vh) snap too:
       inside a plateau → nothing;
       the nearest plateau AHEAD in the last direction of travel whose
       near edge is within 24 s-vh → snap;
       else any plateau with an edge within 6 s-vh → snap;
       else nothing.
     Candidates R1–R7 only: never R0, never a rest at ≥ 1800, never
     from the Ch5 zone.
   - Motion = retarget: lenis.scrollTo(vhToPx(R.at), { immediate,
     force }) and the playhead's critically damped follower (ζ 1, ω 8)
     glides the story there — one continuous move that keeps the
     current velocity: no hermite, no double ease-out "dead stop".
     playhead.glide() keeps the 28 vh lag cap from turning a long glide
     into a pop. Any wheel input simply retargets again.
   - `landed` (guide, WP8) requires the plateau AND |playhead v| < 2 vh/s.
   ============================================================ */

import { FrameOrder, LIVE_KEYS, type CinemaCtx, type GuideSnapBus, type SnapController } from "../types";
import { MARKS, MASTER_END, RESTS, restById, type Rest } from "../beats";
import { readWindowAt } from "../dilation";
import { runtime } from "../runtime";
import { asPlayhead } from "../playhead";

const SNAP = MARKS.snapV3;
const CANDIDATES: readonly Rest[] = RESTS.filter((r) => r.plateau !== null && r.at < SNAP.maxVh);
/** px of wheel input per notch (Chrome / Edge mouse notch). */
const NOTCH_PX = 100;
/** deltaMode 1 (lines) → px (Firefox). */
const LINE_PX = 16;
/** The rate gate's window (ms). */
const RATE_WINDOW_MS = 1000;
/** Wheel events remembered for the rate gate (≥ 1 s of trackpad events at 60 Hz). */
const LOG = 96;

/** §6.4: the rest to snap to from `landVh` after travelling in `dir`, or null. `Winv`: master vh → s-vh. */
export function snapTarget(landVh: number, dir: 1 | -1, Winv: (vh: number) => number): Rest | null {
  for (const r of CANDIDATES) {
    const p = r.plateau!;
    if (landVh >= p[0] && landVh <= p[1]) return null; // already resting
  }
  const s = Winv(landVh);
  let best: Rest | null = null;
  let bestD = Infinity;
  // ahead in the direction of travel: distance to the plateau's NEAR edge
  for (const r of CANDIDATES) {
    const p = r.plateau!;
    const d = (Winv(dir > 0 ? p[0] : p[1]) - s) * dir;
    if (d > 0 && d <= SNAP.aheadS && d < bestD) {
      best = r;
      bestD = d;
    }
  }
  if (best) return best;
  // any direction: distance to the nearer edge
  for (const r of CANDIDATES) {
    const p = r.plateau!;
    const d = Math.min(Math.abs(Winv(p[0]) - s), Math.abs(Winv(p[1]) - s));
    if (d <= SNAP.anyS && d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

/** §6.4: inside a read window's text hold after its rest (rest plateau end → meter end). */
export function inTextHold(vh: number): boolean {
  const d = readWindowAt(vh);
  if (!d || !d.rest || d.meterEnd === undefined) return false;
  const p = restById(d.rest).plateau;
  return !!p && vh > p[1] && vh < d.meterEnd;
}

/** |deltaY| in px (deltaMode 0 px, 1 lines × 16, 2 pages × innerHeight). */
export function wheelPx(deltaY: number, deltaMode: number, pageH: number): number {
  const k = deltaMode === 1 ? LINE_PX : deltaMode === 2 ? pageH : 1;
  return Math.abs(deltaY) * k;
}

export function build(ctx: CinemaCtx, bus: GuideSnapBus): void {
  const mql = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
  let capable = mql.matches;
  const onMql = () => {
    capable = mql.matches;
  };
  mql.addEventListener("change", onMql);

  // the live scroll map + glide (WP1 playhead); a bare PlayheadApi falls back to master vh
  const ph = asPlayhead(ctx.playhead);
  const Winv = ph ? ph.map.Winv : (vh: number) => vh;
  const pxToVh = (px: number): number => {
    if (ph) return ph.map.pxToVh(px);
    const a = ctx.vhToPx(0);
    const b = ctx.vhToPx(MASTER_END);
    return b > a ? ((px - a) / (b - a)) * MASTER_END : 0;
  };

  let stopped = false; // external stop (teleport, return, overlay, phase)
  let gesture = false; // a wheel gesture is awaiting its one decision
  let lastWheelAt = -1e9;
  // wheel log for the 1 s rate gate (ring of [t, px])
  const logT = new Float64Array(LOG).fill(-1e9);
  const logPx = new Float64Array(LOG);
  let logHead = 0;

  const onWheel = (e: WheelEvent) => {
    const now = performance.now();
    lastWheelAt = now;
    logT[logHead] = now;
    logPx[logHead] = wheelPx(e.deltaY, e.deltaMode, window.innerHeight);
    logHead = (logHead + 1) % LOG;
    gesture = true;
  };
  window.addEventListener("wheel", onWheel, { passive: true, capture: true });

  /** Mean wheel input (px/s, normalised) over the second of input that ended with the last
   *  wheel event — the rate the gesture had when the wheel stopped (the decision itself comes
   *  420 ms later, so a window ending at the decision would be 42 % idle). Trapezoid rule: the
   *  last event counts half (a single notch reads 50 px/s, a steady 2 notches/s reads 250). */
  const gestureRate = (): number => {
    let sum = 0;
    let lastPx = 0;
    for (let i = 0; i < LOG; i++) {
      const age = lastWheelAt - logT[i];
      if (age < 0 || age > RATE_WINDOW_MS) continue;
      sum += logPx[i];
      if (age === 0) lastPx = Math.max(lastPx, logPx[i]);
    }
    return ((sum - 0.5 * lastPx) * 1000) / RATE_WINDOW_MS;
  };

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

  ctx.frame.add(FrameOrder.Guide, (vh) => {
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
    const now = performance.now();
    if (now - lastWheelAt < SNAP.idleMs) return;
    gesture = false; // one decision per gesture, whatever it is
    // rate gate: a reader who keeps scrolling at ≥ 2 notches/s is never snapped
    if (gestureRate() >= SNAP.maxRateNotchesPerS * NOTCH_PX) return;
    // where the wheel glide lands, in master vh (through W)
    const landVh = pxToVh(lenis.targetScroll);
    if (vh >= MASTER_END || landVh >= MASTER_END) return; // Ch5 zone: never pulled back into the cinema
    if (inTextHold(vh) || inTextHold(landVh)) return; // a reader on a close is never pulled
    const r = snapTarget(landVh, bus.lastDir, Winv);
    if (!r) return;
    const px = ctx.vhToPx(r.at);
    if (Math.abs(px - lenis.targetScroll) < 0.5) return;
    // motion = retarget: the scroll lands now, the follower glides the story there
    ph?.glide();
    lenis.scrollTo(px, { immediate: true, force: true });
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
