/* ============================================================
   three/springs.ts — the v3 spring family (spec rev 3.1 §1.2, §6).
   API fixed by WP0 (with a working integrator, so WP1/WP3/WP8 can
   test before WP4 merges); WP4 owns the TUNING afterwards (the SPRINGS
   table values), never the API.

   - `Spring` (scalar) / `SpringVec` (n components): damped harmonic
     springs x'' = −2ζω x' − ω²(x − target). Each step is the EXACT
     solution for the step's (constant) target — under-, critically and
     over-damped closed forms — applied in sub-steps of ≤ 1/60 s. This
     meets the spec's "semi-implicit, dt sub-stepped ≤ 1/60" intent
     (stable, frame-rate independent) with no integration error at all:
     30 Hz and 165 Hz give the same curve to float precision (WP0
     deviation, noted in the report; the API is unchanged).
   - `stepCritical`: the exact critically damped step of §6.2 (the
     playhead follower), in the spec's own formula.
   - Every target is 0 when the playhead is at rest (§6.2): the time
     layer decays to exactly 0 and `reset()` zeroes it on jump/settle.
   - `softClamp(o, k) = k·tanh(o/k)`: the lean's soft limit.
   Pure: no THREE, no DOM.
   ============================================================ */

export interface SpringSpec {
  /** damping ratio ζ (1 = critically damped) */
  zeta: number;
  /** natural angular frequency ω (rad/s) */
  omega: number;
}

/**
 * §1.2 spring table (ζ, ω and the gains/clamps of each consumer). Tuned by WP4 against the
 * real path and a §6.2 follower (scratchpad/work/v3qa/wp4/sim/dyn1.ts): a wheel stop at
 * 35 vh/s in J1 gives a 0.10–0.11 world forward follow-through that settles (5 %) 1.08 s after
 * the stop with ≤ 1 overshoot, 0.14 at 50 vh/s, 0.178 for a 120 vh/s fling (soft clamp); bank
 * 0.4–0.7° cruising at 35 vh/s, 1.0° at 50, 1.8° (clamp) on a fling; fovKick +0.66° at
 * 35 vh/s, +2.26° at 120. Once the playhead rests, every velocity-driven term is < 3e−5 world /
 * 3e−5° within 1.0 s (camlayer rest drag); identical at 60 Hz, 165 Hz and jittery frames.
 */
export const SPRINGS = {
  /** §6.2 playhead follower (critically damped, exact step): ω 8 fine / 11 coarse; lag cap 28 vh → 0 by 1880 */
  follower: { zeta: 1, omega: 8, omegaTouch: 11, lagCap: 28, lagCapFrom: 1840, lagCapTo: 1880 },
  /** operator follow-through: target −g·a_path in camera space; soft clamp 0.18·tanh(|o|/0.18) world
   *  (radial). WP4 tuning: g 0.035 → 0.07 s² — at 0.035 a 35 vh/s stop leaned 0.066 world (a 0.5 %
   *  dolly, not visible); 0.07 gives 0.117, and a fling still stays under the 0.18 clamp. */
  lean: { zeta: 0.62, omega: 4.2, g: 0.07, clamp: 0.18 },
  /** rollKick: target 0.9°·a_lat (normalised by aRef world/s²), clamp ±1.8°. Sign (WP4): the
   *  camera banks INTO its lateral acceleration (+ = bank right, the top of the frame tilts
   *  right), the same handedness as the scripted `roll`, which banks toward the travel
   *  direction; the spec's "−0.9°" names the magnitude, its roll sign convention is open. */
  bank: { zeta: 0.7, omega: 5.0, gainDeg: 0.9, clampDeg: 1.8, aRef: 1 },
  /** FOV kick: target +2.2°·pvelN, clamp +2.5° */
  fovKick: { zeta: 0.6, omega: 4.5, gainDeg: 2.2, clampDeg: 2.5 },
  /** look-ahead: 0.15·pvelS world along the path tangent (signed: it leads in both scroll
   *  directions), as an angular look offset at camlayer's D_LOOK_REF */
  lookAhead: { zeta: 0.85, omega: 5.0, gain: 0.15 },
  /** focus pull (DOF): target = mid-field (hub depth) → SP depth by `focusSP`; ζ 0.58 overshoots
   *  ≈ 10 % of a step (the visible hunt) */
  focus: { zeta: 0.58, omega: 3.2 },
  /** cursor parallax: look += (mx·0.05, my·0.035) world × parallax channel (angular, at D_LOOK_REF:
   *  ±0.5° / ±0.35° in J1, ×0.4 in Ch2–Ch3, ×0.6 in C4) */
  parallax: { zeta: 1.0, omega: 3.0, gainX: 0.05, gainY: 0.035 },
  /** cursor wake chain (5 nodes) → uWake[5] */
  wake: { zeta: 1.0, omegas: [16, 11, 8, 5.5, 4] as readonly number[] },
  /** dock visual width on a verb swap (compositor only: clip-path inset on bg/edge layers) */
  dockWidth: { zeta: 0.6, omega: 14 },
} as const;

/** Largest step (s); longer frames are split (the step itself is exact). */
export const MAX_SUBSTEP = 1 / 60;

/** Soft clamp: ≈ identity near 0, saturates at ±k. */
export const softClamp = (o: number, k: number): number => (k > 0 ? k * Math.tanh(o / k) : 0);

/** Hard clamp helper. */
export const clampAbs = (o: number, k: number): number => (o > k ? k : o < -k ? -k : o);

/** Exact damped-oscillator step for a constant target. Returns [x', v']. */
function exactStep(x: number, v: number, target: number, zeta: number, omega: number, dt: number, out: [number, number]): [number, number] {
  const x0 = x - target;
  if (omega <= 0) {
    out[0] = x + v * dt;
    out[1] = v;
    return out;
  }
  if (Math.abs(zeta - 1) < 1e-6) {
    const a = v + omega * x0;
    const e = Math.exp(-omega * dt);
    out[0] = target + (x0 + a * dt) * e;
    out[1] = (v - omega * a * dt) * e;
  } else if (zeta < 1) {
    const zw = zeta * omega;
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zw * dt);
    const c = Math.cos(wd * dt);
    const s = Math.sin(wd * dt);
    const B = (v + zw * x0) / wd;
    out[0] = target + e * (x0 * c + B * s);
    out[1] = e * (v * c - (zw * B + wd * x0) * s);
  } else {
    const r = Math.sqrt(zeta * zeta - 1);
    const r1 = -omega * (zeta - r);
    const r2 = -omega * (zeta + r);
    const c2 = (v - r1 * x0) / (r2 - r1);
    const c1 = x0 - c2;
    const e1 = Math.exp(r1 * dt);
    const e2 = Math.exp(r2 * dt);
    out[0] = target + c1 * e1 + c2 * e2;
    out[1] = r1 * c1 * e1 + r2 * c2 * e2;
  }
  return out;
}

const tmp: [number, number] = [0, 0];

/** A scalar damped spring (exact steps of ≤ 1/60 s). */
export class Spring {
  x = 0;
  v = 0;
  zeta: number;
  omega: number;

  constructor(spec: SpringSpec, x0 = 0) {
    this.zeta = spec.zeta;
    this.omega = spec.omega;
    this.x = x0;
  }

  /** Advance by dt seconds toward `target`; returns x. dt ≤ 0 is a no-op. */
  step(target: number, dt: number): number {
    if (!(dt > 0)) return this.x;
    const n = Math.max(1, Math.ceil(dt / MAX_SUBSTEP - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      exactStep(this.x, this.v, target, this.zeta, this.omega, h, tmp);
      this.x = tmp[0];
      this.v = tmp[1];
    }
    return this.x;
  }

  /** Jump to x (default 0) with zero velocity. */
  reset(x = 0): void {
    this.x = x;
    this.v = 0;
  }

  /** |x − target| and |v| below eps. */
  settled(target = 0, eps = 1e-4): boolean {
    return Math.abs(this.x - target) < eps && Math.abs(this.v) < eps;
  }
}

/** n independent springs sharing one spec (e.g. a 3-D lean offset, a 2-D parallax). */
export class SpringVec {
  readonly x: Float64Array;
  readonly v: Float64Array;
  zeta: number;
  omega: number;

  constructor(n: number, spec: SpringSpec) {
    this.x = new Float64Array(n);
    this.v = new Float64Array(n);
    this.zeta = spec.zeta;
    this.omega = spec.omega;
  }

  /** Advance every component toward `target[i]` (missing / null = 0). */
  step(target: ArrayLike<number> | null, dt: number): Float64Array {
    if (!(dt > 0)) return this.x;
    const n = Math.max(1, Math.ceil(dt / MAX_SUBSTEP - 1e-9));
    const h = dt / n;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < this.x.length; i++) {
        const t = target && i < target.length ? target[i] : 0;
        exactStep(this.x[i], this.v[i], t, this.zeta, this.omega, h, tmp);
        this.x[i] = tmp[0];
        this.v[i] = tmp[1];
      }
    }
    return this.x;
  }

  reset(): void {
    this.x.fill(0);
    this.v.fill(0);
  }

  settled(eps = 1e-4): boolean {
    for (let i = 0; i < this.x.length; i++) if (Math.abs(this.x[i]) >= eps || Math.abs(this.v[i]) >= eps) return false;
    return true;
  }
}

/** Mutable state of an exact critically damped follower. */
export interface CriticalState {
  x: number;
  v: number;
}

/**
 * The exact critically damped step (§6.2):
 *   Δ = x − target
 *   x' = target + (Δ + (v + ωΔ)·dt)·e^(−ω·dt)
 *   v' = (v − ω(v + ωΔ)·dt)·e^(−ω·dt)
 * (the target is held constant over dt). Mutates and returns `s`.
 */
export function stepCritical(s: CriticalState, target: number, omega: number, dt: number): CriticalState {
  if (!(dt > 0)) return s;
  const d = s.x - target;
  const a = s.v + omega * d;
  const e = Math.exp(-omega * dt);
  s.x = target + (d + a * dt) * e;
  s.v = (s.v - omega * a * dt) * e;
  return s;
}
