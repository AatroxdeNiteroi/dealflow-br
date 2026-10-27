/* ============================================================
   three/embers.ts — interior embers (§7.5, J4). Owner: WP-GL.
   240 additive gold points (#cf9b1e halo, #f3c560 core, 1.5–4 px)
   inside 0.9R of SP. They drift on a divergence-free ABC flow (a
   cheap curl field: nothing bunches up, nothing drains away), a
   random third of them flares on each "lub" of the heartbeat, and
   they are cut by the dawn front (screen-space, same frontR as the
   interior hole). Visible only while the camera is inside.
   Gold-as-light on the warm-black dome: allowed by the brand rule.
   ============================================================ */

import * as THREE from "three";
import { SP } from "../cinema/beats";
import { seeded } from "../cinema/geometry";
import { SRGB } from "./constants";

const EMBER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uBeatPhase;
  uniform float uLub;
  uniform float uPixelRatio;
  uniform vec3  uSP;
  attribute float aSize;
  attribute float aSeed;
  varying float vBright;
  varying float vHot;
  void main() {
    vec3 q = position - uSP;
    float tt = uTime * 0.16 * uMotion;
    float s = aSeed * 6.2831853;
    // Arnold–Beltrami–Childress flow: divergence-free swirl
    vec3 flow = vec3(
      sin(q.z * 5.0 + tt + s) + cos(q.y * 5.0 + tt * 1.3),
      sin(q.x * 5.0 + tt * 1.1 + s) + cos(q.z * 5.0 - tt),
      sin(q.y * 5.0 - tt * 0.9) + cos(q.x * 5.0 + tt * 0.7 + s)
    );
    vec3 p = position + flow * 0.022;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    float tw = 0.62 + 0.38 * sin(uTime * (0.7 + aSeed * 1.3) * uMotion + aSeed * 40.0);
    // a different third of the embers flares on each lub
    float pick = step(0.66, fract(aSeed * 13.7 + floor(uBeatPhase) * 0.618));
    vHot = pick * uLub;
    vBright = (tw + vHot * 0.9) * smoothstep(0.03, 0.09, depth);
    // mild perspective: embers near the lens read larger (creep parallax)
    float persp = clamp(0.55 / max(depth, 0.01), 1.0, 2.6);
    gl_PointSize = aSize * uPixelRatio * persp * (0.85 + 0.3 * tw + 0.35 * vHot);
    gl_Position = projectionMatrix * mv;
  }
`;

const EMBER_FRAG = /* glsl */ `
  uniform float uEmbers;
  uniform float uFrontR;
  uniform vec2  uRes;
  uniform vec3  cGold;
  uniform vec3  cCore;
  varying float vBright;
  varying float vHot;
  void main() {
    if (uFrontR > 0.0 && distance(gl_FragCoord.xy, 0.5 * uRes) < uFrontR) discard;
    float r = length(gl_PointCoord - 0.5);
    // a hot core and a soft halo
    float core = smoothstep(0.3, 0.0, r);
    float halo = smoothstep(0.5, 0.04, r);
    float a = core * 0.8 + halo * 0.32;
    if (a <= 0.003) discard;
    vec3 col = mix(cGold, cCore, core * (0.55 + 0.45 * vHot));
    gl_FragColor = vec4(col * a * vBright * uEmbers, 1.0);
  }
`;

export function buildEmbers(count: number, seed: number, radius: number, reduced: boolean, aspect = 1.6): THREE.Points {
  const rnd = seeded(seed);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  // the J4 reading pose looks down −z from just in front of the centre: keep
  // every sample inside that view cone, a quarter of the rest (the dark in
  // front of the reader is never empty; the creep still finds embers around)
  const camZ = -0.1; // ≈ (1.16 − SP.z) / 0.9R, in unit-ball coordinates
  const tanV = Math.tan((23 * Math.PI) / 180) * 1.1;
  const tanH = tanV * Math.max(0.4, aspect);
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (;;) {
      x = rnd() * 2 - 1;
      y = rnd() * 2 - 1;
      z = rnd() * 2 - 1;
      if (x * x + y * y + z * z > 1) continue;
      const depth = camZ - z;
      // the reading frustum (≈ 46° vertical, up to 16:9), a little generous
      const inView = depth > 0.08 && Math.abs(x) < depth * tanH && Math.abs(y) < depth * tanV;
      if (inView || rnd() < 0.1) break;
    }
    positions[i * 3] = SP[0] + x * radius;
    positions[i * 3 + 1] = SP[1] + y * radius;
    positions[i * 3 + 2] = SP[2] + z * radius;
    sizes[i] = 1.5 + Math.pow(rnd(), 1.8) * 2.5;
    seeds[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: EMBER_VERT,
    fragmentShader: EMBER_FRAG,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    // premultiplied additive: light on the dark dome, alpha untouched
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: reduced ? 0 : 1 },
      uBeatPhase: { value: 0 },
      uLub: { value: 0 },
      uPixelRatio: { value: 1 },
      uSP: { value: new THREE.Vector3(SP[0], SP[1], SP[2]) },
      uEmbers: { value: 0 },
      uFrontR: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      cGold: { value: SRGB.gold() },
      cCore: { value: SRGB.goldCore() },
    },
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}
