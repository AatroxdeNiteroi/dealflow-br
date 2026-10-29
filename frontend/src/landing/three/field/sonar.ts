/* ============================================================
   three/field/sonar.ts — points: factories + driver (spec rev 3.1
   §4.4, §4.1). Moved verbatim from PointField by WP0 → owned by WP3.

   Factories (construction, moved from PointField.ts:226-271, :315):
   - createBaseGeometry(): today's grid (fixed seed, SP cleared) + its CPU
     arrays; v3 attributes `aTag` (0 none, 1–3 decoy index; zero-filled)
     and `aIndex` (the point index, as a float) are allocated now;
   - createPointUniforms(): the shared `pu` (base points AND dust) — the v2
     uniforms, plus every v3 uniform created at its neutral value (the v2
     shader ignores uniforms it does not declare);
   - createPointMaterial(pu): the v2 point material;
   - createExteriorUniforms(): uEchoRim, marbling, rim hold — zeroed.
   Driver (per frame): the cursor (damped, λ 7) and the v2 point uniforms.
   v3 (WP3): the SONAR program variant, afterglow, pings, echoes, decoys,
   capture, lens, DOF, wake chain, flow time, pinned upload, text mask.
   ============================================================ */

import * as THREE from "three";
import { SP as SP_T, SPHERE_R } from "../../cinema/beats";
import { CX_STILL } from "../../cinema/env";
import { clamp, damp, seeded } from "../../cinema/geometry";
import { CHARGE_SPAN, COLS, FIELD_H, FIELD_SEED, FIELD_W, LINEAR, MOUSE_RADIUS, ROWS, SP_EXCLUDE, SRGB, SWEEP_START, TRAIL } from "../constants";
import { MAX_RINGS } from "../ripples";
import { POINT_FRAG, POINT_VERT } from "../shaders/points";
import type { BaseField, DriverInit, ExteriorUniforms, FieldDriver, FieldFrame, FieldHost, PointUniforms } from "./frame";

const SPV = new THREE.Vector3(SP_T[0], SP_T[1], SP_T[2]);
const u = <T>(value: T) => ({ value });

/* ── factories ─────────────────────────────────────────────── */

/** Today's grid (fixed seed, SP cleared) and its BufferGeometry. */
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
  // v3 (WP3): decoy tag (0 none, 1–3) and the point index (pinned compares)
  const index = new Float32Array(base.count);
  for (let i = 0; i < base.count; i++) index[i] = i;
  g.setAttribute("aTag", new THREE.BufferAttribute(new Float32Array(base.count), 1));
  g.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
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

    /* ── v3 (§4.4), neutral until WP3's SONAR variant reads them ── */
    /** max(sonar, sonarC4): every new term × this; 0 = exactly v2 */
    uSonar: u(0),
    /** the J1–J2 `sonar` channel alone (echoes, capture, lens, decoys, wake) */
    uSonarJ: u(0),
    /** displayed beam angle θ and the spoon lag (rad) */
    uTheta: u(SWEEP_START),
    uLag: u(0),
    uSeek: u(0),
    uGlowTau: u(1.6),
    /** brand gold for the sonar path (SRGB family) */
    uGoldS: u(SRGB.gold()),
    /** echo crests: xyz centre + w radius, and amplitudes (6) */
    uEcho: u(Array.from({ length: 6 }, () => new THREE.Vector4())),
    uEchoA: u(new Float32Array(6)),
    uEchoGate: u(0),
    uFlowAmp: u(0),
    uFlowT: u(0),
    uCapture: u(0),
    uRm: u(0.63),
    uViewDir: u(new THREE.Vector3(0, 0, -1)),
    /** (anchor x, y, r px, lens) */
    uLens: u(new THREE.Vector4()),
    uDof: u(0),
    uFocusD: u(10),
    uCocMax: u(0),
    /** decoy flares decoy0..2 */
    uDecoy: u(new THREE.Vector3()),
    /** cursor wake chain: xy px + strength (5) */
    uWake: u(Array.from({ length: 5 }, () => new THREE.Vector3())),
    /** pinned point indices (−1 = empty) */
    uPinned: u(pinned),
    /** 4 text-mask rects (x, y, w, h) in device px; 0-area = unused */
    uTextMask: u(Array.from({ length: 4 }, () => new THREE.Vector4())),
    /** gold ping threshold on aSize (top 9 %: 2.91; T2: 3.05; ∞ = ink only) */
    uPingGold: u(2.91),
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

/* ── driver ────────────────────────────────────────────────── */

export class SonarDriver implements FieldDriver {
  private pu!: PointUniforms;
  private camera!: THREE.PerspectiveCamera;
  private host!: FieldHost;
  private readonly mouse = new THREE.Vector2(-10, -10);
  private readonly mouseTarget = new THREE.Vector2(-10, -10);
  private pulse = 0;
  private pulseT = -1e3;

  init(k: DriverInit): void {
    this.pu = k.pu;
    this.camera = k.camera;
    this.host = k.host;
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

    /* ── uniforms ── */
    const pu = this.pu;
    const cam = this.camera;
    pu.uTime.value = f.t;
    pu.uBeatPhase.value = f.beatPhase;
    (pu.uMouse.value as THREE.Vector2).set(this.mouse.x * cam.aspect, this.mouse.y);
    pu.uSweepAngle.value = f.legacySweepMod;
    pu.uChargeGain.value = s.chargeGain;
    pu.uPulse.value = this.pulse;
    pu.uPulseT.value = this.pulseT;
    pu.uSoft.value = s.soft;
    pu.uDive.value = s.dive;
    pu.uOpacity.value = s.fieldOp;
    pu.uFocus.value = s.focus;
    pu.uShockR.value = f.time.shockR;
    pu.uWarp.value = f.tier.warp && s.warp > 0 ? clamp(f.camVel * 0.35, 0, 1.5) : 0;
  }

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

  resetTimeLayer(): void {}

  dispose(): void {}
}
