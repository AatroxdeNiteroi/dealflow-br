/* ============================================================
   cinema/eases.ts — the v3 easing family (spec rev 3.1 §1.2, WP0).

   Registered ONCE at module scope (imported by cinema/index.ts) as
   GSAP CustomEases. The `rk-*` eases stay for Ch5 and existing UI,
   gsap.defaults is never touched, and the master's local default
   stays `ease: "none"`.

   Every multi-segment curve has collinear handles at its joints (C¹ in
   y(x): no velocity kink) and no TEXT ease exceeds 1 — text never
   overshoots (clarity veto). Bounce stays reserved for instrument acts
   (`back.out(1.6)` lock/needle/ringLock, `back.out(1.15)` countSettle).

   Per-frame writers (glyph writer, respiro, dossier, RIG) must not call
   gsap.parseEase per frame: take the function once with `cxEase(name)`.
   `bezierEase(path)` is a pure evaluator of the same path strings (no
   GSAP), used by unit tests and by any node-side check.
   ============================================================ */

import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);

/** CustomEase path strings (SVG-style, normalised 0..1 box). */
export const CX_EASE_PATHS = {
  /** glyph opacity: soak, then settle (joint slope 1.2 both sides). No overshoot. */
  "cx-ink-bloom": "M0,0 C0.08,0.02 0.16,0.564 0.34,0.78 0.52,0.996 0.72,1 1,1",
  /** glyph y / skew / rotate; ANY text being read (joint slope 0.075 both sides). No overshoot. */
  "cx-ink-settle": "M0,0 C0.16,0.64 0.3,0.97 0.5,0.985 0.7,1 0.86,1 1,1",
  /** word blur → 0, colour cooling, rack focus. No overshoot. */
  "cx-ink-dry": "M0,0 C0.24,0.42 0.5,0.86 1,1",
  /** every exit: glyph evaporation, panel out (joint slope 1.625 both sides). No overshoot. */
  "cx-evap": "M0,0 C0.32,0 0.52,0.18 0.68,0.44 0.82,0.6675 0.9,0.92 1,1",
  /** in-place positional moves: reels, card grow, collapse size, dims, ring travel, tag park;
   *  replaces every linear scrub on visible elements. No overshoot. */
  "cx-flow": "M0,0 C0.5,0 0.2,1 1,1",
  /** non-text UI arrivals: chips, panels' scale, collapse radius (≈ 1.5 % overshoot). */
  "cx-pour": "M0,0 C0.12,0 0.2,0.72 0.42,0.94 0.52,1.04 0.7,1.012 1,1",
  /** instrument closures: reticle bend into the circle, GL lock ring, capture (≈ 4 % overshoot). */
  "cx-meniscus": "M0,0 C0.2,0.06 0.3,1.04 0.52,1.04 0.68,1.04 0.8,1 1,1",
} as const;

export type CxEaseName = keyof typeof CX_EASE_PATHS;

/** Eases that may drive text (asserted ≤ 1 and monotone). */
export const CX_TEXT_EASES: readonly CxEaseName[] = ["cx-ink-bloom", "cx-ink-settle", "cx-ink-dry", "cx-evap", "cx-flow"];

for (const [name, path] of Object.entries(CX_EASE_PATHS)) {
  if (!CustomEase.get(name)) CustomEase.create(name, path);
}

const cache = new Map<CxEaseName, (t: number) => number>();

/** The registered ease as a plain function (resolve once; never per frame). */
export function cxEase(name: CxEaseName): (t: number) => number {
  let f = cache.get(name);
  if (!f) {
    f = gsap.parseEase(name) as (t: number) => number;
    cache.set(name, f);
  }
  return f;
}

/* ── pure evaluator (no GSAP): unit tests and node-side checks ── */

export interface CubicSegment {
  p0: [number, number];
  p1: [number, number];
  p2: [number, number];
  p3: [number, number];
}

/** Parse "M x,y C x1,y1 x2,y2 x,y [x1,y1 x2,y2 x,y …]" into cubic segments. */
export function parseCubicPath(path: string): CubicSegment[] {
  const nums = path.replace(/[MC]/g, " ").trim().split(/[\s,]+/).map(Number);
  const segs: CubicSegment[] = [];
  let x0 = nums[0];
  let y0 = nums[1];
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const seg: CubicSegment = {
      p0: [x0, y0],
      p1: [nums[i], nums[i + 1]],
      p2: [nums[i + 2], nums[i + 3]],
      p3: [nums[i + 4], nums[i + 5]],
    };
    segs.push(seg);
    x0 = seg.p3[0];
    y0 = seg.p3[1];
  }
  return segs;
}

const bez = (a: number, b: number, c: number, d: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/** y(x) of a multi-segment cubic path (bisection on x(t); x must be monotone per segment). */
export function bezierEase(path: string): (x: number) => number {
  const segs = parseCubicPath(path);
  return (x: number): number => {
    if (x <= 0) return segs[0].p0[1];
    const last = segs[segs.length - 1];
    if (x >= 1) return last.p3[1];
    let s = segs[0];
    for (const g of segs) {
      s = g;
      if (x <= g.p3[0]) break;
    }
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (bez(s.p0[0], s.p1[0], s.p2[0], s.p3[0], m) < x) lo = m;
      else hi = m;
    }
    const t = (lo + hi) / 2;
    return bez(s.p0[1], s.p1[1], s.p2[1], s.p3[1], t);
  };
}
