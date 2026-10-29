/* ============================================================
   cinema/playhead.ts — the liquid playhead (spec rev 3.1 §6.2, WP1).

   Every consumer (DOM tweens through the master, acts, GL, guide,
   glyph writer) renders the SAME followed master vh in the same frame.

     s       = st.progress · S_END(profile)          (director: geometry only)
     target  = W(s)                                   (director: dilation map)
     lagMax  = 28 · (1 − smoothstep(1840, 1880, target))
     Δ = x − target   (critically damped, ω 8 fine / 11 coarse — exact step)
     x' = target + (Δ + (v + ωΔ)·dt)·e^(−ω·dt);  v' = (v − ω(v + ωΔ)·dt)·e^(−ω·dt)
     |x' − target| > lagMax → x' = target ± lagMax, v' clamped to the target's rate
     target ≥ 1880          → x' = target, v' = 0   (the Ch5 handoff is exact)

   - No rate cap of any kind (vetoed): the follower never holds the
     playhead back beyond its spring lag; the lag cap only ever FORCES
     catch-up.
   - Exact rest: once |Δ| < 1e-3 vh and |v| < 1e-2 vh/s the playhead
     lands ON the target (x = target, v = 0), so a rest, a snap or a
     station is always the exact composed state of its vh (pure f(vh),
     §6.2 determinism) and an idle page writes nothing.
   - glide(): the snap (guide/snap.ts) retargets the scroll in one jump
     and lets this spring carry the playhead there. The lag cap would
     turn the first (cap-exceeding) part of that move into a pop, so a
     glide relaxes the cap to the gap it starts with and shrinks it as
     the playhead closes in (monotone, never a jump); it ends at the
     first frame inside the normal cap.
   - jump(vh): x = target = vh, v = 0; the master is written, the
     listeners run, then onJump (field time layer + hunt latch reset,
     glyph writer full write). Called by settle(0|1) (teleport, return
     home, deep links, Gateway re-entry), refresh after a profile change.
   - FLAGS.PLAYHEAD_FOLLOW = false → identity (x = target every frame).
   - velocity(): the displayed rate of x (master vh/s, signed) — the
     spring's v while it follows, the forced rate while the cap or the
     handoff pins x. It is what field.setPlayhead() and the guide read.
   ============================================================ */

import type { PlayheadApi } from "./types";
import { readWindowAt, type DilationProfile } from "./dilation";
import { FLAGS } from "./flags";
import { MASTER_END } from "./beats";
import { SPRINGS, stepCritical, type CriticalState } from "../three/springs";

/** The live scroll map (director): s-vh and px in both directions, current profile. */
export interface ScrollMap {
  /** master vh → s-vh */
  Winv(vh: number): number;
  /** document scroll px → master vh (unclamped) */
  pxToVh(px: number): number;
  /** master vh → document scroll px */
  vhToPx(vh: number): number;
}

export interface Playhead extends PlayheadApi {
  /** Clock step 2: advance the follower by dt seconds; returns the followed vh (does not write the master). */
  step(dt: number): number;
  /** The next target move is a deliberate retarget (snap): glide there under the spring, never a cap pop. */
  glide(): void;
  /** x === target and v === 0 (nothing left to render). */
  settled(): boolean;
  /** |x − target| (master vh). */
  lag(): number;
  /** The scroll map the target comes from (snap decisions in s units). */
  readonly map: ScrollMap;
}

/** WP1 extras on ctx.playhead (the snap narrows the frozen PlayheadApi to these). */
export function asPlayhead(p: PlayheadApi): Playhead | null {
  const q = p as Partial<Playhead>;
  return typeof q.glide === "function" && !!q.map ? (p as Playhead) : null;
}

export interface PlayheadOptions {
  /** The follower's target, W(s) in [0, MASTER_END] (director.target). */
  target(): number;
  /** Scroll position in s-vh (director.s). */
  s(): number;
  /** Current dilation profile (ω 8 fine / 11 coarse). */
  profile(): DilationProfile;
  /** The live scroll map (director). */
  map: ScrollMap;
  /** Write the master at vh and run the listeners (director.render(vh, true)). */
  writeMaster(vh: number): void;
  /** After a jump: field time layer + hunt latch reset, glyph writer full write. */
  onJump?(vh: number): void;
}

const F = SPRINGS.follower;
/** Exact-rest thresholds (vh, vh/s): 1e-3 vh ≈ 0.01 px. */
const REST_EPS_X = 1e-3;
const REST_EPS_V = 1e-2;
/** Largest dt the follower integrates in one frame (a background tab's first frame). */
const MAX_DT = 0.1;

const ss = (a: number, b: number, x: number): number => {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
};

/** §6.2 lag cap: 28 vh, → 0 over 1840–1880 (target vh). */
export function lagCapAt(target: number): number {
  return F.lagCap * (1 - ss(F.lagCapFrom, F.lagCapTo, target));
}

export function createPlayhead(o: PlayheadOptions): Playhead {
  const clampVh = (v: number) => (v < 0 ? 0 : v > MASTER_END ? MASTER_END : v);
  const st: CriticalState = { x: clampVh(o.target()), v: 0 };
  let prevTarget = st.x;
  let vOut = 0;
  /** Relaxed cap of a glide in progress (−1 = none). */
  let glideCap = -1;
  let glideArmed = false;

  const step = (dt: number): number => {
    const target = clampVh(o.target());
    if (!(dt > 0)) {
      prevTarget = target;
      return st.x;
    }
    const h = dt > MAX_DT ? MAX_DT : dt;
    const rate = (target - prevTarget) / h;
    prevTarget = target;
    const x0 = st.x;

    if (!FLAGS.PLAYHEAD_FOLLOW || target >= F.lagCapTo) {
      // identity follower, or the Ch5 handoff: x = W(s) exactly
      st.x = target;
      st.v = 0;
      glideCap = -1;
      glideArmed = false;
      vOut = (target - x0) / h;
      return st.x;
    }
    if (st.x === target && st.v === 0) {
      vOut = 0;
      glideArmed = false;
      return st.x;
    }

    const omega = o.profile() === "coarse" ? F.omegaTouch : F.omega;
    stepCritical(st, target, omega, h);

    // lag cap (forced catch-up only), relaxed while a snap glide closes in
    let cap = lagCapAt(target);
    if (glideArmed) {
      glideCap = Math.max(cap, Math.abs(x0 - target));
      glideArmed = false;
    }
    if (glideCap >= 0) {
      const gap = Math.abs(st.x - target);
      if (gap <= cap) glideCap = -1;
      else {
        glideCap = Math.min(glideCap, gap);
        cap = glideCap;
      }
    }
    const d = st.x - target;
    let pinned = false;
    if (d > cap) {
      st.x = target + cap;
      pinned = true;
    } else if (d < -cap) {
      st.x = target - cap;
      pinned = true;
    }
    if (pinned) {
      // v' clamped to the target's rate: never faster than the target (no overshoot when it stops)
      const lo = rate < 0 ? rate : 0;
      const hi = rate > 0 ? rate : 0;
      st.v = st.v < lo ? lo : st.v > hi ? hi : st.v;
    }

    // exact rest
    if (Math.abs(st.x - target) < REST_EPS_X && Math.abs(st.v) < REST_EPS_V && Math.abs(rate) < REST_EPS_V) {
      st.x = target;
      st.v = 0;
      glideCap = -1;
    }
    vOut = pinned ? (st.x - x0) / h : st.v;
    return st.x;
  };

  return {
    vh: () => st.x,
    target: () => clampVh(o.target()),
    s: () => o.s(),
    velocity: () => vOut,
    readWindow: (vh: number) => readWindowAt(vh),
    jump(vh: number) {
      const x = clampVh(vh);
      st.x = x;
      st.v = 0;
      vOut = 0;
      prevTarget = x;
      glideCap = -1;
      glideArmed = false;
      o.writeMaster(x);
      o.onJump?.(x);
    },
    step,
    glide() {
      glideArmed = true;
    },
    settled: () => st.v === 0 && st.x === clampVh(o.target()),
    lag: () => Math.abs(st.x - clampVh(o.target())),
    map: o.map,
  };
}
