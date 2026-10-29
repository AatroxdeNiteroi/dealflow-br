/* ============================================================
   three/field/camlayer.ts — the camera layer (spec rev 3.1 §6, §4.1).
   Moved from PointField.update() by WP0; v3 built by WP4.

   Layers (§6.1), composed every frame:
     L1 path    CAMERA.seek (vh < 352, portrait variant at aspect < 1),
                v2 CAMERA.in (352–1568), v2 CAMERA.out (≥ 1568)  — camera.ts
     L2 score   roll (on camera.up, about the view axis), fovSeek, plus v2's
                fovThud / fovWiden / fovUniverse / creep / breath
     L3 lean    operator follow-through: −g·a_path in camera space, soft
                clamp 0.18 world (position only: the aim stays on the look
                point, so the near field parallaxes against the far field)
                + bank: a roll kick INTO the lateral acceleration (a drone
                banks toward where it accelerates — same handedness as the
                scripted roll, which banks toward the travel direction)
     L4 kicks   fovKick (+2.2°·pvelN) and look-ahead (0.15·pvelS along the
                path tangent; signed, so it leads in both directions)
     L5 cursor  parallax on the look (gain = `parallax` channel)
     L6 Ch2–Ch3 backdrop: pure-f(vh) drift on a plateau-frozen coordinate +
                a time sway (sin on both axes: exactly 0 at t = 0)
     L7 focus   the DOF focus distance spring → f.focusD (not the pose)

   Look offsets (L4–L6) are ANGULAR: "x world" of look offset means x world
   at the reference aim distance D_LOOK_REF = 5.73 world (0.10 world = 1°,
   the spec's own "≈ 1° of look, ≈ 20 px at 1440×900" for the drift). The
   real look distance runs from ~16 (J1) to 0.84 (Ch2–Ch3, the camera sits
   inside the sphere) — literal world offsets on the look target would be
   0.2° in J1 and 6.8° behind the dossier.

   Gates (§6.1, §4.2): `camLean` gates L3 + fovKick, `camLook` gates
   look-ahead + parallax, `driftCard` / `breathCard` gate L6. Each spring's
   target is multiplied by its gate, its output again by the gate (so the
   term is EXACTLY 0 wherever the gate is 0: 352–1112 and 1552–1700 carry
   no time-layer term), and a spring is zeroed while its gate is 0 (no
   stale state resurfaces when scrolling back). Every target is 0 at rest
   (the cursor parallax follows the cursor); after the playhead stops, a
   rest drag pulls the velocity-driven springs to exactly 0 (< 1e−4 world /
   0.01° within 1 s of idle) without cutting the visible settle.

   Exactness: when a v3 term is 0 the v2 code path runs untouched (camera.up
   = (0,1,0), lookAt on the path's look target, the v2 FOV sum first), so
   352–1112 and 1552–1568 are bit-identical to the baseline under ?cx-still,
   and 1112–1552 differ from it by exactly the drift term.
   ?cx-still / reduced motion: f.motion = 0 → L3–L5 and the sway are 0 and
   the focus distance equals its target; the drift (pure f(vh)) stays
   (it is part of the deterministic frame), except under reduced motion.

   - preUpdate(f): the BASE pose f.base = path(vh) + creep + roll + score
     FOV (L1 + L2), no time layer. β_SP / ρ_SP (beam) come from it.
   - apply(cam, f): v2's breath / entryZ / throb / fovGate, then the v3
     time layer, the near plane that hugs the membrane, the projection
     (v2's 1e-4° FOV hysteresis) and updateMatrixWorld; writes f.cam,
     f.camVel, f.sphere.d / inside, f.focusD.
   - poseScratch(): the base pose (L1 + L2) on the scratch camera
     (sampleScreenPoints): same path, roll and FOV as the main camera's
     base, no time layer.
   - resetTimeLayer(): zeroes every spring and the kinematic history
     (playhead.jump / settle).

   Outputs other drivers read (contract):
   - f.base: pose before the time layer (beam β_SP / ρ_SP, scratch camera).
   - f.cam.pos / up / fov: the rendered camera. f.cam.look is a point on the
     rendered view axis: use it as a DIRECTION only (while look offsets are
     live it sits D_LOOK_REF ahead of the camera, otherwise it is the path's
     look target).
   - f.focusD: the focus spring, a VIEW-SPACE DEPTH (distance along the base
     view axis, the same measure as the shader's −mv.z), ≥ 0.25 world.
   - Roll sign: positive = the camera's top tilts right (clockwise roll seen
     from behind the camera). The score's `roll` keys and the bank use this
     convention; the bank leans INTO the lateral acceleration.
   - Velocity: f.pvel (WP1's signed master vh/s via setPlayhead) normalised
     by 120 vh/s; while f.pvel is exactly 0 (WP0's identity playhead) the
     layer measures dvh/dt itself.
   ============================================================ */

import * as THREE from "three";
import { CAMERA, RESTS, SP as SP_T } from "../../cinema/beats";
import { FLAGS } from "../../cinema/flags";
import { clamp, clamp01, damp, smoothstep } from "../../cinema/geometry";
import type { FieldScoreState } from "../../cinema/types";
import { CameraRig, breathOffset } from "../camera";
import { SPRINGS, Spring, SpringVec, clampAbs } from "../springs";
import type { DriverInit, FieldDriver, FieldFrame, FieldHost, PoseState } from "./frame";

/* the J3 crossing: below this gap to the membrane the near plane follows the
   surface (no clipped hole) and the interior starts covering (seamless contact) */
export const CONTACT_BAND = 0.25;
const NEAR_INSIDE = 0.02;
const NEAR_MIN = 0.004;

const SPV = new THREE.Vector3(SP_T[0], SP_T[1], SP_T[2]);
/** the instrument hub: "mid-field" for the focus pull */
const HUB = new THREE.Vector3(0, 0, -1);
const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

/** Reference aim distance for the angular look offsets: 0.10 world = 1°. */
export const D_LOOK_REF = 0.1 / Math.tan(1 * DEG);

/** |playhead velocity| that normalises to 1 (vh/s), and its damping (as PointField's pvelN, §1.2). */
const PVEL_FULL = 120;
const PVEL_LAMBDA = 6;
/** Path-acceleration pre-filter (1/s): removes frame-time jitter and, if the follower is off
 *  (FLAGS.PLAYHEAD_FOLLOW = 0), most of the Lenis per-notch velocity steps (lean rate RMS at
 *  35 vh/s 0.46 → 0.26 world/s vs λ 18); with the follower the stop settle is unchanged. */
const ACC_LAMBDA = 8;
/** A step larger than this in one frame is a cut (jump, teleport, scrollbar drag), not motion. */
const CUT_VH = 60;
const CUT_WORLD = 2;
/** Rest: the playhead is idle below this speed (vh/s); the drag ramps in over [from, to] s of idle. */
const REST_VH_S = 1.5;
const REST_RAMP: readonly [number, number] = [0.12, 0.4];
/** Extra decay rate (1/s) of the velocity-driven springs once idle. */
const REST_DRAG = 9;
/** Below these the springs snap to exact zero (no denormal tails). */
const SNAP_X = 1e-7;
const SNAP_V = 1e-6;
/** Sub-step 8 (§4.9): camera lean off, ramped over this many seconds. */
const LEAN_RAMP_S = 0.3;
/** §6.5 mobile scales. */
const MOBILE = { roll: 0.6, fovKick: 0.6, drift: 0.6 } as const;
/** §6.1 L6 drift (world @ D_LOOK_REF, periods in plateau-frozen vh) and sway (world, rad/s). */
// motion r1: amplitudes a viewer can see (was 0.10/420 and 0.06/560, and a ≈ 70 s sway that read as still)
const DRIFT = { ax: 0.28, px: 300, ay: 0.17, py: 400, phy: 1.1 } as const;
const SWAY = { ax: 0.18, fx: 0.26, ay: 0.12, fy: 0.19 } as const;
/** FLAGS.INTERIOR_PARALLAX (default off): J4 cursor parallax window, flat before R2. */
const J4_PARALLAX = { gain: 0.4, inFrom: 488, inTo: 520, outFrom: 625, outTo: 649 } as const;

/** Plateaus R1–R7 [start, end] (master vh): the drift coordinate stands still on them. */
const PLATEAUS: ReadonlyArray<readonly [number, number]> = RESTS.filter((r) => r.plateau).map((r) => r.plateau!);

/** Plateau-frozen vh (§6.1 L6): u(vh) = vh − Σ_p clamp(vh − p.start, 0, p.len). */
export function frozenVh(vh: number): number {
  let u = vh;
  for (const [a, b] of PLATEAUS) u -= clamp(vh - a, 0, b - a);
  return u;
}

/** §6.1 L6 drift (world at D_LOOK_REF, camera right / up) at vh, before the mobile scale. */
export function driftAt(vh: number, driftCard: number, out: { x: number; y: number }): { x: number; y: number } {
  if (driftCard === 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const u = frozenVh(vh);
  out.x = driftCard * DRIFT.ax * Math.sin((TWO_PI * u) / DRIFT.px);
  out.y = driftCard * DRIFT.ay * Math.sin((TWO_PI * u) / DRIFT.py + DRIFT.phy);
  return out;
}

/** The view's right / up / forward for an UNROLLED lookAt (world up +y). */
function basis(pos: THREE.Vector3, look: THREE.Vector3, r: THREE.Vector3, u: THREE.Vector3, fw: THREE.Vector3): boolean {
  fw.copy(look).sub(pos);
  const len = fw.length();
  if (!(len > 1e-9)) return false;
  fw.multiplyScalar(1 / len);
  r.set(-fw.z, 0, fw.x); // fw × (0, 1, 0)
  const rl = r.length();
  if (!(rl > 1e-9)) return false;
  r.multiplyScalar(1 / rl);
  u.crossVectors(r, fw);
  return true;
}

/** Roll `up` (+y) about the unit view axis `fw` by `deg` (positive = bank right: the camera's top tilts right). */
function rolledUp(fw: THREE.Vector3, deg: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(0, 1, 0).applyAxisAngle(fw, deg * DEG);
}

/** Readouts of the time layer (dev / QA: `window.__cxField.cam.debug()`). */
export interface CamLayerDebug {
  /** lean offset (world, camera right / up / forward) after the soft clamp and gate */
  lean: [number, number, number];
  bankDeg: number;
  fovKickDeg: number;
  /** look offsets (world @ D_LOOK_REF, right / up) */
  lookAhead: [number, number];
  parallax: [number, number];
  drift: [number, number];
  sway: [number, number];
  rollDeg: number;
  focusD: number;
  focusTarget: number;
  /** path acceleration (filtered, world/s²) and the camera's own normalised playhead speed */
  acc: [number, number, number];
  pvelN: number;
  idle: number;
}

export class CamLayer implements FieldDriver {
  readonly rig = new CameraRig();
  private host: FieldHost | null = null;
  /** the main camera (its aspect picks the seek variant before the base pose is sampled) */
  private mainCam: THREE.PerspectiveCamera | null = null;
  private readonly P = new THREE.Vector3();
  private readonly L = new THREE.Vector3();
  private readonly B = new THREE.Vector3();
  private camVel = 0;
  private readonly prevPos = new THREE.Vector3();
  private hasPrev = false;
  private lastFov = -1;
  private lastNear = -1;

  /* v3 time layer */
  private readonly lean = new SpringVec(3, SPRINGS.lean);
  private readonly bank = new Spring(SPRINGS.bank);
  private readonly fovKick = new Spring(SPRINGS.fovKick);
  private readonly lookAhead = new SpringVec(2, SPRINGS.lookAhead);
  private readonly parallax = new SpringVec(2, SPRINGS.parallax);
  private readonly focus = new Spring(SPRINGS.focus);
  private focusLive = false;
  /** kinematics of the BASE pose (pure path, no time layer) */
  private kinVh = 0;
  private readonly kinPos = new THREE.Vector3();
  private readonly kinVel = new THREE.Vector3();
  private kinDt = 0;
  private kinState: 0 | 1 | 2 = 0; // 0 none, 1 position, 2 position + velocity
  private readonly acc = new THREE.Vector3();
  private pvelN = 0;
  private pvelS = 0;
  private idle = 0;
  private leanAvail = 1;
  /** last outputs (reused on dt = 0 redraws) */
  private readonly out = {
    lean: new THREE.Vector3(),
    bank: 0,
    kick: 0,
    lax: 0,
    lay: 0,
    pax: 0,
    pay: 0,
  };
  private readonly drift = { x: 0, y: 0 };
  private sway = { x: 0, y: 0 };
  private rollDeg = 0;
  private focusTarget = 0;

  /* scratch */
  private readonly r = new THREE.Vector3();
  private readonly u = new THREE.Vector3();
  private readonly fw = new THREE.Vector3();
  private readonly t0 = new THREE.Vector3();
  private readonly t1 = new THREE.Vector3();
  private readonly t2 = new THREE.Vector3();
  private readonly t3 = new THREE.Vector3();
  private readonly tgt3 = new Float64Array(3);
  private readonly tgt2 = new Float64Array(2);
  private readonly scratchPose: PoseState = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: CAMERA.fovBase };

  init(k: DriverInit): void {
    this.host = k.host;
    this.mainCam = k.camera;
    this.rig.setAspect(k.camera.aspect);
  }

  private get mobile(): boolean {
    return !!this.host && this.host.mobile;
  }

  /** Score roll after the mobile scale (deg). */
  private scoreRoll(s: FieldScoreState): number {
    return s.roll === 0 ? 0 : this.mobile ? s.roll * MOBILE.roll : s.roll;
  }

  /**
   * The base pose at vh (L1 + L2, pure f(vh) for this viewport): path + creep, camera.up
   * rolled by the score roll, FOV = 46 + thud + widen + universe + seek. No time layer.
   */
  basePose(vh: number, s: FieldScoreState, out: PoseState): PoseState {
    this.rig.pose(vh, s.creep, out.pos, out.look);
    const roll = this.scoreRoll(s);
    if (roll !== 0 && basis(out.pos, out.look, this.r, this.u, this.fw)) rolledUp(this.fw, roll, out.up);
    else out.up.set(0, 1, 0);
    let fov = CAMERA.fovBase + s.fovThud + s.fovWiden + s.fovUniverse;
    if (s.fovSeek !== 0) fov += s.fovSeek;
    out.fov = fov;
    return out;
  }

  /** L1 + L2: the base pose (no time layer) into f.base. */
  preUpdate(f: FieldFrame): void {
    // The seek variant follows the main camera's aspect, picked BEFORE the base pose is sampled
    // (a rotation swaps landscape ↔ portrait knots: a cut in the path, never an acceleration).
    if (this.mainCam && this.rig.setAspect(this.mainCam.aspect)) this.cutKinematics();
    this.basePose(f.vh, f.score, f.base);
  }

  /** The main camera is posed by apply(); update() is part of the driver contract only. */
  update(_f: FieldFrame): void {}

  /** Time layer + projection on `cam` (main camera). */
  apply(cam: THREE.PerspectiveCamera, f: FieldFrame): void {
    const s = f.score;
    const m = f.motionV2;
    const vh = f.vh;
    if (this.rig.setAspect(cam.aspect)) this.cutKinematics();

    /* v2: path(vh) + creep, then the v2 time layer (breath, entryZ) */
    const P = this.P.copy(f.base.pos);
    let L = this.L.copy(f.base.look);
    breathOffset(f.t, s.breathHero * m, s.breathUni * m, this.B);
    P.add(this.B);
    P.z += f.time.entryZ;

    /* v3 time layer (L3–L7) + the L6 drift */
    this.stepTimeLayer(f);
    const o = this.out;
    if (o.lean.x !== 0 || o.lean.y !== 0 || o.lean.z !== 0) {
      // camera-space offset → world on the base basis (the aim stays on the look point)
      if (basis(f.base.pos, f.base.look, this.r, this.u, this.fw)) {
        P.addScaledVector(this.r, o.lean.x).addScaledVector(this.u, o.lean.y).addScaledVector(this.fw, o.lean.z);
      }
    }
    const ox = o.lax + o.pax + this.drift.x + this.sway.x;
    const oy = o.lay + o.pay + this.drift.y + this.sway.y;
    if (ox !== 0 || oy !== 0) {
      // angular look offset: aim point at D_LOOK_REF along the unrolled view, moved on its right / up
      if (basis(P, L, this.r, this.u, this.fw)) {
        L = this.t0.copy(P).addScaledVector(this.fw, D_LOOK_REF).addScaledVector(this.r, ox).addScaledVector(this.u, oy);
      }
    }
    const roll = this.scoreRoll(s) + o.bank;
    this.rollDeg = roll;
    cam.position.copy(P);
    if (roll !== 0 && basis(P, L, this.r, this.u, this.fw)) rolledUp(this.fw, roll, cam.up);
    else cam.up.set(0, 1, 0);
    cam.lookAt(L);

    const sp = f.sphere;
    const R = sp.R;
    const sphereOn = sp.on;
    const d = P.distanceTo(SPV);
    const inside = sphereOn && d < R;
    sp.d = d;
    sp.inside = inside;

    /* FOV — single owner: 46 − throb + thud + gate + widen + universe (v2, in v2's order) + seek + kick (v3) */
    const throb = vh < CAMERA.throb.maxVh && !f.labelsShown ? f.beat * CAMERA.throb.amp * m : 0;
    let fov = CAMERA.fovBase - throb + s.fovThud + f.time.fovGate + s.fovWiden + s.fovUniverse;
    if (s.fovSeek !== 0) fov += s.fovSeek;
    if (o.kick !== 0) fov += o.kick;
    /* near plane hugs the membrane while crossing: no clipped hole */
    let near: number = CAMERA.near;
    if (sphereOn) {
      if (inside) near = NEAR_INSIDE;
      else if (d - R < CONTACT_BAND) near = clamp((d - R) * 0.5, NEAR_MIN, CAMERA.near);
    }
    if (Math.abs(fov - this.lastFov) > 1e-4 || near !== this.lastNear) {
      cam.fov = fov;
      cam.near = near;
      cam.updateProjectionMatrix();
      this.lastFov = fov;
      this.lastNear = near;
    }
    cam.updateMatrixWorld();

    /* camera speed (world/s, damped) for the J3 speed-stretch; jumps are ignored */
    if (this.hasPrev && f.dt > 0) {
      const step = P.distanceTo(this.prevPos);
      this.camVel = damp(this.camVel, step > 2 ? 0 : step / f.dt, 10, f.dt);
    }
    this.prevPos.copy(P);
    this.hasPrev = true;

    f.camVel = this.camVel;
    f.cam.pos.copy(P);
    f.cam.look.copy(L);
    f.cam.up.copy(cam.up);
    f.cam.fov = cam.fov;
    f.focusD = this.focus.x > 0.25 ? this.focus.x : 0.25;
  }

  /**
   * L3–L7 for this frame: kinematics of the base pose, the springs (stepped
   * only when dt > 0), their gates, the rest drag; the L6 drift and sway.
   * Writes this.out / drift / sway / focus.
   */
  private stepTimeLayer(f: FieldFrame): void {
    const s = f.score;
    const dt = f.dt;
    const vh = f.vh;

    /* L6 drift: pure f(vh) (kept under ?cx-still, off under reduced motion) */
    if (FLAGS.CARD_DRIFT && f.motionV2 > 0 && s.driftCard > 0) {
      driftAt(vh, s.driftCard, this.drift);
      if (this.mobile) {
        this.drift.x *= MOBILE.drift;
        this.drift.y *= MOBILE.drift;
      }
    } else {
      this.drift.x = 0;
      this.drift.y = 0;
    }

    /* focus target (L7): mid-field (the hub's depth) → SP's depth, from the base pose */
    const base = f.base;
    let focusT = this.focusTarget;
    if (basis(base.pos, base.look, this.r, this.u, this.fw)) {
      const dMid = this.t1.copy(HUB).sub(base.pos).dot(this.fw);
      const dSP = this.t1.copy(SPV).sub(base.pos).dot(this.fw);
      const k = s.focusSP;
      focusT = Math.max(0.25, dMid + (dSP - dMid) * k);
    }
    this.focusTarget = focusT;

    const live = f.motion > 0;
    if (!live) {
      // ?cx-still / reduced motion: no time layer, the focus sits on its target
      this.zeroSprings();
      this.cutKinematics();
      this.focus.reset(focusT);
      this.focusLive = false;
      this.sway.x = 0;
      this.sway.y = 0;
      return;
    }
    if (!this.focusLive) {
      this.focus.reset(focusT);
      this.focusLive = true;
    }

    /* L6 sway (time; exactly 0 at t = 0) */
    if (FLAGS.CARD_DRIFT && s.breathCard > 0) {
      const a = s.breathCard * (this.mobile ? MOBILE.drift : 1);
      this.sway.x = a * SWAY.ax * Math.sin(SWAY.fx * f.t);
      this.sway.y = a * SWAY.ay * Math.sin(SWAY.fy * f.t);
    } else {
      this.sway.x = 0;
      this.sway.y = 0;
    }

    if (!(dt > 0)) {
      // a redraw of the same instant (resize, first frame): outputs stay as they are
      this.applyOutputGates(f);
      return;
    }

    /* kinematics of the base pose (world): velocity and acceleration */
    const dvh = vh - this.kinVh;
    if (this.kinState > 0 && (Math.abs(dvh) > CUT_VH || this.kinPos.distanceTo(base.pos) > CUT_WORLD)) {
      // a cut, not motion: drop the history and the velocity-driven state
      this.cutKinematics();
      this.zeroSprings();
    }
    const vhDotMeas = this.kinState > 0 ? dvh / dt : 0;
    // WP1 feeds the follower's exact velocity; the WP0 identity playhead reports 0 → measure it
    const vPh = f.pvel !== 0 ? f.pvel : vhDotMeas;
    this.pvelN = damp(this.pvelN, clamp01(Math.abs(vPh) / PVEL_FULL), PVEL_LAMBDA, dt);
    this.pvelS = damp(this.pvelS, clamp(vPh / PVEL_FULL, -1, 1), PVEL_LAMBDA, dt);
    if (this.kinState >= 1) {
      const v = this.t2.copy(base.pos).sub(this.kinPos).multiplyScalar(1 / dt);
      if (this.kinState === 2) {
        const h = 0.5 * (dt + this.kinDt);
        const a = this.t3.copy(v).sub(this.kinVel).multiplyScalar(1 / h);
        const kA = 1 - Math.exp(-ACC_LAMBDA * dt);
        this.acc.x += (a.x - this.acc.x) * kA;
        this.acc.y += (a.y - this.acc.y) * kA;
        this.acc.z += (a.z - this.acc.z) * kA;
      }
      this.kinVel.copy(v);
      this.kinState = 2;
    } else this.kinState = 1;
    this.kinPos.copy(base.pos);
    this.kinVh = vh;
    this.kinDt = dt;

    /* idle → rest: every velocity-driven target fades to 0 and a drag pulls the state to exactly 0 */
    this.idle = Math.abs(vPh) < REST_VH_S ? this.idle + dt : 0;
    const restK = smoothstep(REST_RAMP[0], REST_RAMP[1], this.idle);
    const live1 = 1 - restK;
    const dragK = restK > 0 ? Math.exp(-REST_DRAG * restK * dt) : 1;

    const life = FLAGS.CAM_LIFE;
    /* sub-step 8: camera lean off (ramped) */
    const leanWanted = f.subStep >= 8 ? 0 : 1;
    this.leanAvail = leanWanted > this.leanAvail ? Math.min(leanWanted, this.leanAvail + dt / LEAN_RAMP_S) : Math.max(leanWanted, this.leanAvail - dt / LEAN_RAMP_S);

    /* basis of the base pose (unrolled) for the camera-space terms */
    const hasBasis = basis(base.pos, base.look, this.r, this.u, this.fw);
    const acc = this.acc;

    /* L3 lean + bank (gate camLean × sub-step on target and output; the tier / mobile scales
       are applied once, on the output — applyOutputGates) */
    const gL = life && hasBasis && f.tier.camLean > 0 ? s.camLean * this.leanAvail : 0;
    if (gL > 0) {
      const g = SPRINGS.lean.g;
      const t = this.tgt3;
      t[0] = -g * acc.dot(this.r) * gL * live1;
      t[1] = -g * acc.dot(this.u) * gL * live1;
      t[2] = -g * acc.dot(this.fw) * gL * live1;
      this.lean.step(t, dt);
      const latN = acc.dot(this.r) / SPRINGS.bank.aRef;
      this.bank.step(clampAbs(SPRINGS.bank.gainDeg * latN, SPRINGS.bank.clampDeg) * gL * live1, dt);
      this.dragN(this.lean, dragK);
      this.drag1(this.bank, dragK);
    } else {
      this.lean.reset();
      this.bank.reset();
    }

    /* L4 fovKick (gate camLean) */
    const gK = life ? s.camLean : 0;
    if (gK > 0) {
      const sc = this.mobile ? MOBILE.fovKick : 1;
      this.fovKick.step(SPRINGS.fovKick.gainDeg * this.pvelN * sc * gK * live1, dt);
      this.drag1(this.fovKick, dragK);
    } else this.fovKick.reset();

    /* L4 look-ahead (gate camLook): 0.15·pvelS world along the path tangent, projected on the view */
    const gA = life && hasBasis ? s.camLook : 0;
    if (gA > 0) {
      const t = this.tgt2;
      const tan = this.pathTangent(vh, s.creep);
      const k = SPRINGS.lookAhead.gain * this.pvelS * gA * live1;
      t[0] = tan ? k * tan.dot(this.r) : 0;
      t[1] = tan ? k * tan.dot(this.u) : 0;
      this.lookAhead.step(t, dt);
      this.dragN(this.lookAhead, dragK);
    } else this.lookAhead.reset();

    /* L5 cursor parallax (gain `parallax`, output gate camLook; no parallax on touch or in the Gateway) */
    const pGain = this.parallaxGain(f);
    if (pGain > 0) {
      const t = this.tgt2;
      const mx = f.mouse.on ? f.mouse.x : 0;
      const my = f.mouse.on ? f.mouse.y : 0;
      t[0] = SPRINGS.parallax.gainX * mx * pGain;
      t[1] = SPRINGS.parallax.gainY * my * pGain;
      this.parallax.step(t, dt);
      this.snap2(this.parallax);
    } else this.parallax.reset();

    /* L7 focus pull (always live while motion is allowed; WP3's `dof` decides if it shows) */
    this.focus.step(focusT, dt);

    this.applyOutputGates(f);
  }

  /** Output = spring × its gate (exactly 0 where the gate is 0), soft clamps, mobile scales. */
  private applyOutputGates(f: FieldFrame): void {
    const s = f.score;
    const o = this.out;
    const life = FLAGS.CAM_LIFE && f.motion > 0;
    const tierLean = f.tier.camLean; // 1 on T0–T2, 0 on T3, 0.6 on mobile (§4.9)
    const gL = life && tierLean > 0 ? s.camLean * this.leanAvail : 0;
    if (gL > 0) {
      const x = this.lean.x;
      const n = Math.hypot(x[0], x[1], x[2]);
      const k = SPRINGS.lean.clamp;
      // radial soft clamp, then the gate and the tier scale (lean ×0.6 on mobile, §6.5)
      const sc = n > 0 ? ((k * Math.tanh(n / k)) / n) * gL * tierLean : 0;
      o.lean.set(x[0] * sc, x[1] * sc, x[2] * sc);
      // the bank is roll: ×0.6 on mobile (§6.5), the tier only switches it off (T3)
      const b = clampAbs(this.bank.x, SPRINGS.bank.clampDeg) * gL;
      o.bank = b === 0 ? 0 : this.mobile ? b * MOBILE.roll : b;
    } else {
      o.lean.set(0, 0, 0);
      o.bank = 0;
    }
    const gK = life ? s.camLean : 0;
    o.kick = gK > 0 ? clampAbs(this.fovKick.x, SPRINGS.fovKick.clampDeg) * gK : 0;
    const gA = life ? s.camLook : 0;
    o.lax = gA > 0 ? this.lookAhead.x[0] * gA : 0;
    o.lay = gA > 0 ? this.lookAhead.x[1] * gA : 0;
    const gP = life ? this.parallaxOutGate(f) : 0;
    o.pax = gP > 0 ? this.parallax.x[0] * gP : 0;
    o.pay = gP > 0 ? this.parallax.x[1] * gP : 0;
    // normalise −0 to 0 so the "term is 0" fast paths stay exact
    if (o.bank === 0) o.bank = 0;
    if (o.kick === 0) o.kick = 0;
  }

  /** Cursor parallax gain (target side). */
  private parallaxGain(f: FieldFrame): number {
    if (this.mobile || f.inGateway) return 0;
    let g = f.score.parallax;
    if (FLAGS.INTERIOR_PARALLAX) g += J4_PARALLAX.gain * this.j4Window(f.vh);
    return g;
  }

  /** Cursor parallax output gate: camLook (same knots as `parallax`, peak 1), or the J4 window. */
  private parallaxOutGate(f: FieldFrame): number {
    if (this.mobile || f.inGateway) return 0;
    let g = f.score.camLook;
    if (FLAGS.INTERIOR_PARALLAX) g += this.j4Window(f.vh);
    return g;
  }

  private j4Window(vh: number): number {
    const w = J4_PARALLAX;
    return smoothstep(w.inFrom, w.inTo, vh) * (1 - smoothstep(w.outFrom, w.outTo, vh));
  }

  /** Unit tangent of the base path at vh (central difference), or null on a flat stretch. */
  private pathTangent(vh: number, creep: number): THREE.Vector3 | null {
    const a = this.t1;
    const b = this.t2;
    const la = this.t3;
    this.rig.pose(Math.max(0, vh - 0.5), creep, a, la);
    this.rig.pose(vh + 0.5, creep, b, la);
    b.sub(a);
    const n = b.length();
    if (!(n > 1e-9)) return null;
    return b.multiplyScalar(1 / n);
  }

  private drag1(sp: Spring, k: number): void {
    if (k < 1) {
      sp.x *= k;
      sp.v *= k;
    }
    if (Math.abs(sp.x) < SNAP_X && Math.abs(sp.v) < SNAP_V) sp.reset();
  }

  private dragN(sp: SpringVec, k: number): void {
    if (k < 1) {
      for (let i = 0; i < sp.x.length; i++) {
        sp.x[i] *= k;
        sp.v[i] *= k;
      }
    }
    for (let i = 0; i < sp.x.length; i++) if (Math.abs(sp.x[i]) >= SNAP_X || Math.abs(sp.v[i]) >= SNAP_V) return;
    sp.reset();
  }

  private snap2(sp: SpringVec): void {
    // the parallax target follows the cursor (not 0 at rest): snap only a settled zero
    for (let i = 0; i < sp.x.length; i++) if (Math.abs(sp.x[i]) >= SNAP_X || Math.abs(sp.v[i]) >= SNAP_V) return;
    sp.reset();
  }

  private zeroSprings(): void {
    this.lean.reset();
    this.bank.reset();
    this.fovKick.reset();
    this.lookAhead.reset();
    this.parallax.reset();
    const o = this.out;
    o.lean.set(0, 0, 0);
    o.bank = 0;
    o.kick = 0;
    o.lax = 0;
    o.lay = 0;
    o.pax = 0;
    o.pay = 0;
    this.pvelN = 0;
    this.pvelS = 0;
    this.idle = 0;
  }

  private cutKinematics(): void {
    this.kinState = 0;
    this.kinDt = 0;
    this.acc.set(0, 0, 0);
  }

  /** Base pose (L1 + L2) at atVh on the scratch camera (sampleScreenPoints): no time layer. */
  poseScratch(cam: THREE.PerspectiveCamera, atVh: number, ss: FieldScoreState, w: number, h: number): void {
    // same viewport as the main camera: if this is the first to see a new aspect, it is still a cut
    if (this.rig.setAspect(w / h)) this.cutKinematics();
    const b = this.basePose(atVh, ss, this.scratchPose);
    cam.position.copy(b.pos);
    cam.up.copy(b.up);
    cam.lookAt(b.look);
    cam.fov = b.fov;
    cam.aspect = w / h;
    cam.near = CAMERA.near;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  resize(w?: number, h?: number): void {
    this.lastFov = -1;
    if (w && h && this.rig.setAspect(w / h)) this.cutKinematics();
  }

  /** playhead.jump / settle: zero lean / bank / kicks / look-ahead / parallax, re-seat the focus. */
  resetTimeLayer(): void {
    this.zeroSprings();
    this.cutKinematics();
    this.focusLive = false;
  }

  /** Dev / QA readout of the current time layer. */
  debug(): CamLayerDebug {
    const o = this.out;
    return {
      lean: [o.lean.x, o.lean.y, o.lean.z],
      bankDeg: o.bank,
      fovKickDeg: o.kick,
      lookAhead: [o.lax, o.lay],
      parallax: [o.pax, o.pay],
      drift: [this.drift.x, this.drift.y],
      sway: [this.sway.x, this.sway.y],
      rollDeg: this.rollDeg,
      focusD: this.focus.x,
      focusTarget: this.focusTarget,
      acc: [this.acc.x, this.acc.y, this.acc.z],
      pvelN: this.pvelN,
      idle: this.idle,
    };
  }

  dispose(): void {}
}
