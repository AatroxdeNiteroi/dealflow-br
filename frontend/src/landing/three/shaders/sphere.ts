/* ============================================================
   three/shaders/sphere.ts — the company sphere (§7.4). Owner: WP-GL.

   Two opaque meshes on one SphereGeometry (fixes today's banding,
   which came from a transparent DoubleSide sphere without depth):
   - EXTERIOR (FrontSide, depth-writing). Dark state = today's look
     (ember core, veins, warm fresnel rim × uGateDark). As the camera
     closes on the membrane (uNear → 1) the body converges to the
     interior dome, so the contact frame at 465 is seamless. Lit state
     (≥ 1600) = a paper body with a crisp saturated gold rim LINE and
     a small gold core MARK (gold-on-paper rule: line/mark only).
     Leaving through the membrane (C4a, 1605) the lit body thickens
     from a film (uAlpha 0 → 1, drawn over the field) to the opaque,
     depth-writing body, so the field is never cut away in one frame.
   - INTERIOR (BackSide, depth-writing). Warm-black dome with the
     beat, a gold edge glow (rimIn) right after the crossing, and the
     screen-space dawn hole: the SAME frontR as CH1's ink twin
     (geometry.dawnFrontPx), so the text inverts exactly at the front.
   - ATMOSPHERE (BackSide shell 1.07×). Its visible part is the ring
     OUTSIDE the silhouette, i.e. over paper; gold light there would be
     a low-alpha gold wash (vetoed by the brand rule, §1.2). It is an
     ink penumbra instead — the body's presence on paper — gated by
     uGateDark; the gold stays on the dark body (fresnel rim).
   ============================================================ */

export const SPHERE_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

/** Shared by the exterior (contact blend) and the interior: identical maths
 *  on both sides of the membrane, so the crossing frame cannot pop. */
const DOME = /* glsl */ `
  uniform vec2  uRes;
  uniform float uBeat;
  uniform float uRimIn;
  uniform vec3  cDomeC;
  uniform vec3  cDomeE;
  uniform vec3  cGold;

  uniform float uDprD;

  // ±0.5/255 ordered noise: a dark gradient over ~900 px has ~17 code values
  // per channel, which would band into visible rings without it
  float dither(vec2 fc) {
    return fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715)))) - 0.5;
  }

  vec3 domeColour(vec2 fc, float nv) {
    vec2 c = 0.5 * uRes;
    float rUV = clamp(distance(fc, c) / (0.5 * length(uRes)), 0.0, 1.0);
    vec3 col = mix(cDomeC, cDomeE, smoothstep(0.0, 1.0, rUV)) * (1.0 + 0.08 * uBeat);
    // the membrane we just pierced still glows at the frame's edges: a thin
    // warm light hugging all four sides (+ grazing walls), fading by 520
    // distance to a rounded (superellipse) frame — hugs the edges, no mitred corners
    vec2 q = abs(fc - c) / c;
    float s = pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25);
    float m = min(c.x, c.y) / uDprD;
    float edge = max(0.0, 1.0 - s) * m;
    float fall = clamp(0.1 * m, 16.0, 46.0); // 46 px at 900 tall, tighter on phones
    float g = pow(1.0 - nv, 3.0) + 0.55 * exp(-edge / fall) + 0.25 * exp(-edge / (3.2 * fall));
    col += cGold * (uRimIn * g * 0.5);
    return col + dither(fc) / 255.0;
  }
`;

export const EXTERIOR_FRAG = /* glsl */ `
  uniform float uLit;
  uniform float uPulse;
  uniform float uTime;
  uniform float uMotion;
  uniform float uGateDark;
  uniform float uNear;
  uniform float uPixelRatio;
  uniform vec3  uAnchor;
  uniform vec3  uColB;
  uniform vec3  uColL;
  uniform vec3  uRim;
  uniform vec3  cLitA;
  uniform vec3  cLitB;
  uniform float uAlpha;
  varying vec3 vN;
  varying vec3 vV;
  ${DOME}

  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(vV);
    float nv = clamp(dot(N, V), 0.0, 1.0);
    float l = dot(N, normalize(vec3(-0.4, 0.55, 0.72))) * 0.5 + 0.5;
    vec3 c;
    if (uLit > 0.5) {
      // lit: a paper body, a saturated gold rim line, a small gold core mark
      c = mix(cLitA, cLitB, l * l);
      vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uPixelRatio;
      float dist = distance(fc, uAnchor.xy);
      // the core: a crisp saturated dot (a soft gold falloff would be a wash on paper)
      float coreR = clamp(uAnchor.z * 0.07, 1.25, 3.5);
      c = mix(c, cGold, (1.0 - smoothstep(coreR - 0.9, coreR, dist)) * 0.9);
      // the rim: a ~1.5 px saturated line at the silhouette, at any size
      // (pow(1 − N·V, 6) alone is sub-pixel when small and a gold band when large)
      float edgePx = uAnchor.z * (1.0 - sqrt(max(0.0, 1.0 - nv * nv)));
      float rim = 1.0 - smoothstep(0.7, 1.7, edgePx);
      c = mix(c, cGold, max(rim, pow(1.0 - nv, 24.0)));
    } else {
      // dark: today's body — ember core with the beat, glassy veins, warm rim on dark
      c = mix(uColB, uColL, l * l);
      float core = pow(nv, 1.7);
      c += vec3(0.62, 0.39, 0.13) * core * uPulse;
      float veins = 0.5 + 0.5 * sin(N.x * 22.0 + uTime * 0.3 * uMotion) * cos(N.y * 18.0);
      // veins fade as the body fills the frame (at full screen they read as a weave)
      c = mix(c, c * 0.72 + uColL * 0.2, veins * core * 0.4 * (1.0 - 0.7 * uGateDark));
      c += uRim * pow(1.0 - nv, 2.4) * 0.8 * uGateDark;
      if (uNear > 0.0) c = mix(c, domeColour(gl_FragCoord.xy, nv), uNear);
    }
    gl_FragColor = vec4(c + dither(gl_FragCoord.xy) / 255.0, uAlpha);
  }
`;

export const INTERIOR_FRAG = /* glsl */ `
  uniform float uFrontR;
  uniform float uPixelRatio;
  varying vec3 vN;
  varying vec3 vV;
  ${DOME}

  void main() {
    float nv = abs(dot(normalize(vN), normalize(vV)));
    vec2 fc = gl_FragCoord.xy;
    vec3 col = domeColour(fc, nv);
    float alpha = 1.0;
    if (uFrontR > 0.0) {
      // J5 dawn: a radial hole, centred, frontR = dawn · 0.56 · hypot(W, H).
      // Crisp on the paper side (the ink twin is clipped exactly at frontR, so
      // no grey film over it); the dark closes in over 8 px.
      float d = distance(fc, 0.5 * uRes);
      float px = uPixelRatio;
      if (d < uFrontR - 1.5 * px) discard;
      alpha = smoothstep(uFrontR - 1.5 * px, uFrontR + 8.0 * px, d);
      // the gold terminator: light on the dark limb only — never over the
      // semi-transparent edge, where it would read as a gold wash on paper
      float rim = exp(-pow((d - uFrontR - 9.0 * px) / (4.0 * px), 2.0)) * smoothstep(0.75, 0.98, alpha);
      col = mix(col, cGold, rim * 0.9);
    }
    gl_FragColor = vec4(col, alpha);
  }
`;

export const ATMO_FRAG = /* glsl */ `
  uniform vec2  uRes;
  uniform float uPixelRatio;
  uniform vec3  uAnchor;
  uniform float uGateDark;
  uniform vec3  cInk;
  void main() {
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uPixelRatio;
    float dist = distance(fc, uAnchor.xy);
    float w = max(uAnchor.z * 0.07, 1.0);
    float s = clamp((dist - uAnchor.z) / w, 0.0, 1.0);
    float a = (1.0 - s) * (1.0 - s) * 0.09 * uGateDark * step(uAnchor.z, dist + 0.5);
    if (a <= 0.002) discard;
    gl_FragColor = vec4(cInk, a);
  }
`;
