/* ============================================================
   three/labels.ts — cursor label data (§7.7) + the C4c sweep-flash
   pick. Owner: WP-GL. The DOM side (pool, text, phase gate) is CH1's.

   - The base layer is projected only when the camera matrix changed
     (or the viewport did) and bucketed into a coarse 12×8 screen
     grid; a mouse query then visits only the cells under the cursor
     radius. Arrays are allocated once and reused.
   - The query runs only when the mouse moved > .5 px or the camera
     changed. Up to 4 labels, 78 px apart, nearest first; strength =
     1 − d/radius (CH1 shows values only above .62).
   - From vh 220 the target is protected: nothing within 120 px of
     the projected company.
   ============================================================ */

import * as THREE from "three";
import type { CursorLabel } from "../cinema/types";
import { MOUSE_RADIUS, TWO_PI } from "./constants";

const GX = 12;
const GY = 8;
const MAX_LABELS = 4;
const MIN_SEP = 78;
const OFFSET_X = 13;
const OFFSET_Y = -11;

export class LabelPicker {
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly values: Float32Array;
  private readonly angles: Float32Array;
  private readonly sx: Float32Array;
  private readonly sy: Float32Array;
  private readonly ok: Uint8Array;
  private readonly cellStart = new Int32Array(GX * GY + 1);
  private readonly cellItems: Int32Array;
  private readonly cellFill = new Int32Array(GX * GY);
  private readonly lastMatrix = new Float32Array(32);
  private w = 0;
  private h = 0;
  private projected = false;
  private lastMx = -1e9;
  private lastMy = -1e9;
  private readonly v = new THREE.Vector3();
  private readonly cand: Array<{ i: number; d: number }> = [];
  private readonly picked: Array<{ x: number; y: number }> = [];
  private readonly pool: CursorLabel[] = [];

  constructor(positions: Float32Array, values: Float32Array, angles: Float32Array) {
    this.n = positions.length / 3;
    this.pos = positions;
    this.values = values;
    this.angles = angles;
    this.sx = new Float32Array(this.n);
    this.sy = new Float32Array(this.n);
    this.ok = new Uint8Array(this.n);
    this.cellItems = new Int32Array(this.n);
    for (let i = 0; i < MAX_LABELS; i++) this.pool.push({ x: 0, y: 0, value: 0, strength: 0, i: -1 });
  }

  /** Re-project the base layer if the camera (or viewport) changed. Returns true if it did. */
  sync(camera: THREE.PerspectiveCamera, w: number, h: number): boolean {
    const m = this.lastMatrix;
    const a = camera.matrixWorldInverse.elements;
    const b = camera.projectionMatrix.elements;
    let same = this.projected && w === this.w && h === this.h;
    if (same) {
      for (let i = 0; i < 16; i++) {
        if (m[i] !== a[i] || m[16 + i] !== b[i]) {
          same = false;
          break;
        }
      }
    }
    if (same) return false;
    for (let i = 0; i < 16; i++) {
      m[i] = a[i];
      m[16 + i] = b[i];
    }
    this.w = w;
    this.h = h;
    this.projected = true;

    const fill = this.cellFill;
    fill.fill(0);
    for (let i = 0; i < this.n; i++) {
      this.v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]).project(camera);
      const inFront = this.v.z > -1 && this.v.z < 1;
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      this.sx[i] = x;
      this.sy[i] = y;
      const on = inFront && x >= 0 && x < w && y >= 0 && y < h;
      this.ok[i] = on ? 1 : 0;
      if (on) fill[this.cellIndex(x, y)]++;
    }
    const start = this.cellStart;
    start[0] = 0;
    for (let c = 0; c < GX * GY; c++) start[c + 1] = start[c] + fill[c];
    fill.fill(0);
    for (let i = 0; i < this.n; i++) {
      if (!this.ok[i]) continue;
      const c = this.cellIndex(this.sx[i], this.sy[i]);
      this.cellItems[start[c] + fill[c]++] = i;
    }
    return true;
  }

  private cellIndex(x: number, y: number): number {
    const cx = Math.min(GX - 1, Math.max(0, Math.floor((x / this.w) * GX)));
    const cy = Math.min(GY - 1, Math.max(0, Math.floor((y / this.h) * GY)));
    return cy * GX + cx;
  }

  /**
   * Cursor labels into `out` (reused). `mx/my` = mouse in CSS px (or NaN = none);
   * `avoid` = protected target centre (or null).
   */
  query(
    camChanged: boolean,
    mx: number,
    my: number,
    avoid: { x: number; y: number } | null,
    out: CursorLabel[],
  ): void {
    if (!Number.isFinite(mx) || !Number.isFinite(my)) {
      out.length = 0;
      this.lastMx = this.lastMy = -1e9;
      return;
    }
    if (!camChanged && Math.abs(mx - this.lastMx) <= 0.5 && Math.abs(my - this.lastMy) <= 0.5) return;
    this.lastMx = mx;
    this.lastMy = my;

    const radius = MOUSE_RADIUS * 0.5 * this.h; // NDC·aspect units → CSS px (isotropic)
    const cand = this.cand;
    cand.length = 0;
    const cw = this.w / GX;
    const ch = this.h / GY;
    const x0 = Math.max(0, Math.floor((mx - radius) / cw));
    const x1 = Math.min(GX - 1, Math.floor((mx + radius) / cw));
    const y0 = Math.max(0, Math.floor((my - radius) / ch));
    const y1 = Math.min(GY - 1, Math.floor((my + radius) / ch));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * GX + cx;
        for (let k = this.cellStart[c]; k < this.cellStart[c + 1]; k++) {
          const i = this.cellItems[k];
          const d = Math.hypot(this.sx[i] - mx, this.sy[i] - my);
          if (d >= radius) continue;
          if (avoid && Math.hypot(this.sx[i] - avoid.x, this.sy[i] - avoid.y) < 120) continue;
          cand.push({ i, d });
        }
      }
    }
    cand.sort((a, b) => a.d - b.d);

    const picked = this.picked;
    picked.length = 0;
    out.length = 0;
    for (const c of cand) {
      if (picked.length >= MAX_LABELS) break;
      const px = this.sx[c.i];
      const py = this.sy[c.i];
      let ok = true;
      for (const pk of picked) {
        if (Math.hypot(px - pk.x, py - pk.y) < MIN_SEP) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      picked.push({ x: px, y: py });
      const lab = this.pool[out.length];
      lab.x = Math.round((px + OFFSET_X) * 2) / 2;
      lab.y = Math.round((py + OFFSET_Y) * 2) / 2;
      lab.value = this.values[c.i];
      lab.strength = 1 - c.d / radius;
      lab.i = c.i;
      out.push(lab);
    }
  }

  /** Forget the last query (labels gated off): the next query recomputes. */
  reset(out: CursorLabel[]): void {
    out.length = 0;
    this.lastMx = this.lastMy = -1e9;
  }

  /**
   * C4c sweep-flash: one base point within `window` rad behind the sweep's
   * leading edge, on screen (margin px), scanning from a rotating start so
   * consecutive picks differ. Returns the index or −1. Uses the last sync.
   */
  pickBehindSweep(sweepAngle: number, window: number, margin: number, start: number): number {
    if (!this.projected) return -1;
    const n = this.n;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (!this.ok[i]) continue;
      let behind = (sweepAngle - this.angles[i]) % TWO_PI;
      if (behind < 0) behind += TWO_PI;
      if (behind > window) continue;
      const x = this.sx[i];
      const y = this.sy[i];
      if (x < margin || y < margin || x > this.w - margin || y > this.h - margin) continue;
      return i;
    }
    return -1;
  }

  /** Screen position of point i at the last sync (CSS px), or null if off screen. */
  screenOf(i: number): { x: number; y: number } | null {
    if (i < 0 || i >= this.n || !this.ok[i]) return null;
    return { x: this.sx[i], y: this.sy[i] };
  }

  valueOf(i: number): number {
    return this.values[i] ?? 0;
  }
}
