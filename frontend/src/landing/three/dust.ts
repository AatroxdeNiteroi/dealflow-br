/* ============================================================
   three/dust.ts — the dust layer (§7.5). Owner: WP-GL.
   A second Points draw: uniform positions in a disc of radius 16 on
   z ∈ [−4, 0], revealed by the C4b wave (|pos − SP| < dust·30, soft
   1.5) × dustGain, lifted to gold by the sweep's analytic charge.
   Built once at the session's starting tier (T0: base + dust = 117.965
   exactly; T1: 15,000); a later tier drop only shrinks the drawRange
   (the order is random, so any prefix is a uniform subset).
   ============================================================ */

import * as THREE from "three";
import { seeded } from "../cinema/geometry";

const DUST_RADIUS = 16;

export function buildDust(count: number, seed: number, material: THREE.ShaderMaterial): THREE.Points {
  const rnd = seeded(seed);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const angles = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // uniform in the disc (sqrt for area density)
    const r = Math.sqrt(rnd()) * DUST_RADIUS;
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = -rnd() * 4;
    sizes[i] = 0.5 + rnd() * 0.6;
    seeds[i] = rnd();
    angles[i] = Math.atan2(y, x);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  g.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
  const pts = new THREE.Points(g, material);
  pts.frustumCulled = false;
  return pts;
}
