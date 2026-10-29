/* ============================================================
   three/field/camlayer.ts — the camera layer (spec rev 3.1 §6.1, §4.1).
   Moved verbatim from PointField.update() by WP0 → owned by WP4.

   - preUpdate(f): the BASE pose f.base = path(vh) + creep (L1) and the
     score FOV channels (L2), no time layer. β_SP / ρ_SP (beam) are
     computed from it, so the hunt is a pure f(vh) once latched.
   - apply(cam, f): the time layer on top (v2: breath, entryZ, FOV throb +
     gate; v3, WP4: roll on camera.up, lean, bank, kicks, look-ahead,
     parallax, Ch2–Ch3 drift/sway), the near plane that hugs the membrane,
     the projection (1e-4° FOV hysteresis, v2) and updateMatrixWorld;
     writes f.cam, f.camVel, f.sphere.d / inside. The SAME apply is used
     for the scratch camera (sampleScreenPoints, label picker, anchor),
     so they see the identical matrix.
   - poseScratch(): the path-only pose sampleScreenPoints uses (v2).
   v3 gates (§6.1): no time-layer term over 352–1112 and 1552–1700, and
   every term is 0 at rest; resetTimeLayer() zeroes the springs.
   ============================================================ */

import * as THREE from "three";
import { CAMERA, SP as SP_T } from "../../cinema/beats";
import { clamp, damp } from "../../cinema/geometry";
import type { FieldScoreState } from "../../cinema/types";
import { CameraRig, breathOffset } from "../camera";
import type { DriverInit, FieldDriver, FieldFrame } from "./frame";

/* the J3 crossing: below this gap to the membrane the near plane follows the
   surface (no clipped hole) and the interior starts covering (seamless contact) */
export const CONTACT_BAND = 0.25;
const NEAR_INSIDE = 0.02;
const NEAR_MIN = 0.004;

const SPV = new THREE.Vector3(SP_T[0], SP_T[1], SP_T[2]);

export class CamLayer implements FieldDriver {
  readonly rig = new CameraRig();
  private readonly P = new THREE.Vector3();
  private readonly L = new THREE.Vector3();
  private readonly B = new THREE.Vector3();
  private camVel = 0;
  private readonly prevPos = new THREE.Vector3();
  private hasPrev = false;
  private lastFov = -1;
  private lastNear = -1;

  init(_k: DriverInit): void {}

  /** L1 + L2: the base pose (no time layer). */
  preUpdate(f: FieldFrame): void {
    const s = f.score;
    this.rig.pose(f.vh, s.creep, f.base.pos, f.base.look);
    f.base.up.set(0, 1, 0);
    f.base.fov = CAMERA.fovBase + s.fovThud + s.fovWiden + s.fovUniverse;
  }

  /** The main camera is posed by apply(); update() is part of the driver contract only. */
  update(_f: FieldFrame): void {}

  /** Time layer + projection on `cam` (main camera). */
  apply(cam: THREE.PerspectiveCamera, f: FieldFrame): void {
    const s = f.score;
    const m = f.motionV2;
    const vh = f.vh;

    /* camera — path(vh) + creep, then the time layer (breath, entryZ) */
    const P = this.P.copy(f.base.pos);
    const L = this.L.copy(f.base.look);
    breathOffset(f.t, s.breathHero * m, s.breathUni * m, this.B);
    P.add(this.B);
    P.z += f.time.entryZ;
    cam.position.copy(P);
    cam.lookAt(L);

    const sp = f.sphere;
    const R = sp.R;
    const sphereOn = sp.on;
    const d = P.distanceTo(SPV);
    const inside = sphereOn && d < R;
    sp.d = d;
    sp.inside = inside;

    /* FOV — single owner: 46 − throb + thud + gate + widen + universe */
    const throb = vh < CAMERA.throb.maxVh && !f.labelsShown ? f.beat * CAMERA.throb.amp * m : 0;
    const fov = CAMERA.fovBase - throb + s.fovThud + f.time.fovGate + s.fovWiden + s.fovUniverse;
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
  }

  /** Path-only pose at atVh (no breath, no entryZ, no throb): sampleScreenPoints. */
  poseScratch(cam: THREE.PerspectiveCamera, atVh: number, ss: FieldScoreState, w: number, h: number): void {
    this.rig.pose(atVh, ss.creep, this.P, this.L);
    cam.position.copy(this.P);
    cam.lookAt(this.L);
    cam.fov = CAMERA.fovBase + ss.fovThud + ss.fovWiden + ss.fovUniverse;
    cam.aspect = w / h;
    cam.near = CAMERA.near;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  resize(): void {
    this.lastFov = -1;
  }

  /** v3 (WP4): zero lean / bank / kicks / look-ahead / parallax / focus springs. */
  resetTimeLayer(): void {}

  dispose(): void {}
}
