/* ============================================================
   three/shaders/beam.ts — the v3 phosphor sonar beam (spec rev 3.1
   §4.3). Owner: WP2.

   Geometry (three/instrument.ts buildBeamSector): a 128-segment sector
   on the instrument plane z = −1 (apex ON the hub), radius 12.8. Each rim
   vertex stores a normalised angle t ∈ [0, 1]; the vertex shader maps it
   to the local angle mix(−(uBack + uLag), +0.06, t), so the sector shrinks
   with τ in J2 (fill cost) and always contains the bent lead line. The
   mesh is rotated by θ each frame (local +x = the lead).

   Fragment — "on paper everything is ink" (§1.2):
   - the lead is a GOLD HAIRLINE (SRGB #cf9b1e = the DOM gold), 1.5–2.25
     CSS px, analytically anti-aliased in device px;
   - behind it, an INK veil (≤ 7 %) decaying as exp(−b/τ_v), τ_v =
     0.34·glowTau, with a 1.5-CSS-px paper grain re-seeded 12×/s, plus a
     5-px ink shade that gives the line its wet edge;
   - the veil exists ONLY behind the line (AA'd `behind` cut), so the only
     leading edge is the gold hairline, and the back edge is ≤ 1 % of
     peak: no straight edge anywhere, no gold halo, no trailing core;
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
/** Sector segments (§4.3). */
export const BEAM_SEGMENTS = 128;
/** Sector extent ahead of the (unbent) lead, rad. */
export const BEAM_AHEAD = 0.06;

export const BEAM_VERT = /* glsl */ `
  attribute float aT;
  uniform float uBack;
  uniform float uAhead;
  varying vec2 vLocal;
  void main() {
    vec2 p = vec2(0.0);
    if (aT >= 0.0) {
      float a = mix(-uBack, uAhead, aT);
      p = vec2(cos(a), sin(a)) * ${BEAM_RADIUS.toFixed(2)};
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

  // 1 inside any live rect, → 0 over a 12 CSS px feather (§4.4)
  float textMask(vec2 css) {
    float m = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 r = uTextMask[i];
      if (r.z > 0.0 && r.w > 0.0) m = max(m, 1.0 - smoothstep(0.0, 12.0, sdRect(css, r)));
    }
    return m;
  }

  void main() {
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
    vec2 gs = vec2(dot(gl, dFdx(vLocal)), dot(gl, dFdy(vLocal)));
    float sPx = a * r / max(length(gs), 1e-6);
    float dpx = abs(sPx);

    // the gold hairline (lead edge), cut by the needle
    float hw = 0.5 * uLineW * uDpr;
    float lineA = (1.0 - smoothstep(hw - 0.5, hw + 0.75, dpx)) * rad
                * (1.0 - smoothstep(uLineEnd - 0.6, uLineEnd, r));

    // ink veil + shade, behind the line only (AA'd cut: no leading edge but the line).
    // The needle ends them with the line (a touch earlier and softer), so past the
    // line's end there is never a veil edge without its gold line.
    float behind = 1.0 - smoothstep(-0.75, 0.75, sPx);
    float vEnd = 1.0 - smoothstep(uLineEnd - 1.4, uLineEnd - 0.2, r);
    float b = max(-a, 0.0);
    float grain = 0.75 + 0.5 * hash12(floor(gl_FragCoord.xy / (1.5 * uDpr)) + uGrainT);
    // (0.035 + 0.025·grain) at the default uVeilMax 0.07, scaled with the knob (§11 item 45)
    float veil = min(uVeilMax, exp(-b / uTauV) * uVeilMax * (0.5 + 0.357143 * grain) * rad) * behind * vEnd;
    float shade = exp(-(dpx / uDpr) / 5.0) * uShade * rad * behind * vEnd;

    vec2 css = vec2(gl_FragCoord.x / uDpr, uViewH - gl_FragCoord.y / uDpr);
    float inkA = (veil + shade) * (1.0 - lineA) * (1.0 - textMask(css));

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
