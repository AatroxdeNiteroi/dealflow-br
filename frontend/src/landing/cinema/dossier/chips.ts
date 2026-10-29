/* ============================================================
   cinema/dossier/chips.ts — WP-DOSSIER pure math (no DOM).

   Everything here is a pure function of its inputs, so the per-frame
   writer in dossier.timeline.ts stays a pure function of master vh
   (exact reversal, no state):

   - rounded-rect / stadium paths (tick dial ring, orbit) sampled by
     perimeter fraction, clockwise from top-centre (screen y down);
   - the C2a/C2b/C3a schedule: tick draw, chip flights (3 waves),
     impacts, orbit, landings, the C3b convergence (§5);
   - closed-form quadratic Bézier flight state (position, tangent,
     normalised speed) — no MotionPath (§10.7).

   Times are authored in base vh and scaled by PACE (beats.ts).
   v3 (WP7): the windows read by more than one package come from
   beats.ts SHARED_WINDOWS (orbit start / pause, landing start) and the
   C3b convergence from TEXT_V3 (1236–1262); the tick dial ring is a
   STADIUM concentric with the capsule tarja (§7 C2).
   ============================================================ */

import { PACE, SHARED_WINDOWS, TEXT_V3 } from "../beats";
import { bezierQ, bezierQTangent, clamp01, sineInOut, type Pt } from "../geometry";
import type { Rect } from "../types";

export const CHIPS_DESKTOP = 26;
export const CHIPS_MOBILE = 12;

const P = (v: number): number => v * PACE;

/* ── paths ──────────────────────────────────────────────────── */

/** Rounded rectangle: centre, half sizes, corner radius. */
export interface RRect {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  r: number;
}

/** A point on a path with its outward normal and clockwise tangent. */
export interface PathPt {
  x: number;
  y: number;
  nx: number;
  ny: number;
  tx: number;
  ty: number;
}

export const newPathPt = (): PathPt => ({ x: 0, y: 0, nx: 0, ny: -1, tx: 1, ty: 0 });

/** `r` inflated by `inflate` on every side, corner radius clamped to the half sizes. */
export function rrectAround(r: Rect, inflate: number, radius: number): RRect {
  const hw = Math.max(0, r.w / 2 + inflate);
  const hh = Math.max(0, r.h / 2 + inflate);
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, hw, hh, r: Math.max(0, Math.min(radius, hw, hh)) };
}

/** Stadium (semicircular ends) around `r` ⊕ inflate — the orbit of the "cerco". */
export function stadiumAround(r: Rect, inflate: number): RRect {
  const q = rrectAround(r, inflate, Infinity);
  q.r = Math.min(q.hw, q.hh);
  return q;
}

export function rrPerimeter(q: RRect): number {
  return 4 * (q.hw - q.r) + 4 * (q.hh - q.r) + 2 * Math.PI * q.r;
}

const setPt = (o: PathPt, x: number, y: number, nx: number, ny: number, tx: number, ty: number): PathPt => {
  o.x = x;
  o.y = y;
  o.nx = nx;
  o.ny = ny;
  o.tx = tx;
  o.ty = ty;
  return o;
};

const arcPt = (o: PathPt, cx: number, cy: number, r: number, a: number): PathPt => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  // y down: increasing angle runs clockwise on screen
  return setPt(o, cx + r * c, cy + r * s, c, s, -s, c);
};

/** Point at perimeter fraction u (wraps), clockwise from top-centre. */
export function rrPoint(q: RRect, u: number, out: PathPt = newPathPt()): PathPt {
  const per = rrPerimeter(q);
  if (per <= 0) return setPt(out, q.cx, q.cy, 0, -1, 1, 0);
  let s = (((u % 1) + 1) % 1) * per;
  const { cx, cy, hw, hh, r } = q;
  const ex = hw - r; // half straight length, horizontal
  const ey = hh - r; // half straight length, vertical
  const arc = (Math.PI * r) / 2;
  // top edge, right half
  if (s < ex) return setPt(out, cx + s, cy - hh, 0, -1, 1, 0);
  s -= ex;
  if (s < arc) return arcPt(out, cx + ex, cy - ey, r, -Math.PI / 2 + s / r);
  s -= arc;
  if (s < 2 * ey) return setPt(out, cx + hw, cy - ey + s, 1, 0, 0, 1);
  s -= 2 * ey;
  if (s < arc) return arcPt(out, cx + ex, cy + ey, r, s / r);
  s -= arc;
  if (s < 2 * ex) return setPt(out, cx + ex - s, cy + hh, 0, 1, -1, 0);
  s -= 2 * ex;
  if (s < arc) return arcPt(out, cx - ex, cy + ey, r, Math.PI / 2 + s / r);
  s -= arc;
  if (s < 2 * ey) return setPt(out, cx - hw, cy + ey - s, -1, 0, 0, -1);
  s -= 2 * ey;
  if (s < arc) return arcPt(out, cx - ex, cy - ey, r, Math.PI + s / r);
  s -= arc;
  return setPt(out, cx - ex + s, cy - hh, 0, -1, 1, 0);
}

/** CSS rotation (deg) that aligns an element's long (y) axis with the normal. */
export const normalAngleDeg = (p: PathPt): number => (Math.atan2(-p.nx, p.ny) * 180) / Math.PI;
/** CSS rotation (deg) that aligns an element's x axis with the travel tangent. */
export const tangentAngleDeg = (tx: number, ty: number): number => (Math.atan2(ty, tx) * 180) / Math.PI;

/** Shortest-path angle interpolation (deg). */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  if (d === -180) d = 180;
  return a + d * t;
}

/* ── schedule (§5 C2a–C3b) ──────────────────────────────────── */

export interface ChipTiming {
  /** Chip index (time order). */
  i: number;
  wave: 0 | 1 | 2;
  /** Depth layer (i % 3): 0 near · 1 mid · 2 far. */
  depth: 0 | 1 | 2;
  start: number;
  end: number;
  /** Absorbed chips light this tick at impact; orbiters land on it in C3a. */
  tick: number;
  /** Orbit slot (wave 3) or −1. */
  slot: number;
  /** C3a landing window (orbiters only). */
  land: readonly [number, number] | null;
  /** Bézier bulge side. */
  sign: 1 | -1;
}

export interface DialSchedule {
  /** Ticks = chips. */
  n: number;
  nAbs: number;
  nOrb: number;
  chips: ChipTiming[];
  /** Tick draw windows (888–905). */
  draw: Array<readonly [number, number]>;
  /** Tick light window = the chip's impact (last 10%) or the orbiter's landing tail. */
  lit: Array<readonly [number, number]>;
  /** Event vh per tick (impact / landing end) — charge line and thunk. */
  event: number[];
  /** Impacts that thunk the tarja and ripple the field (C2a absorptions). */
  impacts: number[];
}

export const DIAL = {
  draw: [P(888), P(905)] as const,
  drawLen: P(2),
  flight: P(40),
  waveStarts: [P(905), P(965), P(1025)] as const,
  waveSpan: P(80),
  /** Impact = the last 10% of a flight. */
  impactFrac: 0.1,
  /** Orbit: quarter turn per 47 vh, scrubbed from 1105, still across R4 (SHARED_WINDOWS). */
  orbitFrom: SHARED_WINDOWS.chipsOrbitFrom,
  orbitPause: [SHARED_WINDOWS.chipsOrbitPause.from, SHARED_WINDOWS.chipsOrbitPause.to] as const,
  orbitRate: 0.25 / P(47),
  /** Orbiter k lands over [1172 + 2k, 1180 + 2k] (while the C2 close is held, inside the card). */
  landStart: SHARED_WINDOWS.chipsLandStart,
  landStep: P(2),
  landLen: P(8),
  /** C3b: ticks converge on the tarja's left edge (v3: 1236–1262, after the card has grown). */
  converge: [TEXT_V3.dossier.converge.from, TEXT_V3.dossier.converge.to] as const,
  convergeStagger: P(0.6),
  convergeFade: P(4),
  /** Tick light / bump length. */
  litLen: P(4),
  /** Sparks live in the first 15% of a flight. */
  sparkFrac: 0.15,
} as const;

export function buildSchedule(mobile: boolean): DialSchedule {
  const waves = mobile ? [4, 4, 4] : [9, 9, 8];
  const n = waves[0] + waves[1] + waves[2];
  const nOrb = waves[2];
  const nAbs = n - nOrb;
  const chips: ChipTiming[] = [];
  let i = 0;
  for (let w = 0; w < 3; w++) {
    const count = waves[w];
    // desktop: 5 vh between chips (spec); mobile: spread the 4 over the same wave
    const step = mobile ? (DIAL.waveSpan - DIAL.flight) / Math.max(1, count - 1) : P(5);
    for (let j = 0; j < count; j++, i++) {
      const start = DIAL.waveStarts[w] + step * j;
      const orbiter = w === 2;
      const k = j;
      chips.push({
        i,
        wave: w as 0 | 1 | 2,
        depth: (i % 3) as 0 | 1 | 2,
        start,
        end: start + DIAL.flight,
        tick: orbiter ? nAbs + k : i,
        slot: orbiter ? k : -1,
        land: orbiter ? [DIAL.landStart + DIAL.landStep * k, DIAL.landStart + DIAL.landStep * k + DIAL.landLen] : null,
        sign: i % 2 === 0 ? 1 : -1,
      });
    }
  }
  const drawStep = (DIAL.draw[1] - DIAL.draw[0] - DIAL.drawLen) / Math.max(1, n - 1);
  const draw = Array.from({ length: n }, (_, t) => {
    const a = DIAL.draw[0] + drawStep * t;
    return [a, a + DIAL.drawLen] as const;
  });
  const event: number[] = new Array(n).fill(0);
  const lit: Array<readonly [number, number]> = new Array(n);
  const impacts: number[] = [];
  for (const c of chips) {
    const e = c.land ? c.land[1] : c.end;
    event[c.tick] = e;
    lit[c.tick] = [e - DIAL.litLen, e];
    if (!c.land) impacts.push(e - DIAL.litLen);
  }
  return { n, nAbs, nOrb, chips, draw, lit, event, impacts };
}

/** Orbit perimeter fraction for slot k at vh (quarter turn over 1105–1152, still on R4, resumes after C3a starts). */
export function orbitU(slot: number, nOrb: number, vh: number): number {
  const base = slot / Math.max(1, nOrb) + 0.5 / Math.max(1, nOrb);
  // unclamped below 1105: an orbiter keeps drifting along the orbit from the moment it
  // arrives (no dead stop), and every slot is at its base angle exactly at 1105
  const a = Math.min(vh, DIAL.orbitPause[0]) - DIAL.orbitFrom;
  const b = Math.max(0, vh - DIAL.orbitPause[1]);
  return base + (a + b) * DIAL.orbitRate;
}

/** Triangle 0 → 1 → 0 over [a, b]. */
export function tri(a: number, b: number, v: number): number {
  if (v <= a || v >= b) return 0;
  const t = (v - a) / (b - a);
  return 1 - Math.abs(2 * t - 1);
}

/* ── flights ────────────────────────────────────────────────── */

export interface Flight {
  x: number;
  y: number;
  /** Travel direction (deg, CSS rotate). */
  angle: number;
  /** 0..1, normalised by the fastest chip of the swarm. */
  speed: number;
}

/** Eased quadratic Bézier flight: position at t' = sine.inOut(t), rotation = tangent. */
export function flight(p0: Pt, c: Pt, p2: Pt, t: number, vmax: number, out: Flight): Flight {
  const tt = sineInOut(clamp01(t));
  const p = bezierQ(p0, c, p2, tt);
  const d = bezierQTangent(p0, c, p2, tt);
  out.x = p.x;
  out.y = p.y;
  if (Math.abs(d.x) + Math.abs(d.y) > 1e-6) out.angle = tangentAngleDeg(d.x, d.y);
  // |dP/dt| = |B'(t')| · (π/2)·sin(πt)
  const v = Math.hypot(d.x, d.y) * (Math.PI / 2) * Math.sin(Math.PI * clamp01(t));
  out.speed = vmax > 0 ? clamp01(v / vmax) : 0;
  return out;
}

/** Fastest mid-flight speed among chips (normaliser for the trails). */
export function swarmVmax(pairs: ReadonlyArray<{ p0: Pt; p2: Pt }>): number {
  let m = 0;
  for (const { p0, p2 } of pairs) m = Math.max(m, Math.hypot(p2.x - p0.x, p2.y - p0.y) * (Math.PI / 2));
  return m;
}

/**
 * Match sources to targets by angle around `c` so chips arrive from the
 * direction of their tick (no paths crossing the card), while the dial
 * still lights in index order. Returns, per target, the index of its source.
 */
export function matchByAngle(c: Pt, targets: readonly Pt[], sources: readonly Pt[]): number[] {
  const n = targets.length;
  const m = sources.length;
  if (!n || !m) return [];
  const ang = (p: Pt) => Math.atan2(p.y - c.y, p.x - c.x);
  const tOrd = targets.map((p, i) => ({ i, a: ang(p) })).sort((a, b) => a.a - b.a);
  const sOrd = sources.map((p, i) => ({ i, a: ang(p) })).sort((a, b) => a.a - b.a);
  // best cyclic shift (sources may outnumber targets; reuse wraps if fewer)
  let bestShift = 0;
  let best = Infinity;
  for (let shift = 0; shift < m; shift++) {
    let cost = 0;
    for (let k = 0; k < n; k++) {
      const s = sOrd[(k + shift) % m];
      let d = Math.abs(s.a - tOrd[k].a);
      if (d > Math.PI) d = 2 * Math.PI - d;
      cost += d;
    }
    if (cost < best) {
      best = cost;
      bestShift = shift;
    }
  }
  const out = new Array<number>(n);
  for (let k = 0; k < n; k++) out[tOrd[k].i] = sOrd[(k + bestShift) % m].i;
  return out;
}

/* ── C3b convergence ────────────────────────────────────────── */

export interface ConvergePlan {
  /** Column slot (top → bottom) per tick. */
  slot: number[];
  /** Window per tick. */
  win: Array<readonly [number, number]>;
}

/**
 * Ticks fold into a column on the tarja's left edge: each keeps its
 * angular order seen from the target (no crossings), the column centre
 * (the far, right-side ticks) leaves first — "from the centre" — so the
 * whole ring arrives together as the scan line is born there.
 */
export function convergePlan(pts: readonly Pt[], target: Pt): ConvergePlan {
  const n = pts.length;
  const ord = pts
    .map((p, i) => ({ i, a: Math.atan2(p.y - target.y, p.x - target.x + 1e-3) }))
    .sort((a, b) => a.a - b.a);
  const slot = new Array<number>(n);
  ord.forEach((o, k) => (slot[o.i] = k));
  const mid = (n - 1) / 2;
  const maxRank = Math.ceil(mid);
  const dur = DIAL.converge[1] - DIAL.converge[0] - DIAL.convergeStagger * maxRank;
  const win = slot.map((k) => {
    const rank = Math.floor(Math.abs(k - mid) + 1e-6);
    const a = DIAL.converge[0] + DIAL.convergeStagger * rank;
    return [a, a + dur] as const;
  });
  return { slot, win };
}

/** Column target for slot k of n along a vertical line of length `len` centred at `c`. */
export function columnPoint(c: Pt, len: number, k: number, n: number): Pt {
  const span = Math.max(0, len - 8);
  return { x: c.x, y: c.y - span / 2 + (n > 1 ? (span * k) / (n - 1) : span / 2) };
}

/* ── static ring for the reduced DossierStatic (fractions of the ring box) ── */

/** Tick positions as fractions (0..1) of the ring box around a nominal tarja
 *  (v3: a stadium, concentric with the capsule tarja, as in motion). */
export function staticRing(n: number, w = 318, h = 40, inflate = 10): Array<{ x: number; y: number; a: number }> {
  const q = stadiumAround({ x: inflate, y: inflate, w, h }, inflate);
  const bw = w + 2 * inflate;
  const bh = h + 2 * inflate;
  const out: Array<{ x: number; y: number; a: number }> = [];
  const p = newPathPt();
  for (let i = 0; i < n; i++) {
    rrPoint(q, i / n, p);
    out.push({ x: p.x / bw, y: p.y / bh, a: normalAngleDeg(p) });
  }
  return out;
}

