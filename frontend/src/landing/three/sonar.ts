/* ============================================================
   three/sonar.ts — sonar CPU work (spec rev 3.1 §4.4, §4.9). WP3.

   Build time (pickSonarSources, deterministic: fixed seed grid + the
   beats.ts tables):
   - 12 ECHO SOURCES, one per 30° sector: big ≥ 0.82, 1.5 < |xy| < 9,
     z ∈ [−3.5, 1.5]; within a sector the biggest bead wins (a mild
     penalty past |xy| 5 keeps them on screen), never on top of the
     target (xy within 1.2 world of SP's hub-plane projection). Each has
     a weight w ∈ [0.55, 1] (from its size): crest amplitude and the
     chip's `strength` (the value shows only above
     LABEL_VALUE_MIN_STRENGTH, so some chips show their value and others
     the redacted run).
   - 3 DECOYS (flares at 238 / 262 / 286): large beads 2–6 world from SP
     whose bearing is within ±0.6 rad of β_SP, chosen where the hunting
     beam actually is at each flare (θ ≈ β_SP + huntOffset(u)), and on
     screen + ≥ 150 px from the target (+ apart from each other) at the
     nominal J2 pose (CAMERA.seek knots), so their DOM chips are legal
     at 1440×900 and, where possible, at 390×844.
   Per frame (SonarEchoes):
   - crests: b_i = mod(θ − φ_i, 2π) (φ_i = the beam-plane bearing of the
     flowed source through the camera, hubBearing(), + lag),
     r_i = 2.6·b_i, A_i = exp(−b_i/1.1)·w_i; the N youngest (smallest b)
     with A > 0.02 are uploaded (N = tier echoes, §4.9), each centred on
     the source's FLOWED position (the TS flow mirror), so the crest and
     the chip leader sit on the bead the GPU draws;
   - marks (frameData.echoes): an echo mark is born when the lead passes
     a source going forward (age = seconds since), a decoy mark when the
     playhead crosses its flare peak going forward; they expire after
     their hold, on a jump, or (decoys) 4 vh back past the peak.
   Dev counters (§11): crestsLive (+ the distinct sources seen),
   pingsPerTurn (visible beads the lead crossed over the last full turn)
   and capInside (beads inside 0.95 R_m, capture mirror).
   ============================================================ */

import * as THREE from "three";
import { CAMERA, SP, SPHERE_R } from "../cinema/beats";
import type { EchoMark } from "../cinema/types";
import { flowOffsetPh, type FlowOut } from "./flow";
import type { BaseField } from "./field/frame";

const TAU = Math.PI * 2;
const wrapPi = (a: number): number => {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
};
const modTau = (a: number): number => {
  const r = a % TAU;
  return r < 0 ? r + TAU : r;
};

/** Echo constants (§4.4 / §4.9). */
export const ECHO = {
  sources: 12,
  /** crest radius per radian behind the lead (world) */
  radiusPerRad: 2.6,
  /** amplitude decay (rad) */
  decay: 1.1,
  /** uploaded only above this amplitude */
  minA: 0.02,
  /** upload slots (uEcho[6]) */
  slots: 6,
  /** an echo mark lives this long after its ping (s): chip hold ≤ 3 s + 160 ms evaporation */
  markLife: 3.2,
} as const;

/** Decoy flares (beats.SCORE decoy0..2 = gauss(peak, 7, 1)). */
export const DECOY = {
  peaks: [238, 262, 286] as const,
  /** a decoy mark lives this long after its peak crossing (s): bloom .24 + hold 1.8 + evaporate .16 */
  markLife: 2.4,
  /** scrolling back this far past the peak evaporates the chip at once (vh) */
  backOff: 4,
  /** the beads grey to ink α 0.35 over this span after the peak (vh) */
  rejectSpan: 9,
} as const;

/** The meniscus radius R_m (1.5 sphere radii, §4.4 capture). */
export const R_M = 1.5 * SPHERE_R;

/* ── the hunt (closed form; mirrors field/beamClock.ts huntOffset, kept local so the
      picks never depend on another driver's module) ── */
const huntOffset = (u: number): number => 0.9 * (1 - u) * (1 - u) * Math.exp(-2.4 * u) * Math.cos(2.6 * Math.PI * u);
const huntU = (vh: number): number => Math.min(1, Math.max(0, (vh - 226) / 110));

/**
 * A point's bearing / radius on the beam plane z = −1 along the ray from a camera position: where
 * the point sits on screen relative to the hub, i.e. the angle at which the drawn lead line covers
 * it (§4.3 does this for SP; the sonar path does it for every bead, so rings and afterglow line up
 * with the hairline at any camera pose). Exact mirror of the GLSL `hubBearing`.
 */
export function hubBearing(px: number, py: number, pz: number, cx: number, cy: number, cz: number, out: { beta: number; rho: number }): { beta: number; rho: number } {
  const dz = pz - cz;
  if (dz > -1e-3) {
    // at / behind the camera's depth (never drawn): the plain bearing
    out.beta = Math.atan2(py, px);
    out.rho = Math.hypot(px, py);
    return out;
  }
  const t = (-1 - cz) / dz;
  const x = cx + (px - cx) * t;
  const y = cy + (py - cy) * t;
  out.beta = Math.atan2(y, x);
  out.rho = Math.hypot(x, y);
  return out;
}

/** SP's bearing / radius on the z = −1 plane along the ray from a camera position (§4.3). */
export function spBearing(cx: number, cy: number, cz: number, out: { beta: number; rho: number }): { beta: number; rho: number } {
  return hubBearing(SP[0], SP[1], SP[2], cx, cy, cz, out);
}

/* ── nominal seek pose (piecewise-linear through the CAMERA.seek knots at their profile vh):
      used ONLY to choose decoys that are on screen at their flare; the real pose is WP4's ── */
const SEEK_KNOT_VH = [0, 100, 190, 285, 352];
function nominalSeekPose(vh: number, P: THREE.Vector3, L: THREE.Vector3): void {
  const pts = CAMERA.seek.points;
  const look = CAMERA.seek.look;
  let k = 0;
  while (k < SEEK_KNOT_VH.length - 2 && vh > SEEK_KNOT_VH[k + 1]) k++;
  const t = Math.min(1, Math.max(0, (vh - SEEK_KNOT_VH[k]) / (SEEK_KNOT_VH[k + 1] - SEEK_KNOT_VH[k])));
  P.set(
    pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t,
    pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t,
    pts[k][2] + (pts[k + 1][2] - pts[k][2]) * t,
  );
  L.set(
    look[k][0] + (look[k + 1][0] - look[k][0]) * t,
    look[k][1] + (look[k + 1][1] - look[k][1]) * t,
    look[k][2] + (look[k + 1][2] - look[k][2]) * t,
  );
}

export interface SonarPicks {
  /** 12 echo source point indices (one per 30° sector), −1 where a sector has none */
  echoes: Int32Array;
  /** echo source weights w_i ∈ [0.55, 1] (0 where empty) */
  weights: Float32Array;
  /** 3 decoy point indices (−1 if none qualified) */
  decoys: Int32Array;
}

export interface SonarCounters {
  /** crests with A > 0.02 this frame: their source ids */
  crestsLive: number[];
  /** distinct source ids that have had a live crest since the last reset (§11 item 21) */
  crestSources: number[];
  /** visible beads the lead crossed during the last full beam turn (§11 item 45 b) */
  pingsPerTurn: number;
  /** pings counted so far in the current turn, and the angle swept (rad) */
  pingsThisTurn: number;
  turnSwept: number;
  /** beads inside 0.95 R_m during the capture (§11 item 25) */
  capInside: number;
  /** max |capInside| seen while capture > 0 since the last reset */
  capInsideMax: number;
  /** beads packed into the meniscus band (lateral distance < 1.6 R_m) this frame */
  capBand: number;
}

const bigOf = (size: number): number => Math.sqrt(Math.max(0, (size - 1.05) / 2.25));

/** Build-time picks: 12 echo sources + 3 decoys (deterministic). */
export function pickSonarSources(base: BaseField): SonarPicks {
  const n = base.count;
  const pos = base.positions;
  const echoes = new Int32Array(ECHO.sources).fill(-1);
  const weights = new Float32Array(ECHO.sources);
  const best = new Float32Array(ECHO.sources).fill(-1e9);
  // SP on the hub plane, seen from the hero pose (0, 0, 16)
  const sp0 = spBearing(0, 0, 16, { beta: 0, rho: 0 });
  const spx = Math.cos(sp0.beta) * sp0.rho;
  const spy = Math.sin(sp0.beta) * sp0.rho;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const big = bigOf(base.sizes[i]);
    const rho = Math.hypot(x, y);
    if (big < 0.82 || rho <= 1.5 || rho >= 9 || z < -3.5 || z > 1.5) continue;
    if (Math.hypot(x - spx, y - spy) < 1.2) continue;
    const sector = Math.min(ECHO.sources - 1, Math.floor(((base.angles[i] + Math.PI) / TAU) * ECHO.sources));
    const score = big - 0.04 * Math.max(0, rho - 5);
    if (score > best[sector]) {
      best[sector] = score;
      echoes[sector] = i;
      weights[sector] = 0.55 + 0.45 * Math.min(1, Math.max(0, (big - 0.82) / 0.18));
    }
  }

  /* decoys */
  const decoys = new Int32Array(3).fill(-1);
  const isSource = new Set<number>();
  echoes.forEach((i) => i >= 0 && isSource.add(i));
  const P = new THREE.Vector3();
  const L = new THREE.Vector3();
  const v = new THREE.Vector3();
  const cams = [
    { cam: new THREE.PerspectiveCamera(CAMERA.fovBase, 1440 / 900, CAMERA.near, CAMERA.far), w: 1440, h: 900, margin: 70, minSP: 150, minApart: 170 },
    { cam: new THREE.PerspectiveCamera(CAMERA.fovBase, 390 / 844, CAMERA.near, CAMERA.far), w: 390, h: 844, margin: 36, minSP: 130, minApart: 110 },
  ];
  const project = (c: (typeof cams)[number], i: number): { x: number; y: number } | null => {
    v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).project(c.cam);
    if (!(v.z > -1 && v.z < 1)) return null;
    return { x: (v.x * 0.5 + 0.5) * c.w, y: (-v.y * 0.5 + 0.5) * c.h };
  };
  const spV = new THREE.Vector3(SP[0], SP[1], SP[2]);
  const bearing = { beta: 0, rho: 0 };
  const hb = { beta: 0, rho: 0 };
  // relaxation passes: 0 = both viewports, 1 = desktop only, 2 = desktop with looser rules, 3 = bearing/distance only
  for (let k = 0; k < 3; k++) {
    const vh = DECOY.peaks[k];
    nominalSeekPose(vh, P, L);
    for (const c of cams) {
      c.cam.position.copy(P);
      c.cam.lookAt(L);
      c.cam.updateMatrixWorld();
      c.cam.updateProjectionMatrix();
    }
    spBearing(P.x, P.y, P.z, bearing);
    const beta = bearing.beta;
    const target = beta + huntOffset(huntU(vh));
    const spScreen = cams.map((c) => {
      v.copy(spV).project(c.cam);
      return { x: (v.x * 0.5 + 0.5) * c.w, y: (-v.y * 0.5 + 0.5) * c.h };
    });
    // every pass competes: a looser pass pays a bearing penalty, so a bead the hunting beam really
    // sweeps at the flare beats a perfectly framed one 0.5 rad away (decoy 0's beam position also
    // carries the latch offset δ0, unknown at build time: it only gets the nominal target)
    const PENALTY = [0, 0.18, 0.32, 0.6];
    let pick = -1;
    let bestScore = 1e9;
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < n; i++) {
        if (isSource.has(i) || decoys.includes(i)) continue;
        const size = base.sizes[i];
        if (size < 2.3) continue;
        const x = pos[i * 3];
        const y = pos[i * 3 + 1];
        const z = pos[i * 3 + 2];
        const dSP = Math.hypot(x - SP[0], y - SP[1], z - SP[2]);
        if (dSP < 2 || dSP > 6 || z < -4 || z > 1.6) continue;
        // the bearing the drawn beam covers it at, from the nominal pose (as β_SP)
        const phi0 = hubBearing(x, y, z, P.x, P.y, P.z, hb).beta;
        if (Math.abs(wrapPi(phi0 - beta)) > 0.6) continue;
        let ok = true;
        for (let ci = 0; ci < cams.length && ok && pass < 3; ci++) {
          if (pass >= 1 && ci === 1) continue; // portrait dropped from pass 1
          const c = cams[ci];
          const s = project(c, i);
          const loose = pass >= 2 ? 0.8 : 1;
          if (!s || s.x < c.margin || s.y < c.margin || s.x > c.w - c.margin || s.y > c.h - c.margin) ok = false;
          else if (Math.hypot(s.x - spScreen[ci].x, s.y - spScreen[ci].y) < c.minSP * loose) ok = false;
          else {
            for (let j = 0; j < k && ok; j++) {
              const o = decoys[j];
              if (o < 0) continue;
              const so = project(c, o);
              if (so && Math.hypot(s.x - so.x, s.y - so.y) < c.minApart * loose) ok = false;
            }
          }
        }
        if (!ok) continue;
        const score = Math.abs(wrapPi(phi0 - target)) - 0.05 * bigOf(size) + PENALTY[pass];
        if (score < bestScore) {
          bestScore = score;
          pick = i;
        }
      }
    }
    decoys[k] = pick;
  }
  return { echoes, weights, decoys };
}

/** Dev counters, zeroed. */
export function createSonarCounters(): SonarCounters {
  return { crestsLive: [], crestSources: [], pingsPerTurn: 0, pingsThisTurn: 0, turnSwept: 0, capInside: 0, capInsideMax: 0, capBand: 0 };
}

/* ── per frame: crests and marks ───────────────────────────── */

export interface CrestUpload {
  /** uEcho[6]: xyz centre (flowed source) + w radius */
  centres: THREE.Vector4[];
  /** uEchoA[6] */
  amps: Float32Array;
}

/** Projects a world point to CSS px; returns false when behind / outside the clip volume. */
export type Projector = (x: number, y: number, z: number, out: { x: number; y: number }) => boolean;

export class SonarEchoes {
  readonly picks: SonarPicks;
  readonly counters = createSonarCounters();
  private readonly n: number;
  private readonly sx: Float32Array;
  private readonly sy: Float32Array;
  private readonly sz: Float32Array;
  private readonly hb = { beta: 0, rho: 0 };
  private readonly b = new Float32Array(ECHO.sources);
  private readonly prevB = new Float32Array(ECHO.sources).fill(-1);
  private readonly bornAt = new Float64Array(ECHO.sources).fill(-1);
  private readonly order: number[] = [];
  private readonly seen = new Set<number>();
  private readonly fl: FlowOut = { x: 0, y: 0, z: 0 };
  /** flowed source positions this frame (xyz × 12) */
  readonly flowed = new Float32Array(ECHO.sources * 3);
  // decoys
  private readonly dx = new Float32Array(3);
  private readonly dy = new Float32Array(3);
  private readonly dz = new Float32Array(3);
  private readonly decoyBorn = new Float64Array(3).fill(-1);
  private prevVh = NaN;
  // mark pool
  private readonly pool: EchoMark[] = [];
  private readonly sp = { x: 0, y: 0 };

  constructor(base: BaseField, picks: SonarPicks) {
    this.picks = picks;
    this.n = ECHO.sources;
    this.sx = new Float32Array(this.n);
    this.sy = new Float32Array(this.n);
    this.sz = new Float32Array(this.n);
    for (let k = 0; k < this.n; k++) {
      const i = picks.echoes[k];
      if (i < 0) continue;
      this.sx[k] = base.positions[i * 3];
      this.sy[k] = base.positions[i * 3 + 1];
      this.sz[k] = base.positions[i * 3 + 2];
    }
    for (let k = 0; k < 3; k++) {
      const i = picks.decoys[k];
      if (i < 0) continue;
      this.dx[k] = base.positions[i * 3];
      this.dy[k] = base.positions[i * 3 + 1];
      this.dz[k] = base.positions[i * 3 + 2];
    }
    for (let k = 0; k < ECHO.sources + 3; k++) this.pool.push({ x: 0, y: 0, i: -1, kind: "echo", age: 0, reject: false, strength: 0 });
  }

  /**
   * Crests for this frame. `theta`/`lag`: the displayed beam angle and spoon lag; `cam` = the
   * camera position (the bearing is the one the drawn beam covers the flowed source at, exactly
   * as the shader); `slots` = tier echoes (≤ 6); `gate` = echoGate·sonar·ready (0 = nothing
   * uploaded); `slotFade[k]` fades slots that a sub-step is removing. Writes `up` and returns the
   * number of live crests.
   */
  crests(
    theta: number,
    lag: number,
    cam: { x: number; y: number; z: number },
    slots: number,
    gate: number,
    slotFade: Float32Array,
    ph: readonly [number, number, number],
    A: number,
    w3: number,
    up: CrestUpload,
  ): number {
    const order = this.order;
    order.length = 0;
    const fl = this.fl;
    const hb = this.hb;
    for (let k = 0; k < this.n; k++) {
      if (this.picks.echoes[k] < 0) {
        this.b[k] = 1e9;
        continue;
      }
      flowOffsetPh(this.sx[k], this.sy[k], ph, A, w3, fl);
      const x = this.sx[k] + fl.x;
      const y = this.sy[k] + fl.y;
      const z = this.sz[k] + fl.z;
      this.flowed[k * 3] = x;
      this.flowed[k * 3 + 1] = y;
      this.flowed[k * 3 + 2] = z;
      hubBearing(x, y, z, cam.x, cam.y, cam.z, hb);
      const rn = hb.rho / 12.8;
      this.b[k] = modTau(theta - (hb.beta + lag * rn * rn));
      order.push(k);
    }
    order.sort((a, c) => this.b[a] - this.b[c]);
    const live = this.counters.crestsLive;
    live.length = 0;
    let used = 0;
    for (let s = 0; s < ECHO.slots; s++) {
      up.amps[s] = 0;
      up.centres[s].set(0, 0, 0, 0);
    }
    if (gate > 0) {
      for (let j = 0; j < order.length && used < Math.min(slots, ECHO.slots); j++) {
        const k = order[j];
        const b = this.b[k];
        const A0 = Math.exp(-b / ECHO.decay) * this.picks.weights[k];
        if (A0 <= ECHO.minA) continue; // sorted by b, but a later source may carry a higher weight
        up.centres[used].set(this.flowed[k * 3], this.flowed[k * 3 + 1], this.flowed[k * 3 + 2], ECHO.radiusPerRad * b);
        up.amps[used] = A0 * gate * slotFade[used];
        live.push(k);
        this.seen.add(k);
        used++;
      }
    }
    return used;
  }

  /** Distinct sources with a live crest since the last reset (dev). */
  crestSources(): number[] {
    this.counters.crestSources = Array.from(this.seen).sort((a, c) => a - c);
    return this.counters.crestSources;
  }

  resetCounters(): void {
    this.seen.clear();
    this.counters.capInsideMax = 0;
    this.counters.pingsThisTurn = 0;
    this.counters.turnSwept = 0;
  }

  /**
   * frameData.echoes for this frame (reused array). `active` = echo chips allowed (echoGate·sonar
   * > 0, sonar path on, not reduced); `decoyOn` = J2 decoys allowed; `t` = field time (s);
   * `jump` = this frame teleported (no births). Decoy positions use the same flow as the GPU
   * (pinned decoys get only the flow).
   */
  marks(
    vh: number,
    t: number,
    active: boolean,
    decoyOn: boolean,
    jump: boolean,
    ph: readonly [number, number, number],
    A: number,
    w3: number,
    project: Projector,
    out: EchoMark[],
  ): void {
    out.length = 0;
    let p = 0;
    /* echo marks: born when the lead passes a source going forward */
    for (let k = 0; k < this.n; k++) {
      const i = this.picks.echoes[k];
      if (i < 0) continue;
      const b = this.b[k];
      const pb = this.prevB[k];
      this.prevB[k] = b;
      if (!active || jump) {
        this.bornAt[k] = -1;
        continue;
      }
      // forward crossing: b wrapped from ~2π to ~0 (the lead moved past the source)
      if (pb >= 0 && pb > Math.PI && b < 0.5 * Math.PI && pb - b > Math.PI) this.bornAt[k] = t;
      const born = this.bornAt[k];
      if (born < 0) continue;
      const age = t - born;
      if (age > ECHO.markLife || age < 0) {
        this.bornAt[k] = -1;
        continue;
      }
      if (!project(this.flowed[k * 3], this.flowed[k * 3 + 1], this.flowed[k * 3 + 2], this.sp)) continue;
      const m = this.pool[p++];
      m.x = Math.round(this.sp.x * 2) / 2;
      m.y = Math.round(this.sp.y * 2) / 2;
      m.i = i;
      m.kind = "echo";
      m.age = age;
      m.reject = false;
      m.strength = this.picks.weights[k];
      out.push(m);
    }
    /* decoy marks: born at the forward crossing of the flare peak */
    const pv = this.prevVh;
    this.prevVh = vh;
    const fl = this.fl;
    for (let k = 0; k < 3; k++) {
      const i = this.picks.decoys[k];
      if (i < 0) continue;
      const peak = DECOY.peaks[k];
      if (!decoyOn || jump || vh < peak - DECOY.backOff) {
        this.decoyBorn[k] = -1;
        if (!decoyOn || vh < peak - DECOY.backOff) continue;
      }
      if (!jump && Number.isFinite(pv) && pv < peak && vh >= peak && vh - pv < 20) this.decoyBorn[k] = t;
      const born = this.decoyBorn[k];
      if (born < 0) continue;
      const age = t - born;
      if (age > DECOY.markLife || age < 0) {
        this.decoyBorn[k] = -1;
        continue;
      }
      flowOffsetPh(this.dx[k], this.dy[k], ph, A, w3, fl);
      if (!project(this.dx[k] + fl.x, this.dy[k] + fl.y, this.dz[k] + fl.z, this.sp)) continue;
      const m = this.pool[p++];
      m.x = Math.round(this.sp.x * 2) / 2;
      m.y = Math.round(this.sp.y * 2) / 2;
      m.i = i;
      m.kind = "decoy";
      m.age = age;
      m.reject = vh >= peak;
      m.strength = 0;
      out.push(m);
    }
  }

  /** Forget every mark (teleport, settle, gate off). */
  clearMarks(): void {
    this.bornAt.fill(-1);
    this.prevB.fill(-1);
    this.decoyBorn.fill(-1);
    this.prevVh = NaN;
  }
}

/* ── capture mirror (dev counter capInside, §11 item 25) ───── */

const sstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Exact mirror of the shader's capture (shaders/points.ts, SONAR): the packed distance |p' − SP|
 * of a bead at offset q = p − SP (flow included), seen along the unit view direction V. The
 * swirl rotates about V, so it keeps |q⊥| and q·V: the distance never depends on it. Also
 * returns the packed lateral distance (the meniscus band) through `out`. Pinned beads skip it.
 */
export function captureDistance(
  qx: number,
  qy: number,
  qz: number,
  vx: number,
  vy: number,
  vz: number,
  capture: number,
  out: { d: number; rp: number } = { d: 0, rp: 0 },
  Rm: number = R_M,
): { d: number; rp: number } {
  const d = Math.hypot(qx, qy, qz);
  const f = capture * (1 - sstep(3.0, 5.2, d));
  const zq = qx * vx + qy * vy + qz * vz;
  const rp = Math.sqrt(Math.max(0, d * d - zq * zq));
  let rp2 = rp > Rm ? rp + (Rm + (rp - Rm) * 0.1 - rp) * f : rp;
  rp2 = Math.max(rp2, 0.97 * Rm * sstep(0, 0.25, f));
  const zq2 = zq * (1 - 0.7 * f);
  const m3 = 0.97 * Rm * sstep(0, 0.08, capture);
  if (rp2 * rp2 + zq2 * zq2 < m3 * m3) rp2 = Math.sqrt(Math.max(m3 * m3 - zq2 * zq2, 0));
  out.d = Math.sqrt(rp2 * rp2 + zq2 * zq2);
  out.rp = rp2;
  return out;
}

/* ── pings per turn (dev counter, §11 item 45 b) ───────────── */

/** Sorted static bead bearings φ0 = aAngle + 0.06·(z + 1) (mod 2π) with their indices: the dev
 *  pings-per-turn counter only (every bead is crossed once per turn whatever the pose). */
export function sortedBearings(base: BaseField): { phi: Float32Array; idx: Int32Array } {
  const n = base.count;
  const idx = Array.from({ length: n }, (_, i) => i);
  const phiAll = new Float32Array(n);
  for (let i = 0; i < n; i++) phiAll[i] = modTau(base.angles[i] + 0.06 * (base.positions[i * 3 + 2] + 1));
  idx.sort((a, b) => phiAll[a] - phiAll[b]);
  const phi = new Float32Array(n);
  const out = new Int32Array(n);
  for (let k = 0; k < n; k++) {
    phi[k] = phiAll[idx[k]];
    out[k] = idx[k];
  }
  return { phi, idx: out };
}

/** First k with phi[k] ≥ a (binary search). */
export function lowerBound(phi: Float32Array, a: number): number {
  let lo = 0;
  let hi = phi.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (phi[mid] < a) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
