/* ============================================================
   three/ribbons.ts — rings, ticks and crosshair as ribbons (spec rev 3.1
   §4.7). WP0 STUB → WP2.

   v3 (WP2): one draw call — 4 rings × 192 quads, 60 ticks and 2
   crosshair arms as capsule quads, attributes (aTheta, aSide ±1, aKind,
   aT); ring i travels hub → SP (`ringTravel_i`), turns to face the camera,
   radius → anchor.r + 14 + 6i (`rT_i` computed on the CPU), merges onto
   ring0 (`ringMerge`), fades into the DOM reticle (`ringFade`); analytic
   AA, round tips, width 1.25 CSS px (1.5 at merge / mobile); G2 shock
   wobble; ringScreen(i) for the RIG hand-off. Shaders in
   shaders/sweep.ts (RIBBON_*). The stub builds nothing: the v2
   LineSegments (instrument.ts) keep drawing.
   ============================================================ */

import type * as THREE from "three";

export interface Ribbons {
  mesh: THREE.Mesh;
  /** draw fractions: ring0..3, ticks, cross */
  draw: Float32Array;
}

/** Stub: no ribbons (null) — the legacy lines draw. */
export function buildRibbons(_reduced: boolean): Ribbons | null {
  return null;
}
