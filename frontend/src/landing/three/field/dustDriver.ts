/* ============================================================
   three/field/dustDriver.ts — the dust lifecycle (spec rev 3.1 §4.5,
   §4.9). Moved verbatim from PointField by WP0 → owned by WP3.

   v2 behaviour kept: built once after the gateway boot (warm-up) at the
   session's tier, budgeted from the GPU-timed 1×1 draw (QA PERF-6), a
   safety-net build at vh ≥ 1400, the C4b wave uniforms and visibility,
   and the TIER HOLD: a governor drop that arrives while the universe is
   on screen waits until it is gone (QA PERF-6).
   v3 (WP3): createDustMaterials() also returns the DUST_SONAR program
   (J1 hidden-universe prefix, cost-sized at warm-up through
   FieldDriver.warmUp), uDustSonar, the 0.3 s prefix ramp, the hold
   applying to the C4b universe only, sub-steps.
   ============================================================ */

import * as THREE from "three";
import { PACE } from "../../cinema/beats";
import { FIELD_SEED, TOTAL_POINTS } from "../constants";
import { buildDust } from "../dust";
import type { Governor, TierSpec } from "../governor";
import { POINT_FRAG, POINT_VERT } from "../shaders/points";
import { ORD, type DriverInit, type FieldDriver, type FieldFrame, type FieldHost, type PointUniforms } from "./frame";

/** The dust materials: the v2 dust path, and (WP3) the DUST_SONAR prefix program. */
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
  return { dust, dustSonar: null };
}

export class DustDriver implements FieldDriver {
  private scene!: THREE.Scene;
  private pu!: PointUniforms;
  private host!: FieldHost;
  private gov!: Governor;
  private baseCount = 0;
  private dustMat: THREE.ShaderMaterial | null = null;
  private dust: THREE.Points | null = null;
  private dustBuilt = 0;
  /** QA PERF-6: dust budget from the measured per-point GPU cost (∞ = not yet measured). */
  private dustCap = Infinity;
  /** QA PERF-6: a tier drop that arrived while the dust was on screen. */
  private tierPending = false;

  init(k: DriverInit): void {
    this.scene = k.scene;
    this.pu = k.pu;
    this.host = k.host;
    this.gov = k.gov;
    this.baseCount = k.base.count;
  }

  /** The dust Points (null until built). */
  get mesh(): THREE.Points | null {
    return this.dust;
  }

  private countFor(spec: TierSpec): number {
    const n = spec.dust === "full" ? Math.max(0, TOTAL_POINTS - this.baseCount) : spec.dust;
    return Math.min(n, this.dustCap);
  }

  /** Builds the dust layer once (hidden), at the CURRENT tier's count. */
  ensure(): void {
    if (this.dust || this.host.disposed || this.host.reduced) return;
    const dustN = this.countFor(this.host.spec);
    if (!(dustN > 0)) return;
    this.dustMat = createDustMaterials(this.pu).dust;
    this.dust = buildDust(dustN, FIELD_SEED ^ 0x9e3779b9, this.dustMat);
    this.dust.renderOrder = ORD.dust;
    this.dust.visible = false;
    this.dustBuilt = dustN;
    this.scene.add(this.dust);
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

  update(f: FieldFrame): void {
    const s = f.score;
    const pu = this.pu;
    // safety net: the warm-up normally built it at the gateway
    if (!this.dust && f.vh >= 1400 * PACE) this.ensure();
    const dustOn = !!this.dust && this.drawn() > 0;
    pu.uWave.value = s.dust;
    pu.uWaveGain.value = s.dustGain;
    pu.uBaseWave.value = dustOn ? 0 : 1;
    if (this.dust) this.dust.visible = dustOn && s.dust > 0 && s.dustGain > 0;
  }

  /** A tier change: shrink the draw range (never rebuild). */
  onTier(spec: TierSpec): void {
    if (this.dust) this.dust.geometry.setDrawRange(0, Math.min(this.dustBuilt, this.countFor(spec)));
  }

  /** Before the draw: a drop held back during the dust reveal lands once it is gone. */
  beforeRender(applyTier: () => void): void {
    if (this.tierPending && !(this.dust && this.dust.visible)) {
      this.tierPending = false;
      applyTier();
    }
  }

  /** After the draw: feed the governor one frame interval (null = no previous frame). */
  afterRender(intervalMs: number | null, applyTier: () => void): void {
    if (intervalMs !== null && this.gov.sample(intervalMs)) {
      // never thin the universe (or change DPR) while it is on screen
      if (this.dust && this.dust.visible) this.tierPending = true;
      else applyTier();
    }
  }

  dispose(): void {}
}
