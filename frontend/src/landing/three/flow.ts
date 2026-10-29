/* ============================================================
   three/flow.ts — the current (spec rev 3.1 §4.6): a GLSL chunk and its
   EXACT TS mirror. WP0 ships both (unit-tested: TS vs GLSL readback on
   64 points, max error < 1e−5 world) but nothing uses them yet → WP3.

     w = p.xy·0.42
     ψ = sin(0.83w.x + 0.31w.y + 0.9T) + 0.6·sin(−0.41w.x + 1.13w.y − 0.7T + 1.7)
         + 0.35·sin(1.7w.x − 1.4w.y + 1.3T + 4.1)
     v = (∂ψ/∂y, −∂ψ/∂x)·0.5                       (divergence-free)
     p.xy += A·v;  p.z += A·0.4·ψ

   T is integrated on the CPU (T += dt·(1 + 2·pvelN)·motion) and
   A = flowAmp·(1 + 0.6·pvelN). The GPU never sees T: the CPU passes
   the three wave PHASES (0.9T, −0.7T + 1.7, 1.3T + 4.1) reduced mod 2π
   in double precision (`flowPhases`, e.g. a `uniform vec3 uFlowPhase`),
   so every float32 sin/cos argument stays ≤ ~21 rad and the GLSL
   matches the mirror to < 1e−5 world. The TS mirror is applied by the CPU
   readers to the ≤ 8 pinned points and the 12 echo sources so DOM
   leaders stay on their points (≤ 1.5 px). Tier variants (§4.9): the
   third wave is dropped on T3 (`waves` = 2) and A is scaled per tier.
   ============================================================ */

const K = 0.42;

const TAU = Math.PI * 2;
const modTau = (a: number): number => {
  const r = a % TAU;
  return r < 0 ? r + TAU : r;
};

/** The three wave phases at flow time T, reduced to [0, 2π) in double precision. */
export function flowPhases(T: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  out[0] = modTau(0.9 * T);
  out[1] = modTau(-0.7 * T + 1.7);
  out[2] = modTau(1.3 * T + 4.1);
  return out;
}

/** GLSL: `vec3 flowOffset(vec3 p, vec3 ph, float A)` — offset to ADD to p (world);
 *  `ph` = flowPhases(T) from the CPU. */
export const FLOW_GLSL = /* glsl */ `
  vec3 flowOffset(vec3 p, vec3 ph, float A) {
    vec2 w = p.xy * ${K.toFixed(2)};
    float a1 = 0.83 * w.x + 0.31 * w.y + ph.x;
    float a2 = -0.41 * w.x + 1.13 * w.y + ph.y;
    float a3 = 1.7 * w.x - 1.4 * w.y + ph.z;
    float psi = sin(a1) + 0.6 * sin(a2) + 0.35 * sin(a3);
    float c1 = cos(a1);
    float c2 = 0.6 * cos(a2);
    float c3 = 0.35 * cos(a3);
    float dpx = (0.83 * c1 - 0.41 * c2 + 1.7 * c3) * ${K.toFixed(2)};
    float dpy = (0.31 * c1 + 1.13 * c2 - 1.4 * c3) * ${K.toFixed(2)};
    return vec3(dpy * 0.5 * A, -dpx * 0.5 * A, A * 0.4 * psi);
  }
`;

const PH: [number, number, number] = [0, 0, 0];

/** Exact TS mirror of FLOW_GLSL at flow time T: writes the offset into `out` (x, y, z) and returns it. */
export function flowOffset(x: number, y: number, T: number, A: number, out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }): { x: number; y: number; z: number } {
  flowPhases(T, PH);
  const wx = x * K;
  const wy = y * K;
  const a1 = 0.83 * wx + 0.31 * wy + PH[0];
  const a2 = -0.41 * wx + 1.13 * wy + PH[1];
  const a3 = 1.7 * wx - 1.4 * wy + PH[2];
  const psi = Math.sin(a1) + 0.6 * Math.sin(a2) + 0.35 * Math.sin(a3);
  const c1 = Math.cos(a1);
  const c2 = 0.6 * Math.cos(a2);
  const c3 = 0.35 * Math.cos(a3);
  const dpx = (0.83 * c1 - 0.41 * c2 + 1.7 * c3) * K;
  const dpy = (0.31 * c1 + 1.13 * c2 - 1.4 * c3) * K;
  out.x = dpy * 0.5 * A;
  out.y = -dpx * 0.5 * A;
  out.z = A * 0.4 * psi;
  return out;
}

/** ψ depends on T only through 0.9T, −0.7T and 1.3T (all multiples of 0.1T), so the field is
 *  periodic in T with period 20π: wrapping T there is EXACT and keeps the float32 GLSL
 *  arguments small in long sessions. */
export const FLOW_T_PERIOD = 20 * Math.PI;
export const wrapFlowT = (T: number): number => {
  const r = T % FLOW_T_PERIOD;
  return r < 0 ? r + FLOW_T_PERIOD : r;
};

/** Flow time integration (CPU): T += dt·(1 + 2·pvelN)·motion, wrapped to [0, 20π). */
export const stepFlowT = (T: number, dt: number, pvelN: number, motion: number): number => wrapFlowT(T + dt * (1 + 2 * pvelN) * motion);

/** Flow amplitude: A = flowAmp·(1 + 0.6·pvelN). */
export const flowAmplitude = (flowAmp: number, pvelN: number): number => flowAmp * (1 + 0.6 * pvelN);
