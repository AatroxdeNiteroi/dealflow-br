/* ============================================================
   three/createField.ts — the field factory. Owner: WP-GL.

   WP0 seed: `LegacyFieldAdapter` wraps TODAY's PointField (untouched)
   behind the full FieldAdapter API (§7.9) so every package can
   develop against the contract before the rewrite lands:
   - no internal rAF: PointField's loop is cancelled; the clock calls
     update(vh, t, dt) then render() (one playhead, same frame as DOM);
   - camera = legacy setJourney/setUniverse, mapped from master vh;
   - score = beats.SCORE evaluated per frame (cinema/field/score.ts);
   - time layer (entryZ, fovGate) applied; shockR/ringBoost stored;
   - anchor/projection/isDarkAt/sampleScreenPoints from the legacy
     camera + visible sphere; addRipple stores events (no shader yet).
   Construction failure (no WebGL) → NullField (`ok: false`).
   ============================================================ */

import * as THREE from "three";
import { PointField, type CursorLabel as LegacyLabel } from "./PointField";
import { NullField } from "./NullField";
import { CAMERA, PACE, SP } from "../cinema/beats";
import { FLAGS } from "../cinema/flags";
import { clamp01, damp, dawnFrontPx, seeded } from "../cinema/geometry";
import { createScoreState, evaluateScore } from "../cinema/field/score";
import type {
  AnchorScreen,
  FieldAdapter,
  FieldFrameData,
  FieldScoreState,
  FieldTime,
  PauseReason,
  Rect,
  RippleEvent,
} from "../cinema/types";

export interface CreateFieldOptions {
  reduced: boolean;
}

export function createField(canvas: HTMLCanvasElement, opts: CreateFieldOptions): FieldAdapter {
  if (FLAGS.DEV_NO_WEBGL) return new NullField(opts);
  try {
    return new LegacyFieldAdapter(canvas, opts);
  } catch (err) {
    console.warn("[field] WebGL unavailable — using the CSS fallback", err);
    return new NullField(opts);
  }
}

/* ── legacy PointField internals (TS-private, plain JS fields) ── */
interface PFInternals {
  rafId: number;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sphere: THREE.Mesh;
  sphereMat: THREE.ShaderMaterial;
  basePositions: Float32Array;
  sweepAngle: number;
  journey: number;
  universe: number;
  vel: number;
  velTarget: number;
  fovThrob: number;
  fovThud: number;
  fovWiden: number;
  sweepBoost: number;
  mouse: THREE.Vector2;
  mouseTarget: THREE.Vector2;
  camLook: THREE.Vector3;
  cursorLabels: LegacyLabel[];
  sweepBearing: number;
  updateCharges(dt: number): void;
  applyJourney(p: number, t: number): void;
  applyUniverse(t: number): void;
  applyFov(): void;
  updateFrameUniforms(t: number): void;
  computeLabels(): void;
}

const TWO_PI = Math.PI * 2;
const SWEEP_SPEED = TWO_PI / 19; // PointField's sweep speed

// master vh → legacy journey p (0–1) and universe u (0–1)
const JOURNEY_KEYS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [220, 0.42], // dive done (J1)
  [360, 0.7], // mira done (R1)
  [368, 0.7],
  [465, 0.8], // crossing complete (contact)
  [657, 0.94], // interior holds the dark (R2)
  [673, 0.94],
  [770, 1], // cleared to paper (J5)
].map(([v, p]) => [v * PACE, p] as const);
const UNIVERSE_KEYS: ReadonlyArray<readonly [number, number]> = [
  [1568, 0],
  [1782, 0.8], // legacy applyUniverse saturates at 0.8
  [1900, 1],
].map(([v, u]) => [v * PACE, u] as const);

function piecewise(keys: ReadonlyArray<readonly [number, number]>, x: number): number {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [x0, y0] = keys[i];
    const [x1, y1] = keys[i + 1];
    if (x < x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return keys[keys.length - 1][1];
}

const SPV = new THREE.Vector3(SP[0], SP[1], SP[2]);

export class LegacyFieldAdapter implements FieldAdapter {
  readonly ok = true;
  readonly tier: 0 | 1 | 2 | 3;
  time: FieldTime = { entryZ: 0, shockR: -1, fovGate: 0, ringBoost: [0, 0, 0, 0] };
  readonly score: FieldScoreState = createScoreState();
  frameData: FieldFrameData;

  private pf: PointField;
  private pfi: PFInternals;
  private reduced: boolean;
  private paused = new Set<PauseReason>();
  private disposed = false;
  private vel = 0;
  private lastVh = 0;
  private lastT = 0;
  private ripples: RippleEvent[] = [];
  private anchor: AnchorScreen = { x: 0, y: 0, r: 0, visible: false, inside: false };
  private heroCam = new THREE.PerspectiveCamera(CAMERA.fovBase, 1, CAMERA.near, CAMERA.far);
  private v = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private onVisibility = () => this.setPaused("hidden", document.hidden);

  constructor(canvas: HTMLCanvasElement, opts: CreateFieldOptions) {
    this.reduced = opts.reduced;
    this.pf = new PointField(canvas, { reducedMotion: opts.reduced });
    this.pfi = this.pf as unknown as PFInternals;
    // one rAF owner: the gsap.ticker clock (PointField's own loop is cancelled)
    cancelAnimationFrame(this.pfi.rafId);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.tier = coarse || window.innerWidth <= 720 ? 2 : 0;
    this.frameData = { cursorLabels: this.pfi.cursorLabels, sweepBearing: 0, sweepFlash: null };
    this.syncHeroCam();
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  update(vh: number, t: number, dt: number): void {
    if (this.disposed || this.paused.size) return;
    const p = this.pfi;
    this.lastVh = vh;
    this.lastT = t;
    evaluateScore(vh, this.score);

    p.journey = piecewise(JOURNEY_KEYS, vh);
    p.universe = piecewise(UNIVERSE_KEYS, vh);
    // sweep reacts to scroll: angular speed × (1 + 1.6·vel)
    p.sweepAngle += dt * SWEEP_SPEED * (1 + 1.6 * this.vel);
    p.updateCharges(dt);
    p.mouse.x = damp(p.mouse.x, p.mouseTarget.x, 7, dt);
    p.mouse.y = damp(p.mouse.y, p.mouseTarget.y, 7, dt);

    this.applyCamera(t);

    p.vel = this.vel;
    p.velTarget = this.vel;
    if (p.sweepBoost > 0) p.sweepBoost = Math.max(0, p.sweepBoost - dt * 2.4);
    // FOV: 46 − throb + fovThud + fovGate + fovWiden + fovUniverse (one owner: applyFov)
    if (!(vh < CAMERA.throb.maxVh && p.cursorLabels.length === 0)) p.fovThrob = 0;
    p.fovThud = 0;
    p.fovWiden = this.score.fovThud + this.score.fovWiden + this.score.fovUniverse + this.time.fovGate;
    p.applyFov();
    p.updateFrameUniforms(t);
    p.camera.updateMatrixWorld();
    p.computeLabels();
    p.sweepBearing = (((p.sweepAngle % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI * 360;
    this.frameData.sweepBearing = p.sweepBearing;
    this.computeAnchor();
  }

  render(): void {
    if (this.disposed || this.paused.size) return;
    this.pfi.renderer.render(this.pfi.scene, this.pfi.camera);
  }

  setVelocity(v01: number): void {
    this.vel = clamp01(v01);
  }

  flare(): void {
    this.pf.pulse(1);
  }

  setMouse(nx: number, ny: number): void {
    this.pf.setMouse(nx, ny);
  }

  clearMouse(): void {
    this.pf.clearMouse();
  }

  resize(): void {
    if (this.disposed) return;
    this.pf.resize();
    this.syncHeroCam();
    // reduced motion: one static hero frame, re-rendered on resize (§7.1)
    if (this.reduced) this.pfi.renderer.render(this.pfi.scene, this.pfi.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.pf.dispose();
  }

  getAnchorScreen(): AnchorScreen {
    return this.anchor;
  }

  projectToScreen(x: number, y: number, z: number, heroPose = false): { x: number; y: number; visible: boolean } {
    const cam = heroPose ? this.heroCam : this.pfi.camera;
    this.v.set(x, y, z).project(cam);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const visible = this.v.z > -1 && this.v.z < 1 && Math.abs(this.v.x) <= 1 && Math.abs(this.v.y) <= 1;
    return {
      x: Math.round((this.v.x * 0.5 + 0.5) * w * 2) / 2,
      y: Math.round((-this.v.y * 0.5 + 0.5) * h * 2) / 2,
      visible,
    };
  }

  ringRadiusPx(worldR: number, heroPose = false): number {
    const c = this.projectToScreen(0, 0, -1, heroPose);
    const e = this.projectToScreen(worldR, 0, -1, heroPose);
    return Math.hypot(e.x - c.x, e.y - c.y);
  }

  sampleScreenPoints(n: number, seed: number, atVh: number, exclude?: Rect): Array<{ x: number; y: number }> {
    if (this.disposed || n <= 0) return [];
    const p = this.pfi;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // pose the legacy camera at atVh, sample, then restore the current pose
    p.journey = piecewise(JOURNEY_KEYS, atVh);
    p.universe = piecewise(UNIVERSE_KEYS, atVh);
    this.applyCamera(0, true);
    p.camera.updateMatrixWorld();

    const pos = p.basePositions;
    const count = pos.length / 3;
    const order = Array.from({ length: count }, (_, i) => i);
    const rnd = seeded(seed);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const out: Array<{ x: number; y: number }> = [];
    const margin = 24;
    let minD = Math.sqrt((w * h) / Math.max(1, n)) * 0.5;
    for (let pass = 0; pass < 3 && out.length < n; pass++) {
      for (const i of order) {
        if (out.length >= n) break;
        this.v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).project(p.camera);
        if (this.v.z <= -1 || this.v.z >= 1) continue;
        const x = (this.v.x * 0.5 + 0.5) * w;
        const y = (-this.v.y * 0.5 + 0.5) * h;
        if (x < margin || y < margin || x > w - margin || y > h - margin) continue;
        if (exclude && x > exclude.x && x < exclude.x + exclude.w && y > exclude.y && y < exclude.y + exclude.h) continue;
        if (out.some((q) => Math.hypot(q.x - x, q.y - y) < minD)) continue;
        out.push({ x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 });
      }
      minD *= 0.6;
    }

    // restore the live pose
    p.journey = piecewise(JOURNEY_KEYS, this.lastVh);
    p.universe = piecewise(UNIVERSE_KEYS, this.lastVh);
    this.applyCamera(this.lastT);
    p.camera.updateMatrixWorld();
    return out;
  }

  isDarkAt(x: number, y: number): boolean {
    const a = this.anchor;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (a.inside) {
      const dawn = this.score.dawn;
      if (dawn >= 1) return false;
      return Math.hypot(x - w / 2, y - h / 2) > dawnFrontPx(dawn, w, h);
    }
    if (this.score.lit >= 1 || !a.visible) return false;
    return Math.hypot(x - a.x, y - a.y) < a.r;
  }

  addRipple(e: RippleEvent): void {
    // WP-GL: uRings[6] in the point shader (§7.8). Stored so the API is complete.
    this.ripples.push(e);
  }

  setPaused(reason: PauseReason, on: boolean): void {
    if (on) this.paused.add(reason);
    else this.paused.delete(reason);
  }

  /* ── internals ─────────────────────────────────────────────── */

  /** Legacy camera for the current journey/universe + the time layer's entryZ. */
  private applyCamera(t: number, still = false): void {
    const p = this.pfi;
    p.applyJourney(p.journey, still ? 0 : t);
    p.applyUniverse(still ? 0 : t);
    // G1/G2 entry offset (time layer): the camera starts 3.5 further back
    if (!still && this.time.entryZ !== 0) {
      p.camera.position.z += this.time.entryZ;
      p.camera.lookAt(p.camLook);
    }
  }

  private computeAnchor(): void {
    const p = this.pfi;
    const cam = p.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const legacyR = p.sphere.scale.x;
    const opacity = Number(p.sphereMat.uniforms.uOpacity.value);
    // the visible legacy sphere while it shows; the design radius once it has cleared
    const R = opacity > 0.01 ? legacyR : this.score.sphereR;
    const d = cam.position.distanceTo(SPV);
    const inside = d < R;
    this.v.copy(SPV).project(cam);
    cam.getWorldDirection(this.fwd);
    const ahead = this.fwd.dot(this.tmp.copy(SPV).sub(cam.position)) > 0;
    const sx = (this.v.x * 0.5 + 0.5) * w;
    const sy = (-this.v.y * 0.5 + 0.5) * h;
    let r: number;
    if (inside) {
      r = Math.hypot(w, h) / 2;
    } else {
      const theta = Math.asin(Math.min(1, R / d));
      r = (Math.tan(theta) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) * (h / 2);
    }
    this.anchor = {
      x: Math.round(sx * 2) / 2,
      y: Math.round(sy * 2) / 2,
      r: Math.round(r * 2) / 2,
      visible: inside || (ahead && sx > -r && sx < w + r && sy > -r && sy < h + r && this.score.sphereVisible > 0),
      inside,
    };
  }

  private syncHeroCam(): void {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const c = this.heroCam;
    c.aspect = w / h;
    c.fov = CAMERA.fovBase;
    c.position.set(CAMERA.in.points[0][0], CAMERA.in.points[0][1], CAMERA.in.points[0][2]);
    c.lookAt(CAMERA.in.look[0][0], CAMERA.in.look[0][1], CAMERA.in.look[0][2]);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }
}
