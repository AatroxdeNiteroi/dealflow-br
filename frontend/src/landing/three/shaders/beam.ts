/* ============================================================
   three/shaders/beam.ts — the v3 sector beam (spec rev 3.1 §4.3).
   WP0 STUB (no program) → WP2.

   v3 (WP2): a 128-segment sector mesh, apex at the hub on z = −1
   (INSTRUMENT_Z), radius 12.8, vertices storing t ∈ [0, 1] mapped to the
   local angle mix(−uBack, +0.06, t) with uBack = min(2.6, 4.6·uTauV);
   fragment: the gold hairline (SRGB.gold) over an ink veil that exists
   ONLY behind the line (AA'd `behind` cut, no straight edge anywhere),
   positive spoon lag (the rim trails), grain, the ink shade behind the
   line, uTextMask, premultiplied blending, uGain = sweepGain_v3. No gold
   halo, no trailing core (the v2 trailCore/trailHalo are gone).
   ============================================================ */

/** Stub: empty sources (no beam mesh is built until WP2). */
export const BEAM_VERT = "";
export const BEAM_FRAG = "";

/** Salience knobs (§4.3, §11 item 45), in tuning order with their caps. */
export const BEAM_KNOBS = {
  veilMax: { value: 0.07, cap: 0.09 },
  afterglowDark: { value: 0.85, cap: 1.0 },
  glowSize: { value: 0.55, cap: 0.8 },
  lineW: { value: 1.5, cap: 2.0 },
  pingAlphaExp: { value: 0.7, cap: 0.5 },
} as const;
