/* ============================================================
   three/field/beamClock.ts — the v3 beam angle (spec rev 3.1 §4.3).
   WP0 ships it working but UNUSED (PointField and NullField keep the
   legacy angle until WP2 switches) → owned by WP2.

   One class, used by both PointField and NullField:
   - time integrator θ_time += dt·(2π/16)·motion, ONLY while the hunt latch
     is clear (no velocity boost; the legacy integrator in field/beam.ts is
     untouched and keeps feeding the legacy charge);
   - free:  θ_free(vh) = SWEEP_START + θ_time + 2π·vh/180;
   - latch: on the first frame with vh ≥ 226 (latch clear) store
     δ0 = wrapPi(θ_free(226) − θ_hunt(0)) and freeze θ_time. While latched:
       vh ≥ 226        → hunt: θ = θ_hunt(u) + (δ0 + 2π(vh − 226)/180)·(1 − ss(0, 0.35, u))
       222 ≤ vh < 226  → θ_free(vh) with the frozen θ_time
     below 222 the latch clears and θ_time resumes from its frozen value
     (no jump after any dwell in J2);
   - θ_hunt(u) = β_SP + 0.9·(1 − u)²·e^(−2.4u)·cos(2.6πu), u = seek
     (linear 226 → 336): whips to the target, overshoots ≈ 9°, swings
     back, settles exactly at 336 with zero angular velocity;
   - jump(vh): vh ≥ 226 → latch with δ0 = 0; vh < 222 → clear; θ_time kept.
   - vh ≥ 400: the beam source is the legacy angle (Ch4), not this clock.
   ============================================================ */

import { SWEEP_START, TWO_PI } from "../constants";

export const HUNT = {
  latchAt: 226,
  clearBelow: 222,
  /** seek u = clamp((vh − 226) / 110) */
  seekFrom: 226,
  seekTo: 336,
  /** scroll term: one turn per 180 vh */
  vhPerTurn: 180,
  /** time term: one turn per 16 s */
  secondsPerTurn: 16,
  amp: 0.9,
  decay: 2.4,
  freq: 2.6,
  blendTo: 0.35,
} as const;

export const wrapPi = (a: number): number => {
  let x = (a + Math.PI) % TWO_PI;
  if (x < 0) x += TWO_PI;
  return x - Math.PI;
};

const ss = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** θ_hunt(u) − β_SP (closed form). */
export const huntOffset = (u: number): number =>
  HUNT.amp * (1 - u) * (1 - u) * Math.exp(-HUNT.decay * u) * Math.cos(HUNT.freq * Math.PI * u);

export class BeamClock {
  /** integrated time term (rad) */
  thetaTime = 0;
  latched = false;
  delta0 = 0;
  /** last displayed θ (rad, unwrapped) */
  theta = SWEEP_START;

  private free(vh: number): number {
    return SWEEP_START + this.thetaTime + (TWO_PI * vh) / HUNT.vhPerTurn;
  }

  /** Advance one frame; returns the displayed θ. `betaSP` = the SP bearing from the base pose. */
  step(vh: number, dt: number, motion: number, betaSP: number): number {
    if (this.latched && vh < HUNT.clearBelow) this.latched = false;
    if (!this.latched) {
      this.thetaTime += dt * (TWO_PI / HUNT.secondsPerTurn) * motion;
      if (vh >= HUNT.latchAt) {
        this.delta0 = wrapPi(this.free(HUNT.latchAt) - (betaSP + huntOffset(0)));
        this.latched = true;
      }
    }
    if (this.latched && vh >= HUNT.latchAt) {
      const u = Math.min(1, Math.max(0, (vh - HUNT.seekFrom) / (HUNT.seekTo - HUNT.seekFrom)));
      const carry = (this.delta0 + (TWO_PI * (vh - HUNT.latchAt)) / HUNT.vhPerTurn) * (1 - ss(0, HUNT.blendTo, u));
      this.theta = betaSP + huntOffset(u) + carry;
    } else {
      this.theta = this.free(vh);
    }
    return this.theta;
  }

  /** Teleport (playhead.jump): latch with δ0 = 0 at/after 226, clear below 222. */
  jump(vh: number): void {
    if (vh >= HUNT.latchAt) {
      this.latched = true;
      this.delta0 = 0;
    } else if (vh < HUNT.clearBelow) {
      this.latched = false;
    }
  }

  reset(): void {
    this.latched = false;
    this.delta0 = 0;
  }
}
