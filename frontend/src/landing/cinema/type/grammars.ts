/* ============================================================
   cinema/type/grammars.ts — glyph grammars (spec rev 3.1 §5.3).
   WP0 STUB (word-level maskRise behaviour) → owned by WP5.

   A grammar maps a glyph's (or, in word mode, a word's) local progress
   q ∈ [0, 1] to its written state. v3 grammars (WP5):
     INK (paper)  opacity cx-ink-bloom(min(1, 1.6q)); y 0.32em·(1 − cx-ink-settle(q));
                  skewX −7°·(1 − s); rotate ρ_g·(1 − s) (ρ_g seeded ±3°, origin 0 100%);
                  word blur 4 → 0 (cx-ink-dry); bleed front in reading order
     LIGHT (dark) opacity cx-ink-bloom(min(1, 1.4q)); y 0.32em·(1 − cx-ink-settle(q));
                  respiro word blur 6 → 0; ltr inside each word
     EVAPORATE    opacity 1 − cx-evap(q); y −0.22em·cx-evap(q); blur 0 → 3 px; rtl
   Text never overshoots. Mobile: opacity and y only.

   The stub returns v2's word-level maskRise state (yPercent 105 → 0,
   opacity 0 → 1, sine.out; the exit mirrors it upward).
   ============================================================ */

import type { Grammar } from "../types";

export interface GlyphState {
  /** opacity 0..1 */
  op: number;
  /** translateY in em (v3) — the stub reports yPercent in `yPct` instead */
  yEm: number;
  /** translateY in % of the word box (word-level stub) */
  yPct: number;
  /** skewX (deg) */
  skew: number;
  /** rotate (deg) */
  rot: number;
  /** word-level blur (px) */
  blur: number;
}

const sineOut = (t: number): number => Math.sin((Math.PI * t) / 2);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Word-level state for grammar g at local progress q (stub: v2 maskRise). */
export function grammarState(g: Grammar, q: number, out: GlyphState = { op: 1, yEm: 0, yPct: 0, skew: 0, rot: 0, blur: 0 }): GlyphState {
  const t = clamp01(q);
  out.skew = 0;
  out.rot = 0;
  out.blur = 0;
  out.yEm = 0;
  if (g === "evaporate") {
    const e = sineOut(t);
    out.op = 1 - e;
    out.yPct = -105 * e;
  } else {
    const e = sineOut(t);
    out.op = e;
    out.yPct = 105 * (1 - e);
  }
  return out;
}

/** Default order and glyph duration per grammar (§5.2). */
export const GRAMMAR_DEFAULTS: Record<Grammar, { order: "bleed" | "ltr" | "rtl"; glyphDur: number }> = {
  ink: { order: "bleed", glyphDur: 8 },
  light: { order: "ltr", glyphDur: 18 },
  evaporate: { order: "rtl", glyphDur: 8 },
};

/** Floor on any word's rise (vh, asserted by WP5). */
export const WORD_RISE_MIN = 10;
