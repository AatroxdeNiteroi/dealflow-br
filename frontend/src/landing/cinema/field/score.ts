/* ============================================================
   cinema/field/score.ts — the field score: a pure function of master
   vh built from the beats.SCORE ramps (§7.3). Owner: WP-GL.

   The engine evaluates it once per frame (field.update), before any
   DOM writer runs, into `field.score` — the read-only view DOM
   consumers use (CH1 reads `dawn` for the ink-twin clip, the guide
   and the rig read through isDarkAt / the anchor). Nothing here
   depends on time, input or history: scrubbing back to a vh gives
   back exactly the same channels (reversal is exact).

   Channels keep the beats.SCORE names; derived, time-based values
   (breath phase, beat, flare, ring boosts) live in the engine's time
   layer, never here.
   ============================================================ */

import { SCORE, type ChannelDef, type ScoreChannel } from "../beats";
import { evalChannel } from "../geometry";
import type { FieldScoreState } from "../types";

const CHANNELS: ReadonlyArray<readonly [ScoreChannel, ChannelDef]> = (Object.keys(SCORE) as ScoreChannel[]).map(
  (c) => [c, SCORE[c]] as const,
);

export function createScoreState(): FieldScoreState {
  const s = { vh: 0 } as FieldScoreState;
  for (const [c] of CHANNELS) s[c] = 0;
  return evaluateScore(0, s);
}

/** Evaluate every channel at vh into `out` (allocation-free per frame). */
export function evaluateScore(vh: number, out: FieldScoreState): FieldScoreState {
  out.vh = vh;
  for (let i = 0; i < CHANNELS.length; i++) {
    const [c, def] = CHANNELS[i];
    out[c] = evalChannel(def, vh);
  }
  return out;
}

/** One channel at an arbitrary vh (e.g. a DOM reader planning ahead). */
export function scoreAt(channel: ScoreChannel, vh: number): number {
  return evalChannel(SCORE[channel], vh);
}
