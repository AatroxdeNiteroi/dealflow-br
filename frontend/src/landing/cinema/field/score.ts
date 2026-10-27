/* ============================================================
   cinema/field/score.ts — field score: a pure function of master vh
   built from beats.SCORE (§7.3). Owner: WP-GL.

   WP0 seed: a complete, working evaluator so DOM packages (e.g. CH1
   reading `field.score.dawn`) can develop against real values before
   the PointField rewrite lands. WP-GL may extend it (derived
   channels) but keys stay the beats.SCORE channel names.
   ============================================================ */

import { SCORE, type ScoreChannel } from "../beats";
import { evalChannel } from "../geometry";
import type { FieldScoreState } from "../types";

const CHANNELS = Object.keys(SCORE) as ScoreChannel[];

export function createScoreState(): FieldScoreState {
  const s = { vh: 0 } as FieldScoreState;
  for (const c of CHANNELS) s[c] = 0;
  return evaluateScore(0, s);
}

/** Evaluate every channel at vh into `out` (allocation-free per frame). */
export function evaluateScore(vh: number, out: FieldScoreState): FieldScoreState {
  out.vh = vh;
  for (const c of CHANNELS) out[c] = evalChannel(SCORE[c], vh);
  return out;
}
