/* ============================================================
   three/field/dustDriver.ts — the dust lifecycle (spec rev 3.1 §4.5,
   §4.9). Owner: WP3.

   v2 behaviour kept: built once after the gateway boot (warm-up) at the
   session's tier, budgeted from the GPU-timed 1×1 draw (QA PERF-6), a
   safety-net build at vh ≥ 1400, the C4b wave uniforms and visibility.
   The TIER HOLD now means the C4b universe only: a governor drop that
   arrives while it is on screen waits until it is gone. A drop that
   changes the DPR (a canvas resize) is also held until the playhead
   sits on a rest plateau (R0 included), in the Gateway, at the plans
   (vh ≥ 1900) or while the page is hidden (§4.9 "two mechanisms").

   v3 — the J1 HIDDEN UNIVERSE (§4.5): a prefix of the dust buffer
   drawn by its own DUST_SONAR program (shaders/points.ts) through a
   second BufferGeometry that SHARES the dust attributes (no second
   copy, its own draw range), lit only in the afterglow.
   - Size from measured cost: the program is timed on 8k beads in the
     1×1 warm-up scissor (GpuTimer, 3 samples, median; the vertex cull
     disabled so the estimate is the worst case) and the prefix is
     min(tier cap 24k T0 / 12k T1, dust built, ⌊1.0 ms / cost⌋). No
     timer: 24k T0 (16k at DPR ≥ 1.5), 12k T1. T2/T3/mobile: none.
   - uDustSonar = dustSonar · ready, `ready` fading in over 0.8 s once
     the budget is known (never before the post-boot warm-up).
   - Governor cuts / restores (sub-step ladder: ½, then 0; a tier drop)
     never pop: the beads leaving (or arriving) form a band [lo, hi)
     whose alpha ramps over 0.3 s (uKeep / uCutAlpha), then the draw
     range follows. No canvas resize is ever involved.
   - The flow moves the grains on T0 only (uDustFlow = uFlowAmp there).
   The sub-step ladder itself (judder rule) is fed from afterRender and
   published as FieldFrame.subStep (read by WP4's camera lean, WP5's
   word blur through the field).
   ============================================================ */

import * as THREE from "three";
import { PACE, restAt } from "../../cinema/beats";
import { CX_STILL, IS_DEV } from "../../cinema/env";
import { FLAGS } from "../../cinema/flags";
import { FIELD_SEED, TOTAL_POINTS } from "../constants";
import { buildDust } from "../dust";
import { SUBSTEP_SIGNAL, effectiveV3, type Governor, type TierSpec, type V3Effective } from "../governor";
import type { GpuTimer } from "../gpuTimer";
import { DUST_SONAR_FRAG, DUST_SONAR_VERT, POINT_FRAG, POINT_VERT } from "../shaders/points";
import { ORD, type DriverInit, type FieldDriver, type FieldFrame, type FieldHost, type PointUniforms, type WarmCtx } from "./frame";

const u = <T>(value: T) => ({ value });

/** Hidden-universe constants (§4.5). */
export const PREFIX = {
  /** beads timed at warm-up */
  timedBeads: 8000,
  samples: 3,
  /** GPU budget of the whole prefix (ms) */
  budgetMs: 1.0,
  /** no GPU timer: T0 at DPR < 1.5 / ≥ 1.5 (capped by the tier) */
  fallbackHi: 24000,
  fallbackLo: 16000,
  readyFade: 0.8,
  cutRamp: 0.3,
} as const;

/** The dust materials: the v2 dust path, and the DUST_SONAR prefix program (shares `pu`). */
export function createDustMaterials(pu: PointUniforms): { dust: THREE.ShaderMaterial; dustSonar: THREE.ShaderMaterial | null } {
  const dust = new THREE.ShaderMaterial({
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    defines: { DUST: "" },
    uniforms: pu,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const dustSonar = new THREE.ShaderMaterial({
    vertexShader: DUST_SONAR_VERT,
    fragmentShader: DUST_SONAR_FRAG,
    uniforms: {
      uTheta: pu.uTheta,
      uLag: pu.uLag,
      uDustSonar: pu.uDustSonar,
      uPixelRatio: pu.uPixelRatio,
      uViewport: pu.uViewport,
      uFlowPhase: pu.uFlowPhase,
      uDustFlow: pu.uDustFlow,
      uFlowW3: pu.uFlowW3,
      uTextMask: pu.uTextMask,
      uInk: pu.uInk,
      uInkDeep: pu.uInkDeep,
      uKeep: u(0),
      uCutAlpha: u(1),
      uNoCull: u(0),
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  return { dust, dustSonar };
}

const medianOf = (a: readonly number[]): number => {
  const s = a.slice().sort((x, y) => x - y);
  return s[s.length >> 1];
};

export class DustDriver implements FieldDriver {
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private pu!: PointUniforms;
  private host!: FieldHost;
  private gov!: Governor;
  private gpuT!: GpuTimer;
  private frame!: FieldFrame;
  private baseCount = 0;
  private dustMat: THREE.ShaderMaterial | null = null;
  private dust: THREE.Points | null = null;
  private dustBuilt = 0;
  /** QA PERF-6: dust budget from the measured per-point GPU cost (∞ = not yet measured). */
  private dustCap = Infinity;
  /** QA PERF-6: a tier drop held back (C4b universe on screen, or a DPR change off a plateau). */
  private tierPending = false;
  private lastVh = 0;
  private inGateway = false;

  /* ── hidden universe ── */
  private prefix: THREE.Points | null = null;
  private prefixMat: THREE.ShaderMaterial | null = null;
  /** measured / fallback bead budget (NaN = not known yet) */
  private prefixBudget = NaN;
  private readonly samples: number[] = [];
  private timing = 0;
  private timingQueued = false;
  private warmedAt = 0;
  private readyA = 0;
  /** band [lo, hi): beads < lo are full, [lo, hi) at alpha `bandA`, ≥ hi not drawn */
  private lo = 0;
  private hi = 0;
  private bandA = 1;
  private readonly eff: V3Effective = { prefixScale: 1, textBlur: true, cocMax: 0, echoes: 6, pingGold: 1, flowScale: 1, wake: 0, camLean: 1 };

  init(k: DriverInit): void {
    this.scene = k.scene;
    this.renderer = k.renderer;
    this.camera = k.camera;
    this.pu = k.pu;
    this.host = k.host;
    this.gov = k.gov;
    this.gpuT = k.gpuT;
    this.frame = k.frame;
    this.baseCount = k.base.count;
    k.frame.subStep = this.gov.sub.subStep;
    if (IS_DEV) {
      const w = window as unknown as { __cxDust?: unknown };
      w.__cxDust = {
        prefix: () => ({ budget: this.prefixBudget, lo: this.lo, hi: this.hi, bandA: this.bandA, readyA: this.readyA, samples: this.samples.slice(), visible: !!this.prefix?.visible, uDustSonar: this.pu.uDustSonar.value }),
        gov: () => ({ tier: this.gov.tier, ticks: this.gov.sub.ticks, subStep: this.gov.sub.subStep, vsync: this.gov.sub.vsync, tierPending: this.tierPending }),
        /** field-draw GPU times (ms) over the last ≤ 240 draws: p50 / p95 (dev budget checks) */
        gpu: () => {
          const a = this.gov.gpuLog.slice().sort((x, y) => x - y);
          const at = (q: number) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * q))] : NaN);
          return { n: a.length, p50: at(0.5), p95: at(0.95), max: a.length ? a[a.length - 1] : NaN };
        },
        clearGpu: () => (this.gov.gpuLog.length = 0),
        forceSubStep: (n: number | null) => this.gov.sub.force(n),
      };
    }
  }

  /** The dust Points (null until built). */
  get mesh(): THREE.Points | null {
    return this.dust;
  }

  private countFor(spec: TierSpec): number {
    const n = spec.dust === "full" ? Math.max(0, TOTAL_POINTS - this.baseCount) : spec.dust;
    return Math.min(n, this.dustCap);
  }

  private prefixWanted(): boolean {
    return FLAGS.SONAR && FLAGS.HIDDEN_UNIVERSE && !this.host.mobile && !this.host.reduced;
  }

  /** Builds the dust layer once (hidden), at the CURRENT tier's count, and the J1 prefix mesh. */
  ensure(): void {
    if (this.dust || this.host.disposed || this.host.reduced) return;
    const dustN = this.countFor(this.host.spec);
    if (!(dustN > 0)) return;
    const mats = createDustMaterials(this.pu);
    this.dustMat = mats.dust;
    this.dust = buildDust(dustN, FIELD_SEED ^ 0x9e3779b9, this.dustMat);
    this.dust.renderOrder = ORD.dust;
    this.dust.visible = false;
    this.dustBuilt = dustN;
    this.scene.add(this.dust);

    if (this.prefixWanted() && this.host.spec.sonarDust > 0 && mats.dustSonar) {
      // the prefix shares the dust attributes (same GL buffers), with its own draw range
      const src = this.dust.geometry;
      const g = new THREE.BufferGeometry();
      for (const name of ["position", "aSize", "aAngle"]) g.setAttribute(name, src.getAttribute(name));
      g.setDrawRange(0, 0);
      this.prefixMat = mats.dustSonar;
      this.prefix = new THREE.Points(g, this.prefixMat);
      this.prefix.frustumCulled = false;
      this.prefix.renderOrder = ORD.dust;
      this.prefix.visible = false;
      this.scene.add(this.prefix);
    } else mats.dustSonar?.dispose();
  }

  /**
   * QA PERF-6 — 115k dust points cost ~4–10 ms of GPU per frame on a
   * Radeon 680M and would cost 15–30 ms on weaker iGPUs. From the timed
   * 1×1 draw (≈ the per-point cost, ~75 % of a full-screen draw; fill
   * grows with DPR) keep the largest count whose full draw fits ~5 ms.
   * Without GPU timing: full below DPR 1.5, else the spec's 43,483.
   * Decided at the gateway, never while the dust is on screen.
   */
  setBudget(ms: number, drawn: number): void {
    if (!this.dust || this.host.disposed) return;
    const full = Math.max(0, TOTAL_POINTS - this.baseCount);
    const hi = this.host.dpr >= 1.5;
    let cap: number;
    if (!(ms > 0) || !(drawn > 0)) {
      cap = hi ? 43483 : full;
    } else {
      const perPoint = (ms / 0.75 / drawn) * (hi ? 1.2 : 1);
      cap = [full, 60000, 43483, 15000].find((n) => n * perPoint <= 5) ?? 15000;
    }
    this.dustCap = cap;
    const n = Math.min(this.dustBuilt, this.countFor(this.host.spec));
    this.dust.geometry.setDrawRange(0, n);
    const how = ms > 0 ? " (1×1 dust draw " + ms.toFixed(2) + " ms for " + drawn + ")" : " (no GPU timer)";
    console.info("[field] dust budget " + n + " pts" + how);
  }

  drawn(): number {
    if (!this.dust) return 0;
    const n = this.dust.geometry.drawRange.count;
    return n === Infinity ? this.dustBuilt : n;
  }

  /* ── hidden-universe budget (GPU-timed on 8k beads in a 1×1 scissor) ── */

  /** Inside PointField's warm-up scissor, after the v2 dust timing: the first sample. */
  warmUp(_w: WarmCtx): void {
    if (!this.prefix) return;
    this.warmedAt = performance.now();
    if (!this.gpuT.ok) {
      // no timer: one untimed draw still builds the program's draw-time state (no first-use stall)
      this.timeOnce(true, false);
      this.setPrefixBudget(NaN);
      return;
    }
    this.timingQueued = true;
    this.timeOnce(true);
  }

  /** One timed 8k draw of the prefix program. `inScissor`: the caller already set the 1×1 scissor. */
  private timeOnce(inScissor: boolean, timed = true): void {
    const pm = this.prefix;
    const mat = this.prefixMat;
    if (!pm || !mat || this.timing >= PREFIX.samples) return;
    const q = timed ? this.gpuT.begin() : null;
    if (timed && !q) return; // timer busy: retried next frame (beforeRender)
    const r = this.renderer;
    const others = this.scene.children.filter((o) => o !== pm && o.visible);
    others.forEach((o) => (o.visible = false));
    const wasVisible = pm.visible;
    const range = pm.geometry.drawRange;
    const r0 = range.start;
    const r1 = range.count;
    pm.visible = true;
    pm.geometry.setDrawRange(0, Math.min(PREFIX.timedBeads, this.dustBuilt));
    const mu = mat.uniforms;
    const saved = [mu.uNoCull.value, mu.uKeep.value, mu.uCutAlpha.value, this.pu.uDustSonar.value];
    mu.uNoCull.value = 1;
    mu.uKeep.value = 1e9;
    mu.uCutAlpha.value = 1;
    this.pu.uDustSonar.value = 1;
    if (!inScissor) {
      r.setScissorTest(true);
      r.setScissor(0, 0, 1, 1);
    }
    r.render(this.scene, this.camera);
    if (!inScissor) {
      r.setScissor(0, 0, this.host.w, this.host.h);
      r.setScissorTest(false);
    }
    if (q) {
      this.gpuT.end(q, (ms) => this.onSample(ms));
      this.timing++;
    }
    [mu.uNoCull.value, mu.uKeep.value, mu.uCutAlpha.value, this.pu.uDustSonar.value] = saved;
    pm.geometry.setDrawRange(r0, r1);
    pm.visible = wasVisible;
    others.forEach((o) => (o.visible = true));
  }

  private onSample(ms: number): void {
    if (this.host.disposed) return;
    this.samples.push(ms);
    if (this.samples.length >= PREFIX.samples) this.setPrefixBudget(medianOf(this.samples));
  }

  private setPrefixBudget(ms: number): void {
    if (Number.isFinite(this.prefixBudget)) return;
    const spec = this.host.spec;
    let n: number;
    const timed = Math.min(PREFIX.timedBeads, this.dustBuilt);
    if (ms > 0 && timed > 0) {
      const per = ms / timed;
      n = Math.floor(PREFIX.budgetMs / per);
    } else n = this.host.dpr >= 1.5 ? PREFIX.fallbackLo : PREFIX.fallbackHi;
    n = Math.max(0, Math.min(n, spec.sonarDust, this.dustBuilt));
    this.prefixBudget = n;
    this.timingQueued = false;
    const how = ms > 0 ? ` (8k timed ${ms.toFixed(3)} ms, median of ${this.samples.length})` : " (no GPU timer)";
    console.info(`[field] hidden universe ${n} pts${how}`);
  }

  /* ── per frame ── */

  update(f: FieldFrame): void {
    const s = f.score;
    const pu = this.pu;
    this.lastVh = f.vh;
    this.inGateway = f.inGateway;
    // safety net: the warm-up normally built it at the gateway
    if (!this.dust && f.vh >= 1400 * PACE) this.ensure();
    const dustOn = !!this.dust && this.drawn() > 0;
    pu.uWave.value = s.dust;
    pu.uWaveGain.value = s.dustGain;
    pu.uBaseWave.value = dustOn ? 0 : 1;
    if (this.dust) this.dust.visible = dustOn && s.dust > 0 && s.dustGain > 0;

    /* hidden universe */
    const pm = this.prefix;
    if (!pm || !this.prefixMat) {
      pu.uDustSonar.value = 0;
      return;
    }
    // a lost timer result must not keep the universe dark forever
    if (!Number.isFinite(this.prefixBudget) && this.warmedAt > 0 && performance.now() - this.warmedAt > 3000) {
      this.setPrefixBudget(this.samples.length ? medianOf(this.samples) : NaN);
    }
    const known = Number.isFinite(this.prefixBudget);
    const still = CX_STILL || f.dt <= 0;
    if (known) this.readyA = still ? 1 : Math.min(1, this.readyA + f.dt / PREFIX.readyFade);
    effectiveV3(f.tier, this.gov.sub.ticks, this.eff);
    const cap = known ? Math.min(this.prefixBudget, f.tier.sonarDust, this.dustBuilt) : 0;
    const target = Math.floor(cap * this.eff.prefixScale);
    this.stepBand(target, still ? Infinity : f.dt);
    const mu = this.prefixMat.uniforms;
    mu.uKeep.value = this.lo;
    mu.uCutAlpha.value = this.bandA;
    if (pm.geometry.drawRange.count !== this.hi || pm.geometry.drawRange.start !== 0) pm.geometry.setDrawRange(0, this.hi);
    const gate = s.dustSonar * this.readyA * (f.motionV2 > 0 ? 1 : 0);
    pu.uDustSonar.value = gate;
    pu.uDustFlow.value = this.gov.tier === 0 && !this.host.mobile ? (pu.uFlowAmp.value as number) : 0;
    pm.visible = gate > 0.001 && this.hi > 0;
  }

  /** The 0.3 s cut / restore band (no pop). dt = Infinity snaps. */
  private stepBand(T: number, dt: number): void {
    const k = dt === Infinity ? 1 : dt / PREFIX.cutRamp;
    if (T === this.lo && this.hi === this.lo) {
      this.bandA = 1;
      return;
    }
    if (T <= this.lo) {
      // cutting: [T, hi) fades out
      if (this.lo > T) {
        if (this.hi === this.lo) this.bandA = 1;
        this.lo = T;
      }
      this.bandA -= k;
      if (this.bandA <= 0) {
        this.hi = this.lo;
        this.bandA = 1;
      }
    } else {
      // restoring: [lo, T) fades in
      if (this.hi === this.lo) this.bandA = 0;
      if (this.hi !== T) this.hi = T;
      this.bandA += k;
      if (this.bandA >= 1) {
        this.lo = this.hi;
        this.bandA = 1;
      }
    }
  }

  /** A tier change: shrink the draw range (never rebuild). The prefix follows from update(). */
  onTier(spec: TierSpec): void {
    if (this.dust) this.dust.geometry.setDrawRange(0, Math.min(this.dustBuilt, this.countFor(spec)));
  }

  /** A DPR change (canvas resize) is applied only on a rest plateau, in the Gateway, at the plans
   *  or while the page is hidden; a tier change that keeps the DPR may land at any time. */
  private dprChangeAllowed(): boolean {
    const next = this.gov.spec().dpr;
    if (Math.abs(next - this.host.dpr) < 1e-6) return true;
    if (this.inGateway || this.lastVh >= 1900 * PACE) return true;
    if (typeof document !== "undefined" && document.hidden) return true;
    return restAt(this.lastVh) !== null;
  }

  /** Before the draw: a held drop lands once allowed; pending prefix timing samples. */
  beforeRender(applyTier: () => void): void {
    if (this.timingQueued && this.timing < PREFIX.samples) this.timeOnce(false);
    if (this.tierPending && !(this.dust && this.dust.visible) && this.dprChangeAllowed()) {
      this.tierPending = false;
      applyTier();
    }
  }

  /** After the draw: feed the governor (tiers) and the sub-step ladder one frame interval. */
  afterRender(intervalMs: number | null, applyTier: () => void): void {
    if (intervalMs === null) return;
    if (this.gov.sample(intervalMs)) {
      // never thin the universe while it is on screen, never resize the canvas mid-move
      if ((this.dust && this.dust.visible) || !this.dprChangeAllowed()) this.tierPending = true;
      else applyTier();
    }
    this.gov.sampleJudder(intervalMs);
    this.frame.subStep = this.gov.sub.subStep;
    SUBSTEP_SIGNAL.subStep = this.frame.subStep;
    SUBSTEP_SIGNAL.ticks = this.gov.sub.ticks;
  }

  dispose(): void {
    // the prefix geometry and material are in the scene: PointField.dispose() frees them
    if (IS_DEV) {
      const w = window as unknown as { __cxDust?: unknown };
      delete w.__cxDust;
    }
  }
}
