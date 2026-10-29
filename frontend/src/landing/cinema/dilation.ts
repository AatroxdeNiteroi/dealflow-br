/* ============================================================
   cinema/dilation.ts — scroll-space dilation (spec rev 3.1 §2.2, WP0).

   Pure, no DOM. The page gets longer only inside text holds: the
   wheel moves the story 1.5–4.3× slower exactly where there is
   something to read.

     vh   master vh (every table stays in master vh, §0.2)
     s    scroll distance in viewport heights from the top of
          .lp-scroll ("s-vh"): what the wheel produces
     k(vh)   = max(1, max_i 1 + (K_i − 1)·ss(from_i, from_i + RAMP, vh)
                                      ·(1 − ss(to_i − RAMP, to_i, vh)))
     Winv(vh) = ∫0^vh k     (s at a master vh)
     W(s)     = Winv⁻¹(s)   (master vh at a scroll position; dW/ds = 1/k)

   Tabulated every 0.25 vh over [0, MASTER_END] (7601 doubles per
   profile, midpoint rule — the same integration as
   scratchpad/work/v3dir/rev/dwell31.cjs), linear between samples, so
   W(Winv(x)) = x to float precision. Outside [0, 1900] k = 1.

   Profiles: "fine" (fine pointer) and "coarse" (`(pointer: coarse)`,
   the same media query CSS uses). K per profile is explicit (no
   TOUCH_SCALE). Reduced motion has no tracks, so no dilation.
   Consumers: WP1 (director W/Winv, follower target, snap s-space),
   WP8 (read windows, meter, lead starts), the track assert.
   ============================================================ */

import { MASTER_END, PACE, RESTS, ACTS_AT, type RestId } from "./beats";

export type DilationProfile = "fine" | "coarse";

export interface Dwell {
  id: string;
  /** master vh */
  from: number;
  to: number;
  /** stretch on fine pointers */
  K: number;
  /** stretch on coarse pointers */
  Ktouch: number;
  /** a read window (§5.7 rule 1): holds text, contains exactly one rest */
  read: boolean;
  /** read windows: the rest inside */
  rest?: RestId;
  /** read windows: master vh at which the window's text is fully settled (meter start) */
  full?: number;
  /** read windows: master vh at which the text breaks (meter end, lead end) */
  meterEnd?: number;
}

const P = (v: number): number => v * PACE;

/** Ramp length (vh) of the smoothstep at both ends of every window. */
export const RAMP = 10;

/** §2.2 dilation windows (master vh). */
export const DWELLS: readonly Dwell[] = [
  /** lock act, target tag, R1 */
  { id: "D1", from: P(342), to: P(376), K: 1.6, Ktouch: 1.6, read: false },
  /** respiro fully written, R2 */
  { id: "D2", from: P(604), to: P(694), K: 1.5, Ktouch: 1.625, read: true, rest: "R2", full: P(617.6), meterEnd: P(673) },
  /** dossier header, R3 */
  { id: "D3", from: P(862), to: P(896), K: 1.5, Ktouch: 1.5, read: false },
  /** rev-note, C2 close, R4 */
  // motion r1: K 3.9 → 4.4 (C2 legible ≈ 5.7 s at 50 vh/s) and the tail 1190 → 1200, so the
  // close evaporates while the page is still viscous (D7 / D9 likewise; meterEnd unchanged)
  // motion r2: full 1150 → 1146 (the C2 sub pours 1122–1146, so the meter starts when it is settled)
  { id: "D4", from: P(1108), to: P(1200), K: 4.4, Ktouch: 4.6, read: true, rest: "R4", full: P(1146), meterEnd: P(1186) },
  /** amount sharp, R5 */
  { id: "D5", from: P(1384), to: P(1414), K: 1.5, Ktouch: 1.5, read: false },
  /** range ends and seal, read alone */
  { id: "D6", from: P(1460), to: P(1492), K: 1.8, Ktouch: 1.8, read: false },
  /** C3 close, R6 */
  { id: "D7", from: P(1494), to: P(1604), K: 3.75, Ktouch: 4.0, read: true, rest: "R6", full: P(1540), meterEnd: P(1590) },
  /** count settles, alone */
  { id: "D8", from: P(1740), to: P(1768), K: 2.4, Ktouch: 2.4, read: false },
  /** Ch4 close, R7 (overlaps D8 over 1758–1768) */
  // motion r2: tail 1860 → 1870, so the count-plate drain (1859–1866) and the stage off (1868)
  // play while the page is still viscous, not at full speed plus the lag-cap catch-up
  { id: "D9", from: P(1758), to: P(1870), K: 4.3, Ktouch: 4.375, read: true, rest: "R7", full: P(1782), meterEnd: P(1848) },
];

/** The read windows (D2, D4, D7, D9). */
export const READ_WINDOWS: readonly Dwell[] = DWELLS.filter((d) => d.read);

const ss = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Stretch k(vh) ≥ 1 for a profile (pure). */
export function k(vh: number, profile: DilationProfile = "fine"): number {
  let v = 1;
  for (const d of DWELLS) {
    const K = profile === "coarse" ? d.Ktouch : d.K;
    const w = ss(d.from, d.from + RAMP, vh) * (1 - ss(d.to - RAMP, d.to, vh));
    const x = 1 + (K - 1) * w;
    if (x > v) v = x;
  }
  return v;
}

/** Table step (vh). */
export const STEP = 0.25;
const N = Math.round(MASTER_END / STEP); // 7600 intervals → 7601 samples

function buildTable(profile: DilationProfile): Float64Array {
  const t = new Float64Array(N + 1);
  let s = 0;
  for (let i = 1; i <= N; i++) {
    const vh = i * STEP;
    s += k(vh - STEP / 2, profile) * STEP;
    t[i] = s;
  }
  return t;
}

const TABLES: Record<DilationProfile, Float64Array> = {
  fine: buildTable("fine"),
  coarse: buildTable("coarse"),
};

/** s-vh at the master end (the scroll length of the cinema) for a profile. */
export function S_END(profile: DilationProfile = "fine"): number {
  return TABLES[profile][N];
}

/** Master vh → s-vh (∫0^vh k). Linear between 0.25-vh samples; k = 1 outside [0, MASTER_END]. */
export function Winv(vh: number, profile: DilationProfile = "fine"): number {
  const t = TABLES[profile];
  if (vh <= 0) return vh;
  if (vh >= MASTER_END) return t[N] + (vh - MASTER_END);
  const x = vh / STEP;
  const i = Math.floor(x);
  if (i >= N) return t[N];
  return t[i] + (t[i + 1] - t[i]) * (x - i);
}

/** s-vh → master vh (inverse of Winv: binary search on the same table, linear between samples). */
export function W(s: number, profile: DilationProfile = "fine"): number {
  const t = TABLES[profile];
  if (s <= 0) return s;
  const end = t[N];
  if (s >= end) return MASTER_END + (s - end);
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= s) lo = mid;
    else hi = mid;
  }
  const a = t[lo];
  const b = t[hi];
  return (lo + (b > a ? (s - a) / (b - a) : 0)) * STEP;
}

/** The dilation window containing master vh (read or not), or null. Overlaps (D8/D9) return the read window. */
export function dwellAt(vh: number): Dwell | null {
  let hit: Dwell | null = null;
  for (const d of DWELLS) {
    if (vh >= d.from && vh <= d.to) {
      if (!hit || (d.read && !hit.read)) hit = d;
    }
  }
  return hit;
}

/** The read window containing master vh, or null (ctx.playhead.readWindow). */
export function readWindowAt(vh: number): Dwell | null {
  for (const d of READ_WINDOWS) if (vh >= d.from && vh <= d.to) return d;
  return null;
}

/* ── track mirror (§2.2): only the SUM is load-bearing (stages are fixed) ── */

const trackSet = (profile: DilationProfile) => {
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const ch1 = Winv(P(880), profile);
  const ch2 = Winv(P(1160), profile) - ch1;
  const ch3 = Winv(P(1560), profile) - Winv(P(1160), profile);
  const ch4 = S_END(profile) - Winv(P(1560), profile) + 100;
  return { lpScroll: r1(ch1), ch2: r1(ch2), ch3: r1(ch3), ch4: r1(ch4) };
};

/** CSS mirror, fine pointers (landing.css, WP1): sum = S_END + 100 = 3005.8 (motion r2: D9 tail 1870). */
export const TRACKS_VH = { lpScroll: 940.9, ch2: 445.3, ch3: 714.3, ch4: 905.3 } as const;
/** CSS mirror, `(pointer: coarse)`: sum = 3064.9. */
export const TRACKS_VH_TOUCH = { lpScroll: 950.9, ch2: 454.7, ch3: 736.6, ch4: 922.7 } as const;

/** Track heights recomputed from the tables (unit test: equal to TRACKS_VH / TRACKS_VH_TOUCH). */
export function computeTracks(profile: DilationProfile): { lpScroll: number; ch2: number; ch3: number; ch4: number } {
  return trackSet(profile);
}

/** Which profile the CSS uses right now (same media query). */
export function currentProfile(): DilationProfile {
  if (typeof window === "undefined" || !window.matchMedia) return "fine";
  return window.matchMedia("(pointer: coarse)").matches ? "coarse" : "fine";
}

/* ── dock rules (§5.7) ─────────────────────────────────────── */

/** Lead start of a rest's imperative: max(W(s(R.at) − 30), the last act in (R − 60, R − 8)). */
export function leadStart(restId: RestId, profile: DilationProfile = "fine"): number {
  const r = RESTS.find((x) => x.id === restId);
  if (!r || !r.plateau) return 0;
  const a = W(Winv(r.at, profile) - 30, profile);
  let act = -Infinity;
  for (const at of Object.values(ACTS_AT)) if (at < r.at - P(8) && at > r.at - P(60)) act = Math.max(act, at);
  return Math.max(a, act);
}

/** Reading-meter fill m ∈ [0, 1] for a read window at scroll position s (s-vh), or null outside full → end. */
export function meterAt(d: Dwell, s: number, profile: DilationProfile = "fine"): number | null {
  if (!d.read || d.full === undefined || d.meterEnd === undefined) return null;
  const a = Winv(d.full, profile);
  const b = Winv(d.meterEnd, profile);
  if (s < a || s > b) return null;
  return b > a ? (s - a) / (b - a) : 1;
}
