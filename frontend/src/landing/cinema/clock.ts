/* ============================================================
   cinema/clock.ts — the ONE gsap.ticker callback (spec rev 3.1 §8.2).

   Order inside the callback (never change it):
     1. lenis.raf(time·1000) → emits "scroll" → ScrollTrigger.update
        (geometry only for the cinema; Ch5's scrub:1 and the other
        triggers update as in v2)
     2. dt = min(deltaRatio/60, 0.05); vh = playhead.step(dt)
        (critically damped follower of W(s), cinema/playhead.ts)
     3. director.render(vh): tl.time(vh) + listeners (acts, guide
        bookkeeping) ONLY when vh moved (a refresh replays it itself)
     4. velocity: v2's vel, unchanged formula, for the legacy sweep
        integrator — vPxS = |lenis.velocity| / dt → clamp01(/2400) →
        damp λ 6 — and the playhead velocity (master vh/s, signed) →
        field.setPlayhead (the field derives pvelN / pvelS)
     5. field.update(vh, t, dt)   camera, uniforms, updateMatrixWorld
     6. frame fns by order: Anchors 20 · Dossier 25 · Labels 30 ·
        Glyphs 31 (timed → ctx.perf.glyphMs) · Guide 40 · Reducer 50
     7. field.render()
   GSAP's root render (Ch5 scrub:1, acts, swaps) happens before this
   callback in the same tick, so the reducer (last DOM writer) wins
   over a late Ch5 catch-up write while vh < ch5 start.

   ?cx-still (dev captures): the field sees t = 0, dt = 0 and no
   velocity of either kind; the playhead itself still follows in real
   time (captures wait for it to land, and at rest it lands exactly).

   Glyph timer (§4.9): the FrameOrder.Glyphs slot is timed every frame
   in which the playhead moved (the writer is pure f(vh) and idles
   otherwise) or a full write was requested; `p95()` covers the last 60
   such frames. WP5's text tier reads it between blocks.
   ============================================================ */

import gsap from "gsap";
import type Lenis from "lenis";
import type { FieldAdapter, FrameFn, FrameOrder } from "./types";
import { clamp01, damp } from "./geometry";
import { CX_STILL } from "./env";

export interface FrameRegistry {
  add(order: FrameOrder, fn: FrameFn): () => void;
  run(vh: number, t: number, dt: number): void;
  clear(): void;
}

/** Rolling cost sampler (ms) for one frame slot. */
export interface SlotTimer {
  /** Arm the next run of the slot for a sample (a "live" frame). */
  arm(): void;
  /** Record a sample if armed (called by the registry around the slot). */
  sample(ms: number): void;
  armed(): boolean;
  /** 95th percentile of the last ≤ 60 samples (0 before the first). */
  p95(): number;
}

const TIMER_WINDOW = 60;

export function createSlotTimer(): SlotTimer {
  const buf = new Float64Array(TIMER_WINDOW);
  const sorted = new Float64Array(TIMER_WINDOW);
  let n = 0;
  let head = 0;
  let isArmed = false;
  let dirty = false;
  let cached = 0;
  return {
    arm() {
      isArmed = true;
    },
    armed: () => isArmed,
    sample(ms) {
      if (!isArmed) return;
      isArmed = false;
      buf[head] = ms;
      head = (head + 1) % TIMER_WINDOW;
      if (n < TIMER_WINDOW) n++;
      dirty = true;
    },
    p95() {
      if (!n) return 0;
      if (dirty) {
        for (let i = 0; i < n; i++) sorted[i] = buf[i];
        const view = sorted.subarray(0, n).sort();
        cached = view[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
        dirty = false;
      }
      return cached;
    },
  };
}

export function createFrames(timed?: { order: FrameOrder; timer: SlotTimer }): FrameRegistry {
  let list: Array<{ order: number; seq: number; fn: FrameFn }> = [];
  let seq = 0;
  const failed = new WeakSet<FrameFn>();
  const call = (fn: FrameFn, vh: number, t: number, dt: number) => {
    try {
      fn(vh, t, dt);
    } catch (err) {
      // one broken writer must never stop the field or the other writers
      if (!failed.has(fn)) {
        failed.add(fn);
        console.error("[cinema/clock] frame fn threw (reported once)", err);
      }
    }
  };
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
        const e = list[i];
        if (timed && e.order === timed.order && timed.timer.armed()) {
          const t0 = performance.now();
          call(e.fn, vh, t, dt);
          timed.timer.sample(performance.now() - t0);
        } else {
          call(e.fn, vh, t, dt);
        }
      }
    },
    clear() {
      list = [];
    },
  };
}

/** lagSmoothing on the Gateway only (QA PERF-5); 0 everywhere else (§11.7). */
export function setGatewayLag(on: boolean): void {
  if (on) gsap.ticker.lagSmoothing(250, 33);
  else gsap.ticker.lagSmoothing(0);
}

export interface Clock {
  /** Smoothed v2 scroll velocity 0..1 (same value the field receives). */
  velocity(): number;
  dispose(): void;
}

const V_FULL_PX_S = 2400;
const V_LAMBDA = 6;

export function createClock(opts: {
  lenis: Lenis | null;
  field: FieldAdapter;
  frames: FrameRegistry;
  /** Step 2: the followed vh for this frame. */
  step(dt: number): number;
  /** Step 3: write the master (returns true when it moved). */
  write(vh: number): boolean;
  /** Playhead velocity, master vh/s (signed). */
  playheadVelocity(): number;
  /** The glyph slot's timer (armed on frames in which the playhead moved). */
  glyphTimer: SlotTimer;
}): Clock {
  const { lenis, field, frames, step, write, playheadVelocity, glyphTimer } = opts;
  let vel = 0;
  const tick = (time: number) => {
    // 1 · smoother → ScrollTrigger.update (geometry; Ch5 scrubs)
    if (lenis) lenis.raf(time * 1000);
    // 2 · the liquid playhead
    const dt = Math.min(gsap.ticker.deltaRatio(60) / 60, 0.05);
    const vh = step(dt);
    // 3 · the master + acts + guide bookkeeping, only when vh moved
    if (write(vh)) glyphTimer.arm();
    // 4 · velocities: v2 vel (px/frame → px/s → 0..1, damped once) + playhead
    const vPxS = lenis ? Math.abs(lenis.velocity) / Math.max(dt, 1e-4) : 0;
    vel = damp(vel, clamp01(vPxS / V_FULL_PX_S), V_LAMBDA, dt);
    // ?cx-still (dev captures): the field sees t = 0, dt = 0 and no velocity
    field.setVelocity(CX_STILL ? 0 : vel);
    field.setPlayhead(CX_STILL ? 0 : playheadVelocity());
    // 5 · field state for this exact followed vh
    field.update(vh, CX_STILL ? 0 : time, CX_STILL ? 0 : dt);
    // 6 · DOM frame writers (Glyphs timed when armed)
    frames.run(vh, time, dt);
    // 7 · GL draw
    field.render();
  };
  gsap.ticker.add(tick);
  // QA PERF-5: built during the Gateway boot, whose time-based G1 must not
  // JUMP over the mount's long tasks (cinema build, DrawSVG measures): lag
  // smoothing stays on while the portal is up (scroll is locked there) and
  // the scroll-locked §11.7 lagSmoothing(0) starts with the exit
  // (setGatewayLag(false) from the phase, cinema/index.ts).
  setGatewayLag(true);
  return {
    velocity: () => vel,
    dispose() {
      gsap.ticker.remove(tick);
    },
  };
}
