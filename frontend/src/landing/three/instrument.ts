/* ============================================================
   three/instrument.ts — the radar instrument (§7.6). Owner: WP-GL.
   Rings + dial + crosshair as ONE LineSegments draw, and the sweep
   wedge. Geometry is today's (radii 2.4/5.0/7.8/10.8 at z −1, a
   60-tick dial 12.0–12.8, a 0.6 crosshair); the draw order is new:
   every path starts at 12 o'clock and runs clockwise, so a ring
   "undraws" back to the top like a closing dial.

   v3 (spec rev 3.1 §4.3, WP2): buildBeamSector() — the phosphor sonar
   beam's sector mesh (apex ON the hub at INSTRUMENT_Z, radius ≤ 12.8,
   BEAM_SEGMENTS segments, angle and radius mapped in the vertex shader). The v2 wedge and
   LineSegments above stay for FLAGS.SONAR = false and the boot frames
   before the v3 programs link (field/beam.ts cross-fades them out).
   ============================================================ */

import * as THREE from "three";
import {
  INSTRUMENT_Z,
  LINEAR,
  RING_RADII,
  RING_SEGMENTS,
  SRGB,
  SWEEP_RADIUS,
  TICK_COUNT,
  TRAIL,
  TWO_PI,
} from "./constants";
import { LINE_FRAG, LINE_VERT, SWEEP_FRAG, SWEEP_VERT } from "./shaders/sweep";
import { BEAM_AHEAD, BEAM_FRAG, BEAM_KNOBS, BEAM_RADIUS, BEAM_SEGMENTS, BEAM_SHADE, BEAM_VERT } from "./shaders/beam";

/** Today's base opacities: rings .16, dial .20, crosshair .30. */
const BASE = [0.16, 0.16, 0.16, 0.16, 0.2, 0.3];
/** v2 base opacities (field/beam.ts scales a copy while the v2 lines stand in for the ribbons). */
export const LINE_BASE: readonly number[] = BASE;

export interface Instrument {
  lines: THREE.LineSegments;
  lineMat: THREE.ShaderMaterial;
  sweep: THREE.Group;
  sweepMat: THREE.ShaderMaterial;
  /** Draw fractions: ring0..3, dial, cross. */
  draw: Float32Array;
  /** Per-ring G2 light-up boost. */
  boost: Float32Array;
}

export function buildInstrument(reduced: boolean): Instrument {
  const pos: number[] = [];
  const kind: number[] = [];
  const tt: number[] = [];
  const push = (x: number, y: number, k: number, t: number) => {
    pos.push(x, y, INSTRUMENT_Z);
    kind.push(k);
    tt.push(t);
  };

  // rings — clockwise from 12 o'clock; aT = arc fraction
  RING_RADII.forEach((radius, k) => {
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const t0 = i / RING_SEGMENTS;
      const t1 = (i + 1) / RING_SEGMENTS;
      const a0 = Math.PI / 2 - t0 * TWO_PI;
      const a1 = Math.PI / 2 - t1 * TWO_PI;
      push(Math.cos(a0) * radius, Math.sin(a0) * radius, k, t0);
      push(Math.cos(a1) * radius, Math.sin(a1) * radius, k, t1);
    }
  });

  // dial — 60 ticks, long every 5th; aT = tick index / 60
  for (let i = 0; i < TICK_COUNT; i++) {
    const a = Math.PI / 2 - (i / TICK_COUNT) * TWO_PI;
    const inner = i % 5 === 0 ? 12.0 : 12.4;
    push(Math.cos(a) * inner, Math.sin(a) * inner, 4, i / TICK_COUNT);
    push(Math.cos(a) * 12.8, Math.sin(a) * 12.8, 4, i / TICK_COUNT);
  }

  // crosshair — four arms from the hub; aT = 0 at the hub, 1 at the tip
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    push(0, 0, 5, 0);
    push(dx * 0.6, dy * 0.6, 5, 1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1));
  g.setAttribute("aT", new THREE.Float32BufferAttribute(tt, 1));

  const draw = new Float32Array([1, 1, 1, 1, 1, 1]);
  const boost = new Float32Array([0, 0, 0, 0]);
  const lineMat = new THREE.ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    uniforms: {
      uDraw: { value: draw },
      uBase: { value: new Float32Array(BASE) },
      uBoost: { value: boost },
      uTicks: { value: TICK_COUNT },
      cLine: { value: SRGB.line() },
      cGold: { value: SRGB.gold() },
    },
  });
  const lines = new THREE.LineSegments(g, lineMat);
  lines.frustumCulled = false;

  // sweep wedge — apex at the hub, arc at the rim (today's fan)
  const segments = 96;
  const verts: number[] = [0, 0, 0.5];
  for (let i = 0; i <= segments; i++) {
    const a = -TRAIL + TRAIL * (i / segments);
    verts.push(Math.cos(a) * SWEEP_RADIUS, Math.sin(a) * SWEEP_RADIUS, 0.5);
  }
  const idx: number[] = [];
  for (let i = 1; i <= segments; i++) idx.push(0, i, i + 1);
  const wedge = new THREE.BufferGeometry();
  wedge.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  wedge.setIndex(idx);
  const sweepMat = new THREE.ShaderMaterial({
    vertexShader: SWEEP_VERT,
    fragmentShader: SWEEP_FRAG,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: LINEAR.gold() },
      uColorHot: { value: LINEAR.goldHot() },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
      uMotion: { value: reduced ? 0 : 1 },
      uBoost: { value: 0 },
    },
  });
  const sweep = new THREE.Group();
  const wedgeMesh = new THREE.Mesh(wedge, sweepMat);
  wedgeMesh.frustumCulled = false;
  sweep.add(wedgeMesh);

  return { lines, lineMat, sweep, sweepMat, draw, boost };
}

/* ── v3 sector beam (§4.3) ───────────────────────────────────── */

export interface BeamSector {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  u: {
    uBack: { value: number };
    uAhead: { value: number };
    uRadius: { value: number };
    uSegs: { value: number };
    uInk: { value: THREE.Vector3 };
    uGold: { value: THREE.Vector3 };
    uLag: { value: number };
    uFadeR: { value: number };
    uLineW: { value: number };
    uLineEnd: { value: number };
    uTauV: { value: number };
    uVeilMax: { value: number };
    uShade: { value: number };
    uGain: { value: number };
    uDpr: { value: number };
    uViewH: { value: number };
    uGrainT: { value: THREE.Vector2 };
    uTextMask: { value: THREE.Vector4[] };
    /** live text-mask rects, packed first in uTextMask */
    uMaskN: { value: number };
  };
}

/** The sector: apex vertex (aT = −1) at the hub + BEAM_SEGMENTS + 1 rim vertices (aT = i/N), all
 *  on z = INSTRUMENT_Z; the local angle and radius come from the vertex shader. Hidden until the
 *  driver's program is ready. */
export function buildBeamSector(): BeamSector {
  const pos: number[] = [0, 0, INSTRUMENT_Z];
  const at: number[] = [-1];
  for (let i = 0; i <= BEAM_SEGMENTS; i++) {
    pos.push(0, 0, INSTRUMENT_Z);
    at.push(i / BEAM_SEGMENTS);
  }
  const idx: number[] = [];
  for (let i = 1; i <= BEAM_SEGMENTS; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aT", new THREE.Float32BufferAttribute(at, 1));
  g.setIndex(idx);
  const u: BeamSector["u"] = {
    uBack: { value: 2.5 },
    uAhead: { value: BEAM_AHEAD },
    uRadius: { value: BEAM_RADIUS },
    uSegs: { value: BEAM_SEGMENTS },
    uInk: { value: SRGB.ink() },
    uGold: { value: SRGB.gold() },
    uLag: { value: 0.1 },
    uFadeR: { value: 12.8 },
    uLineW: { value: BEAM_KNOBS.lineW.value },
    uLineEnd: { value: 12.8 },
    uTauV: { value: 0.544 },
    uVeilMax: { value: BEAM_KNOBS.veilMax.value },
    uShade: { value: BEAM_SHADE },
    uGain: { value: 0 },
    uDpr: { value: 1 },
    uViewH: { value: 1 },
    uGrainT: { value: new THREE.Vector2() },
    uTextMask: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
    uMaskN: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    uniforms: u as unknown as Record<string, THREE.IUniform>,
    transparent: true,
    depthTest: true, // the beam passes behind the sphere
    depthWrite: false,
    // premultiplied "over" (the fragment writes (ink·a_ink + gold·a_line, a)·gain)
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, mat, u };
}
