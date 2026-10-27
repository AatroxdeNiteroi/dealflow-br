/* ============================================================
   three/shaders/points.ts — base points + dust (§7.5). Owner: WP-GL.

   One vertex/fragment pair; `#define DUST` builds the dust variant.
   Park parity: at the plans backdrop every new term is identity
   (no focus, warp, shock, ripples; near fade and local bokeh are 1/0
   at park depths ≥ 14), so the base points draw exactly as today.

   New over today's shader:
   - analytic charge (aAngle): the gold trail is a closed form of the
     sweep angle — no 2,772-iteration CPU loop, no attribute upload;
   - depthTest against the opaque sphere (set on the material);
   - near-camera handling: fade smoothstep(.35, 1.2, depth), sprite
     cap, local bokeh max(uSoft, 1 − smoothstep(.6, 2.5, depth)),
     radial speed-stretch ellipse (uWarp);
   - G2 shockwave (+.8 resolved, .25 radial push), rack focus,
     deterministic ink ripples (uRings), C4b dust wavefront;
   - the heartbeat phase is integrated on the CPU (uBeatPhase): the
     old fract(uTime/period) drifted out of rhythm as uTime grew.
   ============================================================ */

export const POINT_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uBeatPhase;
  uniform vec2  uMouse;
  uniform float uMouseR;
  uniform float uAspect;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uSizeCap;
  uniform float uSoft;
  uniform float uFocus;
  uniform float uSweepAngle;
  uniform float uChargeSpan;
  uniform float uChargeGain;
  uniform float uPulse;
  uniform float uPulseT;
  uniform float uShockR;
  uniform float uWarp;
  uniform vec2  uViewport;
  uniform vec4  uRings[6];
  uniform vec3  uSP;
  uniform float uWave;
  uniform float uWaveGain;
  uniform float uBaseWave;

  attribute float aSize;
  attribute float aSeed;
  attribute float aAngle;

  varying float vResolved;
  varying float vThrob;
  varying float vSeed;
  varying float vDepth;
  varying float vCharge;
  varying float vSoft;
  varying float vNear;
  varying float vStretch;
  varying vec2  vDir;
#ifdef DUST
  varying float vReveal;
#endif

  const float TAU = 6.2831853;
  const float CHARGE_LIFE = 6.5;
  const float PULSE_LIFE = 2.4;

  void main() {
    vSeed = aSeed;

    // analytic charge — the sweep deposits gold that cools over CHARGE_LIFE
    float behind = mod(uSweepAngle - aAngle, TAU);
    float charge = clamp(1.0 - behind / uChargeSpan, 0.0, 1.0) * uChargeGain;
    // G2 contact flare: a SHORT, partial charge flash that cools quadratically,
    // so the shock front and the ring light-up stay the readable event
    // (integration: a full-field 6.5 s charge flooded the hero under the card)
    float pk = clamp(1.0 - (uTime - uPulseT) / PULSE_LIFE, 0.0, 1.0);
    charge = max(charge, uPulse * pk * pk);
    vCharge = charge;

    vec3 p = position;
    float drift = uTime * 0.13 + aSeed * TAU;
    p.x += sin(drift) * 0.04;
    p.y += cos(drift * 0.92) * 0.04;
#ifndef DUST
    p.x += sin(uTime * 0.42 + aSeed * 9.3) * 0.15 * charge;
    p.y += cos(uTime * 0.37 + aSeed * 6.7) * 0.15 * charge;
#endif

    float flash = 0.0;
    // G2 — the shockwave front wakes the field ("o radar acorda")
    if (uShockR > 0.0) {
      float rl = length(p.xy);
      float k = 1.0 - smoothstep(0.0, 0.6, abs(rl - uShockR));
      p.xy += (rl > 1e-4 ? p.xy / rl : vec2(0.0)) * (0.25 * k);
      flash += 0.8 * k;
    }

    // C4b — the dust wave grows from the company
    float wd = distance(position, uSP);
    float waveR = uWave * 30.0;
#ifdef DUST
    vReveal = clamp((waveR - wd) / 1.5 + 1.0, 0.0, 1.0) * uWaveGain * step(0.0001, uWave);
    flash += 0.6 * exp(-pow((wd - waveR) / 0.9, 2.0)) * vReveal;
#else
    if (uBaseWave > 0.5 && uWave > 0.0) {
      flash += 0.6 * exp(-pow((wd - waveR) / 0.9, 2.0)) * uWaveGain;
    }
#endif

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 na = vec2(ndc.x * uAspect, ndc.y);
    float mouseResolved = 1.0 - smoothstep(0.0, uMouseR, distance(na, uMouse));
    float resolved = clamp(max(mouseResolved, charge) + flash, 0.0, 1.0);

    // heartbeat — one lub-dub travelling out from the centre
    float rDist = length(position.xy);
    float bphase = fract(uBeatPhase - rDist * 0.035 - aSeed * 0.02);
    float lub = exp(-pow((bphase - 0.05) * 13.0, 2.0));
    float dub = exp(-pow((bphase - 0.20) * 15.0, 2.0)) * 0.58;
    float beat = min(lub + dub, 1.0);

    vResolved = resolved;
    vThrob = resolved * beat;
    vDepth = -mv.z;
    vNear = smoothstep(0.35, 1.2, vDepth);

#ifdef DUST
    vSoft = 0.0;
    float size = clamp(aSize * uSizeScale / max(vDepth, 0.5), 1.0, 2.0) * uPixelRatio;
#else
    vSoft = max(uSoft, 1.0 - smoothstep(0.6, 2.5, vDepth));
    float px = aSize * uSizeScale / max(vDepth, 0.5);
    float size = px * uPixelRatio
      * (1.0 + vResolved * 1.05 + vThrob * 1.05)
      * (1.0 + vSoft * 0.8)
      * (1.0 + 0.12 * uFocus);
#endif

    // deterministic ink ripples (§7.8): a ring of displacement, ink only
    if (clip.w > 0.0) {
      vec2 sp = vec2((ndc.x * 0.5 + 0.5) * uViewport.x, (0.5 - ndc.y * 0.5) * uViewport.y);
      vec2 off = vec2(0.0);
      float rw = 0.0;
      for (int i = 0; i < 6; i++) {
        vec4 R = uRings[i];
        if (R.w <= 0.0) continue;
        vec2 dv = sp - R.xy;
        float d = length(dv);
        // R.w is the crest weight (1 = a default-amp event at birth, fading to 0)
        float w = exp(-pow((d - R.z) / 18.0, 2.0)) * R.w;
        rw += w;
        if (d > 0.001) off += dv / d * (6.0 * w);
      }
      clip.xy += vec2(off.x, -off.y) * (2.0 / uViewport) * clip.w;
      size *= 1.0 + 0.45 * rw;
    }

    // radial speed-stretch (J3, desktop tier ≤ 1): an ellipse pointing away from the centre
    float stretch = 1.0;
    vec2 dir = vec2(1.0, 0.0);
#ifndef DUST
    if (uWarp > 0.0) {
      float rl = length(na);
      dir = rl > 1e-4 ? na / rl : vec2(1.0, 0.0);
      stretch = 1.0 + min(1.5, uWarp * (0.35 + 0.65 * min(length(ndc), 1.0)));
    }
    size = min(size, uSizeCap);
#endif
    vStretch = stretch;
    vDir = dir;
    gl_PointSize = size * stretch;
    gl_Position = clip;
  }
`;

export const POINT_FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uInkDeep;
  uniform vec3 uGold;
  uniform float uOpacity;
  uniform float uDive;
  uniform float uFocus;

  varying float vResolved;
  varying float vThrob;
  varying float vSeed;
  varying float vDepth;
  varying float vCharge;
  varying float vSoft;
  varying float vNear;
  varying float vStretch;
  varying vec2  vDir;
#ifdef DUST
  varying float vReveal;
#endif

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    // un-stretch the ellipse back to the unit disc (identity when vStretch = 1)
    vec2 d = vec2(vDir.x, -vDir.y);
    vec2 pd = vec2(-d.y, d.x);
    vec2 q = d * dot(uv, d) + pd * (dot(uv, pd) * vStretch);
    float r = length(q);

#ifdef DUST
    if (vReveal <= 0.001) discard;
    float core = smoothstep(0.5, 0.22, r);
    if (core <= 0.001) discard;
    vec3 col = mix(uInk, uInkDeep, clamp(vResolved * 0.85, 0.0, 1.0));
    col = mix(col, uGold, vCharge * 0.6);
    float alpha = (0.32 + vCharge * 0.3 + vResolved * 0.3) * vReveal * vNear;
    gl_FragColor = vec4(col, core * alpha);
#else
    // crisp disc by default; a soft bokeh blob near the lens and in the interior
    float core = smoothstep(0.5, mix(0.44, 0.05, vSoft), r);
    if (core <= 0.001) discard;

    float dark = clamp(vResolved + vThrob * 0.45, 0.0, 1.0);
    vec3 col = mix(uInk, uInkDeep, dark);

    // sphere imposter — 3D volume while the camera is among the points
    float sphereAmt = uDive * clamp(1.35 - vDepth * 0.07, 0.12, 1.0);
    vec2 n2 = q * 2.0;
    float nz = sqrt(max(0.0, 1.0 - dot(n2, n2)));
    vec3 nrm = vec3(n2, nz);
    vec3 lightDir = normalize(vec3(-0.45, 0.6, 0.85));
    float diff = max(dot(nrm, lightDir), 0.0);
    float spec = pow(nz, 3.0) *
      pow(max(dot(reflect(-lightDir, nrm), vec3(0.0, 0.0, 1.0)), 0.0), 22.0);
    col *= mix(1.0, 0.40 + 0.80 * diff, sphereAmt);
    col += vec3(1.0, 0.96, 0.86) * spec * sphereAmt * 0.6;

    // the sweep's charge: gold cooling over the ink (saturated, never a wash)
    col = mix(col, uGold, vCharge * 0.55);
    col += uGold * pow(vCharge, 2.0) * 0.35;

    float depthFade = clamp(1.15 - max(vDepth - 7.0, 0.0) * 0.045, 0.35, 1.0);
    float dimAlpha = (0.42 + vSeed * 0.30) * depthFade;
    float litAlpha = (0.92 + vThrob * 0.08) * depthFade;
    float alpha = mix(dimAlpha, litAlpha, vResolved) + vCharge * 0.22;

    gl_FragColor = vec4(col, core * alpha * uOpacity * vNear * (1.0 - 0.18 * uFocus));
#endif
  }
`;
