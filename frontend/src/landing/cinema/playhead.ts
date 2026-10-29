/* ============================================================
   cinema/playhead.ts — the liquid playhead (spec rev 3.1 §6.2).
   WP0 STUB (identity follower) → owned by WP1.

   v3 contract (WP1 implements it here, API fixed by WP0):
     s       = st.progress · S_END(profile)        (ScrollTrigger geometry only)
     target  = W(s)                                (cinema/dilation.ts)
     x       = critically damped follower of target (three/springs.ts
               stepCritical, ω 8 fine / 11 coarse), lag cap 28 vh → 0 by
               1880, x = target from 1880 on
   The clock steps it once per frame (§8.2 step 2) and every consumer
   (DOM tweens, acts, GL, guide) reads the same followed vh.

   The WP0 stub is the IDENTITY follower over v2's scroll-driven master:
   vh() = target() = the master time ScrollTrigger wrote this frame,
   s() = Winv(vh) (= vh while the v2 tracks are in place), velocity()
   is measured by step() (the WP0 clock does not call it, so it reads 0),
   and jump(vh) writes the master and runs the listeners. Behaviour-neutral:
   nothing in WP0 reads it.
   ============================================================ */

import type { PlayheadApi } from "./types";
import { readWindowAt, Winv, currentProfile } from "./dilation";

export interface Playhead extends PlayheadApi {
  /** Clock step 2 (WP1): advance the follower by dt seconds; returns the followed vh. */
  step(dt: number): number;
}

export interface PlayheadOptions {
  /** The follower's target source: W(s) in v3; the scroll-driven master time in the stub. */
  targetVh(): number;
  /** Write the master at vh and run the listeners (acts, guide bookkeeping). */
  writeMaster(vh: number): void;
  /** Called after a jump (springs, hunt latch, glyph writer full write). */
  onJump?(vh: number): void;
}

export function createPlayhead(o: PlayheadOptions): Playhead {
  let x = o.targetVh();
  let v = 0;
  return {
    vh: () => o.targetVh(),
    target: () => o.targetVh(),
    s: () => Winv(o.targetVh(), currentProfile()),
    velocity: () => v,
    readWindow: (vh: number) => readWindowAt(vh),
    jump(vh: number) {
      x = vh;
      v = 0;
      o.writeMaster(vh);
      o.onJump?.(vh);
    },
    step(dt: number) {
      const t = o.targetVh();
      v = dt > 0 ? (t - x) / dt : 0;
      x = t;
      return x;
    },
  };
}
