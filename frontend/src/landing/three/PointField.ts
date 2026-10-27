/* ============================================================
   three/PointField.ts — the WebGL field engine (§7). Owner: WP-GL.

   ONE playhead: no internal rAF. The cinema clock (gsap.ticker)
   calls update(vh, t, dt) — score, camera, uniforms, anchor, labels
   for that exact master time — then the DOM writers run, then
   render(). WebGL and DOM always show the same moment, and every
   scroll-driven value is a pure function of vh (exact reversal).

   Two state layers (§7.1):
   - the SCORE (cinema/field/score.ts): pure f(vh) from beats.SCORE;
   - the TIME layer `time = { entryZ, shockR, fovGate, ringBoost[4] }`,
     written only by the Gateway tweens and by settle.
   Time-based ambience stays: sweep rotation (× 1 + 1.6·vel),
   heartbeat, embers, camera breath, flare decay, sweep-flash picks.

   Scene (draw order): sphere exterior (opaque) → interior (BackSide,
   depth-writing, dawn hole) → atmosphere → instrument lines → base
   points → dust → sweep → embers. Points depth-test against the
   opaque sphere: in front they overlap it, behind they are hidden.
   ≤ 9 draw calls at any time.

   Reduced motion: one static hero frame (vh 0, entryZ 0, motion 0,
   the frozen charge wedge of today), re-rendered on resize.
   ============================================================ */

import * as THREE from "three";
import { CAMERA, PACE, RIPPLES, SCORE, SP as SP_T, SPHERE_R } from "../cinema/beats";
import { FLAGS } from "../cinema/flags";
import { IS_DEV } from "../cinema/env";
import { clamp, damp, dawnFrontPx, seeded, smoothstep, smooth01 } from "../cinema/geometry";
import { createScoreState, evaluateScore } from "../cinema/field/score";
import { runtime } from "../cinema/runtime";
import type {
  AnchorScreen,
  CursorLabel,
  FieldAdapter,
  FieldFrameData,
  FieldScoreState,
  FieldTime,
  PauseReason,
  Rect,
  RippleEvent,
} from "../cinema/types";
import { CameraRig, breathOffset } from "./camera";
import {
  CHARGE_SPAN,
  COLS,
  FIELD_H,
  FIELD_SEED,
  FIELD_W,
  LINEAR,
  MOUSE_RADIUS,
  ROWS,
  SP_EXCLUDE,
  SRGB,
  SWEEP_SPEED,
  SWEEP_START,
  TOTAL_POINTS,
  TRAIL,
  TWO_PI,
} from "./constants";
import { buildDust } from "./dust";
import { buildEmbers } from "./embers";
import { Governor, type TierSpec } from "./governor";
import { buildInstrument, type Instrument } from "./instrument";
import { LabelPicker } from "./labels";
import { MAX_RINGS, RippleTable } from "./ripples";
import { POINT_FRAG, POINT_VERT } from "./shaders/points";
import { ATMO_FRAG, EXTERIOR_FRAG, INTERIOR_FRAG, SPHERE_VERT } from "./shaders/sphere";

export interface PointFieldOptions {
  reduced: boolean;
}

/* the J3 crossing: below this gap to the membrane the near plane follows the
   surface (no clipped hole) and the interior starts covering (seamless contact) */
const CONTACT_BAND = 0.25;
const INTERIOR_LEAD = 0.02;
const NEAR_INSIDE = 0.02;
const NEAR_MIN = 0.004;
/** The exterior converges to the interior dome over this gap (world). */
const NEAR_BLEND = 0.5;
const LABEL_TARGET_FROM = 220 * PACE;
const FLASH_EVERY = 0.4;
const FLASH_WINDOW = 0.08;

const ORD = { interior: 1, atmo: 2, lines: 3, points: 4, dust: 5, sweep: 6, embers: 7, film: 8 } as const;
/** C4a: gap to the membrane over which the lit body thickens from film to solid
 *  (≈ where its silhouette reaches the screen corners at 16:10). */
const MEMBRANE_FILM = 0.2;

const SPV = new THREE.Vector3(SP_T[0], SP_T[1], SP_T[2]);

type U = { value: unknown };
const u = <T>(value: T) => ({ value });

export class PointField implements FieldAdapter {
  readonly ok = true;
  time: FieldTime = { entryZ: 0, shockR: -1, fovGate: 0, ringBoost: [0, 0, 0, 0] };
  readonly score: FieldScoreState = createScoreState();
  frameData: FieldFrameData = { cursorLabels: [], sweepBearing: 0, sweepFlash: null };

  private readonly canvas: HTMLCanvasElement;
  private readonly reduced: boolean;
  private readonly motion: 0 | 1;
  private readonly mobile: boolean;
  private readonly gov: Governor;
  private spec: TierSpec;
  private dpr: number;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly heroCam: THREE.PerspectiveCamera;
  private readonly scratchCam: THREE.PerspectiveCamera;
  private readonly scratchScore: FieldScoreState = createScoreState();
  private readonly rig = new CameraRig();

  // layers
  private basePositions!: Float32Array;
  private baseValues!: Float32Array;
  private baseAngles!: Float32Array;
  private baseCount = 0;
  private readonly pu: Record<string, U>;
  private readonly pointMat: THREE.ShaderMaterial;
  private dustMat: THREE.ShaderMaterial | null = null;
  private dust: THREE.Points | null = null;
  private dustBuilt = 0;
  private embers: THREE.Points;
  private embersBuilt: number;
  private readonly inst: Instrument;
  private readonly dome: Record<string, U>;
  private readonly exterior: THREE.Mesh;
  private readonly extMat: THREE.ShaderMaterial;
  private readonly interior: THREE.Mesh;
  private readonly intMat: THREE.ShaderMaterial;
  private readonly atmo: THREE.Mesh;
  private readonly atmoMat: THREE.ShaderMaterial;
  private readonly ripples = new RippleTable();
  private readonly rings = new Float32Array(MAX_RINGS * 4);
  private labels!: LabelPicker;

  // time-based state
  private vel = 0;
  private sweepAngle = SWEEP_START;
  private sweepBoost = 0;
  private beatPhase = 0;
  private beat = 0;
  private lub = 0;
  private pulse = 0;
  private pulseT = -1e3;
  private readonly mouse = new THREE.Vector2(-10, -10);
  private readonly mouseTarget = new THREE.Vector2(-10, -10);
  private camVel = 0;
  private readonly prevPos = new THREE.Vector3();
  private hasPrev = false;
  private lastT = 0;

  // frame geometry
  private w = 1;
  private h = 1;
  private readonly buf = new THREE.Vector2(1, 1);
  private anchor: AnchorScreen = { x: 0, y: 0, r: 0, visible: false, inside: false };
  private anchorRaw = { x: 0, y: 0, r: 0 };
  private gateDark = 0;
  private lastFov = -1;
  private lastNear = -1;
  private sizedDpr = 0;

  // sweep-flash (C4c)
  private flashIdx = -1;
  private nextFlashT = 0;
  private flashSeq = 0;
  private readonly flash: CursorLabel = { x: 0, y: 0, value: 0, strength: 1, i: -1 };

  private readonly paused = new Set<PauseReason>();
  private disposed = false;
  private lastRenderAt = 0;

  private readonly P = new THREE.Vector3();
  private readonly L = new THREE.Vector3();
  private readonly B = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly onVisibility = () => this.setPaused("hidden", document.hidden);

  constructor(canvas: HTMLCanvasElement, opts: PointFieldOptions) {
    this.canvas = canvas;
    this.reduced = !!opts.reduced;
    this.motion = this.reduced ? 0 : 1;
    this.mobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 720;
    this.gov = new Governor(this.mobile);
    this.spec = this.gov.spec();
    this.dpr = this.spec.dpr;

    let shaderFailed = false;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.dpr < 1.5,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.debug.onShaderError = (gl, program, vs, fs) => {
      shaderFailed = true;
      console.error("[field] shader error", gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
    };
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fovBase, 1, CAMERA.near, CAMERA.far);
    this.heroCam = this.camera.clone();
    this.scratchCam = this.camera.clone();

    /* ── base points (today's grid, fixed seed, SP cleared) ── */
    this.buildBase();
    this.pu = {
      uTime: u(0),
      uBeatPhase: u(0),
      uMouse: u(new THREE.Vector2(-10, -10)),
      uMouseR: u(MOUSE_RADIUS),
      uAspect: u(1),
      uPixelRatio: u(1),
      uSizeScale: u(45),
      uSizeCap: u(64),
      uSoft: u(0),
      uFocus: u(0),
      uSweepAngle: u(SWEEP_START),
      uChargeSpan: u(this.reduced ? TRAIL : CHARGE_SPAN),
      uChargeGain: u(1),
      uPulse: u(0),
      uPulseT: u(-1e3),
      uShockR: u(-1),
      uWarp: u(0),
      uViewport: u(new THREE.Vector2(1, 1)),
      uRings: u(this.rings),
      uSP: u(SPV.clone()),
      uWave: u(0),
      uWaveGain: u(0),
      uBaseWave: u(0),
      uInk: u(LINEAR.ink()),
      uInkDeep: u(LINEAR.inkDeep()),
      uGold: u(LINEAR.gold()),
      uOpacity: u(1),
      uDive: u(0),
    };
    this.pointMat = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      uniforms: this.pu,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.basePositions, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.baseSizes, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(this.baseSeeds, 1));
    g.setAttribute("aAngle", new THREE.BufferAttribute(this.baseAngles, 1));
    const base = new THREE.Points(g, this.pointMat);
    base.frustumCulled = false;
    base.renderOrder = ORD.points;
    this.scene.add(base);
    this.labels = new LabelPicker(this.basePositions, this.baseValues, this.baseAngles);

    /* ── dust (T0/T1 desktop only) ── */
    const dustN = this.dustCountFor(this.spec);
    if (dustN > 0) {
      this.dustMat = new THREE.ShaderMaterial({
        vertexShader: POINT_VERT,
        fragmentShader: POINT_FRAG,
        defines: { DUST: "" },
        uniforms: this.pu,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      });
      this.dust = buildDust(dustN, FIELD_SEED ^ 0x9e3779b9, this.dustMat);
      this.dust.renderOrder = ORD.dust;
      this.dust.visible = false;
      this.dustBuilt = dustN;
      this.scene.add(this.dust);
    }

    /* ── embers ── */
    this.embersBuilt = this.spec.embers;
    this.embers = buildEmbers(
      this.embersBuilt,
      FIELD_SEED ^ 0x51ed,
      SPHERE_R * 0.9,
      this.reduced,
      (canvas.clientWidth || window.innerWidth) / Math.max(1, canvas.clientHeight || window.innerHeight),
    );
    this.embers.renderOrder = ORD.embers;
    this.embers.visible = false;
    this.scene.add(this.embers);

    /* ── instrument ── */
    this.inst = buildInstrument(this.reduced);
    this.inst.lines.renderOrder = ORD.lines;
    this.inst.sweep.children.forEach((c) => (c.renderOrder = ORD.sweep));
    this.inst.sweep.renderOrder = ORD.sweep;
    this.scene.add(this.inst.lines, this.inst.sweep);

    /* ── the company sphere: exterior + interior (+ atmosphere) ── */
    const sphereGeo = new THREE.SphereGeometry(1, 96, 64);
    this.dome = {
      uRes: u(new THREE.Vector2(1, 1)),
      uDprD: u(1),
      uBeat: u(0),
      uRimIn: u(1),
      cDomeC: u(SRGB.domeCentre()),
      cDomeE: u(SRGB.domeEdge()),
      cGold: u(SRGB.gold()),
    };
    // "transparent" only so the C4a membrane film can blend; at uAlpha 1 it
    // draws first (renderOrder 0) and writes depth exactly like an opaque body
    this.extMat = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: EXTERIOR_FRAG,
      side: THREE.FrontSide,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      uniforms: {
        ...this.dome,
        uAlpha: u(1),
        uLit: u(0),
        uPulse: u(0),
        uTime: u(0),
        uMotion: u(this.motion),
        uGateDark: u(0),
        uNear: u(0),
        uPixelRatio: u(1),
        uAnchor: u(new THREE.Vector3()),
        uColB: u(LINEAR.sphereB()),
        uColL: u(LINEAR.sphereL()),
        uRim: u(LINEAR.sphereRim()),
        cLitA: u(SRGB.litA()),
        cLitB: u(SRGB.litB()),
      },
    });
    this.exterior = new THREE.Mesh(sphereGeo, this.extMat);
    this.exterior.position.copy(SPV);
    this.exterior.frustumCulled = false;
    this.exterior.renderOrder = 0;
    this.scene.add(this.exterior);

    this.intMat = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: INTERIOR_FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      uniforms: { ...this.dome, uFrontR: u(0), uPixelRatio: u(1) },
    });
    this.interior = new THREE.Mesh(sphereGeo, this.intMat);
    this.interior.position.copy(SPV);
    this.interior.frustumCulled = false;
    this.interior.renderOrder = ORD.interior;
    this.interior.visible = false;
    this.scene.add(this.interior);

    this.atmoMat = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: ATMO_FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      uniforms: {
        uRes: this.dome.uRes,
        uPixelRatio: u(1),
        uAnchor: u(new THREE.Vector3()),
        uGateDark: u(0),
        cInk: u(SRGB.ink()),
      },
    });
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), this.atmoMat);
    this.atmo.position.copy(SPV);
    this.atmo.frustumCulled = false;
    this.atmo.renderOrder = ORD.atmo;
    this.atmo.visible = false;
    this.scene.add(this.atmo);

    /* ── fixed ink ripples GL can place itself (§5 J2 lock, C4a membrane,
          ring-lock). The seal and the 18 C2a impacts are DOSSIER's. ── */
    const atAnchor = () => ({ x: this.anchorRaw.x, y: this.anchorRaw.y });
    this.ripples.add({ vh: RIPPLES.at.lock, at: atAnchor });
    this.ripples.add({ vh: RIPPLES.at.membrane, at: () => ({ x: this.w / 2, y: this.h / 2 }) });
    this.ripples.add({ vh: RIPPLES.at.ringLock, at: atAnchor });

    this.resize();

    // first frame now (also surfaces shader errors before anything depends on us)
    this.update(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
    if (shaderFailed) {
      this.dispose();
      throw new Error("[field] shader compilation failed");
    }

    document.addEventListener("visibilitychange", this.onVisibility);
    if (this.gov.forced) console.info(`[field] quality tier T${this.gov.tier} (pinned by ?cx-tier)`);
    if (IS_DEV) (window as unknown as { __cxField?: PointField }).__cxField = this;
  }

  get tier(): 0 | 1 | 2 | 3 {
    return this.gov.tier;
  }

  /* ── base layer ──────────────────────────────────────────── */

  private baseSizes!: Float32Array;
  private baseSeeds!: Float32Array;

  private buildBase(): void {
    const rnd = seeded(FIELD_SEED);
    const cellW = FIELD_W / COLS;
    const cellH = FIELD_H / ROWS;
    const ex = SPHERE_R * SP_EXCLUDE;
    const pos: number[] = [];
    const sizes: number[] = [];
    const seeds: number[] = [];
    const values: number[] = [];
    const angles: number[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = -FIELD_W / 2 + (col + 0.5) * cellW + (rnd() - 0.5) * cellW * 0.86;
        const y = -FIELD_H / 2 + (row + 0.5) * cellH + (rnd() - 0.5) * cellH * 0.86;
        const z = (rnd() * 2 - 1) * 4.0 - 2.0;
        const big = rnd();
        const seed = rnd();
        // nothing sits inside the company (§7.4)
        if (Math.hypot(x - SPV.x, y - SPV.y, z - SPV.z) < ex) continue;
        pos.push(x, y, z);
        angles.push(Math.atan2(y, x));
        sizes.push(1.05 + Math.pow(big, 2.0) * 2.25);
        seeds.push(seed);
        values.push(3 + Math.pow(big, 1.6) * 247);
      }
    }
    this.basePositions = new Float32Array(pos);
    this.baseSizes = new Float32Array(sizes);
    this.baseSeeds = new Float32Array(seeds);
    this.baseValues = new Float32Array(values);
    this.baseAngles = new Float32Array(angles);
    this.baseCount = angles.length;
  }

  private dustCountFor(spec: TierSpec): number {
    return spec.dust === "full" ? Math.max(0, TOTAL_POINTS - this.baseCount) : spec.dust;
  }

  /* ── per frame ───────────────────────────────────────────── */

  update(vh: number, t: number, dt: number): void {
    if (this.disposed) return;
    // the score is cheap and DOM consumers (e.g. CH1's dawn clip) read it
    evaluateScore(vh, this.score);
    if (this.paused.size) return;
    const s = this.score;
    const m = this.motion;
    this.lastT = t;

    /* heartbeat — integrated phase (rate stays 1/period forever) */
    const period = 1.15 + Math.sin(t * 0.2) * 0.05 * m;
    if (m) this.beatPhase += dt / period;
    const bp = this.beatPhase - Math.floor(this.beatPhase);
    const lub = Math.exp(-(((bp - 0.05) * 13) ** 2));
    const dub = Math.exp(-(((bp - 0.2) * 15) ** 2)) * 0.58;
    this.lub = lub;
    this.beat = Math.min(lub + dub, 1);

    /* sweep — reacts to scroll energy; flare decays with dt */
    this.sweepAngle += dt * SWEEP_SPEED * (1 + 1.6 * this.vel) * m;
    if (this.sweepAngle > 1e4) this.sweepAngle -= TWO_PI * Math.floor(this.sweepAngle / TWO_PI);
    if (this.sweepBoost > 0) this.sweepBoost = Math.max(0, this.sweepBoost - dt * 2.4);
    const sweepMod = ((this.sweepAngle % TWO_PI) + TWO_PI) % TWO_PI;

    /* mouse — λ 7 */
    if (this.mouseTarget.x < -5) this.mouse.copy(this.mouseTarget);
    else {
      this.mouse.x = damp(this.mouse.x, this.mouseTarget.x, 7, dt);
      this.mouse.y = damp(this.mouse.y, this.mouseTarget.y, 7, dt);
    }

    /* camera — path(vh) + creep, then the time layer (breath, entryZ) */
    const P = this.P;
    const L = this.L;
    this.rig.pose(vh, s.creep, P, L);
    breathOffset(t, s.breathHero * m, s.breathUni * m, this.B);
    P.add(this.B);
    P.z += this.time.entryZ;
    const cam = this.camera;
    cam.position.copy(P);
    cam.lookAt(L);

    /* sphere radius (log ramp) — and a 7 vh shrink to nothing before it hides */
    const hideAt = SCORE.sphereVisible.to;
    let R = s.sphereR;
    if (vh > hideAt - 7 * PACE) R *= 1 - smoothstep(hideAt - 7 * PACE, hideAt, vh);
    const sphereOn = s.sphereVisible > 0 && R > 1e-4;
    const d = P.distanceTo(SPV);
    const inside = sphereOn && d < R;

    /* FOV — single owner: 46 − throb + thud + gate + widen + universe */
    const labelsShown = this.frameData.cursorLabels.length > 0 && s.labelsGate > 0 && !this.inGateway();
    const throb = vh < CAMERA.throb.maxVh && !labelsShown ? this.beat * CAMERA.throb.amp * m : 0;
    const fov = CAMERA.fovBase - throb + s.fovThud + this.time.fovGate + s.fovWiden + s.fovUniverse;
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
    if (this.hasPrev && dt > 0) {
      const step = P.distanceTo(this.prevPos);
      this.camVel = damp(this.camVel, step > 2 ? 0 : step / dt, 10, dt);
    }
    this.prevPos.copy(P);
    this.hasPrev = true;

    /* anchor (valid for every DOM writer this frame) */
    this.computeAnchor(R, d, inside, sphereOn);
    const halfDiag = Math.hypot(this.w, this.h) / 2;
    this.gateDark = inside ? 1 : smoothstep(0.35, 0.8, this.anchorRaw.r / halfDiag);

    /* ── uniforms ── */
    const pu = this.pu;
    pu.uTime.value = t;
    pu.uBeatPhase.value = this.beatPhase;
    (pu.uMouse.value as THREE.Vector2).set(this.mouse.x * cam.aspect, this.mouse.y);
    pu.uSweepAngle.value = sweepMod;
    pu.uChargeGain.value = s.chargeGain;
    pu.uPulse.value = this.pulse;
    pu.uPulseT.value = this.pulseT;
    pu.uSoft.value = s.soft;
    pu.uDive.value = s.dive;
    pu.uOpacity.value = s.fieldOp;
    pu.uFocus.value = s.focus;
    pu.uShockR.value = this.time.shockR;
    pu.uWarp.value = this.spec.warp && s.warp > 0 ? clamp(this.camVel * 0.35, 0, 1.5) : 0;
    const dustOn = !!this.dust && this.dustDrawn() > 0;
    pu.uWave.value = s.dust;
    pu.uWaveGain.value = s.dustGain;
    pu.uBaseWave.value = dustOn ? 0 : 1;
    if (this.dust) this.dust.visible = dustOn && s.dust > 0 && s.dustGain > 0;

    if (FLAGS.RIPPLES) this.ripples.evaluate(vh, this.rings);
    else this.rings.fill(0);

    /* instrument */
    const inst = this.inst;
    inst.draw[0] = s.ring0;
    inst.draw[1] = s.ring1;
    inst.draw[2] = s.ring2;
    inst.draw[3] = s.ring3;
    inst.draw[4] = s.ticks;
    inst.draw[5] = s.cross;
    const rb = this.time.ringBoost;
    let anyBoost = 0;
    for (let i = 0; i < 4; i++) {
      inst.boost[i] = rb[i] > 0 ? rb[i] : 0;
      anyBoost += inst.boost[i];
    }
    inst.lines.visible = anyBoost > 0 || inst.draw.some((x) => x > 0);
    inst.sweep.rotation.z = this.sweepAngle;
    const su = inst.sweepMat.uniforms;
    su.uOpacity.value = s.sweepGain;
    su.uTime.value = t;
    su.uBoost.value = this.sweepBoost + this.vel * 0.8;
    inst.sweep.visible = s.sweepGain > 0;

    /* sphere */
    const dome = this.dome;
    dome.uBeat.value = this.beat * m;
    dome.uRimIn.value = s.rimIn;
    const ex = this.exterior;
    ex.visible = sphereOn;
    ex.scale.setScalar(Math.max(R, 1e-4));
    const eu = this.extMat.uniforms;
    const lit = s.lit >= 0.5;
    eu.uLit.value = lit ? 1 : 0;
    const approach = smooth01(Math.min(1, Math.max(0, vh / (300 * PACE))));
    const nearK = inside ? 1 : 1 - smoothstep(0, NEAR_BLEND, d - R);
    eu.uNear.value = nearK;
    eu.uPulse.value = (0.35 + this.beat * 0.5) * (0.45 + 0.55 * approach) * (1 - nearK);
    eu.uTime.value = t;
    eu.uGateDark.value = this.gateDark;
    (eu.uAnchor.value as THREE.Vector3).set(this.anchorRaw.x, this.anchorRaw.y, this.anchorRaw.r);
    // C4a: just outside the membrane the lit body is a film over the field
    // (drawn after the points), opaque and depth-writing once it is whole
    const film = lit && !inside ? smoothstep(0, MEMBRANE_FILM, d - R) : 1;
    eu.uAlpha.value = film;
    const filmOn = film < 0.999;
    this.extMat.depthWrite = !filmOn;
    ex.renderOrder = filmOn ? ORD.film : 0;

    const frontPx = s.dawn > 0 ? dawnFrontPx(s.dawn) * this.dpr : 0;
    this.interior.visible = sphereOn && s.dawn < 1 && (inside || d - R < INTERIOR_LEAD);
    this.interior.scale.setScalar(Math.max(R, 1e-4));
    this.intMat.uniforms.uFrontR.value = frontPx;

    this.atmo.visible = sphereOn && !inside && !lit && this.gateDark > 0.001;
    this.atmo.scale.setScalar(Math.max(R, 1e-4) * 1.07);
    const au = this.atmoMat.uniforms;
    au.uGateDark.value = this.gateDark;
    (au.uAnchor.value as THREE.Vector3).set(this.anchorRaw.x, this.anchorRaw.y, this.anchorRaw.r);

    /* embers — inside only, cut by the dawn front */
    const emb = this.embers.material as THREE.ShaderMaterial;
    const eK = inside && s.dawn < 1 ? s.embers : 0;
    emb.uniforms.uEmbers.value = eK;
    emb.uniforms.uTime.value = t;
    emb.uniforms.uBeatPhase.value = this.beatPhase;
    emb.uniforms.uLub.value = this.lub * m;
    emb.uniforms.uFrontR.value = frontPx;
    this.embers.visible = eK > 0;

    /* labels (radar mode, gate open, mouse on) + the C4c sweep-flash pick */
    this.updateLabels(vh, t, sweepMod);
    this.frameData.sweepBearing = (sweepMod / TWO_PI) * 360;
  }

  render(): void {
    if (this.disposed || this.paused.size) {
      this.lastRenderAt = 0;
      return;
    }
    this.renderer.render(this.scene, this.camera);
    const now = performance.now();
    if (this.lastRenderAt && this.gov.sample(now - this.lastRenderAt)) this.applyTier();
    this.lastRenderAt = now;
  }

  /* ── API ─────────────────────────────────────────────────── */

  setVelocity(v01: number): void {
    this.vel = v01 < 0 ? 0 : v01 > 1 ? 1 : v01;
  }

  flare(): void {
    if (this.reduced) return;
    if (this.sweepBoost < 3.2) this.sweepBoost = 3.2;
    // partial flash (see PULSE_LIFE in shaders/points.ts): the field glows
    // with the shock, the sweep's own charge stays the dominant pattern
    this.pulse = 0.6;
    this.pulseT = this.lastT;
  }

  setMouse(nx: number, ny: number): void {
    const wasOff = this.mouseTarget.x < -5;
    this.mouseTarget.set(nx, ny);
    if (wasOff) this.mouse.set(nx, ny); // enter: no slide in from the corner
  }

  clearMouse(): void {
    this.mouseTarget.set(-10, -10);
    this.mouse.set(-10, -10); // leave: no streak of resolved points on the way out
  }

  resize(): void {
    if (this.disposed) return;
    const w = this.canvas.clientWidth || window.innerWidth || 1;
    const h = this.canvas.clientHeight || window.innerHeight || 1;
    // ScrollTrigger refreshInit calls this often: re-assigning canvas.width
    // (even to the same value) clears the bitmap, so only touch it on change
    if (w === this.w && h === this.h && this.dpr === this.sizedDpr) return;
    const first = this.sizedDpr === 0;
    this.w = w;
    this.h = h;
    this.sizedDpr = this.dpr;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.renderer.getDrawingBufferSize(this.buf);
    const aspect = w / h;
    for (const c of [this.camera, this.heroCam, this.scratchCam]) {
      c.aspect = aspect;
      c.updateProjectionMatrix();
    }
    this.lastFov = -1;
    this.syncHeroCam();
    this.applyResolutionUniforms();
    if (this.reduced) this.renderStatic();
    else if (!first && !this.paused.size) {
      // the resized bitmap is blank: redraw this frame now, not on the next tick
      this.update(this.score.vh, this.lastT, 0);
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.ripples.clear();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (IS_DEV) {
      const w = window as unknown as { __cxField?: PointField };
      if (w.__cxField === this) delete w.__cxField;
    }
  }

  getAnchorScreen(): AnchorScreen {
    return this.anchor;
  }

  projectToScreen(x: number, y: number, z: number, heroPose = false): { x: number; y: number; visible: boolean } {
    const cam = heroPose ? this.heroCam : this.camera;
    this.v.set(x, y, z).project(cam);
    const visible = this.v.z > -1 && this.v.z < 1 && Math.abs(this.v.x) <= 1 && Math.abs(this.v.y) <= 1;
    return {
      x: Math.round((this.v.x * 0.5 + 0.5) * this.w * 2) / 2,
      y: Math.round((-this.v.y * 0.5 + 0.5) * this.h * 2) / 2,
      visible,
    };
  }

  ringRadiusPx(worldR: number, heroPose = false): number {
    const cam = heroPose ? this.heroCam : this.camera;
    const c = this.v.set(0, 0, -1).project(cam);
    const cx = c.x;
    const cy = c.y;
    const e = this.v.set(worldR, 0, -1).project(cam);
    return Math.hypot(((e.x - cx) * this.w) / 2, ((e.y - cy) * this.h) / 2);
  }

  sampleScreenPoints(n: number, seed: number, atVh: number, exclude?: Rect): Array<{ x: number; y: number }> {
    if (this.disposed || n <= 0) return [];
    // pose a scratch camera at atVh (path only: no breath, no entryZ, no throb)
    const ss = evaluateScore(atVh, this.scratchScore);
    const cam = this.scratchCam;
    this.rig.pose(atVh, ss.creep, this.P, this.L);
    cam.position.copy(this.P);
    cam.lookAt(this.L);
    cam.fov = CAMERA.fovBase + ss.fovThud + ss.fovWiden + ss.fovUniverse;
    cam.aspect = this.w / this.h;
    cam.near = CAMERA.near;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    const w = this.w;
    const h = this.h;
    const pos = this.basePositions;
    const count = this.baseCount;
    const order = new Int32Array(count);
    for (let i = 0; i < count; i++) order[i] = i;
    const rnd = seeded(seed);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    const out: Array<{ x: number; y: number }> = [];
    const margin = 24;
    let minD = Math.sqrt((w * h) / Math.max(1, n)) * 0.5;
    for (let pass = 0; pass < 4 && out.length < n; pass++) {
      for (let k = 0; k < count && out.length < n; k++) {
        const i = order[k];
        this.v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(cam.matrixWorldInverse);
        if (-this.v.z < 1.2) continue; // too close to the lens (near-faded)
        this.v.applyMatrix4(cam.projectionMatrix);
        if (this.v.z <= -1 || this.v.z >= 1) continue;
        const x = (this.v.x * 0.5 + 0.5) * w;
        const y = (-this.v.y * 0.5 + 0.5) * h;
        if (x < margin || y < margin || x > w - margin || y > h - margin) continue;
        if (exclude && x > exclude.x && x < exclude.x + exclude.w && y > exclude.y && y < exclude.y + exclude.h) continue;
        let clash = false;
        for (const q of out) {
          if ((q.x - x) * (q.x - x) + (q.y - y) * (q.y - y) < minD * minD) {
            clash = true;
            break;
          }
        }
        if (clash) continue;
        out.push({ x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 });
      }
      minD *= 0.6;
    }
    return out;
  }

  isDarkAt(x: number, y: number): boolean {
    const a = this.anchor;
    if (a.inside) {
      const dawn = this.score.dawn;
      if (dawn >= 1) return false;
      return Math.hypot(x - this.w / 2, y - this.h / 2) > dawnFrontPx(dawn);
    }
    if (this.score.lit >= 0.5 || !a.visible) return false;
    return Math.hypot(x - a.x, y - a.y) < a.r;
  }

  addRipple(e: RippleEvent): void {
    this.ripples.add(e);
  }

  setPaused(reason: PauseReason, on: boolean): void {
    if (on) this.paused.add(reason);
    else this.paused.delete(reason);
    if (this.paused.size) this.lastRenderAt = 0;
  }

  /* ── internals ───────────────────────────────────────────── */

  /** Gateway / entering: the emblem element exists (cursor labels are off there). */
  private inGateway(): boolean {
    try {
      return runtime.gateEl() !== null;
    } catch {
      return false;
    }
  }

  private computeAnchor(R: number, d: number, inside: boolean, sphereOn: boolean): void {
    const cam = this.camera;
    const w = this.w;
    const h = this.h;
    this.v.copy(SPV).applyMatrix4(cam.matrixWorldInverse);
    const ahead = this.v.z < 0;
    this.v.applyMatrix4(cam.projectionMatrix);
    const sx = (this.v.x * 0.5 + 0.5) * w;
    const sy = (-this.v.y * 0.5 + 0.5) * h;
    let r: number;
    if (inside) r = Math.hypot(w, h) / 2;
    else {
      const theta = Math.asin(Math.min(1, R / Math.max(d, 1e-6)));
      r = (Math.tan(theta) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) * (h / 2);
      // at the membrane tan → ∞: cap at a few screens (still "covers everything")
      const cap = Math.hypot(w, h) * 4;
      if (!Number.isFinite(r) || r > cap) r = cap;
    }
    this.anchorRaw.x = sx;
    this.anchorRaw.y = sy;
    this.anchorRaw.r = r;
    const visible =
      sphereOn && (inside || (ahead && sx > -r && sx < w + r && sy > -r && sy < h + r));
    this.anchor = {
      x: Math.round(sx * 2) / 2,
      y: Math.round(sy * 2) / 2,
      r: Math.round(r * 2) / 2,
      visible,
      inside,
    };
  }

  private updateLabels(vh: number, t: number, sweepMod: number): void {
    const s = this.score;
    const fd = this.frameData;
    const mouseOn = this.mouseTarget.x > -5;
    if (s.labelsGate > 0 && mouseOn && !this.inGateway()) {
      const camChanged = this.labels.sync(this.camera, this.w, this.h);
      const mx = (this.mouse.x * 0.5 + 0.5) * this.w;
      const my = (-this.mouse.y * 0.5 + 0.5) * this.h;
      const avoid = vh >= LABEL_TARGET_FROM && this.anchor.visible ? this.anchorRaw : null;
      this.labels.query(camChanged, mx, my, avoid, fd.cursorLabels);
    } else if (fd.cursorLabels.length) {
      this.labels.reset(fd.cursorLabels);
    }

    if (s.sweepFlash > 0) {
      this.labels.sync(this.camera, this.w, this.h);
      if (t >= this.nextFlashT || this.flashIdx < 0) {
        this.nextFlashT = t + FLASH_EVERY;
        const start = (this.flashSeq++ * 7919) % Math.max(1, this.baseCount);
        this.flashIdx = this.labels.pickBehindSweep(sweepMod, FLASH_WINDOW, 48, start);
      }
      const p = this.labels.screenOf(this.flashIdx);
      if (p) {
        const f = this.flash;
        f.x = Math.round((p.x + 13) * 2) / 2;
        f.y = Math.round((p.y - 11) * 2) / 2;
        f.value = this.labels.valueOf(this.flashIdx);
        f.strength = 1;
        f.i = this.flashIdx;
        fd.sweepFlash = f;
      } else fd.sweepFlash = null;
    } else {
      fd.sweepFlash = null;
      this.flashIdx = -1;
    }
  }

  private applyResolutionUniforms(): void {
    const pu = this.pu;
    pu.uAspect.value = this.w / this.h;
    pu.uPixelRatio.value = this.dpr;
    pu.uSizeCap.value = this.spec.spriteCap * this.dpr;
    (pu.uViewport.value as THREE.Vector2).set(this.w, this.h);
    (this.dome.uRes.value as THREE.Vector2).copy(this.buf);
    this.dome.uDprD.value = this.buf.x / this.w;
    this.extMat.uniforms.uPixelRatio.value = this.dpr;
    this.intMat.uniforms.uPixelRatio.value = this.dpr;
    this.atmoMat.uniforms.uPixelRatio.value = this.dpr;
    const em = (this.embers.material as THREE.ShaderMaterial).uniforms;
    em.uPixelRatio.value = this.dpr;
    (em.uRes.value as THREE.Vector2).copy(this.buf);
  }

  private dustDrawn(): number {
    if (!this.dust) return 0;
    const n = this.dust.geometry.drawRange.count;
    return n === Infinity ? this.dustBuilt : n;
  }

  /** Governor dropped a tier: DPR, dust and embers shrink; warp may switch off. */
  private applyTier(): void {
    this.spec = this.gov.spec();
    this.dpr = this.spec.dpr;
    if (this.dust) this.dust.geometry.setDrawRange(0, Math.min(this.dustBuilt, this.dustCountFor(this.spec)));
    this.embers.geometry.setDrawRange(0, Math.min(this.embersBuilt, this.spec.embers));
    this.resize();
  }

  private syncHeroCam(): void {
    const c = this.heroCam;
    const p0 = CAMERA.in.points[0];
    const l0 = CAMERA.in.look[0];
    c.position.set(p0[0], p0[1], p0[2]);
    c.lookAt(l0[0], l0[1], l0[2]);
    c.fov = CAMERA.fovBase;
    c.near = CAMERA.near;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }

  /** Reduced motion: the static hero frame (vh 0, entryZ 0, motion 0, frozen wedge). */
  private renderStatic(): void {
    if (this.disposed) return;
    const saved = this.time.entryZ;
    this.time.entryZ = 0;
    this.update(0, 0, 0);
    this.time.entryZ = saved;
    this.renderer.render(this.scene, this.camera);
  }
}
