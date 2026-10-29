/* ============================================================
   three/field/frame.ts — typed frame state + driver contract
   (spec rev 3.1 §4.1, WP0; owned by the integrator after the merge).

   PointField.update(vh, t, dt) fills ONE FieldFrame (reused every
   frame) in call order; every driver reads what earlier drivers wrote
   and writes its own fields. No driver reads another driver's internals.

   Call order (§4.1):
     score → heartbeat → camlayer.preUpdate (base pose) → beam.preUpdate
     (angle; β/ρ from the base pose) → camlayer.apply(camera) → anchor →
     labelsDriver.preUpdate (pinned) → sonar.update → dustDriver.update →
     beam.update (uniforms, ribbons) → sphere/interior/embers (PointField)
     → ripplesDriver.update → labelsDriver.update

   Draw order (ORD, final, §4.1): interior 1, atmo 2, beam 3, ribbons 4 /
   legacyLines 4, points 5, dust 6, legacySweep 7, embers 8, film 9
   (v2: interior 1, atmo 2, lines 3, points 4, dust 5, sweep 6, embers 7,
   film 8 — the v2 meshes keep their relative order, so frames are
   identical). The exterior draws at 0 (or `film` while it is a film).
   ============================================================ */

import * as THREE from "three";
import type { FieldFrameData, FieldScoreState, FieldTime, LabelChipBox } from "../../cinema/types";
import type { Governor, TierSpec } from "../governor";
import type { GpuTimer } from "../gpuTimer";

export const ORD = {
  exterior: 0,
  interior: 1,
  atmo: 2,
  beam: 3,
  ribbons: 4,
  legacyLines: 4,
  points: 5,
  dust: 6,
  legacySweep: 7,
  embers: 8,
  film: 9,
} as const;

export interface PoseState {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  up: THREE.Vector3;
  fov: number;
}

/** Point-material uniforms (shared by the base points and the dust; created by field/sonar.ts). */
export type PointUniforms = Record<string, { value: unknown }>;
/** Extra exterior-sphere uniforms (created zeroed by field/sonar.ts, spread into the exterior material). */
export type ExteriorUniforms = Record<string, { value: unknown }>;

/** The base grid's CPU-side arrays (built once by field/sonar.ts createBaseGeometry). */
export interface BaseField {
  positions: Float32Array;
  sizes: Float32Array;
  seeds: Float32Array;
  values: Float32Array;
  angles: Float32Array;
  count: number;
}

export interface FieldFrame {
  /** master vh (the followed playhead), field time t (s) and dt (s) — t = dt = 0 under ?cx-still */
  vh: number;
  t: number;
  dt: number;
  /** 0 under reduced motion and ?cx-still (v3 terms multiply by it) */
  motion: number;
  /** ext: v2's motion scalar (0 only under reduced motion). v2 code keeps using it, so
   *  ?cx-still frames equal the v3/baseline build (its freeze passes t = dt = 0 only). */
  motionV2: number;
  /** every SCORE channel, evaluated once (cinema/field/score.ts) — the field's own score object */
  score: FieldScoreState;
  /** the field's time layer (Gateway tweens, settle, acts) */
  time: FieldTime;
  /** v2 Lenis-based velocity 0..1 (legacy sweep integrator + wedge boost only) */
  vel: number;
  /** playhead velocity (master vh/s, signed), |normalised| damped λ 6, signed normalised damped */
  pvel: number;
  pvelN: number;
  pvelS: number;
  /** camlayer.preUpdate: path + L2 only (no time layer) */
  base: PoseState;
  /** after camlayer.apply (time layer included) */
  cam: PoseState;
  /** beam.preUpdate: displayed beam angle θ (rad), spoon lag (rad), SP bearing/radius on z = −1 from `base` */
  theta: number;
  lag: number;
  betaSP: number;
  rhoSP: number;
  /** legacy integrator angle (unwrapped; expression byte-identical to v2) */
  legacySweep: number;
  /** ext: legacy angle mod 2π (the points' uSweepAngle, the sweep-flash pick) */
  legacySweepMod: number;
  /** raw (unrounded) anchor px and visibility, valid after the anchor step */
  anchor: { x: number; y: number; r: number; visible: boolean };
  /** camlayer focus spring (DOF focus distance, world) */
  focusD: number;
  /** sonar driver: current integrated time T */
  flowT: number;
  /** ≤ 8 pinned point indices (−1 = empty): labelsDriver's cursor picks ∪ field.setPinned() */
  pinned: Int32Array;
  /** 4 × vec4 CSS-px rects (x, y, w, h) from setTextMask; 0-area when unused */
  textMask: Float32Array;
  /** governor tier spec and sub-step (0–8) */
  tier: TierSpec;
  subStep: number;

  /* ── ext: v2 frame state the split moved out of PointField ── */
  /** viewport (CSS px) and DPR */
  w: number;
  h: number;
  dpr: number;
  /** heartbeat (integrated phase, lub, lub+dub) */
  beatPhase: number;
  lub: number;
  beat: number;
  /** the company sphere: radius (log ramp + pre-hide shrink), on, camera distance, inside */
  sphere: { R: number; on: boolean; d: number; inside: boolean };
  /** camera speed (world/s, damped) for the J3 speed-stretch */
  camVel: number;
  /** darkness of the anchor's disc over the screen (0..1) */
  gateDark: number;
  /** the Gateway / entering emblem exists (cursor labels off) */
  inGateway: boolean;
  /** cursor labels were on screen at the end of the previous frame (FOV throb gate) */
  labelsShown: boolean;
  /** damped cursor in NDC (x right, y up) and whether a cursor is present */
  mouse: { x: number; y: number; on: boolean };
  /** runtime-measured chip box (setLabelChip) or null (static LABEL_CHIP) */
  labelChip: LabelChipBox | null;
}

/** What the host (PointField) exposes to drivers, read at call time. */
export interface FieldHost {
  readonly w: number;
  readonly h: number;
  readonly dpr: number;
  readonly spec: TierSpec;
  readonly disposed: boolean;
  readonly reduced: boolean;
  readonly mobile: boolean;
}

export interface DriverInit {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  ord: typeof ORD;
  /** the shared point uniforms (base points AND dust) */
  pu: PointUniforms;
  /** base grid geometry and its CPU arrays */
  baseGeo: THREE.BufferGeometry;
  base: BaseField;
  /** the base points mesh (its material may be swapped by the sonar driver) */
  points: THREE.Points;
  /** extra exterior-sphere uniforms (already spread into the exterior material) */
  extUniforms: ExteriorUniforms;
  /** main camera (posed by camlayer.apply) and the scratch camera (sampleScreenPoints) */
  camera: THREE.PerspectiveCamera;
  scratchCam: THREE.PerspectiveCamera;
  /** the frame object every driver reads and writes */
  frame: FieldFrame;
  /** PointField.frameData (DOM consumers read it after update) */
  frameData: FieldFrameData;
  host: FieldHost;
  gov: Governor;
  gpuT: GpuTimer;
}

/** Warm-up context (PointField.warmUp, inside the 1×1 scissor, after the v2 dust timing). */
export interface WarmCtx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  gpuT: GpuTimer;
}

export interface FieldDriver {
  /** called once from the constructor, in the order of §4.1 */
  init(k: DriverInit): void;
  preUpdate?(f: FieldFrame): void;
  update(f: FieldFrame): void;
  resize?(w: number, h: number, dpr: number): void;
  /** optional: runs once, right after the constructor's first synchronous frame (async compiles) */
  afterFirstFrame?(): void;
  /** optional: runs inside the warm-up scissor once programs are linked (cost timing) */
  warmUp?(w: WarmCtx): void;
  /** optional: zero every time-layer state (FieldAdapter.resetTimeLayer) */
  resetTimeLayer?(): void;
  dispose(): void;
}

export function createFrame(score: FieldScoreState, time: FieldTime, tier: TierSpec): FieldFrame {
  const pose = (): PoseState => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 46 });
  const pinned = new Int32Array(8);
  pinned.fill(-1);
  return {
    vh: 0,
    t: 0,
    dt: 0,
    motion: 1,
    motionV2: 1,
    score,
    time,
    vel: 0,
    pvel: 0,
    pvelN: 0,
    pvelS: 0,
    base: pose(),
    cam: pose(),
    theta: 0,
    lag: 0,
    betaSP: 0,
    rhoSP: 0,
    legacySweep: 0,
    legacySweepMod: 0,
    anchor: { x: 0, y: 0, r: 0, visible: false },
    focusD: 0,
    flowT: 0,
    pinned,
    textMask: new Float32Array(16),
    tier,
    subStep: 0,
    w: 1,
    h: 1,
    dpr: 1,
    beatPhase: 0,
    lub: 0,
    beat: 0,
    sphere: { R: 0, on: false, d: 0, inside: false },
    camVel: 0,
    gateDark: 0,
    inGateway: false,
    labelsShown: false,
    mouse: { x: -10, y: -10, on: false },
    labelChip: null,
  };
}
