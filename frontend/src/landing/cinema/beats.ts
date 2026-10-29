/* ============================================================
   cinema/beats.ts — THE single source of truth for timing (WP0).

   Master time unit = 1 vh of scroll; the cinema spans 0–1900.
   Every table here is authored in base vh and multiplied by PACE
   on export, so one number retunes every beat and rest together.
   Track heights live in CSS (landing.css): if PACE changes,
   multiply TRACKS_VH there too.

   Tables (spec): BEATS §4.3 · RESTS §4.3/§4.4 · STATIONS §3.2/§3.6
   · VERB_SEGMENTS §3.4 · CAMERA §7.2 · SCORE §7.3 · ACTS_AT §4.5 ·
   RIPPLES §7.8 · MARKS (reducer/guide/snap windows) · GATEWAY_TIMING
   §5 G1–G3 (seconds, not vh).

   Retunes requested by WP-QA come back to this file (owner WP0).
   ============================================================ */

import { FLAGS } from "./flags";

/** Global pacing scale (1.0 = 1900 vh cinema, 19 viewports). */
export const PACE = 1.0;

/** World radii (z = −1 plane) of the 4 instrument rings — one source for
 *  the field (three/constants RING_RADII) and the Gateway shock timing. */
export const RING_WORLD_R = [2.4, 5.0, 7.8, 10.8] as const;
const P = (v: number): number => v * PACE;

/* ── extent ─────────────────────────────────────────────────── */

/** Master end (= `.ch5-track` "top bottom" = Ch5 start). */
export const MASTER_END = P(1900);

/** CSS mirror (landing.css). Sum 2000 vh; master end = sum − 100. */
export const TRACKS_VH = {
  lpScroll: 880,
  ch2: 280,
  ch3: 400,
  ch4: 440,
} as const;

/** Rests R1–R7 hold ±8 vh with zero foreground change. */
export const PLATEAU_HALF = P(8);
/** Act runner hysteresis (§4.5). */
export const ACT_HYSTERESIS = 0.5;
/** Guide verb swap hysteresis at segment boundaries (§3.3). */
export const VERB_HYSTERESIS = P(6);

/* ── stations (chapter rail) ────────────────────────────────── */

export type StationId = "radar" | "convergencia" | "estimativa" | "universo" | "planos";

export interface Station {
  id: StationId;
  /** Rail label, verbatim (§3.1). */
  name: string;
  /** Master vh where this station becomes active. */
  at: number;
}

/* QA fix (D7): "Estimativa" / "Universo" change WITH the eyebrow reel
   (reel1 1172–1188, reel2 1572–1588), not at the R4 / R6 rest centres —
   at a rest the rail, the eyebrow and aria-live name the same chapter. */
export const STATIONS: readonly Station[] = [
  { id: "radar", name: "Radar", at: P(0) },
  { id: "convergencia", name: "Convergência", at: P(880) },
  { id: "estimativa", name: "Estimativa", at: P(1172) },
  { id: "universo", name: "Universo", at: P(1572) },
  { id: "planos", name: "Planos", at: P(1900) },
];

/** Chapter spans in master time (§4.1). */
export const CHAPTERS = [
  { id: "ch1", from: P(0), to: P(880), track: ".lp-scroll" },
  { id: "ch2", from: P(880), to: P(1160), track: ".ch2-track" },
  { id: "ch3", from: P(1160), to: P(1560), track: ".ch3-track" },
  { id: "ch4", from: P(1560), to: P(1900), track: ".ch4-track" },
] as const;

export function stationAt(vh: number): Station {
  let s = STATIONS[0];
  for (const st of STATIONS) if (vh >= st.at) s = st;
  return s;
}

/** Rail needle 0..1 — piecewise: each chapter takes a quarter (§3.1). */
export function railProgress(vh: number): number {
  const n = STATIONS.length - 1;
  if (vh <= STATIONS[0].at) return 0;
  for (let i = 0; i < n; i++) {
    const a = STATIONS[i].at;
    const b = STATIONS[i + 1].at;
    if (vh < b) return (i + (vh - a) / (b - a)) / n;
  }
  return 1;
}

/* ── rests ──────────────────────────────────────────────────── */

export type RestId = "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7";

export interface Rest {
  id: RestId;
  at: number;
  /** [R−8, R+8]; null for R0 (the first notch must move the camera). */
  plateau: readonly [number, number] | null;
  /** Station shown at this rest (rail + aria-live). */
  station: StationId;
  /** 1-based "Etapa N de 8". */
  step: number;
  /** Imperative verb (dock, aria-live, reduced captions). */
  verb: string;
}

const HERO_VERB = FLAGS.HERO_VERB_LEGACY ? "role para varrer o campo" : "role para mergulhar no campo";

const rest = (id: RestId, at: number, station: StationId, step: number, verb: string): Rest => ({
  id,
  at: P(at),
  plateau: id === "R0" ? null : [P(at) - PLATEAU_HALF, P(at) + PLATEAU_HALF],
  station,
  step,
  verb,
});

export const RESTS: readonly Rest[] = [
  rest("R0", 0, "radar", 1, HERO_VERB),
  rest("R1", 360, "radar", 2, "role para entrar na empresa"),
  rest("R2", 665, "radar", 3, "role para iluminar a empresa"),
  rest("R3", 880, "convergencia", 4, "role para reunir as fontes"),
  // R4 / R6 name the chapter on screen (its title and close); the verb points forward
  rest("R4", 1160, "convergencia", 5, "role para revelar o número"),
  rest("R5", 1400, "estimativa", 6, "role para ver a margem"),
  rest("R6", 1560, "estimativa", 7, "role para recuar ao universo"),
  rest("R7", 1790, "universo", 8, "role para ver os planos"),
];
export const REST_COUNT = RESTS.length; // 8 → "Etapa N de 8"

export function restById(id: RestId): Rest {
  return RESTS.find((r) => r.id === id)!;
}

/** The rest whose plateau contains vh (R0: vh < 8), else null. */
export function restAt(vh: number): Rest | null {
  for (const r of RESTS) {
    if (r.plateau) {
      if (vh >= r.plateau[0] && vh <= r.plateau[1]) return r;
    } else if (vh < r.at + PLATEAU_HALF) {
      return r;
    }
  }
  return null;
}

/** Rests strictly behind / ahead of vh (ahead = first rest with at > vh). */
export function restsAround(vh: number): { prev: Rest | null; next: Rest | null } {
  let prev: Rest | null = null;
  let next: Rest | null = null;
  for (const r of RESTS) {
    if (r.at <= vh) prev = r;
    else if (!next) next = r;
  }
  return { prev, next };
}

/* ── beats (§4.3) ───────────────────────────────────────────── */

export type BeatId =
  | "J1" | "J2" | "J3" | "J4" | "J5" | "J6"
  | "C2a" | "C2b"
  | "C3a" | "C3b" | "C3c" | "C3d" | "C3e"
  | "C4a" | "C4b" | "C4c" | "C4d";

export interface Beat {
  id: BeatId;
  name: string;
  start: number;
  end: number;
  len: number;
  /** Rest reached after this beat (plateau follows `end`). */
  rest: RestId | null;
  station: StationId;
}

const beat = (
  id: BeatId,
  name: string,
  start: number,
  end: number,
  restAfter: RestId | null,
  station: StationId,
): Beat => ({ id, name, start: P(start), end: P(end), len: P(end - start), rest: restAfter, station });

export const BEATS: readonly Beat[] = [
  beat("J1", "Mergulho", 0, 220, null, "radar"),
  beat("J2", "Mira", 220, 352, "R1", "radar"),
  beat("J3", "Travessia", 368, 480, null, "radar"),
  beat("J4", "Interior", 480, 657, "R2", "radar"),
  beat("J5", "Alvorada", 673, 770, null, "radar"),
  beat("J6", "Dossiê nasce", 770, 872, "R3", "radar"),
  beat("C2a", "Convergência", 888, 1110, null, "convergencia"),
  beat("C2b", "Cerco", 1110, 1152, "R4", "convergencia"),
  beat("C3a", "Metamorfose", 1168, 1230, null, "estimativa"),
  beat("C3b", "Fusão", 1230, 1270, null, "estimativa"),
  beat("C3c", "Varredura", 1270, 1392, "R5", "estimativa"),
  beat("C3d", "Faixa + selo", 1408, 1490, null, "estimativa"),
  beat("C3e", "Desfecho", 1490, 1552, "R6", "estimativa"),
  beat("C4a", "Recuo", 1568, 1650, null, "universo"),
  beat("C4b", "Universo", 1650, 1755, null, "universo"),
  beat("C4c", "Referente", 1755, 1782, "R7", "universo"),
  beat("C4d", "Entrega", 1798, 1900, null, "universo"),
];

export function beatById(id: BeatId): Beat {
  return BEATS.find((b) => b.id === id)!;
}

/** Beat progress b = (vh − start)/len, clamped 0..1. */
export function beatProgress(id: BeatId, vh: number): number {
  const b = beatById(id);
  const t = (vh - b.start) / b.len;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/* ── time-based gateway beats (seconds) ─────────────────────── */

export const GATEWAY_TIMING = {
  /** G1 boot ≈ 1.9 s. */
  G1: { dur: 1.9 },
  /** G2 exit 1.1 s; contact frame 0.72 s; quiet: cover at .30, onLeft at .65. */
  G2: { dur: 1.1, contact: 0.72, onLeft: 1.1, quietCover: 0.3, quietCoverDur: 0.3, quietLeft: 0.65 },
  /** G3 wake ≤ 0.9 s after phase "radar". */
  G3: { dur: 0.9, dockAt: 0.35, onboardingAt: 0.5 },
  /** G1 camera entry offset (world units, added to pos.z at vh 0). */
  entryZ: 3.5,
} as const;

/* ── guide copy table (§3.4; all ≤ 30 characters) ───────────── */

export type GuideState = "rest" | "transit" | "handoff";

export interface VerbSegment {
  from: number;
  to: number;
  state: GuideState;
  verb: string;
  /** Set on rest segments. */
  rest?: RestId;
}

const seg = (from: number, to: number, state: GuideState, verb: string, r?: RestId): VerbSegment => ({
  from: P(from),
  to: P(to),
  state,
  verb,
  rest: r,
});

const R = (id: RestId) => restById(id);

/** Contiguous, ordered, covering [0, 1900]. Rest segments = plateaus. */
export const VERB_SEGMENTS: readonly VerbSegment[] = [
  seg(0, 8, "rest", R("R0").verb, "R0"),
  seg(8, 220, "transit", "mergulhando no campo"),
  seg(220, 352, "transit", "travando a mira"),
  seg(352, 368, "rest", R("R1").verb, "R1"),
  seg(368, 480, "transit", "entrando na empresa"),
  seg(480, 657, "transit", "dentro da empresa"),
  seg(657, 673, "rest", R("R2").verb, "R2"),
  seg(673, 770, "transit", "iluminando a empresa"),
  seg(770, 872, "transit", "abrindo o dossiê"),
  seg(872, 888, "rest", R("R3").verb, "R3"),
  seg(888, 1110, "transit", "reunindo as fontes"),
  seg(1110, 1152, "transit", "cercando o número"),
  seg(1152, 1168, "rest", R("R4").verb, "R4"),
  seg(1168, 1230, "transit", "preparando a estimativa"),
  seg(1230, 1392, "transit", "revelando o número"),
  seg(1392, 1408, "rest", R("R5").verb, "R5"),
  seg(1408, 1552, "transit", "traçando a margem"),
  seg(1552, 1568, "rest", R("R6").verb, "R6"),
  seg(1568, 1650, "transit", "a empresa vira um ponto"),
  seg(1650, 1782, "transit", "recuando ao universo"),
  seg(1782, 1798, "rest", R("R7").verb, "R7"),
  // rest style (full ring, breathing chevron), not a rest: never snapped
  seg(1798, 1900, "handoff", "a seguir: os planos"),
];

/** idleMid verb (existing copy). */
export const VERB_IDLE_MID = "continue rolando";
/** back verb: "voltando · Convergência". */
export function verbBack(station: Station): string {
  return "voltando · " + station.name;
}

/** Segment containing vh (clamped to the table). */
export function segmentAt(vh: number): VerbSegment {
  for (const s of VERB_SEGMENTS) if (vh < s.to) return s;
  return VERB_SEGMENTS[VERB_SEGMENTS.length - 1];
}

/* ── acts (§4.5) — label positions; owners build the timelines ─ */

export const ACTS_AT = {
  /** RIG — bracket snap + gold flash + tag reveal. */
  lock: P(345),
  /** DOSSIER — needle drop. */
  needle: P(1450),
  /** DOSSIER — seal stamp + check draw. */
  seal: P(1475),
  /** RIG — ring lock around the lit disc. */
  ringLock: P(1645),
  /** CH4 — odometer settle + panel hairline. */
  countSettle: P(1752),
} as const;

/* ── ink ripples (§7.8) ─────────────────────────────────────── */

export const RIPPLES = {
  /** Active while 0 ≤ vh − vh_e ≤ window. */
  window: P(14),
  radiusPx: 260,
  amp: 0.18,
  maxActive: 6,
  /** Fixed events; the 18 C2a impacts are registered by DOSSIER. */
  at: {
    lock: P(345),
    seal: P(1475),
    membrane: P(1605),
    ringLock: P(1645),
  },
} as const;

/* ── windows used by the reducer / guide / snap ─────────────── */

export const MARKS = {
  /** REDUCER: `.lp-cta` y 16 → 0, autoAlpha 0 → 1 (sine.out). */
  ctaIn: [P(755), P(775)] as const,
  /** REDUCER: chrome returns (yPercent ∓100 → 0, autoAlpha → 1, sine.inOut). */
  chromeIn: [P(1840), P(1880)] as const,
  /** GUIDE: dock inner lifts −(footerH + 10 px). */
  dockLift: [P(1840), P(1880)] as const,
  /** Every ch1–4 layer at autoAlpha 0 from here. */
  layersOff: P(1880),
  /** GUIDE mobile: dock moves above the CTA row once the CTA is visible. */
  ctaVisible: P(755),
  /** §4.7 directional snap. */
  snap: { aheadVh: P(30), anyVh: P(6), maxVh: P(1800), idleMs: 220, maxVelocity: 0.2 },
  /** §3.9 dock button at R7+: masterEnd + 0.30 × ch5 scroll length. */
  dockCh5Fraction: 0.3,
} as const;

/* ── camera (§7.2) ──────────────────────────────────────────── */

export type Vec3 = readonly [number, number, number];

/** "sua empresa" in world space (PointField's SP). */
export const SP: Vec3 = [0.9, -0.5, 1.2];
/** Company sphere radius at the dive (world units). */
export const SPHERE_R = 0.42;

/** a = arc fraction 0..1 along a path; `{ knot: k }` = that knot's arc fraction (computed at build). */
export type ArcRef = number | { knot: number };

export interface ProfileKey {
  vh: number;
  a: ArcRef;
  /** Tangent in a-per-vh; "secant" = slope of the chord to the next key. */
  slope?: number | "secant";
}

export interface CameraPath {
  /** Centripetal Catmull–Rom knots, sampled by arc length. */
  points: readonly Vec3[];
  /** Look-at knots, sampled at the same knot coordinate (§7.2). */
  look: readonly Vec3[];
  /** Fritsch–Carlson monotone cubic vh → a. */
  profile: readonly ProfileKey[];
}

const key = (vh: number, a: ArcRef, slope?: number | "secant"): ProfileKey => ({ vh: P(vh), a, slope });

export const CAMERA = {
  fovBase: 46,
  near: 0.1,
  far: 160,
  /** IN path while vh < switchAt, OUT from switchAt on. */
  switchAt: P(1568),
  in: {
    points: [
      [0, 0, 16],
      [0.42, -0.24, 9.4],
      [0.84, -0.47, 4.0],
      [0.9, -0.5, 1.62], // contact: |cam − SP| = R
      [0.9, -0.5, 1.2], // SP centre
    ],
    look: [
      [0, 0, 0],
      [0.55, -0.31, 0.7],
      SP,
      [0.9, -0.5, 0.6],
      [0.9, -0.5, 0.2],
    ],
    profile: [
      key(0, 0, "secant"),
      key(220, 0.42),
      key(352, 0.7),
      key(368, 0.7),
      key(465, { knot: 3 }),
      key(520, 1, 0),
    ],
  } satisfies CameraPath,
  out: {
    points: [
      [0.9, -0.5, 1.04], // P4c — crept pose (= P4 + lookDir·0.16)
      [0.9, -0.5, 1.62], // P5 — membrane
      [0.7, -0.38, 8],
      [0.3, -0.2, 34], // P7 — universe
      [0, 0, 18], // P8 — park (today's ch5 backdrop)
    ],
    look: [
      [0.9, -0.5, 0.2],
      [0.9, -0.5, 0.2],
      [0.5, -0.3, -1],
      [0, 0, -2],
      [0, 0, -2],
    ],
    profile: [
      key(1568, 0, 0),
      key(1605, { knot: 1 }),
      key(1650, { knot: 2 }),
      key(1782, { knot: 3 }),
      key(1798, { knot: 3 }),
      key(1900, 1, 0),
    ],
  } satisfies CameraPath,
  /** Creep applies at the IN end (P4 + lookDir · creep) over this span. */
  creepSpan: [P(520), P(1568)] as const,
  /** pos += hero(t)·hA + uni(t)·uA (× motionScalar); amplitudes in SCORE. */
  breath: {
    hero: { ax: 0.34, fx: 0.12, ay: 0.25, fy: 0.1 }, // (sin(.12t)·.34, cos(.10t)·.25)
    uni: { ax: 0.5, fx: 0.08, ay: 0.35, fy: 0.07 }, // (sin(.08t)·.5, cos(.07t)·.35)
  },
  /** FOV throb = beat·.18, only while vh < throbMaxVh and no label visible. */
  throb: { amp: 0.18, maxVh: P(3) },
} as const;

/* ── field score (§7.3) ─────────────────────────────────────── */

export type Interp = "linear" | "smooth" | "log" | "sine" | "step";

/** Piecewise ramp: before the first key = first value, after the last = last value.
 *  A repeated vh is a step (the later key wins at that vh). */
export interface RampDef {
  kind: "ramp";
  interp: Interp;
  keys: ReadonlyArray<readonly [number, number]>;
}
/** 1 inside [from, to), else 0. */
export interface WindowDef {
  kind: "window";
  from: number;
  to: number;
}
/** amp · exp(−((vh − center)/width)²). */
export interface GaussDef {
  kind: "gauss";
  center: number;
  width: number;
  amp: number;
}
export type ChannelDef = RampDef | WindowDef | GaussDef;

const ramp = (interp: Interp, keys: ReadonlyArray<readonly [number, number]>): RampDef => ({
  kind: "ramp",
  interp,
  keys: keys.map(([v, x]) => [P(v), x] as const),
});
const win = (from: number, to: number): WindowDef => ({ kind: "window", from: P(from), to: P(to) });
const gauss = (center: number, width: number, amp: number): GaussDef => ({
  kind: "gauss",
  center: P(center),
  width: P(width),
  amp,
});

/** Rack focus: up over [R−16, R−8], hold, down over [R+8, R+16] for R2–R6. */
const FOCUS_KEYS: Array<readonly [number, number]> = [];
for (const at of [665, 880, 1160, 1400, 1560]) {
  FOCUS_KEYS.push([at - 16, 0], [at - 8, 1], [at + 8, 1], [at + 16, 0]);
}

const SWEEP_KEYS: ReadonlyArray<readonly [number, number]> = [
  [260, 1], [350, 0], [1700, 0], [1740, 1], [1850, 1], [1900, 0],
];

export const SCORE = {
  /** Company sphere radius (world), log interpolation. Reaches .42 at 352
   *  (not 360): the R1 plateau 352–368 is zero-change (§4.4). */
  sphereR: ramp("log", [[0, 0.06], [352, 0.42], [1820, 0.42], [1880, 0.06]]),
  /** Sphere hidden at ≥ 1885. */
  sphereVisible: win(-1e6, 1885),
  /** uDive — imposter shading. */
  dive: ramp("smooth", [[0, 0], [300, 1], [440, 1], [520, 0]]),
  /** uSoft — bokeh. */
  soft: ramp("smooth", [[400, 0], [520, 1], [1600, 1], [1650, 0]]),
  /** uOpacity of the base points. */
  fieldOp: ramp("linear", [[240, 1], [350, 0.6], [368, 0.6], [465, 0.5], [1600, 0.5], [1650, 1]]),
  /** Rack focus at reading rests R2–R6. */
  focus: ramp("linear", FOCUS_KEYS),
  sweepGain: ramp("linear", SWEEP_KEYS),
  /** = sweepGain, except from 1850 on it holds 1 under PLANS_BACKDROP_PARITY. */
  chargeGain: ramp(
    "linear",
    FLAGS.PLANS_BACKDROP_PARITY ? [[260, 1], [350, 0], [1700, 0], [1740, 1]] : SWEEP_KEYS,
  ),
  /** Ring draw fractions: J2 undraw (outer first), C4b redraw (inner first), C4d undraw. */
  ring0: ramp("linear", [[320, 1], [350, 0], [1660, 0], [1684, 1], [1824, 1], [1848, 0]]),
  ring1: ramp("linear", [[310, 1], [340, 0], [1672, 0], [1696, 1], [1816, 1], [1840, 0]]),
  ring2: ramp("linear", [[295, 1], [325, 0], [1684, 0], [1708, 1], [1808, 1], [1832, 0]]),
  ring3: ramp("linear", [[280, 1], [310, 0], [1696, 0], [1720, 1], [1800, 1], [1824, 0]]),
  /** Dial ticks draw fraction. */
  ticks: ramp("linear", [[280, 1], [320, 0], [1690, 0], [1740, 1], [1800, 1], [1840, 0]]),
  /** Crosshair draw fraction (stays 0: park parity). */
  cross: ramp("linear", [[300, 1], [330, 0]]),
  /** Radial speed-stretch gate (desktop, tier ≤ 1). */
  warp: win(400, 480),
  /** Interior edge glow (QA D3: shorter — gone by 495, not 520). */
  rimIn: ramp("linear", [[465, 1], [495, 0]]),
  /** Interior embers (off at ≥ 765). QA D3: up over 465–480 (was 470–500),
   *  so the interior moves from the moment of contact. */
  embers: ramp("linear", [[465, 0], [480, 1], [765, 1], [765, 0]]),
  /** J5 dawn; frontR(px) = dawn × 0.56 × hypot(W, H) (geometry.dawnFrontPx). */
  dawn: ramp("linear", [[680, 0], [765, 1]]),
  /** Lit exterior from 1600 (invisible from inside). */
  lit: ramp("step", [[1600, 0], [1600, 1]]),
  /** Camera creep along the look direction (world units). */
  creep: ramp("linear", [
    [480, 0], [657, 0.04], [770, 0.04], [872, 0.1], [888, 0.1],
    // integration: held inside the R4 / R5 plateaus (§4.4 zero-change rests);
    // the same .10 → .16 total over the moving stretches only
    [1152, 0.125063], [1168, 0.125063], [1392, 0.146329], [1408, 0.146329], [1552, 0.16],
  ]),
  fovThud: gauss(465, 18, -4),
  fovWiden: gauss(1605, 18, 5),
  fovUniverse: ramp("sine", [[1650, 0], [1755, 4], [1798, 4], [1890, 0]]),
  /** Dust wavefront 0..1 (radius = dust · 30 around SP). */
  dust: ramp("linear", [[1665, 0], [1755, 1]]),
  dustGain: ramp(
    "linear",
    FLAGS.KEEP_DUST_IN_PLANS ? [[1665, 0], [1665, 1]] : [[1665, 0], [1665, 1], [1840, 1], [1890, 0]],
  ),
  /** Cursor labels gate (radar mode only). */
  labelsGate: ramp("linear", [[260, 1], [300, 0]]),
  /** C4c redacted sweep-flash label mode. */
  sweepFlash: win(1720, 1800),
  /** Breath amplitudes (× motionScalar). */
  breathHero: ramp("linear", [[0, 1], [352, 0.243], [368, 0.243], [465, 0]]),
  breathUni: ramp("linear", [[1605, 0], [1650, 0.4], [1798, 0.4], [1900, 1]]),
} as const satisfies Record<string, ChannelDef>;

export type ScoreChannel = keyof typeof SCORE;

/* ── no-WebGL fallback anchor radius (§9.3), px; "full" = half-diagonal ─ */
export const R_FALLBACK = {
  /** [vh, px] with -1 meaning "full screen". */
  keys: [
    [P(0), 4],
    // held through the R1 plateau (zero-change rest)
    [P(352), 100],
    [P(368), 100],
    [P(465), -1],
    [P(1607), -1],
    // C4a: perspective-like fall-off r ≈ 84·35 / (vh − 1605) (integration;
    // was linear full → 84, which made the fallback collapse snap late)
    [P(1610), 588],
    [P(1615), 294],
    [P(1620), 196],
    [P(1625), 147],
    [P(1630), 118],
    [P(1635), 98],
    [P(1640), 84],
    [P(1782), 14],
  ] as ReadonlyArray<readonly [number, number]>,
  /** DOM dome coverage 0 → 1 over 420–465. */
  domeIn: [P(420), P(465)] as const,
};
