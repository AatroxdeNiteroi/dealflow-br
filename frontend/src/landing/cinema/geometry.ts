/* ============================================================
   cinema/geometry.ts — shared pure math (WP0). Anything two
   packages must agree on to the pixel lives here (one function,
   two callers): cardBuildBox (RIG brackets + DOSSIER paper clip),
   dawnFrontPx (GL interior hole + CH1 ink-twin clip), evalChannel
   (GL score + any DOM reader).
   ============================================================ */

import type { Rect } from "./types";
import { PACE, type ChannelDef, type Interp } from "./beats";

/* ── scalars ────────────────────────────────────────────────── */

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Inverse lerp, clamped: where v sits between a and b (0..1). */
export const progress = (a: number, b: number, v: number): number => (b === a ? (v >= b ? 1 : 0) : clamp01((v - a) / (b - a)));
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = progress(e0, e1, x);
  return t * t * (3 - 2 * t);
};
export const smooth01 = (t: number): number => t * t * (3 - 2 * t);
export const sineInOut = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;
export const sineOut = (t: number): number => Math.sin((Math.PI * t) / 2);
export const power2Out = (t: number): number => 1 - (1 - t) * (1 - t);
/** Round to half a CSS pixel (anchors; no shimmer at rest). */
export const roundHalf = (v: number): number => Math.round(v * 2) / 2;
/** Round to the device pixel grid (swaps must be pixel-identical, §6 rule 3). */
export const roundDevice = (v: number): number => {
  const d = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  return Math.round(v * d) / d;
};

/** Frame-rate independent damping: a + (b − a)(1 − e^(−λ·dt)) (§4.6). */
export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  a + (b - a) * (1 - Math.exp(-lambda * dt));

/* ── viewport (cached; never a layout read per frame) ───────────
   The fixed layers and the canvas are as wide as the document's client
   area, which EXCLUDES a classic (6 px) scrollbar — window.innerWidth
   includes it. The scrollbar toggles with Lenis (`.lenis-stopped
   { overflow: hidden }`) without a window resize, so the width is
   cached and refreshed by a ResizeObserver on <html> (+ resize). Height
   stays innerHeight (mobile URL-bar semantics unchanged). Every shared
   default below (viewportInset, cardBuildBox, dawnFrontPx …) reads it,
   so GL, CH1, RIG and DOSSIER agree to the pixel. */

let VW = 0;
let VH = 0;
const readViewport = (): void => {
  if (typeof window === "undefined") return;
  VW = document.documentElement.clientWidth || window.innerWidth;
  VH = window.innerHeight;
};
readViewport();
if (typeof window !== "undefined") {
  window.addEventListener("resize", readViewport);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(readViewport).observe(document.documentElement);
}
/** Viewport width in CSS px, excluding a classic scrollbar (cached). */
export const viewW = (): number => VW || (typeof window !== "undefined" ? window.innerWidth : 0);
/** Viewport height in CSS px (cached innerHeight). */
export const viewH = (): number => VH || (typeof window !== "undefined" ? window.innerHeight : 0);
/** Re-read the viewport now (call before a measure pass). */
export const refreshViewport = (): void => readViewport();

/* ── rects ──────────────────────────────────────────────────── */

export const ZERO_RECT: Readonly<Rect> = Object.freeze({ x: 0, y: 0, w: 0, h: 0 });

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const fromDOMRect = (r: DOMRectReadOnly): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height });

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

/** The viewport inset by `px` on every side (defaults to the live viewport). */
export const viewportInset = (
  px: number,
  vw: number = viewW(),
  vhPx: number = viewH(),
): Rect => ({ x: px, y: px, w: Math.max(0, vw - 2 * px), h: Math.max(0, vhPx - 2 * px) });

/** Grow (px > 0) or shrink (px < 0) a rect on every side. */
export const inflateRect = (r: Rect, px: number): Rect => ({
  x: r.x - px,
  y: r.y - px,
  w: Math.max(0, r.w + 2 * px),
  h: Math.max(0, r.h + 2 * px),
});

/** r ⊕ px, then at least `minSide` square around the centre (J2: bbox ⊕ 14 px, min 44). */
export const padRect = (r: Rect, px: number, minSide = 0): Rect => {
  const g = inflateRect(r, px);
  const w = Math.max(g.w, minSide);
  const h = Math.max(g.h, minSide);
  return { x: g.x + (g.w - w) / 2, y: g.y + (g.h - h) / 2, w, h };
};

/** Clamp a rect inside the viewport inset by `px`. */
export const clampToViewport = (
  r: Rect,
  px: number,
  vw: number = viewW(),
  vhPx: number = viewH(),
): Rect => {
  const x0 = Math.max(px, r.x);
  const y0 = Math.max(px, r.y);
  const x1 = Math.min(vw - px, r.x + r.w);
  const y1 = Math.min(vhPx - px, r.y + r.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
};

export const rectCenter = (r: Rect): { x: number; y: number } => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Circle bbox: (cx ± r, cy ± r). */
export const circleRect = (cx: number, cy: number, r: number): Rect => ({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r });

/** Slice i of n (horizontal) of a rect — J6 bar fusion targets. */
export const sliceRect = (r: Rect, i: number, n: number): Rect => ({ x: r.x + (r.w * i) / n, y: r.y, w: r.w / n, h: r.h });

/** CSS `inset(top right bottom left)` that clips an element laid out at
 *  `frame` down to `box` (both viewport px). */
export const insetFor = (frame: Rect, box: Rect, radius = 0): string => {
  const t = box.y - frame.y;
  const l = box.x - frame.x;
  const b = frame.y + frame.h - (box.y + box.h);
  const r = frame.x + frame.w - (box.x + box.w);
  const px = (v: number) => `${Math.round(v * 2) / 2}px`;
  return `inset(${px(t)} ${px(r)} ${px(b)} ${px(l)}${radius > 0 ? ` round ${px(radius)}` : ""})`;
};

/** J6 (800–850): the box the brackets draw AND the dossier paper clip follows.
 *  From the viewport inset 16 → `card@ch2 − 8 px` (shrunk by `endInset`), sine.inOut.
 *  Both RIG and DOSSIER must call this with the same `cardCh2` rect (`dos.card@ch2`). */
export const CARD_BUILD = { from: 800, to: 850, viewportInset: 16, endInset: 8 } as const;
export function cardBuildBox(
  vh: number,
  cardCh2: Rect,
  vw: number = viewW(),
  vhPx: number = viewH(),
): Rect {
  const t = sineInOut(progress(CARD_BUILD.from * PACE, CARD_BUILD.to * PACE, vh));
  const a = viewportInset(CARD_BUILD.viewportInset, vw, vhPx);
  const b = inflateRect(cardCh2, -CARD_BUILD.endInset);
  return lerpRect(a, b, t);
}

/** J5 dawn front radius in px — the GL interior hole and the CH1 ink twin use this. */
export const dawnFrontPx = (dawn: number, vw: number = viewW(), vhPx: number = viewH()): number =>
  dawn * 0.56 * Math.hypot(vw, vhPx);

/* ── curves ─────────────────────────────────────────────────── */

export interface Pt {
  x: number;
  y: number;
}

/** Quadratic Bézier point. */
export const bezierQ = (p0: Pt, c: Pt, p2: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y,
  };
};
/** Quadratic Bézier tangent (unnormalised derivative). */
export const bezierQTangent = (p0: Pt, c: Pt, p2: Pt, t: number): Pt => ({
  x: 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p2.x - c.x),
  y: 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p2.y - c.y),
});
/** C2a chip control point: midpoint + perpendicular offset of ±k·|P2 − P0|. */
export const bezierQControl = (p0: Pt, p2: Pt, k: number, sign: 1 | -1): Pt => {
  const mx = (p0.x + p2.x) / 2;
  const my = (p0.y + p2.y) / 2;
  const dx = p2.x - p0.x;
  const dy = p2.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mx + (-dy / len) * k * len * sign, y: my + (dx / len) * k * len * sign };
};

/**
 * Fritsch–Carlson monotone cubic interpolation (§7.2 camera speed profiles).
 * `xs` strictly increasing (equal neighbours are treated as a flat hold);
 * optional end tangents override the estimates (e.g. slope 0 at a rest/park).
 * Returns f(x), clamped to the end values outside [xs0, xsN].
 */
export function monotoneCubic(
  xs: readonly number[],
  ys: readonly number[],
  startSlope?: number,
  endSlope?: number,
): (x: number) => number {
  const n = xs.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => ys[0];
  const d: number[] = [];
  const h: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    d[i] = h[i] > 0 ? (ys[i + 1] - ys[i]) / h[i] : 0;
  }
  const m: number[] = new Array(n);
  m[0] = startSlope ?? d[0];
  m[n - 1] = endSlope ?? d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x >= xs[i + 1]) i++;
    const hi = h[i];
    if (hi <= 0) return ys[i + 1];
    const t = (x - xs[i]) / hi;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * hi * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * hi * m[i + 1]
    );
  };
}

/* ── score channels ─────────────────────────────────────────── */

const interp = (mode: Interp, a: number, b: number, t: number): number => {
  switch (mode) {
    case "linear":
      return a + (b - a) * t;
    case "smooth":
      return a + (b - a) * smooth01(t);
    case "sine":
      return a + (b - a) * sineInOut(t);
    case "log":
      return a > 0 && b > 0 ? a * Math.pow(b / a, t) : a + (b - a) * t;
    case "step":
      return a;
  }
};

/** Evaluate one beats.SCORE channel at vh. Pure; reverses exactly. */
export function evalChannel(def: ChannelDef, vh: number): number {
  if (def.kind === "window") return vh >= def.from && vh < def.to ? 1 : 0;
  if (def.kind === "gauss") {
    const z = (vh - def.center) / def.width;
    return def.amp * Math.exp(-z * z);
  }
  const k = def.keys;
  if (k.length === 0) return 0;
  if (vh < k[0][0]) return k[0][1];
  let i = 0;
  // largest i with k[i].vh <= vh (a repeated vh is a step: the later key wins)
  while (i < k.length - 1 && k[i + 1][0] <= vh) i++;
  if (i === k.length - 1) return k[i][1];
  const [x0, y0] = k[i];
  const [x1, y1] = k[i + 1];
  return interp(def.interp, y0, y1, (vh - x0) / (x1 - x0));
}

/* ── seeded randomness (deterministic layouts) ──────────────── */

/** mulberry32 — tiny deterministic PRNG in [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
