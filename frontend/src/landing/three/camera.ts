/* ============================================================
   three/camera.ts — the spline camera (§7.2). Owner: WP-GL.

   - Paths: centripetal Catmull–Rom through the beats.CAMERA knots,
     sampled by ARC LENGTH (getPointAt semantics via getUtoTmapping),
     so speed is C1 and the only zero-velocity moments are the rests
     (flat profile segments) and the park pose.
   - Look: sampled at the SAME knot coordinate as the camera: the arc
     fraction a → curve parameter t (exact inverse of the arc-length
     table) → look.getPoint(t). One table, so the two never drift.
   - Speed profile: Fritsch–Carlson monotone cubic vh → a, keys from
     beats ({ knot: k } = that knot's arc fraction, "secant" = chord
     slope to the neighbouring key).
   - IN path while vh < switchAt (1568), OUT from there. Creep moves
     the IN pose along its own look direction (P4 + lookDir·creep),
     which lands exactly on P4c, the OUT path's first knot.
   - v3 (spec rev 3.1 §6.3, WP4): the J1–J2 SEEK path for vh < seekTo
     (352). It ends on R1_POSE / R1_LOOK (= IN sampled at 352) with
     profile slope 0, as IN has there, so the join is C¹ at zero
     velocity and every vh ≥ 352 takes the untouched v2 branch (J3 is
     bit-exact). Portrait (aspect < 1): a second seek path whose knots
     1–3 have their lateral (x) offsets ×0.55, camera AND look knots,
     so the arc swings less inside the 22° horizontal FOV of a phone
     (max yaw 2.9° instead of 4.5°; SP stays at x 215–285 px at 390×844).
   Breath, entryZ, roll and the FOV sum are applied by the camera layer
   (three/field/camlayer.ts), never baked into the path: the path is a
   pure f(vh).
   ============================================================ */

import * as THREE from "three";
import { CAMERA, type ArcRef, type CameraPath, type ProfileKey, type Vec3 } from "../cinema/beats";
import { monotoneCubic } from "../cinema/geometry";

const ARC_DIVISIONS = 4000;

/** §6.3 portrait variant: lateral (x) offsets of the seek knots 1–3 are scaled by this. */
export const SEEK_PORTRAIT_LATERAL = 0.55;

const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

/** The seek path with knots 1 … n−1 (camera and look) moved toward x = 0 by `k`;
 *  knot 0 (the hero pose, G2 match-cut) and the last knot (R1) are kept exactly. */
export function lateralScaled(def: CameraPath, k: number): CameraPath {
  const sc = (pts: readonly Vec3[]): Vec3[] =>
    pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : ([p[0] * k, p[1], p[2]] as Vec3)));
  return { points: sc(def.points), look: sc(def.look), profile: def.profile };
}

export class SplinePath {
  readonly curve: THREE.CatmullRomCurve3;
  readonly look: THREE.CatmullRomCurve3;
  /** Arc fraction of every knot (0 … 1). */
  readonly knotA: number[];
  readonly from: number;
  readonly to: number;
  private readonly profile: (vh: number) => number;

  constructor(def: CameraPath) {
    this.curve = new THREE.CatmullRomCurve3(def.points.map(v3), false, "centripetal");
    this.curve.arcLengthDivisions = ARC_DIVISIONS;
    this.look = new THREE.CatmullRomCurve3(def.look.map(v3), false, "centripetal");
    const lengths = this.curve.getLengths(ARC_DIVISIONS);
    const total = lengths[lengths.length - 1] || 1;
    const n = def.points.length - 1;
    this.knotA = def.points.map((_, k) => lengths[Math.round((k * ARC_DIVISIONS) / n)] / total);

    const keys = def.profile;
    const xs = keys.map((k) => k.vh);
    const ys = keys.map((k) => this.resolve(k.a));
    this.from = xs[0];
    this.to = xs[xs.length - 1];
    const slopeOf = (k: ProfileKey, i: number, j: number): number | undefined => {
      if (k.slope === undefined) return undefined;
      // v3 (§6.3): ProfileKey.slopeScale multiplies the resolved slope (default 1)
      const sc = k.slopeScale ?? 1;
      if (k.slope === "secant") return (xs[j] === xs[i] ? 0 : (ys[j] - ys[i]) / (xs[j] - xs[i])) * sc;
      return k.slope * sc;
    };
    const last = keys.length - 1;
    this.profile = monotoneCubic(xs, ys, slopeOf(keys[0], 0, 1), slopeOf(keys[last], last - 1, last));
  }

  private resolve(a: ArcRef): number {
    return typeof a === "number" ? a : this.knotA[a.knot];
  }

  /** Arc fraction at master vh (clamped to the profile's ends). */
  arcAt(vh: number): number {
    const a = this.profile(vh);
    return a < 0 ? 0 : a > 1 ? 1 : a;
  }

  /** Camera position and look target at arc fraction a. */
  sampleArc(a: number, outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    // distance 0 (falsy) → the target arc length is u · total
    const t = this.curve.getUtoTmapping(a, 0);
    this.curve.getPoint(t, outPos);
    this.look.getPoint(t, outLook);
  }
}

const tmpDir = new THREE.Vector3();

export class CameraRig {
  readonly inPath = new SplinePath(CAMERA.in);
  readonly outPath = new SplinePath(CAMERA.out);
  readonly switchAt = CAMERA.switchAt;
  /** v3: J1–J2 seek path (landscape) and its lazily built portrait variant. */
  readonly seekLandscape = new SplinePath(CAMERA.seek);
  private seekPortrait: SplinePath | null = null;
  private seekPath: SplinePath = this.seekLandscape;
  readonly seekTo = CAMERA.seekTo;
  private portrait = false;

  /** Pick the seek variant for this viewport (aspect < 1 → portrait). Returns true if it changed. */
  setAspect(aspect: number): boolean {
    const portrait = aspect > 0 && aspect < 1;
    if (portrait === this.portrait) return false;
    this.portrait = portrait;
    if (portrait) {
      this.seekPortrait ??= new SplinePath(lateralScaled(CAMERA.seek, SEEK_PORTRAIT_LATERAL));
      this.seekPath = this.seekPortrait;
    } else this.seekPath = this.seekLandscape;
    return true;
  }

  get isPortrait(): boolean {
    return this.portrait;
  }

  /** Pure path pose at vh (no breath, no entryZ): position + look target. */
  pose(vh: number, creep: number, outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    if (vh < this.seekTo) {
      // v3 seek (creep is 0 there; kept for symmetry with the IN branch)
      this.seekPath.sampleArc(this.seekPath.arcAt(vh), outPos, outLook);
      if (creep !== 0) {
        tmpDir.copy(outLook).sub(outPos);
        const len = tmpDir.length();
        if (len > 1e-6) outPos.addScaledVector(tmpDir, creep / len);
      }
    } else if (vh < this.switchAt) {
      this.inPath.sampleArc(this.inPath.arcAt(vh), outPos, outLook);
      if (creep !== 0) {
        tmpDir.copy(outLook).sub(outPos);
        const len = tmpDir.length();
        if (len > 1e-6) outPos.addScaledVector(tmpDir, creep / len);
      }
    } else {
      this.outPath.sampleArc(this.outPath.arcAt(vh), outPos, outLook);
    }
  }
}

/** Today's camera drifts (§7.2 breath), × amplitude; written into `out` (x, y). */
export function breathOffset(t: number, hA: number, uA: number, out: THREE.Vector3): THREE.Vector3 {
  const h = CAMERA.breath.hero;
  const u = CAMERA.breath.uni;
  out.set(
    Math.sin(h.fx * t) * h.ax * hA + Math.sin(u.fx * t) * u.ax * uA,
    Math.cos(h.fy * t) * h.ay * hA + Math.cos(u.fy * t) * u.ay * uA,
    0,
  );
  return out;
}
