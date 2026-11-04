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
import { FIELD_H, FIELD_W } from "./constants";

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

/** r3: the universe pull-back (OUT knot 3, the C4 count) never backs out past the radar. At the
 *  field's mid depth (the knot's look z) the frustum — with fovUniverse's +4° peak, and the knot's
 *  lateral offset + the universe breath kept as a margin — stays inside FIELD_W × FIELD_H, so the
 *  points fill the frame instead of shrinking to a small field on paper (the knot sat at z 34). */
const UNIVERSE_KNOT = 3;
const UNIVERSE_FOV_PEAK = 4; // beats SCORE.fovUniverse peak (1755–1798)
const UNIVERSE_MARGIN = 0.6; // world units: |knot x| 0.3 + breathUni ≤ 0.2 + slack

export function universeBounded(def: CameraPath, aspect: number): CameraPath {
  const tan = Math.tan(THREE.MathUtils.degToRad((CAMERA.fovBase + UNIVERSE_FOV_PEAK) / 2));
  const dMax = Math.min(
    (FIELD_H / 2 - UNIVERSE_MARGIN) / tan,
    (FIELD_W / 2 - UNIVERSE_MARGIN) / (tan * Math.max(aspect, 1e-3)),
  );
  const p = def.points[UNIVERSE_KNOT];
  const zMax = def.look[UNIVERSE_KNOT][2] + dMax;
  if (p[2] <= zMax) return def;
  const points = def.points.map((q, i) => (i === UNIVERSE_KNOT ? ([q[0], q[1], zMax] as Vec3) : q));
  return { points, look: def.look, profile: def.profile };
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
  /** OUT path for the current aspect (r3: its universe knot is bounded by universeBounded). */
  private outPath = new SplinePath(CAMERA.out);
  private outAspect = -1;
  readonly switchAt = CAMERA.switchAt;
  /** v3: J1–J2 seek path (landscape) and its lazily built portrait variant. */
  readonly seekLandscape = new SplinePath(CAMERA.seek);
  private seekPortrait: SplinePath | null = null;
  private seekPath: SplinePath = this.seekLandscape;
  readonly seekTo = CAMERA.seekTo;
  private portrait = false;

  /** Pick the seek variant for this viewport (aspect < 1 → portrait) and bound the OUT path's
   *  universe knot for it. Returns true if either changed. */
  setAspect(aspect: number): boolean {
    const outChanged = this.boundOut(aspect);
    const portrait = aspect > 0 && aspect < 1;
    if (portrait === this.portrait) return outChanged;
    this.portrait = portrait;
    if (portrait) {
      this.seekPortrait ??= new SplinePath(lateralScaled(CAMERA.seek, SEEK_PORTRAIT_LATERAL));
      this.seekPath = this.seekPortrait;
    } else this.seekPath = this.seekLandscape;
    return true;
  }

  /** Rebuild the OUT path when the aspect moves its universe bound (≥ 1 % of the aspect). */
  private boundOut(aspect: number): boolean {
    if (!(aspect > 0) || Math.abs(aspect - this.outAspect) < 0.01 * aspect) return false;
    this.outAspect = aspect;
    const def = universeBounded(CAMERA.out, aspect);
    const prev = this.outPath.curve.points[UNIVERSE_KNOT].z;
    this.outPath = new SplinePath(def);
    return Math.abs(prev - def.points[UNIVERSE_KNOT][2]) > 1e-6;
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
