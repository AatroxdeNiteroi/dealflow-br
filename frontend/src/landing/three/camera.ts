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
   Breath, entryZ and the FOV sum are applied by PointField (time
   layer), never baked into the path: the path is a pure f(vh).
   ============================================================ */

import * as THREE from "three";
import { CAMERA, type ArcRef, type CameraPath, type ProfileKey, type Vec3 } from "../cinema/beats";
import { monotoneCubic } from "../cinema/geometry";

const ARC_DIVISIONS = 4000;

const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

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
      if (k.slope === "secant") return xs[j] === xs[i] ? 0 : (ys[j] - ys[i]) / (xs[j] - xs[i]);
      return k.slope;
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

  /** Pure path pose at vh (no breath, no entryZ): position + look target. */
  pose(vh: number, creep: number, outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    if (vh < this.switchAt) {
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
