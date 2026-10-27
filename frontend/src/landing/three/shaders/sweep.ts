/* ============================================================
   three/shaders/sweep.ts — sweep wedge + instrument lines (§7.6).
   Owner: WP-GL.

   SWEEP: today's wedge shader, unchanged in look (angle and radius
   rebuilt per pixel — a seamless fan). Opacity × sweepGain (score);
   boost = flare + vel·.8 (dt-decayed flare).

   INSTRUMENT: ONE LineSegments draw for the 4 rings, the 60-tick dial
   and the crosshair (§10.4 "or one merged line set"). Each vertex
   carries its kind (0–3 ring i, 4 dial, 5 crosshair) and a position
   along its own path; the score's draw fractions cut it EXACTLY
   (fragment discard on the interpolated coordinate, so a ring
   undraws smoothly, never by whole segments). ringBoost[i] (G2
   shockwave light-up) lifts the ring's opacity and heats it to gold —
   a saturated line over paper, which the brand rule allows.
   ============================================================ */

import { SWEEP_RADIUS, TRAIL } from "../constants";

export const SWEEP_VERT = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SWEEP_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColorHot;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uMotion;
  uniform float uBoost;
  varying vec2 vLocal;
  void main() {
    float ang = atan(vLocal.y, vLocal.x);
    float vAng = clamp(1.0 + ang / ${TRAIL.toFixed(4)}, 0.0, 1.0);
    float vRad = clamp(length(vLocal) / ${SWEEP_RADIUS.toFixed(4)}, 0.0, 1.0);
    float trail = 1.0 - vAng;

    float rBody = smoothstep(0.0, 0.15, vRad) * (1.0 - smoothstep(0.60, 0.97, vRad));
    float rLine = smoothstep(0.0, 0.05, vRad) * (1.0 - smoothstep(0.92, 1.05, vRad));

    float body = pow(vAng, 1.7) * 0.17 * rBody;
    float leadGlow = pow(vAng, 6.0)   * 0.16 * rBody;
    float leadHalo = pow(vAng, 16.0)  * 0.48 * rLine;
    float shimmer = 0.86 + 0.14 * sin(uTime * 9.0 + vRad * 40.0) * uMotion;
    float leadCore = pow(vAng, 440.0) * 0.70 * rLine * shimmer;
    float trailHalo = pow(trail, 34.0)  * 0.18 * rLine;
    float trailCore = pow(trail, 440.0) * 0.62 * rLine;

    float boost = 1.0 + uBoost * 0.22;
    float lead = (leadGlow + leadHalo + leadCore) * boost;

    float alpha = (body + lead + trailHalo + trailCore) * uOpacity;
    vec3 col = mix(uColor, uColorHot, pow(vAng, 9.0));
    col += vec3(0.42, 0.30, 0.10) * pow(vAng, 60.0) * rLine * boost;
    if (alpha <= 0.0005) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export const LINE_VERT = /* glsl */ `
  attribute float aKind;
  attribute float aT;
  varying float vKind;
  varying float vT;
  void main() {
    vKind = aKind;
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const LINE_FRAG = /* glsl */ `
  uniform float uDraw[6];
  uniform float uBase[6];
  uniform float uBoost[4];
  uniform vec3 cLine;
  uniform vec3 cGold;
  uniform float uTicks;
  varying float vKind;
  varying float vT;
  void main() {
    int k = int(vKind + 0.5);
    float draw = 0.0;
    float base = 0.0;
    float boost = 0.0;
    // unrolled lookups (dynamic indexing of uniform arrays is not portable on ES 1)
    if (k == 0) { draw = uDraw[0]; base = uBase[0]; boost = uBoost[0]; }
    else if (k == 1) { draw = uDraw[1]; base = uBase[1]; boost = uBoost[1]; }
    else if (k == 2) { draw = uDraw[2]; base = uBase[2]; boost = uBoost[2]; }
    else if (k == 3) { draw = uDraw[3]; base = uBase[3]; boost = uBoost[3]; }
    else if (k == 4) { draw = uDraw[4]; base = uBase[4]; }
    else { draw = uDraw[5]; base = uBase[5]; }
    float a = base;
    if (k == 4) {
      // dial: ticks appear one by one; the last one fades in fractionally
      a *= clamp(draw * uTicks - vT * uTicks, 0.0, 1.0);
    } else {
      if (vT > draw) discard;
    }
    float b = clamp(boost, 0.0, 1.6);
    a = min(a + b * 0.42, 0.92);
    if (a <= 0.001) discard;
    vec3 col = mix(cLine, cGold, clamp(b, 0.0, 1.0));
    gl_FragColor = vec4(col, a);
  }
`;
