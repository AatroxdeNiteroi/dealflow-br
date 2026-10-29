/* ============================================================
   three/PointField.ts — the WebGL field engine (§7). Orchestration only.

   v3 WP0 split (spec rev 3.1 §4.1): construction and per-frame code moved,
   behaviour-identical, into owner modules — the camera layer
   (field/camlayer.ts, WP4), beam + instrument (field/beam.ts, WP2), points
   (field/sonar.ts, WP3), dust lifecycle + tier hold (field/dustDriver.ts,
   WP3), labels (field/labelsDriver.ts, WP3), ripples
   (field/ripplesDriver.ts, WP3). What stays here: renderer, scene,
   resize, warm-up scheduling, heartbeat, anchor, the sphere / interior /
   atmosphere / embers (unchanged), sampleScreenPoints, pause, render and
   the driver calls. This file is FROZEN after WP0: every WP's done-when
   includes "PointField.ts diff = 0". New behaviour goes into a driver.

   ONE playhead: no internal rAF. The cinema clock (gsap.ticker)
   calls update(vh, t, dt) — score, camera, uniforms, anchor, labels
   for that exact master time — then the DOM writers run, then
   render(). WebGL and DOM always show the same moment, and every
   scroll-driven value is a pure function of vh (exact reversal).

   Per-frame call order (§4.1): score → heartbeat → camlayer.preUpdate →
   beam.preUpdate → camlayer.apply(camera) → anchor →
   labelsDriver.preUpdate → sonar.update → dustDriver.update →
   beam.update → sphere/interior/embers → ripplesDriver.update →
   labelsDriver.update. All drivers share one FieldFrame (field/frame.ts).

   Reduced motion: one static hero frame (vh 0, entryZ 0, motion 0,
   the frozen charge wedge of today), re-rendered on resize.
   ?cx-still (dev): t = dt = 0 from the clock, no flare, the cursor snaps.
   ============================================================ */

import * as THREE from "three";
import { CAMERA, PACE, SCORE, SP as SP_T, SPHERE_R } from "../cinema/beats";
import { FLAGS } from "../cinema/flags";
import { CX_STILL, IS_DEV } from "../cinema/env";
import { clamp, clamp01, damp, dawnFrontPx, seeded, smoothstep, smooth01 } from "../cinema/geometry";
import { createScoreState, evaluateScore } from "../cinema/field/score";
import { runtime } from "../cinema/runtime";
import type {
  AnchorScreen,
  EchoMark,
  FieldAdapter,
  FieldFrameData,
  FieldScoreState,
  FieldTime,
  LabelChipBox,
  PauseReason,
  Rect,
  RingScreen,
  RippleEvent,
} from "../cinema/types";
import { FIELD_SEED, LINEAR, SRGB } from "./constants";
import { buildEmbers } from "./embers";
import { Governor, type TierSpec } from "./governor";
import { GpuTimer } from "./gpuTimer";
import { ATMO_FRAG, EXTERIOR_FRAG, INTERIOR_FRAG, SPHERE_VERT } from "./shaders/sphere";
import { createFrame, ORD, type BaseField, type DriverInit, type FieldDriver, type FieldFrame, type FieldHost } from "./field/frame";
import { CamLayer } from "./field/camlayer";
import { BeamDriver, createBeamMeshes } from "./field/beam";
import { SonarDriver, createBaseGeometry, createExteriorUniforms, createPointMaterial, createPointUniforms } from "./field/sonar";
import { DustDriver } from "./field/dustDriver";
import { LabelsDriver } from "./field/labelsDriver";
import { RipplesDriver } from "./field/ripplesDriver";

export interface PointFieldOptions {
  reduced: boolean;
}

const INTERIOR_LEAD = 0.02;
/** The exterior converges to the interior dome over this gap (world). */
const NEAR_BLEND = 0.5;
/** C4a: gap to the membrane over which the lit body thickens from film to solid
 *  (≈ where its silhouette reaches the screen corners at 16:10). */
const MEMBRANE_FILM = 0.2;
/** v3 (§1.2): |playhead velocity| that normalises to pvelN = 1 (vh/s), and its damping. */
const PVEL_FULL = 120;
const PVEL_LAMBDA = 6;

const SPV = new THREE.Vector3(SP_T[0], SP_T[1], SP_T[2]);

type U = { value: unknown };
const u = <T>(value: T) => ({ value });

export class PointField implements FieldAdapter {
  readonly ok = true;
  time: FieldTime = { entryZ: 0, shockR: -1, fovGate: 0, ringBoost: [0, 0, 0, 0], lockPulse: 0 };
  readonly score: FieldScoreState = createScoreState();
  frameData: FieldFrameData = { cursorLabels: [], sweepBearing: 0, sweepFlash: null, echoes: [] as EchoMark[] };

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

  // layers
  private readonly base: BaseField;
  private readonly pu: Record<string, U>;
  private readonly pointMat: THREE.ShaderMaterial;
  /** QA PERF-1/5: lazy programs + dust are prepared off the critical path. */
  private warm: "idle" | "compiling" | "ready" | "done" = "idle";
  private readonly bornAt = performance.now();
  private readonly gpuT: GpuTimer;
  private readonly onGpu = (ms: number): void => this.gov.sampleGpu(ms);
  private embers: THREE.Points;
  private embersBuilt: number;
  private readonly dome: Record<string, U>;
  private readonly exterior: THREE.Mesh;
  private readonly extMat: THREE.ShaderMaterial;
  private readonly interior: THREE.Mesh;
  private readonly intMat: THREE.ShaderMaterial;
  private readonly atmo: THREE.Mesh;
  private readonly atmoMat: THREE.ShaderMaterial;

  // drivers (§4.1)
  private readonly frame: FieldFrame;
  private readonly cam = new CamLayer();
  private readonly beam: BeamDriver;
  private readonly sonar = new SonarDriver();
  private readonly dustDrv = new DustDriver();
  private readonly labelsDrv = new LabelsDriver();
  private readonly ripplesDrv = new RipplesDriver();
  private readonly drivers: FieldDriver[];

  // time-based state
  private beatPhase = 0;
  private beat = 0;
  private lub = 0;
  private lastT = 0;
  /** v3: raw playhead velocity (vh/s) from setPlayhead */
  private pvelRaw = 0;

  // frame geometry
  private w = 1;
  private h = 1;
  private readonly buf = new THREE.Vector2(1, 1);
  private anchor: AnchorScreen = { x: 0, y: 0, r: 0, visible: false, inside: false };
  private anchorRaw = { x: 0, y: 0, r: 0 };
  private gateDark = 0;
  private sizedDpr = 0;

  private readonly paused = new Set<PauseReason>();
  private disposed = false;
  private lastRenderAt = 0;

  private readonly v = new THREE.Vector3();
  private readonly onVisibility = () => this.setPaused("hidden", document.hidden);
  private readonly applyTierFn = (): void => this.applyTier();

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
    this.gpuT = new GpuTimer(this.renderer.getContext());

    this.camera = new THREE.PerspectiveCamera(CAMERA.fovBase, 1, CAMERA.near, CAMERA.far);
    this.heroCam = this.camera.clone();
    this.scratchCam = this.camera.clone();

    /* ── base points (today's grid, fixed seed, SP cleared) — field/sonar.ts factories ── */
    const baseG = createBaseGeometry();
    this.base = baseG.base;
    this.pu = createPointUniforms({ reduced: this.reduced });
    this.pointMat = createPointMaterial(this.pu);
    const points = new THREE.Points(baseG.geo, this.pointMat);
    points.frustumCulled = false;
    points.renderOrder = ORD.points;
    this.scene.add(points);

    /* ── dust (T0/T1 desktop only) — QA PERF-5: built after the gateway
          boot (warmUp), not inside the pre-paint commit; the dust driver
          keeps a safety net if nothing has built it by Cap. 3 ── */

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

    /* ── instrument (field/beam.ts factory; every non-null mesh joins the scene) ── */
    const meshes = createBeamMeshes(this.reduced);
    for (const o of [meshes.legacyLines, meshes.legacyWedge, meshes.ribbons, meshes.beam]) if (o) this.scene.add(o);
    this.beam = new BeamDriver(meshes);

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
      // QA D3: the interior frame glow is warm LIGHT (the core gold), not
      // the dark line gold — at low intensity over the brown dome that read olive
      cGlow: u(SRGB.goldCore()),
    };
    const extUniforms = createExteriorUniforms();
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
        ...extUniforms,
      },
    });
    this.exterior = new THREE.Mesh(sphereGeo, this.extMat);
    this.exterior.position.copy(SPV);
    this.exterior.frustumCulled = false;
    this.exterior.renderOrder = ORD.exterior;
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

    /* ── drivers (§4.1): one shared frame, init in call order ── */
    this.frame = createFrame(this.score, this.time, this.spec);
    const self = this;
    const host: FieldHost = {
      get w() {
        return self.w;
      },
      get h() {
        return self.h;
      },
      get dpr() {
        return self.dpr;
      },
      get spec() {
        return self.spec;
      },
      get disposed() {
        return self.disposed;
      },
      reduced: this.reduced,
      mobile: this.mobile,
    };
    const init: DriverInit = {
      renderer: this.renderer,
      scene: this.scene,
      ord: ORD,
      pu: this.pu,
      baseGeo: baseG.geo,
      base: this.base,
      points,
      extUniforms,
      camera: this.camera,
      scratchCam: this.scratchCam,
      frame: this.frame,
      frameData: this.frameData,
      host,
      gov: this.gov,
      gpuT: this.gpuT,
    };
    this.drivers = [this.cam, this.beam, this.labelsDrv, this.sonar, this.dustDrv, this.ripplesDrv];
    for (const d of this.drivers) d.init(init);

    this.resize();

    // first frame now (also surfaces shader errors before anything depends on us)
    this.update(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
    if (shaderFailed) {
      this.dispose();
      throw new Error("[field] shader compilation failed");
    }
    for (const d of this.drivers) d.afterFirstFrame?.();

    document.addEventListener("visibilitychange", this.onVisibility);
    if (this.gov.forced) console.info(`[field] quality tier T${this.gov.tier} (pinned by ?cx-tier)`);
    if (IS_DEV) (window as unknown as { __cxField?: PointField }).__cxField = this;
  }

  get tier(): 0 | 1 | 2 | 3 {
    return this.gov.tier;
  }

  /**
   * QA PERF-1 / PERF-5 / PERF-6 — after the gateway boot verdict (so its GPU
   * cost never feeds the 90-frame sample), or 2.5 s after construction:
   * build the dust, then pre-link EVERY program (interior, atmosphere,
   * embers, dust: hidden at boot, they used to link mid-scroll at J3 and
   * C4b with a 40–120 ms stall) with compileAsync (KHR_parallel_shader_
   * compile, non-blocking). Once linked, ONE frame draws all of them in a
   * 1×1 scissor right before the real draw (ANGLE builds its draw-time
   * state, the dust buffers upload), and the dust alone is GPU-timed to
   * pick its budget before C4b. Drivers then get their own warm-up hook
   * (v3 cost timing) inside the same scissor. Runs inside render(), so the
   * visible frame is always the full redraw that follows.
   */
  private warmUp(): void {
    if (this.warm === "done" || this.reduced) return;
    if (this.warm === "idle") {
      if (!this.gov.booted && performance.now() - this.bornAt < 2500) return;
      this.warm = "compiling";
      this.dustDrv.ensure();
      const ready = () => {
        if (!this.disposed) this.warm = "ready";
      };
      this.renderer.compileAsync(this.scene, this.camera).then(ready, ready);
      return;
    }
    if (this.warm !== "ready") return;
    this.warm = "done";
    const r = this.renderer;
    const lazy = [this.interior, this.atmo, this.embers, this.dustDrv.mesh].filter(Boolean) as THREE.Object3D[];
    const vis = lazy.map((o) => o.visible);
    lazy.forEach((o) => (o.visible = true));
    r.setScissorTest(true);
    r.setScissor(0, 0, 1, 1);
    r.render(this.scene, this.camera);
    const dust = this.dustDrv.mesh;
    if (dust) {
      const others = this.scene.children.filter((o) => o !== dust && o.visible);
      others.forEach((o) => (o.visible = false));
      const n = this.dustDrv.drawn();
      const q = this.gpuT.begin();
      if (q) {
        r.render(this.scene, this.camera);
        this.gpuT.end(q, (ms) => this.dustDrv.setBudget(ms, n));
      } else this.dustDrv.setBudget(NaN, n);
      others.forEach((o) => (o.visible = true));
    }
    for (const d of this.drivers) d.warmUp?.({ renderer: r, scene: this.scene, camera: this.camera, gpuT: this.gpuT });
    r.setScissor(0, 0, this.w, this.h);
    r.setScissorTest(false);
    lazy.forEach((o, i) => (o.visible = vis[i]));
  }

  /* ── per frame ───────────────────────────────────────────── */

  update(vh: number, t: number, dt: number): void {
    if (this.disposed) return;
    // the score is cheap and DOM consumers (e.g. CH1's dawn clip) read it
    evaluateScore(vh, this.score);
    if (this.paused.size) return;
    const s = this.score;
    const m = this.motion;
    const f = this.frame;
    this.lastT = t;
    f.vh = vh;
    f.t = t;
    f.dt = dt;
    f.motionV2 = m;
    f.motion = CX_STILL ? 0 : m;
    f.time = this.time;
    f.tier = this.spec;
    f.w = this.w;
    f.h = this.h;
    f.dpr = this.dpr;

    /* heartbeat — integrated phase (rate stays 1/period forever) */
    const period = 1.15 + Math.sin(t * 0.2) * 0.05 * m;
    if (m) this.beatPhase += dt / period;
    const bp = this.beatPhase - Math.floor(this.beatPhase);
    const lub = Math.exp(-(((bp - 0.05) * 13) ** 2));
    const dub = Math.exp(-(((bp - 0.2) * 15) ** 2)) * 0.58;
    this.lub = lub;
    this.beat = Math.min(lub + dub, 1);
    f.beatPhase = this.beatPhase;
    f.lub = this.lub;
    f.beat = this.beat;

    /* playhead velocity (v3, §1.2): 0 until the clock feeds setPlayhead (WP1) */
    if (FLAGS.DEBUG_PVEL) {
      f.pvel = FLAGS.DEBUG_PVEL * PVEL_FULL;
      f.pvelN = 1;
      f.pvelS = FLAGS.DEBUG_PVEL > 0 ? 1 : -1;
    } else {
      f.pvel = this.pvelRaw;
      f.pvelN = damp(f.pvelN, clamp01(Math.abs(this.pvelRaw) / PVEL_FULL), PVEL_LAMBDA, dt);
      f.pvelS = damp(f.pvelS, clamp(this.pvelRaw / PVEL_FULL, -1, 1), PVEL_LAMBDA, dt);
    }

    /* sphere radius (log ramp) — and a 7 vh shrink to nothing before it hides */
    const hideAt = SCORE.sphereVisible.to;
    let R = s.sphereR;
    if (vh > hideAt - 7 * PACE) R *= 1 - smoothstep(hideAt - 7 * PACE, hideAt, vh);
    const sphereOn = s.sphereVisible > 0 && R > 1e-4;
    f.sphere.R = R;
    f.sphere.on = sphereOn;
    f.inGateway = this.inGateway();
    f.labelsShown = this.frameData.cursorLabels.length > 0 && s.labelsGate > 0 && !f.inGateway;

    /* camera base pose → beam angle → camera (time layer, FOV, near, matrices) */
    this.cam.preUpdate(f);
    this.beam.preUpdate(f);
    this.cam.apply(this.camera, f);
    const d = f.sphere.d;
    const inside = f.sphere.inside;

    /* anchor (valid for every DOM writer this frame) */
    this.computeAnchor(R, d, inside, sphereOn);
    const halfDiag = Math.hypot(this.w, this.h) / 2;
    this.gateDark = inside ? 1 : smoothstep(0.35, 0.8, this.anchorRaw.r / halfDiag);
    f.anchor.x = this.anchorRaw.x;
    f.anchor.y = this.anchorRaw.y;
    f.anchor.r = this.anchorRaw.r;
    f.anchor.visible = this.anchor.visible;
    f.gateDark = this.gateDark;

    /* points, dust, instrument */
    this.labelsDrv.preUpdate(f);
    this.sonar.update(f);
    this.dustDrv.update(f);
    this.beam.update(f);

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
    ex.renderOrder = filmOn ? ORD.film : ORD.exterior;

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

    /* ripples, then labels (radar mode, gate open, mouse on) + the C4c sweep-flash pick */
    this.ripplesDrv.update(f);
    this.labelsDrv.update(f);
  }

  render(): void {
    if (this.disposed || this.paused.size) {
      this.lastRenderAt = 0;
      return;
    }
    this.gpuT.poll();
    this.warmUp();
    // QA PERF-6: a drop held back during the dust reveal lands once it is gone
    this.dustDrv.beforeRender(this.applyTierFn);
    const q = this.gpuT.begin();
    this.renderer.render(this.scene, this.camera);
    this.gpuT.end(q, this.onGpu);
    const now = performance.now();
    this.dustDrv.afterRender(this.lastRenderAt ? now - this.lastRenderAt : null, this.applyTierFn);
    this.lastRenderAt = now;
  }

  /* ── API ─────────────────────────────────────────────────── */

  setVelocity(v01: number): void {
    this.frame.vel = v01 < 0 ? 0 : v01 > 1 ? 1 : v01;
  }

  flare(): void {
    if (this.reduced || CX_STILL) return;
    this.beam.flare();
    // partial flash (see PULSE_LIFE in shaders/points.ts): the field glows
    // with the shock, the sweep's own charge stays the dominant pattern
    this.sonar.flare(this.lastT);
  }

  setMouse(nx: number, ny: number): void {
    this.sonar.setMouse(nx, ny);
  }

  clearMouse(): void {
    this.sonar.clearMouse();
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
    this.cam.resize();
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
    this.gpuT.dispose();
    for (const d of this.drivers) d.dispose();
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
    this.cam.poseScratch(cam, atVh, ss, this.w, this.h);

    const w = this.w;
    const h = this.h;
    const pos = this.base.positions;
    const count = this.base.count;
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
    this.ripplesDrv.add(e);
  }

  setPaused(reason: PauseReason, on: boolean): void {
    if (on) this.paused.add(reason);
    else this.paused.delete(reason);
    if (this.paused.size) this.lastRenderAt = 0;
  }

  /* ── v3 API (§8.2): delegating seams, behaviour-neutral until their owners land ── */

  ringScreen(i: number): RingScreen {
    return this.beam.ringScreen(i);
  }

  setPlayhead(v: number): void {
    this.pvelRaw = Number.isFinite(v) ? v : 0;
  }

  resetTimeLayer(): void {
    this.frame.pvelN = 0;
    this.frame.pvelS = 0;
    for (const d of this.drivers) d.resetTimeLayer?.();
  }

  setTextMask(i: number, rect: Rect | null): void {
    if (!(i >= 0 && i < 4)) return;
    const m = this.frame.textMask;
    const o = (i | 0) * 4;
    m[o] = rect ? rect.x : 0;
    m[o + 1] = rect ? rect.y : 0;
    m[o + 2] = rect ? Math.max(0, rect.w) : 0;
    m[o + 3] = rect ? Math.max(0, rect.h) : 0;
  }

  setLabelChip(box: LabelChipBox): void {
    this.frame.labelChip = { wFull: box.wFull, wRedacted: box.wRedacted, h: box.h, gap: box.gap };
  }

  setPinned(indices: readonly number[]): void {
    this.labelsDrv.setPinned(indices);
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

  private applyResolutionUniforms(): void {
    for (const d of this.drivers) d.resize?.(this.w, this.h, this.dpr);
    (this.dome.uRes.value as THREE.Vector2).copy(this.buf);
    this.dome.uDprD.value = this.buf.x / this.w;
    this.extMat.uniforms.uPixelRatio.value = this.dpr;
    this.intMat.uniforms.uPixelRatio.value = this.dpr;
    this.atmoMat.uniforms.uPixelRatio.value = this.dpr;
    const em = (this.embers.material as THREE.ShaderMaterial).uniforms;
    em.uPixelRatio.value = this.dpr;
    (em.uRes.value as THREE.Vector2).copy(this.buf);
  }

  /** Governor dropped a tier: DPR, dust and embers shrink; warp may switch off. */
  private applyTier(): void {
    this.spec = this.gov.spec();
    this.dpr = this.spec.dpr;
    this.dustDrv.onTier(this.spec);
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
