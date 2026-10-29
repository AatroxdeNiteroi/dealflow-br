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

   v3 "Sonar Líquido" (spec rev 3.1, WP0): every v3 table lives here too,
   with its final values. New channels are added to SCORE directly (no
   consumer yet: inert). Changed v2 keys are published under new names
   (`sweepGain_v3`, `ring0_v3..ring3_v3`, `ticks_v3`, `cross_v3`,
   STATIONS_V3, MARKS.snapV3, RIPPLES_V3, TEXT_V3), so no v2 frame
   changes until the owning WP switches its consumer; the integrator
   deletes the unused v2 entries at release (§10.2). Tables stay in
   master vh (§0.2); scroll-space (s-vh) lives in cinema/dilation.ts.

   Retunes requested by WP-QA come back to this file (owner WP0, then
   the integrator after the WP0 merge).
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

/** v3 (§2.1, decided default 8): Estimativa / Universo change when the previous
 *  chapter's close has fully evaporated, with the eyebrow reel (reel1 1194–1208,
 *  reel2 1592–1606): the rail, eyebrow and aria-live never name the next chapter
 *  while the previous close is on screen. Inert until WP8 (rail, aria-live) and
 *  WP7 (eyebrow reel) switch their consumers. */
export const STATIONS_V3: readonly Station[] = [
  { id: "radar", name: "Radar", at: P(0) },
  { id: "convergencia", name: "Convergência", at: P(880) },
  { id: "estimativa", name: "Estimativa", at: P(1198) },
  { id: "universo", name: "Universo", at: P(1602) },
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

/* ── ink ripples (§7.8; v3 §4.8) ────────────────────────────── */

/** v3 ripple registrations (§4.8, WP3's ripplesDriver): `{ vh, at, amp, inward }`.
 *  `at` = where the centre is evaluated each frame ("anchor" = the GL anchor,
 *  "centre" = the viewport centre). `amp` defaults to RIPPLES.amp; `inward`
 *  runs the radius backwards ((1 − d)·R); `radiusPx` / `window` override
 *  RIPPLES.radiusPx / RIPPLES.window. Inert until WP3 registers from it
 *  (v2 registers lock / membrane / ringLock from RIPPLES.at). */
export interface RippleSpec {
  id: string;
  vh: number;
  at: "anchor" | "centre";
  amp?: number;
  inward?: boolean;
  radiusPx?: number;
  window?: number;
}
export const RIPPLES_V3: readonly RippleSpec[] = [
  /** J2 implosion: one inward ink ripple (420 px → 0) at the anchor, 330 → 345 */
  { id: "implode", vh: P(330), at: "anchor", inward: true, radiusPx: 420, window: P(15) },
  /** the `lock` act: amp 0.30 (≈ 10 px push) */
  { id: "lock", vh: P(345), at: "anchor", amp: 0.3 },
  { id: "membrane", vh: P(1605), at: "centre" },
  { id: "ringLock", vh: P(1645), at: "anchor" },
];

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
  /** v3 snap (§2.1, §6.4; WP1 switches snap.ts to it). aheadS / anyS are s-vh measured
   *  from s(landVh) to the NEAR EDGE of the candidate's plateau (so dilated rests
   *  snap too); idle 420 ms after the last wheel event; no snap while the mean wheel
   *  input over the last 1 s is ≥ maxRateNotchesPerS (100 px per notch after
   *  normalising deltaMode). maxVh stays master vh. */
  snapV3: { aheadS: 24, anyS: 6, maxVh: P(1800), idleMs: 420, maxRateNotchesPerS: 2.0 },
  /** §3.9 dock button at R7+: masterEnd + 0.30 × ch5 scroll length. */
  dockCh5Fraction: 0.3,
} as const;

/* ── shared windows (v3 §2.1) ───────────────────────────────────
   Every window read by more than one package lives here and is imported
   on both sides (master vh). `ease` names the cinema/eases.ts curve both
   sides must use. */

export const SHARED_WINDOWS = {
  /** dossier card grow AND the RIG card-mode ride (was RIG 1186–1226 sineInOut) */
  cardGrow: { from: P(1202), to: P(1236), ease: "cx-flow" },
  tarjaGrow: { from: P(1204), to: P(1236), ease: "cx-flow" },
  /** C2b orbit starts from the comets' state at 1105 */
  chipsOrbitFrom: P(1105),
  /** the orbit holds still on the R4 plateau */
  chipsOrbitPause: { from: P(1152), to: P(1168) },
  /** orbiters land 1172–1194 while the C2 close is held (no landing path may
   *  cross the close panel's rect: WP7 assert) */
  chipsLandStart: P(1172),
  /** `.is-swarm` toggles off after the close and its panel are gone */
  swarm: { from: P(895), to: P(1202) },
  /** C4c disc pulse */
  pulse: { from: P(1768), to: P(1780) },
  /** the RIG leader linking "uma delas" to the disc */
  leaderDraw: { from: P(1762), to: P(1774) },
  /** … stays until the Ch4 close's break (was 1798–1808) */
  leaderRetract: { from: P(1848), to: P(1858) },
  /** the reticle opens after the close is read (was 1800–1830) and is gone before layersOff */
  release: { from: P(1848), to: P(1878) },
  releaseFade: { from: P(1856), to: P(1878) },
} as const;

/* ── text windows (v3 §2.3; WP7 / WP6 adopt them) ───────────────
   Final master-vh windows of every scrubbed text block and panel that
   v3 moves. `kind` drives the pour-before-plateau assert (§2.3, dev):
   "pour" = text arriving (INK / LIGHT / reel), "exit" = text leaving
   (EVAPORATE), "panel" / "move" = boxes and plates (not text). Windows
   v3 keeps (desc, label, eyebrow, caption, reels, collapse …) are listed
   with their unchanged values so the table is complete. */

export type TextWindowKind = "pour" | "exit" | "panel" | "move";
export interface TextWindow {
  from: number;
  to: number;
  kind: TextWindowKind;
  /** cinema/eases.ts curve or glyph grammar the owner must use */
  how: string;
}
const tw = (from: number, to: number, kind: TextWindowKind, how: string): TextWindow => ({
  from: P(from),
  to: P(to),
  kind,
  how,
});

export const TEXT_V3 = {
  /** `dossier/dossier.timeline.ts` T (WP7), old → new */
  dossier: {
    desc: tw(840, 862, "pour", "INK"),
    label: tw(852, 866, "pour", "INK"),
    eyebrowIn: tw(852, 862, "panel", "cx-pour"),
    reelIn: tw(854, 866, "pour", "cx-flow reel, feathered"),
    caption: tw(856, 870, "pour", "INK"),
    revIn: tw(1086, 1100, "pour", "INK (Playfair italic)"),
    c2In: tw(1106, 1116, "panel", "condense: opacity + scale .97 → 1, cx-flow"),
    c2Lead: tw(1110, 1134, "pour", "INK"),
    c2Sub: tw(1126, 1150, "pour", "INK"),
    c2Evap: tw(1186, 1198, "exit", "EVAPORATE"),
    c2PanelOut: tw(1192, 1200, "panel", "cx-evap"),
    captionOut: tw(1188, 1200, "exit", "EVAPORATE + hairlines scaleX → 0 (cx-flow)"),
    revOut: tw(1186, 1196, "exit", "EVAPORATE"),
    haloOut: tw(1190, 1200, "panel", "cx-evap"),
    reel1: tw(1194, 1208, "pour", "cx-flow reel, feathered"),
    cardGrow: tw(1202, 1236, "move", "cx-flow (SHARED_WINDOWS.cardGrow)"),
    tarjaGrow: tw(1204, 1236, "move", "cx-flow (SHARED_WINDOWS.tarjaGrow)"),
    est: tw(1216, 1232, "pour", "INK"),
    converge: tw(1236, 1262, "move", "chips.ts DIAL.converge"),
    lineBorn: tw(1254, 1270, "move", "as v2"),
    sweep: tw(1272, 1382, "move", "linear (instrument), capsule wipe"),
    focus: tw(1290, 1385, "move", "cx-flow, feathered mask tracking --scan-x"),
    endsWords: tw(1442, 1466, "pour", "INK"),
    c3In: tw(1492, 1500, "panel", "condense in place, cx-flow"),
    c3Lead: tw(1494, 1522, "pour", "INK"),
    c3Sub: tw(1514, 1540, "pour", "INK"),
    c3Evap: tw(1590, 1602, "exit", "EVAPORATE"),
    c3PanelOut: tw(1594, 1602, "panel", "cx-evap"),
    reel2: tw(1592, 1606, "pour", "cx-flow reel, feathered"),
    dimSeal: tw(1588, 1596, "move", "cx-flow"),
    dimRange: tw(1590, 1598, "move", "cx-flow"),
    dimLabel: tw(1594, 1601, "move", "cx-flow"),
    dimHead: tw(1597, 1604, "move", "cx-flow"),
    collapse: tw(1605, 1640, "move", "radius cx-pour leads, box cx-flow lags"),
    pinnedOut: tw(1800, 1812, "exit", "cx-evap (pill)"),
    eyebrowOut: tw(1835, 1850, "exit", "EVAPORATE"),
  },
  /** `ch4/ch4.timeline.ts` CH4_T (WP7) */
  ch4: {
    panelIn: tw(1652, 1668, "panel", "condense, cx-flow, opaque paper r 18"),
    label: tw(1660, 1676, "pour", "INK"),
    closeIn: tw(1758, 1766, "panel", "condense"),
    lead: tw(1762, 1776, "pour", "INK"),
    sub: tw(1770, 1782, "pour", "INK"),
    closeOut: tw(1848, 1862, "exit", "EVAPORATE"),
    panelOut: tw(1850, 1866, "panel", "cx-evap"),
  },
  /** odometer reels unchanged: reel k rolls over [from + k·step, from + k·step + len] */
  ch4Reels: { from: P(1680), step: P(8), len: P(36) },
  /** stage off while its content is at 0 (< layersOff 1880) */
  ch4StageOff: P(1868),
  /** `ch1/hud.ts` (WP6): HUD exit (was linear 30–70) */
  hudExit: tw(30, 62, "exit", "EVAPORATE"),
  /** `ch1/respiro.ts` (WP6): the J6 ink twin's glyphs evaporate (dolly unchanged) */
  inkTwinEvap: tw(778, 800, "exit", "EVAPORATE"),
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
  /** v3: multiplies the resolved slope (default 1). The seek path eases out of
   *  R0 with half the secant, so the first notch moves (§6.3). */
  slopeScale?: number;
}

export interface CameraPath {
  /** Centripetal Catmull–Rom knots, sampled by arc length. */
  points: readonly Vec3[];
  /** Look-at knots, sampled at the same knot coordinate (§7.2). */
  look: readonly Vec3[];
  /** Fritsch–Carlson monotone cubic vh → a. */
  profile: readonly ProfileKey[];
}

const key = (vh: number, a: ArcRef, slope?: number | "secant", slopeScale?: number): ProfileKey =>
  slopeScale === undefined ? { vh: P(vh), a, slope } : { vh: P(vh), a, slope, slopeScale };

/** v3 (§6.3): `CAMERA.in` sampled at vh 352 (the R1 pose), full precision, so the
 *  seek path joins J3 at zero velocity on exactly the same pose (computed with
 *  three/camera.ts SplinePath; unit test in scratchpad/work/v3qa/wp0). */
export const R1_POSE: Vec3 = [0.7257765379761277, -0.40815894203736214, 5.645718940278542];
export const R1_LOOK: Vec3 = [0.8114041276578702, -0.45222712611242905, 1.1176112069515023];

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
  /** v3 J1–J2 SEEK path (§6.3, WP4 samples it): used for vh < seekTo; from 352 on the
   *  v2 IN path (byte-identical J3). The profile ends with slope 0 at 352, as IN does
   *  there, so the join is C¹ at zero velocity. Portrait: WP4 scales the lateral
   *  offsets of knots 1–3 ×0.55 (second SplinePath built at refresh, aspect < 1). */
  seekTo: P(352),
  seek: {
    points: [[0, 0, 16], [-1.2, 0.78, 13.0], [-0.55, 1.05, 10.0], [0.5, 0.15, 7.3], R1_POSE],
    look: [[0, 0, 0], [-0.15, 0.1, -0.4], [0.35, -0.18, 0.2], [0.8, -0.45, 0.95], R1_LOOK],
    profile: [
      key(0, 0, "secant", 0.5),
      key(100, { knot: 1 }),
      key(190, { knot: 2 }),
      key(285, { knot: 3 }),
      key(352, 1, 0),
    ],
  } satisfies CameraPath,
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

  /* ── v3 channels (§4.2) — no consumer until WP2/WP3/WP4 read them ──
     Three rules, asserted in dev (cinema/dev/checks.ts): neutral at park
     (vh ≥ 1890: glowTau 1.6, ringFade 1, every other new channel 0), flat
     plateaus (R1–R7), and the J2 transit channels reset over 398–400. */
  /** gate of every J1–J2 point / dust / beam-veil / sphere-skin term */
  sonar: ramp("smooth", [[0, 1], [368, 1], [400, 0]]),
  /** Ch4 reuse: afterglow + pings only */
  sonarC4: ramp("smooth", [[1690, 0], [1730, 1], [1830, 1], [1885, 0]]),
  /** point afterglow τ (rad); veil τ = 0.34·glowTau ≤ 0.544 */
  glowTau: ramp("smooth", [[0, 1.6], [226, 1.6], [300, 0.5], [336, 0.12], [400, 0.12], [401, 1.6]]),
  /** hunt progress u; searchlight blend smoothstep(0.2, 0.6, seek); rim hold */
  seek: ramp("linear", [[226, 0], [336, 1], [398, 1], [400, 0]]),
  /** line end and width */
  needle: ramp("smooth", [[296, 0], [336, 1], [398, 1], [400, 0]]),
  /** liquid capture */
  capture: ramp("smooth", [[286, 0], [350, 1], [368, 1], [398, 0]]),
  /** screen-space lensing behind SP */
  lens: ramp("smooth", [[120, 0], [220, 1], [368, 1], [398, 0]]),
  /** focus target mid-field → SP */
  focusSP: ramp("smooth", [[200, 0], [300, 1], [368, 1], [398, 0]]),
  /** CoC scale */
  dof: ramp("smooth", [
    [0, 0.35], [220, 0.45], [300, 1], [368, 1], [398, 0],
    [1690, 0], [1740, 0.4], [1830, 0.4], [1885, 0],
  ]),
  /** current amplitude (world) */
  flowAmp: ramp("smooth", [
    [0, 0.09], [300, 0.07], [352, 0.05], [368, 0.05], [398, 0],
    [1690, 0], [1740, 0.06], [1830, 0.06], [1885, 0],
  ]),
  /** echo wavefronts and echo chips */
  echoGate: ramp("linear", [[0, 1], [296, 1], [320, 0]]),
  /** decoy flares (GL, pure f(vh)); the DOM chips are time-based once the peak is crossed */
  decoy0: gauss(238, 7, 1),
  decoy1: gauss(262, 7, 1),
  decoy2: gauss(286, 7, 1),
  /** hidden universe (J1 dust prefix) */
  dustSonar: ramp("smooth", [[0, 1], [280, 1], [330, 0]]),
  /** ring drain, outer first; each resets over 398–400 (rings undrawn, beam off) */
  ringTravel3: ramp("smooth", [[262, 0], [318, 1], [398, 1], [400, 0]]),
  ringTravel2: ramp("smooth", [[272, 0], [326, 1], [398, 1], [400, 0]]),
  ringTravel1: ramp("smooth", [[282, 0], [334, 1], [398, 1], [400, 0]]),
  ringTravel0: ramp("smooth", [[292, 0], [340, 1], [398, 1], [400, 0]]),
  /** rings 1–3 → ring0 radius */
  ringMerge: ramp("smooth", [[326, 0], [342, 1], [398, 1], [400, 0]]),
  /** J2 GL → DOM hand-off (back to 1 while draw = 0) */
  ringFade: ramp("linear", [[340, 1], [348, 0], [398, 0], [400, 1]]),
  /** camera roll (deg); 0 at every rest plateau */
  roll: ramp("sine", [
    [0, 0], [110, -2.2], [230, 1.2], [320, 2.4], [346, 0], [352, 0],
    [1650, 0], [1716, -1.6], [1782, 0],
  ]),
  /** FOV (deg): narrows while hunting, releases to 46° over 346–352 */
  fovSeek: ramp("sine", [[226, 0], [300, -2], [336, -3.2], [346, -3.2], [352, 0]]),
  /** gate: position lean, bank, fovKick */
  camLean: ramp("smooth", [[0, 1], [336, 1], [352, 0], [1700, 0], [1740, 1], [1830, 1], [1885, 0]]),
  /** gate: lookAhead, breathCard, parallax */
  camLook: ramp("smooth", [
    [0, 1], [336, 1], [352, 0], [1112, 0], [1140, 1], [1536, 1], [1552, 0],
    [1700, 0], [1740, 1], [1830, 1], [1885, 0],
  ]),
  /** cursor parallax gain (J4 = 0; INTERIOR_PARALLAX off) */
  parallax: ramp("smooth", [
    [0, 1], [336, 1], [352, 0], [1112, 0], [1140, 0.4], [1536, 0.4], [1552, 0],
    [1700, 0], [1740, 0.6], [1830, 0.6], [1885, 0],
  ]),
  /** Ch2–Ch3 time-based look sway (sin on both axes: exactly 0 at t = 0) */
  breathCard: ramp("linear", [[1112, 0], [1140, 1], [1536, 1], [1552, 0]]),
  /** Ch2–Ch3 pure-f(vh) look drift (§6.1 L6) */
  driftCard: ramp("smooth", [[1112, 0], [1140, 1], [1536, 1], [1552, 0]]),

  /* ── changed v2 keys, published under new names (§4.2): the owning WP switches
     its consumer (WP2); the integrator deletes the v2 entry at release ── */
  /** beam visible until the lock (was [260,1] [350,0]); the C4 part equals v2's */
  sweepGain_v3: ramp("linear", [[344, 1], [352, 0], [1700, 0], [1740, 1], [1850, 1], [1900, 0]]),
  /** J2 hiding is done by ringFade; C4 keys unchanged */
  ring0_v3: ramp("linear", [[352, 1], [352, 0], [1660, 0], [1684, 1], [1824, 1], [1848, 0]]),
  ring1_v3: ramp("linear", [[352, 1], [352, 0], [1672, 0], [1696, 1], [1816, 1], [1840, 0]]),
  ring2_v3: ramp("linear", [[352, 1], [352, 0], [1684, 0], [1708, 1], [1808, 1], [1832, 0]]),
  ring3_v3: ramp("linear", [[352, 1], [352, 0], [1696, 0], [1720, 1], [1800, 1], [1824, 0]]),
  ticks_v3: ramp("linear", [[256, 1], [296, 0], [1690, 0], [1740, 1], [1800, 1], [1840, 0]]),
  cross_v3: ramp("linear", [[256, 1], [290, 0]]),
} as const satisfies Record<string, ChannelDef>;

/** v3 channels that are NEW (rule 1 "neutral at park" applies; §4.2). */
export const SCORE_V3_NEW = [
  "sonar", "sonarC4", "glowTau", "seek", "needle", "capture", "lens", "focusSP", "dof",
  "flowAmp", "echoGate", "decoy0", "decoy1", "decoy2", "dustSonar",
  "ringTravel3", "ringTravel2", "ringTravel1", "ringTravel0", "ringMerge", "ringFade",
  "roll", "fovSeek", "camLean", "camLook", "parallax", "breathCard", "driftCard",
] as const satisfies readonly ScoreChannel[];

/** Changed v2 channels → their v3 replacement (equal to the v2 channel at park). */
export const SCORE_V3_OF = {
  sweepGain: "sweepGain_v3",
  ring0: "ring0_v3",
  ring1: "ring1_v3",
  ring2: "ring2_v3",
  ring3: "ring3_v3",
  ticks: "ticks_v3",
  cross: "cross_v3",
} as const satisfies Partial<Record<ScoreChannel, ScoreChannel>>;

/** Neutral values (§4.2 rule 1): what every new channel equals from vh 1890 on. */
export const SCORE_NEUTRAL: Readonly<Partial<Record<ScoreChannel, number>>> = {
  glowTau: 1.6,
  ringFade: 1,
};
export const neutralOf = (c: ScoreChannel): number => SCORE_NEUTRAL[c] ?? 0;

/** §4.2 rule 3: J2 transit channels and the vh range over which they reset. */
export const J2_RESET = {
  from: P(398),
  to: P(400),
  toZero: ["seek", "needle", "ringTravel3", "ringTravel2", "ringTravel1", "ringTravel0", "ringMerge"],
  toOne: ["ringFade"],
} as const;

/** vh from which every new channel must equal its neutral value (§4.2 rule 1). */
export const PARK_NEUTRAL_FROM = P(1890);

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
