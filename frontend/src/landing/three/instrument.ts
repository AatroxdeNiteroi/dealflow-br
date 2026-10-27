/* ============================================================
   three/instrument.ts — the radar instrument (§7.6). Owner: WP-GL.
   Rings + dial + crosshair as ONE LineSegments draw, and the sweep
   wedge. Geometry is today's (radii 2.4/5.0/7.8/10.8 at z −1, a
   60-tick dial 12.0–12.8, a 0.6 crosshair); the draw order is new:
   every path starts at 12 o'clock and runs clockwise, so a ring
   "undraws" back to the top like a closing dial.
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

/** Today's base opacities: rings .16, dial .20, crosshair .30. */
const BASE = [0.16, 0.16, 0.16, 0.16, 0.2, 0.3];

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
