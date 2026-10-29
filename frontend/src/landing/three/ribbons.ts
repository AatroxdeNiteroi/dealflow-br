/* ============================================================
   three/ribbons.ts — rings, dial ticks and crosshair as ribbons (spec
   rev 3.1 §4.7). Owner: WP2. Shaders: shaders/sweep.ts RIBBON_*.

   ONE draw call: 4 rings × 192 quads (attributes aT = arc fraction from 12
   o'clock clockwise, aSide ±1), 60 dial ticks and 2 crosshair arms as
   capsule quads (aEnd 0/1). Widths are CSS px × DPR (1.25; 1.5 at the merge
   and on mobile; ring0 = the Gateway emblem's contact stroke for vh < 8,
   so the G2 match-cut lands on the same weight). Round tips everywhere.

   J2 (the drain): ring i travels hub → SP (`ringTravel_i`, outer first),
   its plane turns to face the camera and its radius goes to
   rT_i = (anchor.r + 14 + 6i)·z_SP/f (world, CPU each frame) — so the
   arrived ring IS the DOM reticle circle (anchor.r + 14) — wobbling in
   transit, merging onto ring0 (`ringMerge`), fading into the DOM circle
   (`ringFade`) and flashing at the lock (`time.lockPulse`). C4b: the hub
   rings (travel/merge were reset to 0 at 400) redraw inner-first.

   CPU mirror: ringFrame()/projectRing() evaluate the SAME centre, plane and
   radius the vertex shader uses (without the transient wobbles), so
   field.ringScreen(i) is the GL ring in CSS px (RIG hand-off, ≤ 1 px).
   ============================================================ */

import * as THREE from "three";
import { INSTRUMENT_Z, RING_RADII, SRGB, TICK_COUNT, TWO_PI } from "./constants";
import { RIBBON_FRAG, RIBBON_VERT } from "./shaders/sweep";

/** Quads per ring (§4.7). */
export const RING_QUADS = 192;
/** CSS px. */
export const RIBBON_W = 1.25;
export const RIBBON_W_MERGE = 1.5;
export const RIBBON_W_MOBILE = 1.5;
/** The Gateway emblem's spiral stroke at the G2 contact (CSS px on screen:
 *  Gateway.tsx `AT_CONTACT.spiral`, the stroke the glide lands on ring0). */
export const EMBLEM_CONTACT_PX = 1.1;
/** v2 base opacities: rings .16, dial .20, crosshair .30 (instrument.ts BASE). */
export const RIBBON_BASE = [0.16, 0.16, 0.16, 0.16, 0.2, 0.3] as const;
/** Alpha a ring condenses to on arrival (4 merged rings ≈ 0.89: the reticle's weight). */
export const RIBBON_ARRIVE_ALPHA = 0.42;
/** Px between the DOM reticle and ring i's arrival radius: anchor.r + 14 + 6i (§3 J2). */
export const RING_GAP_PX = 14;
export const RING_STEP_PX = 6;
/** Fixed wobble phases per ring (p_i, q_i). */
const PH_P = [0.0, 1.7, 3.1, 4.4];
const PH_Q = [0.9, 2.6, 4.0, 5.5];

export interface RibbonUniforms {
  uHub: { value: THREE.Vector3 };
  uSP: { value: THREE.Vector3 };
  uCamPos: { value: THREE.Vector3 };
  uR: { value: Float32Array };
  uRT: { value: Float32Array };
  uTravel: { value: Float32Array };
  uMerge: { value: number };
  uDraw: { value: Float32Array };
  uBase: { value: Float32Array };
  uBoost: { value: Float32Array };
  uLock: { value: number };
  uFade: { value: number };
  uArrive: { value: number };
  uShock: { value: THREE.Vector2 };
  uViewport: { value: THREE.Vector2 };
  uWidth: { value: number };
  uWidth0: { value: number };
  uWidthM: { value: number };
  uPhP: { value: Float32Array };
  uPhQ: { value: Float32Array };
  cLine: { value: THREE.Vector3 };
  cGold: { value: THREE.Vector3 };
}

export interface Ribbons {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  u: RibbonUniforms;
  /** draw fractions: ring0..3, ticks, cross (aliases u.uDraw.value) */
  draw: Float32Array;
}

/** Builds the one-draw ribbon mesh (hidden until the driver's program is ready). */
export function buildRibbons(): Ribbons {
  const pos: number[] = [];
  const kind: number[] = [];
  const tt: number[] = [];
  const side: number[] = [];
  const end: number[] = [];
  const idx: number[] = [];
  let v = 0;
  const vert = (x: number, y: number, z: number, k: number, t: number, sd: number, e: number) => {
    pos.push(x, y, z);
    kind.push(k);
    tt.push(t);
    side.push(sd);
    end.push(e);
    return v++;
  };

  // rings: a strip of RING_QUADS quads, T = 0 … 1 (the last sample closes the loop)
  for (let k = 0; k < 4; k++) {
    const first = v;
    for (let s = 0; s <= RING_QUADS; s++) {
      vert(0, 0, 0, k, s / RING_QUADS, -1, 0);
      vert(0, 0, 0, k, s / RING_QUADS, 1, 0);
    }
    for (let s = 0; s < RING_QUADS; s++) {
      const a = first + s * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }

  // capsule quads: corners (end 0/1) × (side ∓1)
  const capsule = (dx: number, dy: number, z: number, k: number, t: number) => {
    const a = vert(dx, dy, z, k, t, -1, 0);
    vert(dx, dy, z, k, t, 1, 0);
    vert(dx, dy, z, k, t, -1, 1);
    vert(dx, dy, z, k, t, 1, 1);
    idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  };
  // dial — 60 ticks, long every 5th (inner 12.0 / 12.4, outer 12.8), clockwise from 12 o'clock
  for (let i = 0; i < TICK_COUNT; i++) {
    const a = Math.PI / 2 - (i / TICK_COUNT) * TWO_PI;
    capsule(Math.cos(a), Math.sin(a), i % 5 === 0 ? 12.0 : 12.4, 4, i / TICK_COUNT);
  }
  // crosshair — two arms through the hub, half length 0.6
  capsule(1, 0, 0.6, 5, 0);
  capsule(0, 1, 0.6, 5, 1);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1));
  g.setAttribute("aT", new THREE.Float32BufferAttribute(tt, 1));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute("aEnd", new THREE.Float32BufferAttribute(end, 1));
  g.setIndex(idx);

  const draw = new Float32Array([1, 1, 1, 1, 1, 1]);
  const u: RibbonUniforms = {
    uHub: { value: new THREE.Vector3(0, 0, INSTRUMENT_Z) },
    uSP: { value: new THREE.Vector3() },
    uCamPos: { value: new THREE.Vector3(0, 0, 16) },
    uR: { value: new Float32Array(RING_RADII) },
    uRT: { value: new Float32Array(RING_RADII) },
    uTravel: { value: new Float32Array(4) },
    uMerge: { value: 0 },
    uDraw: { value: draw },
    uBase: { value: new Float32Array(RIBBON_BASE) },
    uBoost: { value: new Float32Array(4) },
    uLock: { value: 0 },
    uFade: { value: 1 },
    uArrive: { value: RIBBON_ARRIVE_ALPHA },
    uShock: { value: new THREE.Vector2(-1, 0) },
    uViewport: { value: new THREE.Vector2(1, 1) },
    uWidth: { value: RIBBON_W },
    uWidth0: { value: RIBBON_W },
    uWidthM: { value: RIBBON_W_MERGE },
    uPhP: { value: new Float32Array(PH_P) },
    uPhQ: { value: new Float32Array(PH_Q) },
    cLine: { value: SRGB.line() },
    cGold: { value: SRGB.gold() },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT,
    fragmentShader: RIBBON_FRAG,
    uniforms: u as unknown as Record<string, THREE.IUniform>,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    // quads are extruded in screen space: their winding depends on the stroke direction
    side: THREE.DoubleSide,
    // premultiplied "over" (the fragment writes rgb·a, a)
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  return { mesh, mat, u, draw };
}

/* ── CPU mirror (ringScreen) ─────────────────────────────────── */

export interface RingFrame {
  c: THREE.Vector3;
  e1: THREE.Vector3;
  e2: THREE.Vector3;
  r: number;
}

const Z = new THREE.Vector3(0, 0, 1);
const tmpN = new THREE.Vector3();
const tmpV = new THREE.Vector3();

/** Ring i's centre, in-plane basis and radius (world) from the ribbon uniforms — the vertex
 *  shader's maths without the transient terms (wobble, crest, lock flash). */
export function ringFrame(u: RibbonUniforms, i: number, out: RingFrame): RingFrame {
  const k = Math.max(0, Math.min(3, i | 0));
  const tr = u.uTravel.value[k];
  const sp = u.uSP.value;
  out.c.copy(u.uHub.value).lerp(sp, tr);
  tmpV.copy(u.uCamPos.value).sub(sp).normalize();
  tmpN.copy(Z).lerp(tmpV, tr).normalize();
  out.e1.set(1 - tmpN.x * tmpN.x, -tmpN.x * tmpN.y, -tmpN.x * tmpN.z).normalize();
  out.e2.crossVectors(tmpN, out.e1);
  const R = u.uR.value[k];
  const rt = u.uRT.value[k];
  const r = R + (rt - R) * tr;
  out.r = r + (u.uRT.value[0] - r) * u.uMerge.value;
  return out;
}

const pc = new THREE.Vector3();
const pe = new THREE.Vector3();

/** Projects a ring frame with `cam` into CSS px: centre and the mean of its four semi-axes. */
export function projectRing(
  fr: RingFrame,
  cam: THREE.Camera,
  w: number,
  h: number,
): { x: number; y: number; r: number; visible: boolean } {
  pc.copy(fr.c).project(cam);
  const cx = (pc.x * 0.5 + 0.5) * w;
  const cy = (-pc.y * 0.5 + 0.5) * h;
  const inFront = pc.z > -1 && pc.z < 1;
  let sum = 0;
  for (let s = 0; s < 4; s++) {
    const sgn = s < 2 ? 1 : -1;
    pe.copy(fr.c).addScaledVector(s % 2 === 0 ? fr.e1 : fr.e2, sgn * fr.r).project(cam);
    sum += Math.hypot((pe.x * 0.5 + 0.5) * w - cx, (-pe.y * 0.5 + 0.5) * h - cy);
  }
  const r = sum / 4;
  const visible = inFront && cx > -r && cx < w + r && cy > -r && cy < h + r;
  return { x: cx, y: cy, r, visible };
}
