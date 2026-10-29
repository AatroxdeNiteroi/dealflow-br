/* ============================================================
   three/shaders/beam.ts — the v3 phosphor sonar beam (spec rev 3.1
   §4.3). Owner: WP2.

   Geometry (three/instrument.ts buildBeamSector): a fan sector on the
   instrument plane z = −1 (apex ON the hub), radius ≤ 12.8. Each rim
   vertex stores a normalised angle t ∈ [0, 1]; the vertex shader maps it
   to the local angle mix(−(uBack + uLag), +0.06, t), so the sector shrinks
   with τ in J2 (fill cost) and always contains the bent lead line, and
   puts its CHORDS at uRadius = min(12.8, uFadeR, line end) (vertices at
   uRadius / cos(half a segment)): the polygon always contains the disc the
   fragment shader draws, and nothing past the radial fade or the needle is
   ever rasterised. Everything visible fades out radially before the rim, so
   the rim's facets never show: 32 segments (spec: 128) — four times fewer
   sliver triangles meeting at the apex, whose 2×2-quad overshading near
   the hub was a measurable part of the fill cost. The mesh is rotated by θ
   each frame (local +x = the lead).

   Fragment — "on paper everything is ink" (§1.2):
   - the lead is a GOLD HAIRLINE (SRGB #cf9b1e = the DOM gold), 1.5–2.25
     CSS px, analytically anti-aliased in device px;
   - behind it, an INK veil (≤ 7 %) decaying as exp(−b/τ_v), τ_v =
     0.34·glowTau, with a 1.5-CSS-px paper grain re-seeded 12×/s, plus a
     5-px ink shade that gives the line its wet edge;
   - the veil exists ONLY behind the line (AA'd `behind` cut), so the only
     leading edge is the gold hairline; the sector ends 3.7 τ_v behind it
     (spec: 4.6 τ_v), where the veil is 2.5 % of its peak, i.e. < 0.5 of an
     8-bit step on paper even at the salience cap uVeilMax 0.09 — the same
     invisible back edge as 4.6 τ_v, ~20 % less fill in J1 (fragments past
     that already discard): no straight edge anywhere, no gold halo, no
     trailing core;
   - the spoon lag bends the line backwards (the rim trails):
     φ_line(r) = −uLag·(r/12.8)², uLag ∈ [0, 0.35] rad;
   - the radial window fades in from the hub (0.35–0.9 world) and out
     before the visible half-diagonal (uFadeR), so the dial-radius arc
     never shows; the needle (J2) shortens the line onto the target;
   - uTextMask (§4.4): the veil and the shade fade to 0 under free text
     (Gateway, HUD), 12 px feather. Output is premultiplied.

   Signed px distance to the bent line: d = a·r (a = signed angle from the
   line), divided by |∇_screen d|, with ∇_local d evaluated analytically
   and pushed through the local→screen Jacobian (dFdx/dFdy of vLocal). It
   stays exact under perspective and at any DPR (no fwidth heuristics).
   ============================================================ */

/** Max outer radius of the sector (world, z = −1 plane). */
export const BEAM_RADIUS = 12.8;
/** Sector segments (§4.3 says 128; 32 — see the header: the rim is never visible). */
export const BEAM_SEGMENTS = 32;
/** Sector extent ahead of the (unbent) lead, rad. */
export const BEAM_AHEAD = 0.06;
/** Back extent of the sector, in veil time constants (§4.3 says 4.6; at 3.7 the veil is 2.5 % of
 *  its peak = < 0.5 LSB on paper up to uVeilMax 0.09, and the fragments past it discard anyway). */
export const BEAM_BACK_TAU = 3.7;
/** Back extent cap, rad (§4.3). */
export const BEAM_BACK_MAX = 2.6;

export const BEAM_VERT = /* glsl */ `
  attribute float aT;
  uniform float uBack;
  uniform float uAhead;
  uniform float uRadius;
  uniform float uSegs;
  varying vec2 vLocal;
  void main() {
    vec2 p = vec2(0.0);
    if (aT >= 0.0) {
      float a = mix(-uBack, uAhead, aT);
      // chords at uRadius: the polygon contains the whole disc of radius uRadius
      p = vec2(cos(a), sin(a)) * (uRadius / cos(0.5 * (uBack + uAhead) / uSegs));
    }
    vLocal = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, position.z, 1.0);
  }
`;

export const BEAM_FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uGold;
  uniform float uLag;
  uniform float uFadeR;
  uniform float uLineW;
  uniform float uLineEnd;
  uniform float uTauV;
  uniform float uVeilMax;
  uniform float uShade;
  uniform float uGain;
  uniform float uDpr;
  uniform float uViewH;
  uniform vec2 uGrainT;
  uniform vec4 uTextMask[4];
  uniform float uMaskN;
  varying vec2 vLocal;

  // integer-lattice hash (no sin: stable at any coordinate, any GPU)
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float sdRect(vec2 p, vec4 r) {
    vec2 hs = 0.5 * r.zw;
    vec2 q = abs(p - (r.xy + hs)) - hs;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  }

  // 1 inside any live rect, → 0 over a 12 CSS px feather (§4.4); the driver packs the live
  // rects first and passes their count, so a frame without free text pays nothing here
  float textMask(vec2 css) {
    float m = 0.0;
    for (int i = 0; i < 4; i++) {
      if (float(i) >= uMaskN) break;
      m = max(m, 1.0 - smoothstep(0.0, 12.0, sdRect(css, uTextMask[i])));
    }
    return m;
  }

  void main() {
    // screen derivatives first, in uniform control flow
    vec2 ddx = dFdx(vLocal);
    vec2 ddy = dFdy(vLocal);
    float r = length(vLocal);
    float rad = smoothstep(0.35, 0.9, r) * (1.0 - smoothstep(0.7 * uFadeR, uFadeR, r));
    if (rad <= 0.0) discard;

    // spoon lag: the rim trails (positive lag → the line bends backwards)
    float rn = r / ${BEAM_RADIUS.toFixed(2)};
    float lagK = uLag * rn * rn;
    float a = atan(vLocal.y, vLocal.x) + lagK;     // 0 on the line, < 0 behind

    // signed device-px distance to the bent line: d = a·r over |grad_screen d|
    vec2 pr = vLocal / r;
    vec2 gl = a * pr + vec2(-pr.y, pr.x) + (2.0 * lagK) * pr;
    float sPx = a * r / max(length(vec2(dot(gl, ddx), dot(gl, ddy))), 1e-6);
    float dpx = abs(sPx);
    float b = max(-a, 0.0);
    float hw = 0.5 * uLineW * uDpr;

    // far behind the line, where neither the veil nor the shade reaches half an 8-bit
    // step and there is no line: leave before the grain, the mask and the blend
    float glow = exp(-b / uTauV);
    if (glow * uVeilMax * uGain * rad < 0.0019 && dpx > max(hw + 0.75, 20.0 * uDpr)) discard;

    // the gold hairline (lead edge), cut by the needle
    float lineA = (1.0 - smoothstep(hw - 0.5, hw + 0.75, dpx)) * rad
                * (1.0 - smoothstep(uLineEnd - 0.6, uLineEnd, r));

    // ink veil + shade, behind the line only (AA'd cut: no leading edge but the line).
    // The needle ends them with the line (a touch earlier and softer), so past the
    // line's end there is never a veil edge without its gold line.
    float behind = (1.0 - smoothstep(-0.75, 0.75, sPx)) * (1.0 - smoothstep(uLineEnd - 1.4, uLineEnd - 0.2, r));
    float grain = 0.75 + 0.5 * hash12(floor(gl_FragCoord.xy / (1.5 * uDpr)) + uGrainT);
    // (0.035 + 0.025·grain) at the default uVeilMax 0.07, scaled with the knob (§11 item 45)
    float veil = min(uVeilMax, glow * uVeilMax * (0.5 + 0.357143 * grain) * rad);
    float shade = exp(-(dpx / uDpr) / 5.0) * uShade * rad;
    float inkA = (veil + shade) * behind * (1.0 - lineA);
    if (uMaskN > 0.5) inkA *= 1.0 - textMask(vec2(gl_FragCoord.x / uDpr, uViewH - gl_FragCoord.y / uDpr));

    float A = (inkA + lineA) * uGain;
    if (A < 0.0015) discard;
    gl_FragColor = vec4(uInk * inkA + uGold * lineA, inkA + lineA) * uGain;
  }
`;

/** Salience knobs (§4.3, §11 item 45), in tuning order with their caps.
 *  veilMax and lineW are read by field/beam.ts; afterglowDark, glowSize and
 *  pingAlphaExp are the point-shader knobs (WP3). */
export const BEAM_KNOBS = {
  veilMax: { value: 0.07, cap: 0.09 },
  afterglowDark: { value: 0.85, cap: 1.0 },
  glowSize: { value: 0.55, cap: 0.8 },
  lineW: { value: 1.5, cap: 2.0 },
  pingAlphaExp: { value: 0.7, cap: 0.5 },
} as const;

/** The ink shade right behind the line (alpha at the line, 5 CSS px decay). */
export const BEAM_SHADE = 0.1;
/** Gold rule (§1.2): a gold line on paper is ≤ 2.25 px. */
export const BEAM_LINE_MAX = 2.25;
