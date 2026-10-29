/* ============================================================
   three/shaders/points.ts — base points + dust (§7.5) and the v3
   sonar path (spec rev 3.1 §4.4–§4.6). Owner: WP3.

   One vertex/fragment pair; `#define DUST` builds the v2 dust variant,
   `#define SONAR` the v3 sonar variant of the base points (a separate
   program, swapped in by field/sonar.ts only while uSonar > 0, so the
   v2 path never pays for it). Without SONAR every line below computes
   exactly what v2 computed (park parity, the protected interior).
   Park parity: at the plans backdrop every new term is identity
   (no focus, warp, shock, ripples; near fade and local bokeh are 1/0
   at park depths ≥ 14), so the base points draw exactly as today.

   v2 (unchanged): analytic charge (aAngle), depthTest against the
   opaque sphere, near-camera fade / sprite cap / local bokeh / radial
   speed-stretch, G2 shockwave, rack focus, deterministic ink ripples
   (uRings; a negative weight = the J2 inward implosion pulls instead
   of pushing), C4b dust wavefront, CPU-integrated heartbeat phase.

   SONAR (every term × uSonar = max(sonar, sonarC4)·ready; echoes,
   capture, lens, decoys and the wake are J1–J2 only, uploaded × sonar):
   - bearing φ = the angle at which the DRAWN beam covers the bead (its
     projection onto the beam plane z = −1 along the camera ray, as β_SP,
     §4.3) + lag(ρ): rings and afterglow sit under the hairline at any
     camera pose (spec: aAngle + 0.06·(z + 1), which pinged far beads up
     to 0.3 rad ahead of the line); b behind the lead,
     the J2 searchlight blend; afterglow exp(−bb/τ): ink develops
     (no gold), the bead swells and gains alpha;
   - the legacy gold charge and the per-point jiggle give way to the
     current (three/flow.ts, exact TS mirror for the CPU readers);
   - pings: every bead the lead crosses rings once (ink; gold on the top
     decile by size); the G2 shock front is the first ping;
   - echo wavefronts from 6 crests (lift, push, darken, swell);
   - decoys (aTag 1–3): a gold meniscus line and ×1.8, then struck to
     ink α 0.35; echo sources (aTag 4) emit, never get pushed;
   - liquid capture into a bead meniscus at R_m around SP, radial
     focus (replaces the flat fieldOp), screen-space lens behind SP;
   - cursor: a water-drop dimple + a 5-node spring wake;
   - pinned beads (aIndex ∈ uPinned[8]) skip every displacement except
     the flow, so DOM leaders stay on them;
   - depth of field (energy-conserving CoC, uFocusD), wet ink beads
     (diluted core, meniscus rim, paper highlight) instead of the white
     specular imposter;
   - uTextMask: afterglow darkening, ping rings and echo darkening fade
     to 0 inside 4 CSS-px rects (12 px feather), so free text sits on
     clean paper.
   DUST_SONAR (own program): the J1 hidden universe — a prefix of the
   dust buffer lit only in the afterglow, vertex-bound (beads outside the
   afterglow are culled in the vertex shader).
   ============================================================ */

import { FLOW_GLSL } from "../flow";

/** sdRect text mask over 4 CSS-px rects (x, y, w, h; 0-area = unused), 12 px feather. */
const TEXT_MASK_GLSL = /* glsl */ `
  float textMask(vec2 sp) {
    float m = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 r = uTextMask[i];
      if (r.z <= 0.0 || r.w <= 0.0) continue;
      vec2 hs = 0.5 * r.zw;
      vec2 q = abs(sp - (r.xy + hs)) - hs;
      float sd = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0);
      m = max(m, 1.0 - smoothstep(0.0, 12.0, sd));
    }
    return m;
  }
`;

/** The bearing (and radius / 12.8) at which the drawn beam covers a point: its projection onto the
 *  beam plane z = −1 along the ray from the camera (three's built-in cameraPosition) — the same
 *  construction as β_SP (§4.3), so rings and afterglow sit exactly under the hairline at any pose.
 *  Exact TS mirror: three/sonar.ts hubBearing(). */
const HUB_BEARING_GLSL = /* glsl */ `
  float hubBearing(vec3 q, out float rhoN) {
    float dz = q.z - cameraPosition.z;
    if (dz > -1e-3) {
      rhoN = length(q.xy) / 12.8;
      return atan(q.y, q.x);
    }
    float t = (-1.0 - cameraPosition.z) / dz;
    vec2 h = cameraPosition.xy + (q.xy - cameraPosition.xy) * t;
    rhoN = length(h) / 12.8;
    return atan(h.y, h.x);
  }
`;

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
#ifdef SONAR
  uniform float uSonar;
  uniform float uSonarJ;
  uniform float uTheta;
  uniform float uLag;
  uniform float uSeek;
  uniform float uGlowTau;
  uniform float uGlowDark;
  uniform float uGlowSize;
  uniform float uPingOn;
  uniform float uPingGold;
  uniform float uPingGoldMix;
  uniform float uPingExp;
  uniform float uPingGain;
  uniform vec4  uEcho[6];
  uniform float uEchoA[6];
  uniform vec3  uFlowPhase;
  uniform float uFlowAmp;
  uniform float uFlowW3;
  uniform float uCapture;
  uniform float uRm;
  uniform vec3  uViewDir;
  uniform vec4  uLens;
  uniform float uLensD;
  uniform float uDof;
  uniform float uFocusD;
  uniform float uCocMax;
  uniform vec3  uDecoy;
  uniform vec3  uDecoyR;
  uniform vec3  uWake[5];
  uniform vec2  uWakeV[5];
  uniform float uWakeR;
  uniform float uPinned[8];
  uniform vec4  uTextMask[4];
  uniform vec2  uMousePx;
  uniform float uMouseOn;
  uniform float uFocalPx;
  uniform float uOpacity;

  attribute float aTag;
  attribute float aIndex;
#endif

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
#ifdef SONAR
  /** ring: radius, half width (sprite units, 0.5 = sprite edge), alpha, gold */
  varying vec4 vRing;
  /** bead fraction of the sprite, afterglow dark, afterglow alpha add, DOF alpha */
  varying vec4 vSon;
  /** DOF softness, decoy reject, meniscus dark, opacity */
  varying vec4 vSon2;
#endif
#ifdef DBG_PIN
  /** dev readback probe only: the pinned slot (−1 = not pinned) */
  varying float vPinSlot;
#endif

  const float TAU = 6.2831853;
  const float CHARGE_LIFE = 6.5;
  const float PULSE_LIFE = 2.4;
#ifdef SONAR
  const float PI = 3.14159265;
  ${FLOW_GLSL}
  ${TEXT_MASK_GLSL}
  ${HUB_BEARING_GLSL}
#endif

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
#ifdef SONAR
    // the legacy gold charge is off in the sonar path (§4.4 charge)
    charge *= 1.0 - uSonar;
#endif
    vCharge = charge;

    vec3 p = position;
    float drift = uTime * 0.13 + aSeed * TAU;
#ifdef SONAR
    // the per-point jiggle gives way to the current (the only motion of a pinned bead)
    float jig = 0.04 * (1.0 - uSonar);
    p.x += sin(drift) * jig;
    p.y += cos(drift * 0.92) * jig;
#else
    p.x += sin(drift) * 0.04;
    p.y += cos(drift * 0.92) * 0.04;
#endif
#ifndef DUST
    p.x += sin(uTime * 0.42 + aSeed * 9.3) * 0.15 * charge;
    p.y += cos(uTime * 0.37 + aSeed * 6.7) * 0.15 * charge;
#endif

#ifdef SONAR
    // pinned beads carry a DOM label / chip: only the (mirrored) flow moves them
    float pinned = 0.0;
    for (int k = 0; k < 8; k++) pinned = max(pinned, 1.0 - step(0.5, abs(aIndex - uPinned[k])));
    float freeK = 1.0 - pinned;
#ifdef DBG_PIN
    vPinSlot = -1.0;
    for (int k = 0; k < 8; k++) if (abs(aIndex - uPinned[k]) < 0.5) vPinSlot = float(k);
#endif
    float isSource = step(3.5, aTag);
    // the current: a divergence-free stream (three/flow.ts; CPU mirror for the readers)
    p += flowOffsetW(p, uFlowPhase, uFlowAmp, uFlowW3);
    // behind the lead: the bearing the drawn beam covers the (flowed) bead at + the spoon lag
    float rhoN;
    float phi = hubBearing(p, rhoN);
    phi += uLag * rhoN * rhoN;
    float bAng = mod(uTheta - phi, TAU);
    float bSym = abs(mod(uTheta - phi + PI, TAU) - PI);
    float bb = mix(bAng, bSym, smoothstep(0.2, 0.6, uSeek));
    float glow = exp(-bb / max(uGlowTau, 0.01)) * uSonar;
    // echo wavefronts: crests travelling out of the struck sources
    float crest = 0.0;
    vec3 push = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      float A = uEchoA[i];
      if (A <= 0.0) continue;
      vec3 dv = p - uEcho[i].xyz;
      float dl = length(dv);
      float xc = (dl - uEcho[i].w) / 0.45;
      float c = exp(-xc * xc) * A;
      crest += c;
      if (dl > 1e-4) push.xy += dv.xy / dl * (0.06 * c);
      push.z += 0.22 * c;
    }
    p += push * (freeK * (1.0 - isSource));
    float shockPing = 0.0;
#endif

    float flash = 0.0;
    // G2 — the shockwave front wakes the field ("o radar acorda")
    if (uShockR > 0.0) {
      float rl = length(p.xy);
      float k = 1.0 - smoothstep(0.0, 0.6, abs(rl - uShockR));
      p.xy += (rl > 1e-4 ? p.xy / rl : vec2(0.0)) * (0.25 * k);
      flash += 0.8 * k;
#ifdef SONAR
      // the shock front is the first ping: crest lift, and a ring behind the front
      p.z += 0.30 * k * uSonar;
      shockPing = rl <= uShockR ? clamp(1.0 - (uShockR - rl) / 0.9, 0.0, 1.0) : 0.0;
#endif
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

#ifdef SONAR
    // liquid capture: the near field drains toward SP with a swirl and packs into a bead
    // meniscus that RINGS the disc on screen (never inside 0.97 R_m, never over the disc);
    // far beads dim radially. Exact CPU mirror: three/sonar.ts captureDistance().
    float capM = 0.0;
    float radial = 1.0;
    if (uCapture > 0.0) {
      vec3 q = p - uSP;
      float d = length(q);
      // reach: the whole near field (≈ 90 beads within 3 world) drains; nothing past 5.2
      float f = uCapture * (1.0 - smoothstep(3.0, 5.2, d)) * freeK;
      // the swirl (1.1 rad about the view axis at full capture) keeps |q⊥| and q·V
      float ang = 1.1 * f;
      float cs = cos(ang);
      float sn = sin(ang);
      vec3 qr = q * cs + cross(uViewDir, q) * sn + uViewDir * dot(uViewDir, q) * (1.0 - cs);
      // pack in the screen plane: the distance from the view axis through SP is compressed
      // onto the meniscus band (R_m + 10 %·excess), the depth offset squashes to 30 %
      float zq = dot(qr, uViewDir);
      vec3 qp = qr - uViewDir * zq;
      float rp = length(qp);
      vec3 dir = rp > 1e-4 ? qp / rp : normalize(cross(uViewDir, vec3(0.0, 0.0, 1.0)) + vec3(1e-3, 0.0, 0.0));
      float rp2 = rp > uRm ? mix(rp, uRm + (rp - uRm) * 0.10, f) : rp;
      // a captured bead never sits over the disc: lateral floor 0.97 R_m as it is caught
      rp2 = max(rp2, 0.97 * uRm * smoothstep(0.0, 0.25, f));
      float zq2 = zq * (1.0 - 0.7 * f);
      // and never inside 0.97 R_m in 3D once the capture has begun
      float m3 = 0.97 * uRm * smoothstep(0.0, 0.08, uCapture) * freeK;
      if (rp2 * rp2 + zq2 * zq2 < m3 * m3) rp2 = sqrt(max(m3 * m3 - zq2 * zq2, 0.0));
      p = uSP + dir * rp2 + uViewDir * zq2;
      float mm = (rp2 - uRm) / 0.16;
      capM = f * exp(-mm * mm);
      float d2 = sqrt(rp2 * rp2 + zq2 * zq2);
      radial = mix(1.0, 0.55 + 0.45 * exp(-(d2 / 3.0) * (d2 / 3.0)), uCapture);
    }
#endif

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 na = vec2(ndc.x * uAspect, ndc.y);
    float mouseResolved = 1.0 - smoothstep(0.0, uMouseR, distance(na, uMouse));
#ifdef SONAR
    // the cursor lens lets go of the captured meniscus: no swollen black cluster on the target
    mouseResolved *= 1.0 - 0.85 * uCapture;
#endif
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

#ifdef SONAR
    vec2 spx = vec2((ndc.x * 0.5 + 0.5) * uViewport.x, (0.5 - ndc.y * 0.5) * uViewport.y);
    float tmK = 1.0 - textMask(spx);
    float glowT = glow * tmK;
    float decoyK = 0.0;
    float rejK = 0.0;
    if (aTag > 0.5 && aTag < 3.5) {
      decoyK = aTag < 1.5 ? uDecoy.x : (aTag < 2.5 ? uDecoy.y : uDecoy.z);
      rejK = aTag < 1.5 ? uDecoyR.x : (aTag < 2.5 ? uDecoyR.y : uDecoyR.z);
    }
    // echoes darken the crest (not under free text); a flaring decoy resolves fully
    vResolved = clamp(max(resolved + 0.55 * crest * tmK, decoyK), 0.0, 1.0);
#endif

#ifdef DUST
    vSoft = 0.0;
    float size = clamp(aSize * uSizeScale / max(vDepth, 0.5), 1.0, 2.0) * uPixelRatio;
#else
    vSoft = max(uSoft, 1.0 - smoothstep(0.6, 2.5, vDepth));
    float px = aSize * uSizeScale / max(vDepth, 0.5);
#ifdef SONAR
    // packed (captured) beads swell less under the lens and the heartbeat
    float resGain = mix(1.05, 0.35, uCapture);
#else
    float resGain = 1.05;
#endif
    float size = px * uPixelRatio
      * (1.0 + resolved * resGain + vThrob * resGain)
      * (1.0 + vSoft * 0.8)
      * (1.0 + 0.12 * uFocus);
#endif
#ifdef SONAR
    size *= (1.0 + uGlowSize * glowT) * (1.0 + 0.5 * crest * tmK) * (1.0 + 0.8 * decoyK) * (1.0 - 0.25 * capM);

    // the cursor is a drop of water (dimple + spring wake); the target has mass (lens).
    // Pinned beads skip all three, so their DOM leaders stay on them.
    if (clip.w > 0.0 && freeK > 0.0) {
      vec2 offS = vec2(0.0);
      if (uMouseOn > 0.0) {
        float Rm = uMouseR * 0.5 * uViewport.y;
        vec2 dm = spx - uMousePx;
        float dl = length(dm);
        if (dl < Rm && dl > 1e-3) {
          float u = 1.0 - dl / Rm;
          offS += dm / dl * (9.0 * (1.0 - uCapture) * u * u * uSonar * uMouseOn);
        }
      }
      float gpx = 0.06 * uFocalPx / max(vDepth, 0.5);
      for (int k = 0; k < 5; k++) {
        vec2 wv = uWakeV[k];
        if (dot(wv, wv) <= 1e-8) continue;
        vec2 dk = spx - uWake[k].xy;
        offS += wv * (gpx * exp(-dot(dk, dk) / (uWakeR * uWakeR)));
      }
      if (uLens.w > 0.0) {
        vec2 dl2 = spx - uLens.xy;
        float rr = max(uLens.z, 1.0);
        float xl = length(dl2) / rr;
        float kl = smoothstep(0.92, 1.1, xl) * (1.0 - smoothstep(1.5, 2.2, xl))
          * smoothstep(uLensD - 0.15, uLensD + 0.15, vDepth);
        if (xl > 1e-3) offS += dl2 / (xl * rr) * (5.0 * kl * uLens.w);
      }
      clip.xy += vec2(offS.x, -offS.y) * (2.0 / uViewport) * clip.w;
    }
#endif

    // deterministic ink ripples (§7.8): a ring of displacement, ink only
    if (clip.w > 0.0) {
      vec2 sp = vec2((ndc.x * 0.5 + 0.5) * uViewport.x, (0.5 - ndc.y * 0.5) * uViewport.y);
      vec2 off = vec2(0.0);
      float rw = 0.0;
      for (int i = 0; i < 6; i++) {
        vec4 R = uRings[i];
        if (R.w == 0.0) continue;
        vec2 dv = sp - R.xy;
        float d = length(dv);
        // R.w is the crest weight (1 = a default-amp event at birth, fading to 0;
        // negative = the inward implosion, which pulls instead of pushing)
        float w = exp(-pow((d - R.z) / 18.0, 2.0)) * R.w;
        rw += abs(w);
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
#ifdef SONAR
    // depth of field: an energy-conserving circle of confusion (CSS px × DPR)
    float coc = clamp(uDof * 60.0 * abs(1.0 / max(vDepth, 0.05) - 1.0 / max(uFocusD, 0.05)), 0.0, uCocMax) * uPixelRatio;
    float size0 = max(size, 1e-3);
    size = size0 + coc;
    float dofMul = (size0 / size) * (size0 / size);
    // ping: the lead leaves one ring on every bead it crosses (ink; gold on the top decile)
    // (× the beam's gain: no lead line, no rings — a locked, faded beam leaves only the afterglow)
    float ping = bAng < 0.22 ? (1.0 - bAng / 0.22) * uPingGain : 0.0;
    // past the target on the locked bearing the lead stops moving: no frozen rings there
    float rhoSPn;
    hubBearing(uSP, rhoSPn);
    ping *= 1.0 - smoothstep(0.75, 1.0, uSeek) * smoothstep(0.3, 0.7, (rhoN - rhoSPn) * 12.8);
    ping = max(ping, shockPing) * uSonar * uPingOn * tmK;
    float ringA = ping > 0.0 ? pow(ping, uPingExp) : 0.0;
    float gold = step(uPingGold, aSize) * uPingGoldMix;
    float rd = 0.5 * size;
    float wPx = 1.2 * uPixelRatio;
    // the ring leaves the bead's edge and spreads (≤ 16 px past it: a near, big bead keeps a tight ring)
    float ringR = mix(rd + 0.6 * wPx, min(max(2.3 * rd, rd + 4.0 * uPixelRatio), rd + 16.0 * uPixelRatio), 1.0 - ping);
    // decoy flare: a gold meniscus line hugging the bead
    float dRing = decoyK * tmK;
    if (dRing > ringA) {
      ringA = dRing;
      ringR = rd + 1.4 * uPixelRatio;
      gold = 1.0;
    }
    float sprite = ringA > 0.002 ? max(size, 2.0 * (ringR + wPx)) : size;
    vRing = vec4(ringR / sprite, 0.5 * wPx / sprite, ringA, gold);
    vSon = vec4(size / sprite, uGlowDark * glowT, 0.25 * glowT, dofMul);
    vSon2 = vec4(coc / (coc + size0), rejK, 0.6 * capM, mix(uOpacity, radial, uSonar));
    size = sprite;
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
#ifdef SONAR
  uniform float uSonar;
  uniform vec3 uGoldS;
  uniform vec3 uPaperS;
#endif

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
#ifdef SONAR
  varying vec4 vRing;
  varying vec4 vSon;
  varying vec4 vSon2;
#endif
#ifdef DBG_PIN
  varying float vPinSlot;
#endif

  void main() {
#ifdef DBG_PIN
    // dev readback probe: only the pinned beads' cores, slot-coded in red
    if (vPinSlot < 0.0) discard;
    vec2 pc = (gl_PointCoord - 0.5) / vSon.x;
    if (length(pc) > 0.45) discard;
    // green = full-coverage marker: MSAA-resolved edge pixels (partial coverage) are skipped
    gl_FragColor = vec4((vPinSlot + 1.0) / 8.0, 1.0, 0.0, 1.0);
    return;
#endif
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
#ifdef SONAR
    // the bead fills the inner vSon.x of an enlarged sprite (its ring lives outside it)
    vec2 qd = q / vSon.x;
    float core = smoothstep(0.5, mix(0.44, 0.05, max(vSoft, vSon2.x)), length(qd));
    float ringA = 0.0;
    if (vRing.z > 0.002) {
      float aa = fwidth(r);
      float dr = abs(r - vRing.x);
      ringA = vRing.z * (1.0 - smoothstep(vRing.y - 0.5 * aa, vRing.y + 0.5 * aa, dr));
    }
    if (core <= 0.001 && ringA <= 0.001) discard;
#else
    // crisp disc by default; a soft bokeh blob near the lens and in the interior
    vec2 qd = q;
    float core = smoothstep(0.5, mix(0.44, 0.05, vSoft), r);
    if (core <= 0.001) discard;
#endif

    float dark = clamp(vResolved + vThrob * 0.45, 0.0, 1.0);
#ifdef SONAR
    // afterglow: the ink develops behind the lead; the meniscus beads pool darker
    dark = clamp(max(dark, vSon.y) + vSon2.z, 0.0, 1.0);
#endif
    vec3 col = mix(uInk, uInkDeep, dark);

    // sphere imposter — 3D volume while the camera is among the points
    float sphereAmt = uDive * clamp(1.35 - vDepth * 0.07, 0.12, 1.0);
    vec2 n2 = qd * 2.0;
    float nz = sqrt(max(0.0, 1.0 - dot(n2, n2)));
    vec3 nrm = vec3(n2, nz);
    vec3 lightDir = normalize(vec3(-0.45, 0.6, 0.85));
    float diff = max(dot(nrm, lightDir), 0.0);
    float spec = pow(nz, 3.0) *
      pow(max(dot(reflect(-lightDir, nrm), vec3(0.0, 0.0, 1.0)), 0.0), 22.0);
#ifdef SONAR
    vec3 colImp = col * mix(1.0, 0.40 + 0.80 * diff, sphereAmt) + vec3(1.0, 0.96, 0.86) * spec * sphereAmt * 0.6;
    // wet ink bead: a diluted core, a meniscus rim pooled toward the deep ink, a paper highlight;
    // out of focus the detail melts into the soft blob (a defocused bead shows no crisp glint)
    float sharp = 1.0 - vSon2.x;
    float rr = length(qd);
    vec3 bead = mix(col, uPaperS, 0.25 * sharp * (1.0 - smoothstep(0.0, 0.34, rr)));
    bead = mix(bead, uInkDeep, smoothstep(0.32, 0.5, rr) * 0.8 * sharp);
    float hl = 1.0 - smoothstep(0.045, 0.085, length(qd - vec2(-0.18, -0.2)));
    bead = mix(bead, uPaperS, hl * 0.85 * sharp * sharp);
    col = mix(colImp, mix(col, bead, sphereAmt), uSonar);
#else
    col *= mix(1.0, 0.40 + 0.80 * diff, sphereAmt);
    col += vec3(1.0, 0.96, 0.86) * spec * sphereAmt * 0.6;
#endif

    // the sweep's charge: gold cooling over the ink (saturated, never a wash)
    col = mix(col, uGold, vCharge * 0.55);
    col += uGold * pow(vCharge, 2.0) * 0.35;

    float depthFade = clamp(1.15 - max(vDepth - 7.0, 0.0) * 0.045, 0.35, 1.0);
    float dimAlpha = (0.42 + vSeed * 0.30) * depthFade;
    float litAlpha = (0.92 + vThrob * 0.08) * depthFade;
    float alpha = mix(dimAlpha, litAlpha, vResolved) + vCharge * 0.22;

#ifdef SONAR
    alpha += vSon.z;
    // a struck decoy greys to ink at α 0.35
    col = mix(col, uInk, vSon2.y);
    alpha = mix(alpha, 0.35, vSon2.y);
    float a = core * alpha * vSon2.w * vSon.w * vNear * (1.0 - 0.18 * uFocus);
    // the ring composites over the bead (1.2 px, ink or brand gold)
    vec3 ringCol = mix(mix(uInk, uInkDeep, 0.65), uGoldS, vRing.w);
    float ra = clamp(ringA * vSon2.w * vNear, 0.0, 1.0);
    float outA = ra + a * (1.0 - ra);
    vec3 outC = outA > 1e-5 ? (ringCol * ra + col * a * (1.0 - ra)) / outA : col;
    gl_FragColor = vec4(outC, outA);
#else
    gl_FragColor = vec4(col, core * alpha * uOpacity * vNear * (1.0 - 0.18 * uFocus));
#endif
#endif
  }
`;

/* ── DUST_SONAR: the J1 hidden universe (§4.5) ─────────────────
   A prefix of the dust buffer (same attributes, its own draw range),
   lit only in the afterglow: vReveal = uDustSonar·exp(−b/0.7)·0.8,
   b from the grain's beam-plane bearing (hubBearing) + lag; the flow on T0 only
   (uDustFlow = 0 elsewhere); ink grains 1.3–2 px × DPR at α ≤ 0.32 (radar r1).
   Beads outside the afterglow are culled in the vertex shader (no
   rasterisation: the cost is vertex-bound). uKeep / uCutAlpha fade the
   part of the prefix a governor cut removes (0.3 s, no pop);
   uNoCull = 1 only while the warm-up times the program. */
export const DUST_SONAR_VERT = /* glsl */ `
#define DUST_SONAR
  uniform float uTheta;
  uniform float uLag;
  uniform float uDustSonar;
  uniform float uPixelRatio;
  uniform vec2  uViewport;
  uniform vec3  uFlowPhase;
  uniform float uDustFlow;
  uniform float uFlowW3;
  uniform vec4  uTextMask[4];
  uniform float uKeep;
  uniform float uCutAlpha;
  uniform float uNoCull;

  attribute float aSize;
  attribute float aAngle;

  varying float vA;

  const float TAU = 6.2831853;
  ${FLOW_GLSL}
  ${TEXT_MASK_GLSL}
  ${HUB_BEARING_GLSL}

  void main() {
    float rho = length(position.xy);
    float rhoN;
    float phi = hubBearing(position, rhoN);
    phi += uLag * rhoN * rhoN;
    float b = mod(uTheta - phi, TAU);
    float keep = float(gl_VertexID) < uKeep ? 1.0 : uCutAlpha;
    float reveal = uDustSonar * exp(-b / 0.7) * 0.8 * keep * (1.0 - smoothstep(10.5, 13.0, rho));
    if (reveal < 0.004 && uNoCull < 0.5) {
      vA = 0.0;
      gl_PointSize = 0.0;
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec3 p = position + flowOffsetW(position, uFlowPhase, uDustFlow, uFlowW3);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 sp = vec2((ndc.x * 0.5 + 0.5) * uViewport.x, (0.5 - ndc.y * 0.5) * uViewport.y);
    float depth = -mv.z;
    vA = reveal * 0.4 * (1.0 - textMask(sp)) * smoothstep(0.35, 1.2, depth);
    gl_PointSize = (1.3 + 0.7 * clamp((aSize - 0.5) / 0.6, 0.0, 1.0)) * uPixelRatio;
    gl_Position = clip;
  }
`;

export const DUST_SONAR_FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uInkDeep;
  varying float vA;
  void main() {
    if (vA <= 0.002) discard;
    float r = length(gl_PointCoord - 0.5);
    float core = 1.0 - smoothstep(0.32, 0.5, r);
    gl_FragColor = vec4(mix(uInk, uInkDeep, 0.55), vA * core);
  }
`;
