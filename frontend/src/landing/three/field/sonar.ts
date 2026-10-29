/* ============================================================
   three/field/sonar.ts — points: factories + driver (spec rev 3.1
   §4.4–§4.9, §4.1). Owner: WP3.

   Factories (construction, called by PointField):
   - createBaseGeometry(): today's grid (fixed seed, SP cleared) + its CPU
     arrays; `aIndex` (the point index, for the pinned compares) and
     `aTag` (1–3 = decoy 0–2, 4 = echo source; 0 otherwise) from the
     deterministic build-time picks (three/sonar.ts), which travel with
     the geometry (`userData.sonarPicks`);
   - createPointUniforms(): the shared `pu` (base points AND dust): the
     v2 uniforms verbatim, plus every v3 uniform at its neutral value;
   - createPointMaterial(pu): the v2 point material (unchanged program);
   - createSonarPointMaterial(pu): the `#define SONAR` variant;
   - createExteriorUniforms(): uEchoRim, marbling, rim hold — zeroed.

   Driver (per frame, after the camera and the anchor):
   - v2: the cursor (damped λ 7; ?cx-still snaps), the v2 point uniforms;
   - the SONAR program is compiled asynchronously after the first v2
     frame (KHR_parallel_shader_compile; reduced motion: synchronously,
     its one static frame needs it) and, once linked, cross-fades in
     over 0.3 s. The points use it only while uSonar = max(sonar,
     sonarC4)·ready > 0 (the swap happens where every sonar term is 0:
     vh 400, 1690, 1885), so the v2 path never pays for it;
   - beam angle θ, spoon lag (WP2's frame fields), seek, glow τ;
   - the current: T += dt·(1 + 2·pvelN)·motion (wrapped exactly), phases
     reduced on the CPU, A = flowAmp·(1 + 0.6·pvelN)·tier scale;
   - echoes (three/sonar.ts): crests + frameData.echoes (echo and decoy
     chip requests for WP6, flowed positions), decoy flares/strikes;
   - capture, lens, DOF (uFocusD from WP4's focus spring; until it
     lands, the spring's target), the 5-node cursor wake (springs.ts),
     the text mask, gold pings, the sub-step ladder's uniform values
     (each ramped over 0.3 s: no pops);
   - the exterior skin (marbling × sonar), the target pre-signal
     (exp(−b_SP/0.3)·sonar) and the rim hold while seek > 0.85.
   Pinned beads (uPinned) are owned by labelsDriver.ts.
   Dev: window.__cxSonar (counters crestsLive / crestSources /
   pingsPerTurn / capInside, picks, state).
   ============================================================ */

import * as THREE from "three";
import { SP as SP_T, SPHERE_R } from "../../cinema/beats";
import { CX_STILL, IS_DEV } from "../../cinema/env";
import { FLAGS } from "../../cinema/flags";
import { clamp, damp, seeded, smoothstep } from "../../cinema/geometry";
import type { EchoMark, FieldFrameData } from "../../cinema/types";
import { CHARGE_SPAN, COLS, FIELD_H, FIELD_SEED, FIELD_W, LINEAR, MOUSE_RADIUS, ROWS, SP_EXCLUDE, SRGB, SWEEP_START, TRAIL } from "../constants";
import { flowAmplitude, flowOffsetPh, flowPhases, stepFlowT } from "../flow";
import { effectiveV3, type Governor, type V3Effective } from "../governor";
import { MAX_RINGS } from "../ripples";
import * as beamShaders from "../shaders/beam";
import { POINT_FRAG, POINT_VERT } from "../shaders/points";
import { DECOY, R_M, SonarEchoes, captureDistance, lowerBound, pickSonarSources, sortedBearings, spBearing, type CrestUpload, type SonarPicks } from "../sonar";
import { Spring, SPRINGS } from "../springs";
import type { BaseField, DriverInit, ExteriorUniforms, FieldDriver, FieldFrame, FieldHost, PointUniforms } from "./frame";

const SPV = new THREE.Vector3(SP_T[0], SP_T[1], SP_T[2]);
const u = <T>(value: T) => ({ value });
const TAU = Math.PI * 2;
const modTau = (a: number): number => {
  const r = a % TAU;
  return r < 0 ? r + TAU : r;
};

/** Salience knobs read from the WP0 table (shaders/beam.ts BEAM_KNOBS; tuned at the radar checkpoint,
 *  §10.1, in their listed order within their caps). Fallbacks = the spec's starting values. */
const KNOBS = (beamShaders as unknown as { BEAM_KNOBS?: Record<string, { value: number } | undefined> }).BEAM_KNOBS;
const knob = (name: string, d: number): number => {
  const v = KNOBS?.[name]?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : d;
};

/** Sub-step / tier changes ramp over this long (s), never pop. */
const RAMP_S = 0.3;
/** Wake: node speed (px/s) that reads as full strength; radius as a fraction of the cursor radius. */
const WAKE_FULL_PX_S = 1400;
const WAKE_RADIUS_K = 0.45;

/* ── factories ─────────────────────────────────────────────── */

/** Today's grid (fixed seed, SP cleared), its BufferGeometry and the v3 tags. */
export function createBaseGeometry(): { geo: THREE.BufferGeometry; base: BaseField } {
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
  const base: BaseField = {
    positions: new Float32Array(pos),
    sizes: new Float32Array(sizes),
    seeds: new Float32Array(seeds),
    values: new Float32Array(values),
    angles: new Float32Array(angles),
    count: angles.length,
  };
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(base.positions, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(base.sizes, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(base.seeds, 1));
  g.setAttribute("aAngle", new THREE.BufferAttribute(base.angles, 1));
  // v3: decoy (1–3) / echo-source (4) tags and the point index (pinned compares)
  const picks = pickSonarSources(base);
  const tag = new Float32Array(base.count);
  picks.echoes.forEach((i) => i >= 0 && (tag[i] = 4));
  picks.decoys.forEach((i, k) => i >= 0 && (tag[i] = k + 1));
  const index = new Float32Array(base.count);
  for (let i = 0; i < base.count; i++) index[i] = i;
  g.setAttribute("aTag", new THREE.BufferAttribute(tag, 1));
  g.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
  g.userData.sonarPicks = picks;
  return { geo: g, base };
}

/** The shared point uniforms: v2's set (verbatim) + the v3 ones at their neutral values. */
export function createPointUniforms(o: { reduced: boolean }): PointUniforms {
  const pinned = new Float32Array(8);
  pinned.fill(-1);
  return {
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
    uChargeSpan: u(o.reduced ? TRAIL : CHARGE_SPAN),
    uChargeGain: u(1),
    uPulse: u(0),
    uPulseT: u(-1e3),
    uShockR: u(-1),
    uWarp: u(0),
    uViewport: u(new THREE.Vector2(1, 1)),
    uRings: u(new Float32Array(MAX_RINGS * 4)),
    uSP: u(SPV.clone()),
    uWave: u(0),
    uWaveGain: u(0),
    uBaseWave: u(0),
    uInk: u(LINEAR.ink()),
    uInkDeep: u(LINEAR.inkDeep()),
    uGold: u(LINEAR.gold()),
    uOpacity: u(1),
    uDive: u(0),

    /* ── v3 (§4.4–§4.6); neutral = exactly v2 ── */
    /** max(sonar, sonarC4)·ready: every new term × this; 0 = exactly v2 */
    uSonar: u(0),
    /** the J1–J2 `sonar` channel·ready (echoes, capture, lens, decoys, wake) */
    uSonarJ: u(0),
    /** displayed beam angle θ and the spoon lag (rad) */
    uTheta: u(SWEEP_START),
    uLag: u(0),
    uSeek: u(0),
    uGlowTau: u(1.6),
    /** salience knobs: afterglow dark (0.85, cap 1.0), glow size (0.55, cap 0.8), ping alpha exponent (0.7, → 0.5) */
    uGlowDark: u(0.85),
    uGlowSize: u(0.55),
    uPingExp: u(0.7),
    /** 0 under reduced motion (no pings) */
    uPingOn: u(1),
    /** the beam's gain (sweepGain_v3): pings need a lead line — none once the locked beam fades (344–352) */
    uPingGain: u(1),
    /** gold ping threshold on aSize (top 9 %: 2.91; T2: 3.05); 1e9 = ink only */
    uPingGold: u(2.91),
    /** sub-step "gold pings → ink" ramp (1 → 0) */
    uPingGoldMix: u(1),
    /** brand gold and paper for the sonar path (SRGB family: displayed exactly) */
    uGoldS: u(SRGB.gold()),
    uPaperS: u(SRGB.litB()),
    /** echo crests: xyz centre (flowed source) + w radius, and amplitudes (× echoGate·sonar) */
    uEcho: u(Array.from({ length: 6 }, () => new THREE.Vector4())),
    uEchoA: u(new Float32Array(6)),
    /** the current: phases (0.9T, −0.7T + 1.7, 1.3T + 4.1) mod 2π, amplitude, third-wave weight */
    uFlowPhase: u(new THREE.Vector3()),
    uFlowAmp: u(0),
    uFlowW3: u(1),
    /** the hidden-universe grains' flow (T0 only) */
    uDustFlow: u(0),
    uCapture: u(0),
    uRm: u(R_M),
    uViewDir: u(new THREE.Vector3(0, 0, -1)),
    /** (anchor x, y, r CSS px, lens gain) and |cam − SP| */
    uLens: u(new THREE.Vector4()),
    uLensD: u(10),
    uDof: u(0),
    uFocusD: u(10),
    uCocMax: u(0),
    /** decoy flares decoy0..2 and their strike (grey to ink α 0.35) */
    uDecoy: u(new THREE.Vector3()),
    uDecoyR: u(new THREE.Vector3()),
    /** cursor wake chain: node xy (CSS px) + strength, and its velocity direction × strength */
    uWake: u(Array.from({ length: 5 }, () => new THREE.Vector3())),
    uWakeV: u(Array.from({ length: 5 }, () => new THREE.Vector2())),
    uWakeR: u(60),
    /** pinned point indices (−1 = empty); written by labelsDriver */
    uPinned: u(pinned),
    /** 4 text-mask rects (x, y, w, h) in CSS px, top-left origin; 0-area = unused */
    uTextMask: u(Array.from({ length: 4 }, () => new THREE.Vector4())),
    /** the cursor in CSS px and whether it is on */
    uMousePx: u(new THREE.Vector2(-1e4, -1e4)),
    uMouseOn: u(0),
    /** focal length in CSS px (wake displacement in world → px at the bead's depth) */
    uFocalPx: u(1000),
    /** hidden universe reveal (dust prefix, DUST_SONAR program) */
    uDustSonar: u(0),
  };
}

/** The v2 point material. */
export function createPointMaterial(pu: PointUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: pu,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
}

/** The v3 sonar variant of the point material (same uniforms object). */
export function createSonarPointMaterial(pu: PointUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    defines: { SONAR: "" },
    uniforms: pu,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
}

/** v3 exterior-sphere uniforms (§4.8), zeroed: spread into the exterior material by PointField. */
export function createExteriorUniforms(): ExteriorUniforms {
  return {
    /** target pre-signal: exp(−b_SP/0.3)·sonar */
    uEchoRim: u(0),
    /** the J1–J2 `sonar` channel (marbling ↔ v2 veins) */
    uSkinSonar: u(0),
    /** rim hold while seek > 0.85: (0.6 + 0.4·beat)·sonar */
    uRimHold: u(0),
  };
}

/** The focus spring's target (WP4 integrates it, §6.1 L7): mid-field (the hub) → |cam − SP| by focusSP. */
export function focusTarget(f: FieldFrame): number {
  const c = f.cam.pos;
  const mid = Math.hypot(c.x, c.y, c.z + 1);
  const dSP = f.sphere.d > 0 ? f.sphere.d : c.distanceTo(SPV);
  return mid + (dSP - mid) * f.score.focusSP;
}

/* ── driver ────────────────────────────────────────────────── */

type ProgramInfo = { getUniforms?: () => unknown; diagnostics?: { runnable?: boolean } };

export class SonarDriver implements FieldDriver {
  private pu!: PointUniforms;
  private camera!: THREE.PerspectiveCamera;
  private host!: FieldHost;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private points!: THREE.Points;
  private baseGeo!: THREE.BufferGeometry;
  private base!: BaseField;
  private frameData!: FieldFrameData;
  private gov!: Governor;
  private ext!: ExteriorUniforms;
  private v2Mat!: THREE.Material;
  private sonarMat!: THREE.ShaderMaterial;
  private echoes!: SonarEchoes;
  private picks!: SonarPicks;
  private readonly mouse = new THREE.Vector2(-10, -10);
  private readonly mouseTarget = new THREE.Vector2(-10, -10);
  private pulse = 0;
  private pulseT = -1e3;

  /* v3 state */
  private compiled: "no" | "pending" | "ok" | "failed" = "no";
  private readyA = 0;
  private flowT = 0;
  private readonly ph: [number, number, number] = [0, 0, 0];
  private readonly eff: V3Effective = { prefixScale: 1, textBlur: true, cocMax: 0, echoes: 6, pingGold: 1, flowScale: 1, wake: 0, camLean: 1 };
  private cocMax = -1;
  private flowScale = -1;
  private goldMix = -1;
  private wakeGain = 0;
  private readonly slotFade = new Float32Array(6).fill(1);
  private readonly crestUp: CrestUpload = { centres: [], amps: new Float32Array(6) };
  private readonly wx: Spring[] = [];
  private readonly wy: Spring[] = [];
  private wakeLive = false;
  private prevVh = NaN;
  private prevTheta = NaN;
  private readonly bearing = { beta: 0, rho: 0 };
  private readonly vp = new THREE.Matrix4();
  private readonly tm = new Float32Array(16).fill(-1);
  // dev counters
  private bearings: { phi: Float32Array; idx: Int32Array } | null = null;
  private lastStats = { capture: 0 };

  init(k: DriverInit): void {
    this.pu = k.pu;
    this.camera = k.camera;
    this.host = k.host;
    this.renderer = k.renderer;
    this.scene = k.scene;
    this.points = k.points;
    this.baseGeo = k.baseGeo;
    this.base = k.base;
    this.frameData = k.frameData;
    this.gov = k.gov;
    this.ext = k.extUniforms;
    this.v2Mat = k.points.material as THREE.Material;
    this.sonarMat = createSonarPointMaterial(this.pu);
    this.crestUp.centres = this.pu.uEcho.value as THREE.Vector4[];
    this.crestUp.amps = this.pu.uEchoA.value as Float32Array;
    this.picks = (k.baseGeo.userData.sonarPicks as SonarPicks | undefined) ?? pickSonarSources(k.base);
    this.echoes = new SonarEchoes(k.base, this.picks);
    for (const om of SPRINGS.wake.omegas) {
      this.wx.push(new Spring({ zeta: SPRINGS.wake.zeta, omega: om }));
      this.wy.push(new Spring({ zeta: SPRINGS.wake.zeta, omega: om }));
    }
    const pu = this.pu;
    pu.uGlowDark.value = knob("afterglowDark", 0.85);
    pu.uGlowSize.value = knob("glowSize", 0.55);
    pu.uPingExp.value = knob("pingAlphaExp", 0.7);
    pu.uPingOn.value = this.host.reduced ? 0 : 1;
    // reduced motion renders ONE static frame (in the constructor): its program must exist now
    if (FLAGS.SONAR && this.host.reduced) {
      this.compiled = "ok";
      this.readyA = 1;
    }
    if (IS_DEV) this.installDevHook();
  }

  /** After the first synchronous v2 frame: link the SONAR program in the background. */
  afterFirstFrame(): void {
    if (!FLAGS.SONAR || this.compiled !== "no" || this.host.disposed) return;
    this.compiled = "pending";
    const probe = new THREE.Points(this.baseGeo, this.sonarMat);
    probe.frustumCulled = false;
    this.renderer.compileAsync(probe, this.camera, this.scene).then(
      () => this.verifyProgram(),
      () => this.failProgram("compileAsync rejected"),
    );
  }

  private verifyProgram(): void {
    if (this.host.disposed) return;
    const props = (this.renderer.properties as unknown as { get(o: object): { currentProgram?: ProgramInfo } }).get(this.sonarMat);
    const prog = props?.currentProgram;
    if (!prog) return this.failProgram("no program");
    try {
      prog.getUniforms?.(); // runs three's link check now (onFirstUse), not mid-scroll
    } catch {
      return this.failProgram("link check threw");
    }
    if (prog.diagnostics && prog.diagnostics.runnable === false) return this.failProgram("link failed");
    this.compiled = "ok";
  }

  private failProgram(why: string): void {
    this.compiled = "failed";
    console.warn(`[field] sonar program unavailable (${why}): the v2 point path is kept`);
  }

  update(f: FieldFrame): void {
    const s = f.score;
    /* mouse — λ 7 (?cx-still: straight to the target) */
    if (this.mouseTarget.x < -5 || CX_STILL) this.mouse.copy(this.mouseTarget);
    else {
      this.mouse.x = damp(this.mouse.x, this.mouseTarget.x, 7, f.dt);
      this.mouse.y = damp(this.mouse.y, this.mouseTarget.y, 7, f.dt);
    }
    f.mouse.x = this.mouse.x;
    f.mouse.y = this.mouse.y;
    f.mouse.on = this.mouseTarget.x > -5;

    /* ── v2 uniforms ── */
    const pu = this.pu;
    const cam = this.camera;
    pu.uTime.value = f.t;
    pu.uBeatPhase.value = f.beatPhase;
    (pu.uMouse.value as THREE.Vector2).set(this.mouse.x * cam.aspect, this.mouse.y);
    pu.uSweepAngle.value = f.legacySweepMod;
    // radar r1: while the SONAR program links (boot), the v2 stand-in carries no gold charge where
    // the sonar will be (J1–J2): the first painted frames never flash v2's orange sector; once the
    // sonar has ramped in, the shader's (1 − uSonar) keeps that charge at 0 anyway. Elsewhere
    // (s.sonar = 0, e.g. the Ch5 backdrop) the v2 charge is untouched.
    const booting = FLAGS.SONAR && !this.host.reduced && this.compiled !== "failed" && this.readyA < 1;
    pu.uChargeGain.value = booting ? s.chargeGain * (1 - s.sonar) : s.chargeGain;
    pu.uPulse.value = this.pulse;
    pu.uPulseT.value = this.pulseT;
    pu.uSoft.value = s.soft;
    pu.uDive.value = s.dive;
    pu.uOpacity.value = s.fieldOp;
    pu.uFocus.value = s.focus;
    pu.uShockR.value = f.time.shockR;
    pu.uWarp.value = f.tier.warp && s.warp > 0 ? clamp(f.camVel * 0.35, 0, 1.5) : 0;

    /* ── v3: the sonar path ── */
    const reduced = this.host.reduced;
    const still = CX_STILL || !(f.dt > 0);
    const dt = still ? 0 : f.dt;
    if (this.compiled === "ok") this.readyA = still ? 1 : Math.min(1, this.readyA + dt / RAMP_S);
    const ready = FLAGS.SONAR && this.compiled === "ok" ? this.readyA : 0;
    const sonarJ = s.sonar * ready;
    const sonarAll = Math.max(s.sonar, s.sonarC4) * ready;
    const useSonar = sonarAll > 0;
    const mat = useSonar ? this.sonarMat : this.v2Mat;
    if (this.points.material !== mat) this.points.material = mat;
    pu.uSonar.value = sonarAll;
    pu.uSonarJ.value = sonarJ;

    effectiveV3(f.tier, this.gov.sub.ticks, this.eff);
    const k = still ? 1 : 1 - Math.exp(-dt / (RAMP_S / 3)); // ≈ 0.3 s to settle
    this.cocMax = this.cocMax < 0 || still ? this.eff.cocMax : this.cocMax + (this.eff.cocMax - this.cocMax) * k;
    this.flowScale = this.flowScale < 0 || still ? this.eff.flowScale : this.flowScale + (this.eff.flowScale - this.flowScale) * k;
    this.goldMix = this.goldMix < 0 || still ? this.eff.pingGold : this.goldMix + (this.eff.pingGold - this.goldMix) * k;

    /* the beam (WP2 writes θ / lag / β_SP / ρ_SP in beam.preUpdate) */
    pu.uTheta.value = f.theta;
    pu.uLag.value = f.lag;
    pu.uSeek.value = s.seek;
    pu.uGlowTau.value = s.glowTau;
    let betaSP = f.betaSP;
    let rhoSP = f.rhoSP;
    if (!(rhoSP > 0)) {
      spBearing(f.base.pos.x, f.base.pos.y, f.base.pos.z, this.bearing);
      betaSP = this.bearing.beta;
      rhoSP = this.bearing.rho;
    }

    /* the current */
    this.flowT = stepFlowT(this.flowT, f.dt, f.pvelN, f.motion);
    f.flowT = this.flowT;
    flowPhases(this.flowT, this.ph);
    (pu.uFlowPhase.value as THREE.Vector3).set(this.ph[0], this.ph[1], this.ph[2]);
    const A = useSonar && !reduced ? flowAmplitude(s.flowAmp, f.pvelN) * this.flowScale * ready : 0;
    const w3 = f.tier.flowWaves === 2 ? 0 : 1;
    pu.uFlowAmp.value = A;
    pu.uFlowW3.value = w3;

    /* afterglow + pings */
    pu.uPingGold.value = Number.isFinite(f.tier.pingGold) ? f.tier.pingGold : 1e9;
    pu.uPingGoldMix.value = this.goldMix;
    pu.uPingGain.value = s.sweepGain_v3;

    /* echoes: crests (+ the slots a sub-step removes fade out over 0.3 s) */
    const echoGate = useSonar && !reduced ? s.echoGate * sonarJ : 0;
    for (let i = 0; i < 6; i++) {
      const want = i < this.eff.echoes ? 1 : 0;
      this.slotFade[i] = still ? want : this.slotFade[i] + (want - this.slotFade[i]) * k;
    }
    // the camera the frame draws with (three uploads it as `cameraPosition`)
    this.echoes.crests(f.theta, f.lag, this.camera.position, 6, echoGate, this.slotFade, this.ph, A, w3, this.crestUp);

    /* frameData.echoes: echo + decoy chip requests (flowed screen positions) */
    const jump = (Number.isFinite(this.prevVh) && Math.abs(f.vh - this.prevVh) > 24) || (Number.isFinite(this.prevTheta) && dt > 0 && Math.abs(modTau(f.theta - this.prevTheta + Math.PI) - Math.PI) > 1.2);
    this.prevVh = f.vh;
    this.prevTheta = f.theta;
    const marksOn = useSonar && !reduced && sonarJ > 0;
    this.prepareProjector();
    this.echoes.marks(
      f.vh,
      f.t,
      marksOn && FLAGS.ECHO_CHIPS && echoGate > 0,
      marksOn && FLAGS.DECOY_CHIPS,
      jump,
      this.ph,
      A,
      w3,
      this.project,
      this.frameData.echoes as EchoMark[],
    );

    /* decoys: flare (gauss, pure f(vh)) then struck (grey to ink α 0.35) */
    const dj = useSonar ? sonarJ : 0;
    (pu.uDecoy.value as THREE.Vector3).set(s.decoy0 * dj, s.decoy1 * dj, s.decoy2 * dj);
    (pu.uDecoyR.value as THREE.Vector3).set(
      smoothstep(DECOY.peaks[0], DECOY.peaks[0] + DECOY.rejectSpan, f.vh) * dj,
      smoothstep(DECOY.peaks[1], DECOY.peaks[1] + DECOY.rejectSpan, f.vh) * dj,
      smoothstep(DECOY.peaks[2], DECOY.peaks[2] + DECOY.rejectSpan, f.vh) * dj,
    );

    /* capture + lens (J1–J2 only) */
    pu.uCapture.value = useSonar ? s.capture * sonarJ : 0;
    (pu.uViewDir.value as THREE.Vector3).copy(SPV).sub(f.cam.pos).normalize();
    const lens = useSonar && f.anchor.visible ? s.lens * sonarJ : 0;
    (pu.uLens.value as THREE.Vector4).set(f.anchor.x, f.anchor.y, f.anchor.r, lens);
    pu.uLensD.value = f.sphere.d > 0 ? f.sphere.d : f.cam.pos.distanceTo(SPV);

    /* depth of field (focus spring: WP4; its target until WP4 lands) */
    pu.uDof.value = useSonar ? s.dof * sonarAll : 0;
    pu.uFocusD.value = f.focusD > 0 ? f.focusD : focusTarget(f);
    pu.uCocMax.value = this.cocMax;

    /* cursor: px position, the dimple and the wake chain */
    const w = this.host.w;
    const h = this.host.h;
    const mOn = f.mouse.on && !reduced;
    (pu.uMousePx.value as THREE.Vector2).set((this.mouse.x * 0.5 + 0.5) * w, (-this.mouse.y * 0.5 + 0.5) * h);
    pu.uMouseOn.value = mOn ? 1 : 0;
    const fovR = THREE.MathUtils.degToRad(cam.fov) / 2;
    pu.uFocalPx.value = h / 2 / Math.max(1e-3, Math.tan(fovR));
    this.stepWake(f, dt, still, mOn && useSonar ? sonarJ : 0, w, h);

    /* text mask (CSS px rects, written on change) */
    const src = f.textMask;
    const tm = this.tm;
    let changed = false;
    for (let i = 0; i < 16; i++) {
      if (tm[i] !== src[i]) {
        tm[i] = src[i];
        changed = true;
      }
    }
    if (changed) {
      const rects = pu.uTextMask.value as THREE.Vector4[];
      for (let i = 0; i < 4; i++) rects[i].set(tm[i * 4], tm[i * 4 + 1], tm[i * 4 + 2], tm[i * 4 + 3]);
    }

    /* the sphere exterior (J1–J2 only; v2 from vh 400 on and in Ch4) */
    const skin = FLAGS.SONAR ? s.sonar : 0;
    const ext = this.ext;
    ext.uSkinSonar.value = skin;
    const bSP = modTau(f.theta - (betaSP + f.lag * (rhoSP / 12.8) * (rhoSP / 12.8)));
    ext.uEchoRim.value = skin > 0 ? Math.exp(-bSP / 0.3) * skin : 0;
    ext.uRimHold.value = skin > 0 ? smoothstep(0.85, 0.95, s.seek) * (0.6 + 0.4 * f.beat) * skin : 0;

    if (IS_DEV) this.devCounters(f, useSonar, A, w3);
  }

  /* ── the cursor wake: 5 critically damped nodes chasing the cursor (springs.ts) ── */
  private stepWake(f: FieldFrame, dt: number, still: boolean, gate: number, w: number, h: number): void {
    const pu = this.pu;
    const nodes = Math.min(5, this.eff.wake);
    const mx = (this.mouse.x * 0.5 + 0.5) * w;
    const my = (-this.mouse.y * 0.5 + 0.5) * h;
    const wake = pu.uWake.value as THREE.Vector3[];
    const wv = pu.uWakeV.value as THREE.Vector2[];
    pu.uWakeR.value = WAKE_RADIUS_K * MOUSE_RADIUS * 0.5 * h;
    const target = gate > 0 && nodes > 0 ? 1 : 0;
    this.wakeGain = still ? target : this.wakeGain + (target - this.wakeGain) * (1 - Math.exp(-dt / 0.1));
    if (!f.mouse.on || still) {
      // no cursor (or a frozen capture): the chain rests on the cursor, no velocity
      for (let i = 0; i < 5; i++) {
        this.wx[i].reset(mx);
        this.wy[i].reset(my);
        wake[i].set(mx, my, 0);
        wv[i].set(0, 0);
      }
      this.wakeLive = false;
      return;
    }
    if (!this.wakeLive) {
      for (let i = 0; i < 5; i++) {
        this.wx[i].reset(mx);
        this.wy[i].reset(my);
      }
      this.wakeLive = true;
    }
    let tx = mx;
    let ty = my;
    for (let i = 0; i < 5; i++) {
      const x = this.wx[i].step(tx, dt);
      const y = this.wy[i].step(ty, dt);
      const vx = this.wx[i].v;
      const vy = this.wy[i].v;
      const sp = Math.hypot(vx, vy);
      const str = i < nodes && sp > 1e-3 ? Math.min(1, sp / WAKE_FULL_PX_S) * (1 - 0.12 * i) * this.wakeGain * gate : 0;
      wake[i].set(x, y, str);
      if (str > 0) wv[i].set((vx / sp) * str, (vy / sp) * str);
      else wv[i].set(0, 0);
      tx = x;
      ty = y;
    }
  }

  /* ── CSS-px projection through the main camera (marks, counters) ── */
  private prepareProjector(): void {
    this.vp.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
  }

  private readonly project = (x: number, y: number, z: number, out: { x: number; y: number }): boolean => {
    const e = this.vp.elements;
    const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (!(cw > 1e-6)) return false;
    const nx = (e[0] * x + e[4] * y + e[8] * z + e[12]) / cw;
    const ny = (e[1] * x + e[5] * y + e[9] * z + e[13]) / cw;
    const nz = (e[2] * x + e[6] * y + e[10] * z + e[14]) / cw;
    if (nz <= -1 || nz >= 1 || nx < -1 || nx > 1 || ny < -1 || ny > 1) return false;
    out.x = (nx * 0.5 + 0.5) * this.host.w;
    out.y = (-ny * 0.5 + 0.5) * this.host.h;
    return true;
  };

  resize(w: number, h: number, dpr: number): void {
    const pu = this.pu;
    pu.uAspect.value = w / h;
    pu.uPixelRatio.value = dpr;
    pu.uSizeCap.value = this.host.spec.spriteCap * dpr;
    (pu.uViewport.value as THREE.Vector2).set(w, h);
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

  /** The G2 contact flare: a SHORT partial charge flash (see PULSE_LIFE in shaders/points.ts). */
  flare(t: number): void {
    this.pulse = 0.6;
    this.pulseT = t;
  }

  /** playhead.jump / settle: no wake velocity, no stale chip marks. */
  resetTimeLayer(): void {
    for (let i = 0; i < 5; i++) {
      this.wx[i].v = 0;
      this.wy[i].v = 0;
    }
    this.echoes.clearMarks();
    this.prevVh = NaN;
    this.prevTheta = NaN;
  }

  dispose(): void {
    // the material on the mesh is freed by PointField.dispose() (scene traverse); the detached one here
    if (this.points.material === this.sonarMat) this.v2Mat.dispose();
    else this.sonarMat.dispose();
    this.dbgMat?.dispose();
    if (IS_DEV) {
      const w = window as unknown as { __cxSonar?: unknown };
      delete w.__cxSonar;
    }
  }

  /* ── dev: counters read by the §11 checks ─────────────────── */

  private devCounters(f: FieldFrame, useSonar: boolean, A: number, w3: number): void {
    const c = this.echoes.counters;
    /* pings per turn: visible beads whose bearing the lead crossed going forward */
    if (!this.bearings) this.bearings = sortedBearings(this.base);
    const th = modTau(f.theta);
    const prev = this.lastTheta;
    this.lastTheta = th;
    if (useSonar && Number.isFinite(prev)) {
      const d = modTau(th - prev);
      if (d > 0 && d < 1) {
        const { phi, idx } = this.bearings;
        const count = (a: number, b: number): void => {
          const i0 = lowerBound(phi, a);
          const i1 = lowerBound(phi, b);
          const pos = this.base.positions;
          const tmp = { x: 0, y: 0 };
          for (let k = i0; k < i1; k++) {
            const i = idx[k];
            if (this.project(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], tmp)) c.pingsThisTurn++;
          }
        };
        if (prev + d <= TAU) count(prev, prev + d);
        else {
          count(prev, TAU);
          count(0, prev + d - TAU);
        }
        c.turnSwept += d;
        if (c.turnSwept >= TAU) {
          c.pingsPerTurn = c.pingsThisTurn;
          c.pingsThisTurn = 0;
          c.turnSwept -= TAU;
        }
      }
    }
    /* capInside: beads inside 0.95 R_m (exact capture mirror incl. the flow; pinned beads skip
       it); capBand: beads packed into the meniscus band (lateral R_m … 1.6 R_m, §11 item 25) */
    const cap = this.pu.uCapture.value as number;
    this.lastStats.capture = cap;
    if (cap > 0) {
      const pinned = this.pu.uPinned.value as Float32Array;
      const pos = this.base.positions;
      const V = this.pu.uViewDir.value as THREE.Vector3;
      const fo = { x: 0, y: 0, z: 0 };
      const cd = { d: 0, rp: 0 };
      let n = 0;
      let band = 0;
      for (let i = 0; i < this.base.count; i++) {
        let skip = false;
        for (let k = 0; k < 8; k++) if (pinned[k] === i) skip = true;
        if (skip) continue;
        const x = pos[i * 3];
        const y = pos[i * 3 + 1];
        const z = pos[i * 3 + 2];
        if (A !== 0) flowOffsetPh(x, y, this.ph, A, w3, fo);
        else fo.x = fo.y = fo.z = 0;
        captureDistance(x + fo.x - SPV.x, y + fo.y - SPV.y, z + fo.z - SPV.z, V.x, V.y, V.z, cap, cd);
        if (cd.d < 0.95 * R_M) n++;
        if (cd.rp < 1.6 * R_M) band++;
      }
      c.capInside = n;
      c.capBand = band;
      if (n > c.capInsideMax) c.capInsideMax = n;
    } else c.capInside = c.capBand = 0;
  }

  private lastTheta = NaN;

  private dbgMat: THREE.ShaderMaterial | null = null;

  /** Dev: renders ONLY the pinned beads' cores (slot-coded) and reads back their GPU centroids (CSS px). */
  private pinProbe(): Array<{ slot: number; index: number; x: number; y: number; n: number }> {
    const r = this.renderer;
    const gl = r.getContext();
    if (!this.dbgMat) {
      this.dbgMat = new THREE.ShaderMaterial({
        vertexShader: POINT_VERT,
        fragmentShader: POINT_FRAG,
        defines: { SONAR: "", DBG_PIN: "" },
        uniforms: this.pu,
        transparent: false,
        depthTest: false,
        depthWrite: false,
      });
    }
    const others = this.scene.children.filter((o) => o !== this.points && o.visible);
    others.forEach((o) => (o.visible = false));
    const saved = this.points.material;
    this.points.material = this.dbgMat;
    r.render(this.scene, this.camera);
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    this.points.material = saved;
    others.forEach((o) => (o.visible = true));
    const sx = new Float64Array(8);
    const sy = new Float64Array(8);
    const n = new Float64Array(8);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = px[(y * W + x) * 4];
        if (px[(y * W + x) * 4 + 1] < 250) continue; // an edge pixel (partial coverage) mixes slots
        if (v < 8) continue;
        const slot = Math.round((v / 255) * 8) - 1;
        if (slot < 0 || slot > 7) continue;
        sx[slot] += x + 0.5;
        sy[slot] += H - y - 0.5;
        n[slot]++;
      }
    }
    const k = W / Math.max(1, this.host.w);
    const pinned = this.pu.uPinned.value as Float32Array;
    const out: Array<{ slot: number; index: number; x: number; y: number; n: number }> = [];
    for (let s = 0; s < 8; s++) if (n[s] > 0) out.push({ slot: s, index: pinned[s], x: sx[s] / n[s] / k, y: sy[s] / n[s] / k, n: n[s] });
    return out;
  }

  private installDevHook(): void {
    const w = window as unknown as { __cxSonar?: unknown };
    w.__cxSonar = {
      pinProbe: () => this.pinProbe(),
      picks: () => ({ echoes: Array.from(this.picks.echoes), weights: Array.from(this.picks.weights), decoys: Array.from(this.picks.decoys) }),
      counters: () => ({ ...this.echoes.counters, crestSources: this.echoes.crestSources(), crestsLive: this.echoes.counters.crestsLive.slice() }),
      resetCounters: () => this.echoes.resetCounters(),
      state: () => ({
        compiled: this.compiled,
        readyA: this.readyA,
        material: this.points.material === this.sonarMat ? "sonar" : "v2",
        uSonar: this.pu.uSonar.value,
        uSonarJ: this.pu.uSonarJ.value,
        flowT: this.flowT,
        flowAmp: this.pu.uFlowAmp.value,
        cocMax: this.cocMax,
        echoes: (this.frameData.echoes as EchoMark[]).map((m) => ({ ...m })),
        echoA: Array.from(this.pu.uEchoA.value as Float32Array),
        decoy: (this.pu.uDecoy.value as THREE.Vector3).toArray(),
        decoyR: (this.pu.uDecoyR.value as THREE.Vector3).toArray(),
        capture: this.lastStats.capture,
        ext: { echoRim: this.ext.uEchoRim.value, skin: this.ext.uSkinSonar.value, rimHold: this.ext.uRimHold.value },
        pinned: Array.from(this.pu.uPinned.value as Float32Array),
      }),
    };
  }
}

