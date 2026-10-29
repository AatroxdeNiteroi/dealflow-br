/* ============================================================
   cinema/type/grammars.ts — the glyph grammars (spec rev 3.1 §5.3). WP5.

   A grammar maps a glyph's local progress q ∈ [0, 1] to what the writer
   draws. Pure functions (no DOM): the scrub writer, the time variants
   and every custom writer (respiro LIGHT, HUD, chips, dock) share them.

     INK (paper)   opacity  cx-ink-bloom(min(1, 1.6q))
                   y        0.32em·(1 − s)        s = cx-ink-settle(q)
                   skewX    −7°·(1 − s)           (desktop only)
                   rotate   ρ_g·(1 − s)           ρ_g seeded in ±3°, origin 0 100%
                   blur     4 → 0 px cx-ink-dry   (word level, desktop T0/T1)
                   order    bleed front in reading order (bleedOrder)
     LIGHT (dark)  opacity  cx-ink-bloom(min(1, 1.4q))
                   y        0.32em·(1 − s)        (no skew / rotate)
                   blur     6 → 0 px              (word level; the respiro's)
                   order    ltr inside each word: glyph j over
                            [a_k + j·6/(n_k − 1), +18] (lightGlyphProgress)
     EVAPORATE     opacity  1 − cx-evap(q)
                   y        −0.22em·cx-evap(q)
                   blur     0 → 3 px              (word level, desktop T0/T1)
                   order    rtl: the reverse of the bleed front

   Text never overshoots: every text ease is ≤ 1 and monotone (asserted by
   WP0's ease test), so INK/LIGHT y ≥ 0 and opacity ∈ [0, 1] for all q.
   Mobile (≤ 720 px or a coarse pointer): opacity and y only.
   ============================================================ */

import type { Grammar } from "../types";
import { cxEase } from "../eases";

export interface GlyphState {
  /** opacity 0..1 */
  op: number;
  /** translateY in em of the glyph's own font size (+ = down) */
  yEm: number;
  /** translateX in em (motion r1: INK's lateral settle, ≤ 0 = from behind the front; desktop only) */
  xEm: number;
  /** Back-compat with the WP0 stub (a word-level yPercent): yEm as a % of a
   *  1.2-line word box. New code uses yEm. */
  yPct: number;
  /** skewX (deg) */
  skew: number;
  /** rotate (deg) */
  rot: number;
  /** word-level blur (px) at this progress (the writer decides where it applies) */
  blur: number;
}

/* ── grammar constants (§5.3) ─────────────────────────────────── */

/** drift (motion r1): the glyph also settles 0.12 em along the line, arriving from behind the
 *  bleed front (ink running across wet paper); monotone cx-ink-settle, so it never overshoots. */
export const INK = Object.freeze({ rise: 0.32, skew: -7, rho: 3, blur: 4, bloomK: 1.6, drift: 0.12 });
export const LIGHT = Object.freeze({ rise: 0.32, blur: 6, bloomK: 1.4, lead: 6, glyph: 18 });
export const EVAPORATE = Object.freeze({ lift: 0.22, blur: 3 });

/** Default order and glyph duration (vh per glyph) per grammar (§5.2). */
export const GRAMMAR_DEFAULTS: Record<Grammar, { order: "bleed" | "ltr" | "rtl"; glyphDur: number }> = {
  ink: { order: "bleed", glyphDur: 8 },
  light: { order: "ltr", glyphDur: LIGHT.glyph },
  evaporate: { order: "rtl", glyphDur: 8 },
};

/** Floor on any word's rise, vh (§5.2; asserted by the writer in dev). */
export const WORD_RISE_MIN = 10;
/** The bleed front's line overlap: line L+1 starts when line L's front is 65 % across. */
export const BLEED_LINE_LAG = 0.65;
/** The bleed front's wobble, in em of the glyph (× valueNoise ∈ [−1, 1]). */
export const BLEED_NOISE_EM = 0.35;
/** Mobile: glyph starts are floored to this grid (vh), i.e. a stagger floor. */
export const MOBILE_STAGGER_VH = 0.5;
/** Words wider than this never blur (§5.3, respiro BLUR_MAX_W). */
export const BLUR_MAX_WORD_PX = 220;

/* ── eases, resolved once (never per frame) ───────────────────── */

const bloom = cxEase("cx-ink-bloom");
const settle = cxEase("cx-ink-settle");
const dry = cxEase("cx-ink-dry");
const evap = cxEase("cx-evap");

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const LINE_EM = 1.2;

export interface GrammarOpts {
  /** this glyph's seeded rotation amplitude ρ_g (deg, INK only) */
  rho?: number;
  /** opacity and y only (≤ 720 px or coarse pointer) */
  mobile?: boolean;
  /** false: skip the word-level blur term (out.blur = 0) — the per-glyph writer
   *  never uses it (it asks grammarBlur once per word), so it saves one ease
   *  evaluation per glyph per frame. Default true. */
  blur?: boolean;
}

/**
 * State of grammar `g` at local progress q (clamped to [0, 1]).
 * q ≤ 0: the pre-state (INK/LIGHT invisible, EVAPORATE settled);
 * q ≥ 1: the post-state (INK/LIGHT settled, EVAPORATE gone).
 */
export function grammarState(
  g: Grammar,
  q: number,
  out: GlyphState = { op: 1, yEm: 0, xEm: 0, yPct: 0, skew: 0, rot: 0, blur: 0 },
  opts?: GrammarOpts,
): GlyphState {
  const t = clamp01(q);
  const mobile = !!opts?.mobile;
  const blur = !mobile && opts?.blur !== false;
  if (g === "evaporate") {
    const e = t <= 0 ? 0 : t >= 1 ? 1 : evap(t);
    out.op = 1 - e;
    out.yEm = -EVAPORATE.lift * e;
    out.xEm = 0;
    out.skew = 0;
    out.rot = 0;
    out.blur = blur ? EVAPORATE.blur * e : 0;
  } else {
    const ink = g === "ink";
    const s = t <= 0 ? 0 : t >= 1 ? 1 : settle(t);
    const bq = Math.min(1, t * (ink ? INK.bloomK : LIGHT.bloomK));
    out.op = bq <= 0 ? 0 : bq >= 1 ? 1 : bloom(bq);
    out.yEm = (ink ? INK.rise : LIGHT.rise) * (1 - s);
    if (ink && !mobile) {
      out.skew = INK.skew * (1 - s);
      out.rot = (opts?.rho ?? 0) * (1 - s);
      out.xEm = -INK.drift * (1 - s);
    } else {
      out.skew = 0;
      out.rot = 0;
      out.xEm = 0;
    }
    out.blur = blur ? (ink ? INK.blur : LIGHT.blur) * (1 - (t <= 0 ? 0 : t >= 1 ? 1 : dry(t))) : 0;
  }
  out.yPct = (out.yEm / LINE_EM) * 100;
  return out;
}

/** Word-level blur (px) of grammar g at the word's progress p (0 when settled or gone). */
export function grammarBlur(g: Grammar, p: number): number {
  const t = clamp01(p);
  if (g === "evaporate") return EVAPORATE.blur * (t <= 0 ? 0 : t >= 1 ? 1 : evap(t));
  return (g === "ink" ? INK.blur : LIGHT.blur) * (1 - (t <= 0 ? 0 : t >= 1 ? 1 : dry(t)));
}

/**
 * LIGHT order (§5.3): glyph j of an n-glyph word whose window starts at
 * `a` (vh) runs over [a + j·6/(n − 1), +18]. Returns its local progress at vh.
 * The respiro word window [472 + 7.6k, 496 + 7.6k] is exactly 6 + 18 vh long.
 */
export function lightGlyphProgress(vh: number, a: number, j: number, n: number): number {
  const start = a + (n > 1 ? (j * LIGHT.lead) / (n - 1) : 0);
  return clamp01((vh - start) / LIGHT.glyph);
}

/* ── ordering ─────────────────────────────────────────────────── */

/** 32-bit integer hash → [0, 1). */
function hash01(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 2D value noise in [−1, 1] (C¹: smoothstep-interpolated lattice). */
export function valueNoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash01(xi, yi, seed);
  const b = hash01(xi + 1, yi, seed);
  const c = hash01(xi, yi + 1, seed);
  const d = hash01(xi + 1, yi + 1, seed);
  const v = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  return v * 2 - 1;
}

/**
 * The INK bleed front in reading order (§5.3):
 *   d_g = ((x_g + 0.35em·valueNoise(x_g, y_g)) / lineWidth_L + 0.65·L) / (1 + 0.65·(nLines − 1))
 * x_g is the glyph's x from its line's start (px), L its line index. Each
 * line fills like ink running along wet paper; line L+1 starts when line
 * L's front is 65 % across. Clamped to [0, 1].
 */
export function bleedOrder(xLine: number, lineW: number, L: number, nLines: number, fontPx: number, seed: number): number {
  const fs = fontPx > 0 ? fontPx : 16;
  const n = valueNoise(xLine / (1.6 * fs), L * 1.7 + 0.31, seed);
  const w = lineW > 1 ? lineW : 1;
  const d = ((xLine + BLEED_NOISE_EM * fs * n) / w + BLEED_LINE_LAG * L) / (1 + BLEED_LINE_LAG * Math.max(0, nLines - 1));
  return clamp01(d);
}

/** INK ρ_g: the glyph's seeded rotation amplitude in ±3° (stable per glyph index and root). */
export function inkRho(index: number, seed: number): number {
  return (hash01(index, 7919, seed) * 2 - 1) * INK.rho;
}

/** A stable 31-bit seed from a string (block id / text). */
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 1) & 0x7fffffff;
}
