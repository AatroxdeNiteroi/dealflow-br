/* ============================================================
   three/sonar.ts — sonar CPU work (spec rev 3.1 §4.9). WP0 STUB → WP3.

   v3 (WP3): build-time picks — 12 echo sources (big ≥ 0.82,
   1.5 < |xy| < 9, z ∈ [−3.5, 1.5], one per 30° sector) and 3 decoys
   (large points within ±0.6 rad of β_SP, 2–6 world from SP); per frame,
   the 6 youngest crests with amplitude > 0.02 (r_i = 2.6·b_i,
   A_i = exp(−b_i/1.1)·w_i), frameData.echoes for the DOM, and the dev
   counters crestsLive / pingsPerTurn / capInside (read by §11).
   The stub picks nothing and reports zeros.
   ============================================================ */

import type { BaseField } from "./field/frame";

export interface SonarPicks {
  /** 12 echo source point indices (one per 30° sector), −1 where a sector has none */
  echoes: Int32Array;
  /** 3 decoy point indices */
  decoys: Int32Array;
}

export interface SonarCounters {
  /** crests with A > 0.02 and their source ids */
  crestsLive: number[];
  /** pings per beam turn (§11 item 45 b) */
  pingsPerTurn: number;
  /** points inside 0.95 R_m during the capture */
  capInside: number;
}

/** Build-time picks (stub: none). */
export function pickSonarSources(_base: BaseField): SonarPicks {
  const echoes = new Int32Array(12).fill(-1);
  const decoys = new Int32Array(3).fill(-1);
  return { echoes, decoys };
}

/** Dev counters (stub: zeros). */
export function createSonarCounters(): SonarCounters {
  return { crestsLive: [], pingsPerTurn: 0, capInside: 0 };
}
