/* ============================================================
   three/field/beam.ts — beam + instrument driver (spec rev 3.1 §4.3,
   §4.7). Moved verbatim from PointField by WP0 → owned by WP2.

   Holds: the instrument meshes (createBeamMeshes: the v3 sector beam and
   the ribbons are null until WP2 builds them; the v2 wedge and line
   segments are wired with their final ORD), the LEGACY sweep integrator
   (its expression is byte-identical to v2 `PointField.ts:572`, §8.1
   item 8: it keeps feeding the legacy charge and the Ch5 backdrop),
   the flare boost, the instrument uniforms, frameData.sweepBearing
   (= the displayed θ) and ringScreen().
   v3 (WP2): BeamClock (field/beamClock.ts) for θ in J1–J2, β_SP / ρ_SP
   from f.base, the sector beam (shaders/beam.ts), ribbons
   (three/ribbons.ts), lockPulse, the switch to `sweepGain_v3`,
   `ring*_v3`, `ticks_v3`, `cross_v3`.
   ============================================================ */

import * as THREE from "three";
import { RING_RADII, SWEEP_SPEED, SWEEP_START, TWO_PI } from "../constants";
import { buildInstrument, type Instrument } from "../instrument";
import type { FieldFrameData, RingScreen } from "../../cinema/types";
import { BeamClock } from "./beamClock";
import { ORD, type DriverInit, type FieldDriver, type FieldFrame, type FieldHost } from "./frame";

export interface BeamMeshes {
  /** v3 sector beam (WP2) */
  beam: THREE.Object3D | null;
  /** v3 ribbons: rings, ticks, crosshair in one draw (WP2) */
  ribbons: THREE.Object3D | null;
  /** v2 wedge (kept for FLAGS.SONAR = false and the Ch4/Ch5 legacy look) */
  legacyWedge: THREE.Object3D;
  /** v2 rings/dial/crosshair LineSegments */
  legacyLines: THREE.Object3D;
}

/** Builds every instrument mesh with its final renderOrder; PointField adds each non-null one to the scene. */
export function createBeamMeshes(reduced: boolean): BeamMeshes & { inst: Instrument } {
  const inst = buildInstrument(reduced);
  inst.lines.renderOrder = ORD.legacyLines;
  inst.sweep.children.forEach((c) => (c.renderOrder = ORD.legacySweep));
  inst.sweep.renderOrder = ORD.legacySweep;
  return { beam: null, ribbons: null, legacyWedge: inst.sweep, legacyLines: inst.lines, inst };
}

export class BeamDriver implements FieldDriver {
  private readonly inst: Instrument;
  /** v3 clock (unused until WP2 switches the beam source) */
  readonly clock = new BeamClock();
  private frameData!: FieldFrameData;
  private camera!: THREE.PerspectiveCamera;
  private host!: FieldHost;
  private vel = 0;
  private sweepAngle = SWEEP_START;
  private sweepBoost = 0;
  private readonly v = new THREE.Vector3();

  constructor(meshes: { inst: Instrument }) {
    this.inst = meshes.inst;
  }

  init(k: DriverInit): void {
    this.frameData = k.frameData;
    this.camera = k.camera;
    this.host = k.host;
  }

  /** Beam angle (before the camera's time layer). */
  preUpdate(f: FieldFrame): void {
    const dt = f.dt;
    const m = f.motionV2;
    this.vel = f.vel;
    /* sweep — reacts to scroll energy; flare decays with dt */
    this.sweepAngle += dt * SWEEP_SPEED * (1 + 1.6 * this.vel) * m;
    if (this.sweepAngle > 1e4) this.sweepAngle -= TWO_PI * Math.floor(this.sweepAngle / TWO_PI);
    if (this.sweepBoost > 0) this.sweepBoost = Math.max(0, this.sweepBoost - dt * 2.4);
    const sweepMod = ((this.sweepAngle % TWO_PI) + TWO_PI) % TWO_PI;
    f.legacySweep = this.sweepAngle;
    f.legacySweepMod = sweepMod;
    // v2: the displayed angle IS the legacy angle (WP2: BeamClock in J1–J2)
    f.theta = sweepMod;
    f.lag = 0;
  }

  /** Instrument uniforms (after the camera and the points). */
  update(f: FieldFrame): void {
    const s = f.score;
    /* instrument */
    const inst = this.inst;
    inst.draw[0] = s.ring0;
    inst.draw[1] = s.ring1;
    inst.draw[2] = s.ring2;
    inst.draw[3] = s.ring3;
    inst.draw[4] = s.ticks;
    inst.draw[5] = s.cross;
    const rb = f.time.ringBoost;
    let anyBoost = 0;
    for (let i = 0; i < 4; i++) {
      inst.boost[i] = rb[i] > 0 ? rb[i] : 0;
      anyBoost += inst.boost[i];
    }
    inst.lines.visible = anyBoost > 0 || inst.draw.some((x) => x > 0);
    inst.sweep.rotation.z = this.sweepAngle;
    const su = inst.sweepMat.uniforms;
    su.uOpacity.value = s.sweepGain;
    su.uTime.value = f.t;
    su.uBoost.value = this.sweepBoost + this.vel * 0.8;
    inst.sweep.visible = s.sweepGain > 0;

    this.frameData.sweepBearing = (f.legacySweepMod / TWO_PI) * 360;
  }

  /** Former pulse(): the wedge's boost (the points' pulse is the sonar driver's). */
  flare(): void {
    if (this.sweepBoost < 3.2) this.sweepBoost = 3.2;
  }

  /**
   * Ring i's projected centre + radius (CSS px). WP0: the v2 HUB ring (centre (0, 0, −1),
   * world radius RING_RADII[i]) through the main camera — WP2 replaces it with the
   * travelling ring (centre hub → SP, radius → anchor.r + 14 + 6i).
   */
  ringScreen(i: number): RingScreen {
    const cam = this.camera;
    const w = this.host.w;
    const h = this.host.h;
    const R = RING_RADII[Math.max(0, Math.min(RING_RADII.length - 1, i | 0))];
    const c = this.v.set(0, 0, -1).project(cam);
    const cx = c.x;
    const cy = c.y;
    const cz = c.z;
    const e = this.v.set(R, 0, -1).project(cam);
    const r = Math.hypot(((e.x - cx) * w) / 2, ((e.y - cy) * h) / 2);
    return {
      x: Math.round((cx * 0.5 + 0.5) * w * 2) / 2,
      y: Math.round((-cy * 0.5 + 0.5) * h * 2) / 2,
      r: Math.round(r * 2) / 2,
      visible: cz > -1 && cz < 1,
    };
  }

  resetTimeLayer(): void {}

  dispose(): void {}
}
