/* ============================================================
   three/field/beamClock.ts — the v3 beam angle (spec rev 3.1 §4.3).
   Owner: WP2. One class, used by both PointField (field/beam.ts) and
   NullField (the CSS beam):

   - time integrator θ_time += dt·(2π/16)·motion, ONLY while the hunt latch
     is clear (no velocity boost; the legacy integrator in field/beam.ts is
     untouched and keeps feeding the legacy charge);
   - free:  θ_free(vh) = SWEEP_START + θ_time + 2π·vh/180 — scroll turns the
     beam (1.22 turns over J1), scrolling back rewinds it;
   - latch: on the first frame with vh ≥ 226 (latch clear) store
     δ0 = wrapPi(θ_free(226) − θ_hunt(0)) and freeze θ_time. While latched:
       vh ≥ 226        → hunt: θ = θ_hunt(u) + (δ0 + 2π(vh − 226)/180)·(1 − ss(0, 0.35, u))
       222 ≤ vh < 226  → θ_free(vh) with the frozen θ_time
     below 222 the latch clears and θ_time resumes from its frozen value
     (θ is continuous both ways at 226, and no jump after any dwell in J2);
     WP2 precision: θ_hunt(0) in δ0 uses β_L, the β_SP of the latch frame, and
     the blended carry also holds (β_L − β_SP(vh)), i.e.
       θ = β_SP(vh) + h(u) + (δ0 + β_L − β_SP(vh) + 2π(vh − 226)/180)·(1 − ss),
     so θ(226) ≡ θ_free(226) EXACTLY even when the latch frame was not at 226
     (a fast fling, a teleport) while β_SP drifts with the seek path; for
     u ≥ 0.35 it is the spec's formula unchanged (θ → β_SP);
   - θ_hunt(u) = β_SP + 0.9·(1 − u)²·e^(−2.4u)·cos(2.6πu), u = seek
     (linear 226 → 336): whips to the target, overshoots ≈ 9°, swings
     back, settles exactly at 336 with zero angular velocity relative to
     the target (θ(336) = β_SP);
   - jump(vh) (playhead.jump / settle / refresh): vh < 222 → clear; vh ≥ 226
     → latch. WP2 decision (spec says δ0 = 0): a jump that LATCHES computes
     δ0 with the same continuity formula on the next step (θ_time kept), and
     a jump while already latched keeps δ0 — so a refresh inside 226–264
     never moves the beam and scrolling back past 226 after a teleport never
     jumps. Past u = 0.35 (vh ≥ 264.5) both choices give the identical θ.
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

/** a mod 2π in [0, 2π). */
export const wrap2Pi = (a: number): number => {
  const x = a % TWO_PI;
  return x < 0 ? x + TWO_PI : x;
};

const ss = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** θ_hunt(u) − β_SP (closed form). */
export const huntOffset = (u: number): number =>
  HUNT.amp * (1 - u) * (1 - u) * Math.exp(-HUNT.decay * u) * Math.cos(HUNT.freq * Math.PI * u);

/** Seek progress u for a master vh (= the `seek` channel over 226–336). */
export const huntU = (vh: number): number =>
  Math.min(1, Math.max(0, (vh - HUNT.seekFrom) / (HUNT.seekTo - HUNT.seekFrom)));

export class BeamClock {
  /** integrated time term (rad) */
  thetaTime = 0;
  latched = false;
  delta0 = 0;
  /** β_SP of the latch frame (rad) */
  betaL = 0;
  /** last displayed θ (rad, unwrapped) */
  theta = SWEEP_START;
  /** a jump latched the clock: δ0 is computed on the next step (needs β_SP) */
  private pendingDelta = false;

  private free(vh: number): number {
    return SWEEP_START + this.thetaTime + (TWO_PI * vh) / HUNT.vhPerTurn;
  }

  private latch(betaSP: number): void {
    this.betaL = betaSP;
    this.delta0 = wrapPi(this.free(HUNT.latchAt) - (betaSP + huntOffset(0)));
    this.latched = true;
    this.pendingDelta = false;
  }

  /** Advance one frame; returns the displayed θ. `betaSP` = the SP bearing from the base pose. */
  step(vh: number, dt: number, motion: number, betaSP: number): number {
    if (this.latched && vh < HUNT.clearBelow) {
      this.latched = false;
      this.pendingDelta = false;
    }
    if (this.pendingDelta) this.latch(betaSP);
    if (!this.latched) {
      if (dt > 0 && motion > 0) this.thetaTime += dt * (TWO_PI / HUNT.secondsPerTurn) * motion;
      // keep the time term small (it only matters mod 2π)
      if (this.thetaTime > 1e4) this.thetaTime -= TWO_PI * Math.floor(this.thetaTime / TWO_PI);
      if (vh >= HUNT.latchAt) this.latch(betaSP);
    }
    if (this.latched && vh >= HUNT.latchAt) {
      const u = huntU(vh);
      const carry =
        (this.delta0 + this.betaL - betaSP + (TWO_PI * (vh - HUNT.latchAt)) / HUNT.vhPerTurn) * (1 - ss(0, HUNT.blendTo, u));
      this.theta = betaSP + huntOffset(u) + carry;
    } else {
      this.theta = this.free(vh);
    }
    return this.theta;
  }

  /** Teleport (playhead.jump): clear below 222; latch at/after 226 (δ0 kept if already latched,
   *  else computed from the continuity formula on the next step). θ_time is kept. */
  jump(vh: number): void {
    if (vh >= HUNT.latchAt) {
      if (!this.latched) {
        this.latched = true;
        this.pendingDelta = true;
      }
    } else if (vh < HUNT.clearBelow) {
      this.latched = false;
      this.pendingDelta = false;
    }
  }

  reset(): void {
    this.latched = false;
    this.pendingDelta = false;
    this.delta0 = 0;
  }
}
