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

   v3 (spec rev 3.1 §4.7, WP2): RIBBON_* — rings, dial ticks and the
   crosshair as screen-space ribbons in ONE draw (three/ribbons.ts). The
   SWEEP_* / LINE_* programs above are kept verbatim for FLAGS.SONAR =
   false (v2 look) and for the boot frames before the v3 programs link.
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

/* ── v3 ribbons (§4.7) ───────────────────────────────────────────
   Vertex attributes (three/ribbons.ts):
     aKind  0–3 ring i · 4 dial tick · 5 crosshair arm
     aT     ring: arc fraction from 12 o'clock, clockwise · tick: i/60 · arm: 0/1
     aSide  ±1 across the ribbon
     aEnd   capsules: 0 = the anchored end A, 1 = the moving end B
     position  rings: unused · tick: (unit dir, inner radius) · arm: (unit dir, half length)
   Ring i: centre mix(hub, SP, travel_i); plane normal turns from ẑ to face
   the camera; radius mix(R_i, rT_i, travel_i) → mix(·, rT_0, merge), with
   the in-transit wobble 4t(1−t)(0.035 sin(2θ+p_i) + 0.025 sin(3θ+q_i)),
   the crest wobble of a passing front (G2 shock / C4b dust) and the lock
   flash ×(1 + 0.08·lockPulse). Each vertex is projected at θ and θ − ε for
   the screen tangent and extruded in device px (w = 1 after the divide, so
   the across/along varyings interpolate linearly on screen). Ticks and
   arms are capsule quads (A, B projected; round caps in the fragment).
   Fragment: analytic coverage of a round-capped stroke; the ring draw cut
   gets round tips at both ends (the closed loop supplies the geometry). */

export const RIBBON_VERT = /* glsl */ `
  attribute float aKind;
  attribute float aT;
  attribute float aSide;
  attribute float aEnd;

  uniform vec3 uHub;
  uniform vec3 uSP;
  uniform vec3 uCamPos;
  uniform float uR[4];
  uniform float uRT[4];
  uniform float uTravel[4];
  uniform float uMerge;
  uniform float uDraw[6];
  uniform float uBase[6];
  uniform float uBoost[4];
  uniform float uLock;
  uniform float uFade;
  uniform float uArrive;
  uniform vec2 uShock;
  uniform vec3 uCrestC;
  uniform float uCrestMode;
  uniform vec2 uViewport;
  uniform float uWidth;
  uniform float uWidth0;
  uniform float uWidthM;
  uniform float uPhP[4];
  uniform float uPhQ[4];
  uniform vec3 cLine;
  uniform vec3 cGold;

  varying float vKind;
  varying float vT;
  varying float vDraw;
  varying float vAcross;
  varying float vAlong;
  varying float vLen;
  varying float vHalf;
  varying float vPxPerT;
  varying vec3 vColor;
  varying float vAlpha;

  const float TAU = 6.28318530718;
  const float EPS = 0.002;

  vec4 clipOf(vec3 p) {
    return projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
  vec2 pxOf(vec4 c) {
    return (c.xy / c.w * 0.5 + 0.5) * uViewport;
  }

  void main() {
    int k = int(aKind + 0.5);
    vKind = aKind;
    vT = aT;
    vLen = 0.0;
    vAlong = 0.0;
    vPxPerT = 1.0;
    float draw = uDraw[k];
    vDraw = draw;
    float base = uBase[k];
    vec3 col = cLine;
    float alpha = base;
    vec4 c0;
    vec2 s;
    float hw;

    if (k < 4) {
      /* ── ring k ── */
      float tr = uTravel[k];
      vec3 c = mix(uHub, uSP, tr);
      vec3 n = normalize(mix(vec3(0.0, 0.0, 1.0), normalize(uCamPos - uSP), tr));
      vec3 e1 = normalize(vec3(1.0, 0.0, 0.0) - n.x * n);
      vec3 e2 = cross(n, e1);
      float R = uR[k];
      float r = mix(mix(R, uRT[k], tr), uRT[0], uMerge) * (1.0 + 0.08 * uLock);
      float wob = 4.0 * tr * (1.0 - tr);
      float p = uPhP[k];
      float q = uPhQ[k];
      float th = 1.57079632679 - aT * TAU;
      float th1 = th - EPS;
      // the crest of a passing front, where it crosses THIS vertex: the G2 shock is radial
      // around the hub axis (as the points' |p.xy|), the C4b dust front a sphere around SP
      vec3 pb = c + r * (cos(th) * e1 + sin(th) * e2);
      float zc = 2.0 * ((uCrestMode > 0.5 ? distance(pb, uCrestC) : length(pb.xy)) - uShock.x);
      float crest = uShock.y * exp(-zc * zc);
      float r0 = r * (1.0 + wob * (0.035 * sin(2.0 * th + p) + 0.025 * sin(3.0 * th + q))) + crest * sin(9.0 * th);
      float r1 = r * (1.0 + wob * (0.035 * sin(2.0 * th1 + p) + 0.025 * sin(3.0 * th1 + q))) + crest * sin(9.0 * th1);
      c0 = clipOf(c + r0 * (cos(th) * e1 + sin(th) * e2));
      vec4 c1 = clipOf(c + r1 * (cos(th1) * e1 + sin(th1) * e2));
      vec2 s0 = pxOf(c0);
      vec2 s1 = pxOf(c1);
      vec2 tg = s1 - s0;
      float tl = length(tg);
      tg = tl > 1e-7 ? tg / tl : vec2(1.0, 0.0);
      vPxPerT = tl / EPS * TAU;
      float w = mix(k == 0 ? uWidth0 : uWidth, uWidthM, uMerge);
      hw = 0.5 * w;
      float ext = hw + 1.0;
      s = s0 + vec2(-tg.y, tg.x) * aSide * ext;
      vAcross = aSide * ext;
      // G2 light-up + lock flash: a saturated line, never a wash (gold rule)
      float b = clamp(uBoost[k], 0.0, 1.6);
      alpha = min(base + b * 0.42, 0.92);
      col = mix(cLine, cGold, clamp(b, 0.0, 1.0));
      // in transit the ring condenses into the reticle it becomes
      alpha = mix(alpha, max(alpha, uArrive), smoothstep(0.0, 1.0, tr));
      alpha *= uFade;
      // the lock flash (@345, mid hand-off): a gold meniscus ring 1.08 → 1 that the hand-off
      // fade does not swallow (it decays with the pulse itself)
      alpha = min(alpha + uLock * 0.42, 0.92);
      col = mix(col, cGold, uLock);
      if (draw <= 0.0) alpha = 0.0;
    } else {
      /* ── capsules: dial tick (k 4) or crosshair arm (k 5) ── */
      vec2 dir = position.xy;
      vec3 A;
      vec3 B;
      float on;
      if (k == 4) {
        float pr = clamp(draw * 60.0 - aT * 60.0, 0.0, 1.0);
        A = uHub + vec3(dir * 12.8, 0.0);
        B = uHub + vec3(dir * mix(12.8, position.z, pr), 0.0);
        on = smoothstep(0.0, 0.2, pr);
      } else {
        float L = position.z * draw;
        A = uHub - vec3(dir * L, 0.0);
        B = uHub + vec3(dir * L, 0.0);
        on = smoothstep(0.0, 0.08, draw);
      }
      vec4 cA = clipOf(A);
      vec4 cB = clipOf(B);
      vec2 sA = pxOf(cA);
      vec2 sB = pxOf(cB);
      vec2 d = sB - sA;
      float L = length(d);
      vec2 u = L > 1e-4 ? d / L : normalize(pxOf(clipOf(uHub + vec3(dir, 0.0))) - pxOf(clipOf(uHub)) + vec2(1e-6, 0.0));
      hw = 0.5 * uWidth;
      float ext = hw + 1.0;
      bool atB = aEnd > 0.5;
      c0 = atB ? cB : cA;
      s = (atB ? sB + u * ext : sA - u * ext) + vec2(-u.y, u.x) * aSide * ext;
      vAlong = atB ? L + ext : -ext;
      vAcross = aSide * ext;
      vLen = L;
      alpha = base * on;
    }

    vHalf = hw;
    vColor = col;
    vAlpha = alpha;
    if (c0.w <= 1e-4 || alpha <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // behind the eye or off: outside the clip volume
    } else {
      gl_Position = vec4(s / uViewport * 2.0 - 1.0, c0.z / c0.w, 1.0);
    }
  }
`;

export const RIBBON_FRAG = /* glsl */ `
  varying float vKind;
  varying float vT;
  varying float vDraw;
  varying float vAcross;
  varying float vAlong;
  varying float vLen;
  varying float vHalf;
  varying float vPxPerT;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d;
    if (vKind < 3.5) {
      // ring: inside the drawn arc the distance is across only; past the cut,
      // the nearer of the two round tips (end at draw, start at T = 0 ≡ 1)
      if (vT <= vDraw) d = abs(vAcross);
      else d = length(vec2(min(vT - vDraw, 1.0 - vT) * vPxPerT, vAcross));
    } else {
      d = length(vec2(max(max(-vAlong, vAlong - vLen), 0.0), vAcross));
    }
    float cov = 1.0 - smoothstep(vHalf - 0.5, vHalf + 0.5, d);
    float a = vAlpha * cov;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;
