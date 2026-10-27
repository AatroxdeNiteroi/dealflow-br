/* ============================================================
   cinema/clock.ts — the ONE gsap.ticker callback (WP0, §4.6).

   Order inside the callback (never change it):
     1. lenis.raf(time·1000) → emits "scroll" → ScrollTrigger.update
        → the scrub:true master renders synchronously (DOM tweens)
     2. dt = min(deltaRatio/60, 0.05); velocity
        vPxS = |lenis.velocity| / dt → vNorm = clamp01(vPxS / 2400)
        → vel = damp(vel, vNorm, 6, dt)   (the ONLY velocity smoothing)
     3. field.update(vh, t, dt)   camera, uniforms, updateMatrixWorld
     4. frame fns by order: Anchors 20 · Dossier 25 · Labels 30 ·
        Guide 40 · Reducer 50
     5. field.render()
   GSAP's root render (Ch5 scrub:1, acts, swaps) happens before this
   callback in the same tick, so the reducer (last DOM writer) wins
   over a late Ch5 catch-up write while vh < ch5 start.
   ============================================================ */

import gsap from "gsap";
import type Lenis from "lenis";
import type { FieldAdapter, FrameFn, FrameOrder } from "./types";
import { clamp01, damp } from "./geometry";

export interface FrameRegistry {
  add(order: FrameOrder, fn: FrameFn): () => void;
  run(vh: number, t: number, dt: number): void;
  clear(): void;
}

export function createFrames(): FrameRegistry {
  let list: Array<{ order: number; seq: number; fn: FrameFn }> = [];
  let seq = 0;
  const failed = new WeakSet<FrameFn>();
  return {
    add(order, fn) {
      const entry = { order, seq: seq++, fn };
      list.push(entry);
      list.sort((a, b) => a.order - b.order || a.seq - b.seq);
      return () => {
        list = list.filter((e) => e !== entry);
      };
    },
    run(vh, t, dt) {
      for (let i = 0; i < list.length; i++) {
        const { fn } = list[i];
        try {
          fn(vh, t, dt);
        } catch (err) {
          // one broken writer must never stop the field or the other writers
          if (!failed.has(fn)) {
            failed.add(fn);
            console.error("[cinema/clock] frame fn threw (reported once)", err);
          }
        }
      }
    },
    clear() {
      list = [];
    },
  };
}

export interface Clock {
  /** Smoothed scroll velocity 0..1 (same value the field receives). */
  velocity(): number;
  dispose(): void;
}

const V_FULL_PX_S = 2400;
const V_LAMBDA = 6;

export function createClock(opts: {
  lenis: Lenis | null;
  field: FieldAdapter;
  frames: FrameRegistry;
  getVh: () => number;
}): Clock {
  const { lenis, field, frames, getVh } = opts;
  let vel = 0;
  const tick = (time: number) => {
    // 1 · smoother → ScrollTrigger.update → master renders
    if (lenis) lenis.raf(time * 1000);
    // 2 · velocity (px/frame → px/s → 0..1, damped once)
    const dt = Math.min(gsap.ticker.deltaRatio(60) / 60, 0.05);
    const vPxS = lenis ? Math.abs(lenis.velocity) / Math.max(dt, 1e-4) : 0;
    vel = damp(vel, clamp01(vPxS / V_FULL_PX_S), V_LAMBDA, dt);
    field.setVelocity(vel);
    // 3 · field state for this exact master time
    const vh = getVh();
    field.update(vh, time, dt);
    // 4 · DOM frame writers
    frames.run(vh, time, dt);
    // 5 · GL draw
    field.render();
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return {
    velocity: () => vel,
    dispose() {
      gsap.ticker.remove(tick);
    },
  };
}
