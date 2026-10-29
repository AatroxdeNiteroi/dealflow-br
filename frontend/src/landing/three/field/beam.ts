/* ============================================================
   three/field/beam.ts — beam + instrument driver (spec rev 3.1 §4.3,
   §4.7). Owner: WP2.

   Meshes (createBeamMeshes): the v3 phosphor sonar beam (sector,
   shaders/beam.ts) and the ribbons (rings, ticks, crosshair in one draw,
   three/ribbons.ts); the v2 wedge and LineSegments stay for
   FLAGS.SONAR = false and for the boot frames before the v3 programs
   link (compileAsync after the first frame, then a 0.3 s cross-fade).

   preUpdate (before the camera's time layer):
   - the LEGACY sweep integrator — its expression is byte-identical to v2
     `PointField.ts:572` (§8.1 item 8): it keeps feeding the legacy charge,
     the Ch5 backdrop and, from vh 400, the beam's angle (Ch4);
   - β_SP / ρ_SP: SP's projection onto the instrument plane z = −1 along the
     ray from the BASE pose (f.base, no time layer), so the hunt is a pure
     f(vh) once latched;
   - θ (f.theta, wrapped to [0, 2π)): the shared BeamClock below vh 400
     (scroll + 16 s/turn time term, hunt latch with frozen θ_time), the
     legacy angle from 400; f.lag = clamp(0.10 + 0.25·pvelS, 0, 0.35) rad
     (the spoon lag; the points apply the same lag(ρ), WP3).
   update (after the camera, anchor and points): the beam uniforms
   (`sweepGain_v3`, τ_v = 0.34·glowTau, sector back angle, needle, uFadeR
   from the visible half-diagonal on z = −1, grain seed, text mask), the
   ribbons (`ring*_v3`, `ticks_v3`, `cross_v3`, ringTravel*, ringMerge,
   ringFade, rT_i from the anchor, ringBoost, lockPulse, G2/C4b crests)
   and frameData.sweepBearing (= the displayed θ, degrees).
   ringScreen(i): the GL ring's CPU projection (ribbons.ts mirror).
   ============================================================ */

import * as THREE from "three";
import { SP as SP_T } from "../../cinema/beats";
import { CX_STILL } from "../../cinema/env";
import { FLAGS } from "../../cinema/flags";
import { clamp, smoothstep } from "../../cinema/geometry";
import type { FieldFrameData, FieldScoreState, RingScreen } from "../../cinema/types";
import { INSTRUMENT_Z, RING_RADII, SWEEP_SPEED, SWEEP_START, TWO_PI } from "../constants";
import { buildBeamSector, buildInstrument, LINE_BASE, type BeamSector, type Instrument } from "../instrument";
import {
  buildRibbons,
  EMBLEM_CONTACT_PX,
  projectRing,
  RIBBON_ARRIVE_ALPHA,
  RIBBON_BASE,
  RIBBON_W,
  RIBBON_W_MERGE,
  RIBBON_W_MOBILE,
  RING_GAP_PX,
  RING_STEP_PX,
  ringFrame,
  type RingFrame,
  type Ribbons,
} from "../ribbons";
import { BEAM_BACK_MAX, BEAM_BACK_TAU, BEAM_KNOBS, BEAM_LINE_MAX, BEAM_RADIUS } from "../shaders/beam";
import { BeamClock, wrap2Pi } from "./beamClock";
import { ORD, type DriverInit, type FieldDriver, type FieldFrame, type FieldHost } from "./frame";

export interface BeamMeshes {
  /** v3 sector beam (null when FLAGS.SONAR is off) */
  beam: THREE.Object3D | null;
  /** v3 ribbons: rings, ticks, crosshair in one draw (null when FLAGS.SONAR is off) */
  ribbons: THREE.Object3D | null;
  /** v2 wedge (FLAGS.SONAR = false, and the boot frames before the v3 programs link) */
  legacyWedge: THREE.Object3D;
  /** v2 rings/dial/crosshair LineSegments (same) */
  legacyLines: THREE.Object3D;
}

export type BeamMeshSet = BeamMeshes & { inst: Instrument; sector: BeamSector | null; rib: Ribbons | null };

/** From this vh on the beam turns on the legacy angle (Ch4 1690–1900; it is off over 352–1700). */
export const LEGACY_ANGLE_FROM = 400;
/** Boot: v2 look → v3 look once the async programs are linked (§4.1). */
const XFADE_MS = 300;
/** If KHR_parallel_shader_compile never reports, show the v3 meshes anyway after this. */
const READY_FALLBACK_MS = 4000;
/** Spoon lag (§4.3): rad at the rim, at rest / per unit pvelS / cap. */
const LAG_REST = 0.1;
const LAG_PER_PVEL = 0.25;
const LAG_MAX = 0.35;

const SPV = new THREE.Vector3(SP_T[0], SP_T[1], SP_T[2]);
const CORNERS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** Builds every instrument mesh with its final renderOrder; PointField adds each non-null one to the scene. */
export function createBeamMeshes(reduced: boolean): BeamMeshSet {
  const inst = buildInstrument(reduced);
  inst.lines.renderOrder = ORD.legacyLines;
  inst.sweep.children.forEach((c) => (c.renderOrder = ORD.legacySweep));
  inst.sweep.renderOrder = ORD.legacySweep;
  if (!FLAGS.SONAR) {
    return { beam: null, ribbons: null, legacyWedge: inst.sweep, legacyLines: inst.lines, inst, sector: null, rib: null };
  }
  const sector = buildBeamSector();
  sector.mesh.renderOrder = ORD.beam;
  const rib = buildRibbons();
  rib.mesh.renderOrder = ORD.ribbons;
  return { beam: sector.mesh, ribbons: rib.mesh, legacyWedge: inst.sweep, legacyLines: inst.lines, inst, sector, rib };
}

export class BeamDriver implements FieldDriver {
  private readonly inst: Instrument;
  private readonly sector: BeamSector | null;
  private readonly rib: Ribbons | null;
  private readonly sonar: boolean;
  /** v3 clock (also used by NullField) */
  readonly clock = new BeamClock();
  private frameData!: FieldFrameData;
  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private host!: FieldHost;
  private vel = 0;
  private sweepAngle = SWEEP_START;
  private sweepBoost = 0;
  /** v3 programs linked (async), and when */
  private ready = false;
  private readyAt = 0;
  private bornAt = 0;
  /** playhead.jump → resetTimeLayer: re-latch the hunt with the next frame's vh */
  private pendingJump = false;
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private readonly fr: RingFrame = { c: new THREE.Vector3(), e1: new THREE.Vector3(), e2: new THREE.Vector3(), r: 0 };
  private readonly buf = new THREE.Vector2(1, 1);
  private readonly lineBase = new Float32Array(LINE_BASE);

  constructor(meshes: BeamMeshSet) {
    this.inst = meshes.inst;
    this.sector = meshes.sector;
    this.rib = meshes.rib;
    this.sonar = !!(meshes.sector && meshes.rib);
  }

  init(k: DriverInit): void {
    this.frameData = k.frameData;
    this.camera = k.camera;
    this.scene = k.scene;
    this.renderer = k.renderer;
    this.host = k.host;
    this.bornAt = performance.now();
    // reduced motion: one static frame, no boot to protect — compile with the first draw
    if (this.sonar && k.host.reduced) this.markReady();
  }

  /** After the constructor's first (v2-path) frame: link the v3 programs off the main thread. */
  afterFirstFrame(): void {
    if (!this.sonar || this.ready) return;
    const meshes = [this.sector!.mesh, this.rib!.mesh];
    const done = () => {
      if (!this.host.disposed) this.markReady();
    };
    try {
      Promise.all(meshes.map((m) => this.renderer.compileAsync(m, this.camera, this.scene))).then(done, done);
    } catch {
      done();
    }
  }

  private markReady(): void {
    if (this.ready) return;
    this.ready = true;
    this.readyAt = performance.now();
  }

  /** v2 → v3 cross-fade (0..1). */
  private xfade(): number {
    if (!this.sonar) return 0;
    if (!this.ready) {
      if (performance.now() - this.bornAt > READY_FALLBACK_MS) this.markReady();
      else return 0;
    }
    if (CX_STILL || this.host.reduced) return 1;
    return Math.min(1, (performance.now() - this.readyAt) / XFADE_MS);
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

    /* β_SP / ρ_SP: SP seen from the base pose, projected onto the instrument plane z = −1 */
    const P = f.base.pos;
    const dz = SPV.z - P.z;
    let bx = SPV.x;
    let by = SPV.y;
    if (Math.abs(dz) > 1e-6) {
      const t = (INSTRUMENT_Z - P.z) / dz;
      if (t > 0) {
        bx = P.x + t * (SPV.x - P.x);
        by = P.y + t * (SPV.y - P.y);
      }
    }
    f.betaSP = Math.atan2(by, bx);
    f.rhoSP = Math.hypot(bx, by);

    if (!this.sonar) {
      // v2: the displayed angle IS the legacy angle
      f.theta = sweepMod;
      f.lag = 0;
      return;
    }
    if (this.pendingJump) {
      this.clock.jump(f.vh);
      this.pendingJump = false;
    }
    const th = this.clock.step(f.vh, dt, f.motion, f.betaSP);
    f.theta = f.vh < LEGACY_ANGLE_FROM ? wrap2Pi(th) : sweepMod;
    f.lag = clamp(LAG_REST + LAG_PER_PVEL * f.pvelS, 0, LAG_MAX);
  }

  /** Instrument uniforms (after the camera and the points). */
  update(f: FieldFrame): void {
    const s = f.score;
    const xf = this.xfade();
    this.updateLegacy(f, s, xf);
    if (this.sonar) {
      this.updateBeam(f, s, xf);
      this.updateRibbons(f, s, xf);
    }
    this.frameData.sweepBearing = this.sonar ? (f.theta / TWO_PI) * 360 : (f.legacySweepMod / TWO_PI) * 360;
  }

  /** The v2 wedge + LineSegments: exactly v2 with FLAGS.SONAR off; otherwise only the boot
   *  stand-in (v3 channels, θ_v3), faded out as the v3 programs come in. */
  private updateLegacy(f: FieldFrame, s: FieldScoreState, xf: number): void {
    const inst = this.inst;
    const k = this.sonar ? 1 - xf : 1;
    if (this.sonar && k <= 0) {
      inst.lines.visible = false;
      inst.sweep.visible = false;
      return;
    }
    /* instrument */
    if (this.sonar) {
      inst.draw[0] = s.ring0_v3;
      inst.draw[1] = s.ring1_v3;
      inst.draw[2] = s.ring2_v3;
      inst.draw[3] = s.ring3_v3;
      inst.draw[4] = s.ticks_v3;
      inst.draw[5] = s.cross_v3;
    } else {
      inst.draw[0] = s.ring0;
      inst.draw[1] = s.ring1;
      inst.draw[2] = s.ring2;
      inst.draw[3] = s.ring3;
      inst.draw[4] = s.ticks;
      inst.draw[5] = s.cross;
    }
    const rb = f.time.ringBoost;
    let anyBoost = 0;
    for (let i = 0; i < 4; i++) {
      inst.boost[i] = rb[i] > 0 ? rb[i] : 0;
      anyBoost += inst.boost[i];
    }
    inst.lines.visible = anyBoost > 0 || inst.draw.some((x) => x > 0);
    if (this.sonar) {
      const base = inst.lineMat.uniforms.uBase.value as Float32Array;
      for (let i = 0; i < 6; i++) base[i] = this.lineBase[i] * k;
      if (this.sonar && s.ringFade < 1) for (let i = 0; i < 4; i++) base[i] *= s.ringFade;
    }
    inst.sweep.rotation.z = this.sonar ? f.theta : this.sweepAngle;
    const su = inst.sweepMat.uniforms;
    const gain = this.sonar ? s.sweepGain_v3 * k : s.sweepGain;
    su.uOpacity.value = gain;
    su.uTime.value = f.t;
    su.uBoost.value = this.sweepBoost + this.vel * 0.8;
    inst.sweep.visible = gain > 0;
  }

  private updateBeam(f: FieldFrame, s: FieldScoreState, xf: number): void {
    const sec = this.sector!;
    const gain = s.sweepGain_v3 * xf;
    sec.mesh.visible = gain > 0.0005;
    if (!sec.mesh.visible) return;
    const u = sec.u;
    sec.mesh.rotation.z = f.theta;
    const tauV = 0.34 * s.glowTau;
    const fadeR = this.fadeRadius(f);
    const needle = s.needle;
    const flareW = 0.5 * Math.min(1, this.sweepBoost / 3.2);
    const lineEnd = fadeR + (f.rhoSP + 0.4 - fadeR) * needle;
    u.uTauV.value = tauV;
    u.uLag.value = f.lag;
    // the veil reaches ≤ 1 % of its peak at 4.6τ; + lag so the bent line never leaves the sector
    u.uBack.value = Math.min(BEAM_BACK_MAX, BEAM_BACK_TAU * tauV) + f.lag;
    // the rim sits at the radial fade or the needle's end, whichever is nearer (+ the chord
    // sagitta of a 128-segment rim): nothing beyond either is ever rasterised
    u.uRadius.value = Math.min(BEAM_RADIUS, fadeR, Math.max(0.5, lineEnd)) * 1.0005;
    u.uFadeR.value = fadeR;
    u.uLineW.value = Math.min(BEAM_LINE_MAX, BEAM_KNOBS.lineW.value + 0.5 * f.pvelN + 0.75 * needle + flareW);
    u.uLineEnd.value = lineEnd;
    u.uGain.value = gain;
    u.uDpr.value = f.dpr;
    u.uViewH.value = f.h;
    // grain re-seeded 12×/s (a small lattice offset; static under reduced motion / ?cx-still)
    const gk = f.motion > 0 ? Math.floor(f.t * 12) : 0;
    u.uGrainT.value.set((gk * 37) % 113, (gk * 61) % 127);
    // text mask (§4.4): live rects packed first, their count in uMaskN
    const tm = f.textMask;
    const rects = u.uTextMask.value;
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const o = i * 4;
      if (tm[o + 2] > 0 && tm[o + 3] > 0) rects[n++].set(tm[o], tm[o + 1], tm[o + 2], tm[o + 3]);
    }
    for (let i = n; i < 4; i++) rects[i].set(0, 0, 0, 0);
    u.uMaskN.value = n;
  }

  /** uFadeR = min(12.8, 0.95·the farthest visible point of z = −1 from the hub); portrait also
   *  ≤ 1.6·the visible half-width, so the dial-radius arc and a long triangle never show. */
  private fadeRadius(f: FieldFrame): number {
    let far = 0;
    for (const [cx, cy] of CORNERS) {
      const hit = this.planeHit(cx, cy);
      if (!hit) return BEAM_RADIUS;
      far = Math.max(far, Math.hypot(hit.x, hit.y));
    }
    let fade = Math.min(BEAM_RADIUS, 0.95 * far);
    if (f.w < f.h) {
      const l = this.planeHit(-1, 0);
      if (l) {
        const lx = l.x;
        const ly = l.y;
        const r = this.planeHit(1, 0); // (reuses the same vector: l is read above)
        if (r) fade = Math.min(fade, 1.6 * 0.5 * Math.hypot(r.x - lx, r.y - ly));
      }
    }
    return Math.max(1, fade);
  }

  /** Where the camera ray through NDC (x, y) meets z = INSTRUMENT_Z (null if it never does). */
  private planeHit(x: number, y: number): THREE.Vector3 | null {
    const cam = this.camera;
    const o = cam.position;
    const d = this.v.set(x, y, 0.5).unproject(cam).sub(o);
    if (Math.abs(d.z) < 1e-9) return null;
    const t = (INSTRUMENT_Z - o.z) / d.z;
    if (t <= 0) return null;
    return this.w.copy(o).addScaledVector(d, t);
  }

  private updateRibbons(f: FieldFrame, s: FieldScoreState, xf: number): void {
    const rib = this.rib!;
    const u = rib.u;
    const draw = rib.draw;
    draw[0] = s.ring0_v3;
    draw[1] = s.ring1_v3;
    draw[2] = s.ring2_v3;
    draw[3] = s.ring3_v3;
    draw[4] = s.ticks_v3;
    draw[5] = s.cross_v3;
    const rb = f.time.ringBoost;
    const boost = u.uBoost.value;
    let anyBoost = 0;
    for (let i = 0; i < 4; i++) {
      boost[i] = rb[i] > 0 ? rb[i] : 0;
      anyBoost += boost[i];
    }
    const fade = s.ringFade;
    const tr = u.uTravel.value;
    tr[0] = s.ringTravel0;
    tr[1] = s.ringTravel1;
    tr[2] = s.ringTravel2;
    tr[3] = s.ringTravel3;
    u.uMerge.value = s.ringMerge;
    u.uSP.value.copy(SPV);
    const cam = this.camera;
    u.uCamPos.value.copy(cam.position);

    /* arrival radii: the DOM reticle (anchor.r + 14) + 6 px per ring, in world at SP's depth
       (kept current every frame: ringScreen reads them even while the ribbons are hidden) */
    const rt = u.uRT.value;
    const zc = -this.v.copy(SPV).applyMatrix4(cam.matrixWorldInverse).z;
    const fpx = f.h / 2 / Math.tan((cam.fov * Math.PI) / 360);
    const live = f.anchor.visible && zc > 1e-3 && fpx > 0;
    for (let i = 0; i < 4; i++) {
      rt[i] = live ? ((f.anchor.r + RING_GAP_PX + RING_STEP_PX * i) * zc) / fpx : RING_RADII[i];
    }

    let any = anyBoost > 0 || f.time.lockPulse > 0;
    for (let i = 0; i < 6 && !any; i++) any = draw[i] * (i < 4 ? fade : 1) > 0;
    rib.mesh.visible = any && xf > 0;
    if (!rib.mesh.visible) return;

    u.uFade.value = fade;
    u.uLock.value = clamp(f.time.lockPulse, 0, 1);
    const base = u.uBase.value;
    for (let i = 0; i < 6; i++) base[i] = RIBBON_BASE[i] * xf;
    u.uArrive.value = RIBBON_ARRIVE_ALPHA * xf;

    /* crests: the G2 shock front (radius from the hub axis, as the points' shock), or the C4b
       dust front (a sphere of radius dust·30 around SP, as the dust wave) */
    const shock = u.uShock.value;
    if (f.time.shockR > 0) {
      shock.set(f.time.shockR, 0.06);
      u.uCrestMode.value = 0;
    } else if (s.dust > 0 && s.dust < 1) {
      shock.set(s.dust * 30, 0.04);
      u.uCrestC.value.copy(SPV);
      u.uCrestMode.value = 1;
    } else shock.set(-1, 0);

    /* widths (device px): 1.25 CSS (1.5 mobile), 1.5 at the merge, ring0 = the emblem stroke for vh < 8 */
    const dpr = f.dpr;
    const wN = this.host.mobile ? RIBBON_W_MOBILE : RIBBON_W;
    u.uWidth.value = wN * dpr;
    u.uWidthM.value = RIBBON_W_MERGE * dpr;
    u.uWidth0.value = (EMBLEM_CONTACT_PX + (wN - EMBLEM_CONTACT_PX) * smoothstep(4, 8, f.vh)) * dpr;
    u.uViewport.value.copy(this.buf);
  }

  resize(w: number, h: number, dpr: number): void {
    if (this.renderer) this.renderer.getDrawingBufferSize(this.buf);
    else this.buf.set(w * dpr, h * dpr);
  }

  /** Former pulse(): the wedge's boost (the points' pulse is the sonar driver's); v3: a brief
   *  brightening of the gold line (still ≤ 2.25 px). */
  flare(): void {
    if (this.sweepBoost < 3.2) this.sweepBoost = 3.2;
  }

  /**
   * Ring i's projected centre + radius (CSS px, rounded to 0.5 like the anchor): the CPU
   * projection of the SAME centre, plane and radius the ribbon shader draws (hub ring at
   * travel 0; at SP facing the camera, radius anchor.r + 14 + 6i, on arrival). FLAGS.SONAR
   * off: the v2 hub ring.
   */
  ringScreen(i: number): RingScreen {
    const cam = this.camera;
    const w = this.host.w;
    const h = this.host.h;
    const k = Math.max(0, Math.min(RING_RADII.length - 1, i | 0));
    if (this.rib) {
      const p = projectRing(ringFrame(this.rib.u, k, this.fr), cam, w, h);
      return { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2, r: Math.round(p.r * 2) / 2, visible: p.visible };
    }
    const R = RING_RADII[k];
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

  /** playhead.jump / settle: the hunt latch is re-established from the next frame's vh. */
  resetTimeLayer(): void {
    this.pendingJump = true;
  }

  dispose(): void {}
}
