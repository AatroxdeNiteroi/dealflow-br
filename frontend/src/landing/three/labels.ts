/* ============================================================
   three/labels.ts — cursor label data (§7.7) + the C4c sweep-flash
   pick. Owner: WP3 (v3 §4.9 LabelPicker). The DOM side is CH1's.

   v3 — no more re-projecting all 2,772 beads every frame:
   - BINS: the base layer is projected and bucketed into a coarse 12×8
     screen grid only on the first use, on a resize, or when the camera
     has moved the screen by more than REBIN_PX since the last bucketing
     (measured on 18 reference beads spread over the field, corners and
     depth extremes included — a cheap, exact drift probe).
   - QUERY: only the cells under the cursor radius, padded by 12 px plus
     that measured drift (it bounds the camera's breath / lean / path
     motion since the bucketing), are projected EXACTLY with the current
     camera; nearest first, ≤ 4 labels, 78 px apart AND their chip boxes
     apart (the runtime-measured box from field.setLabelChip, else the
     static LABEL_CHIP). It reruns when the cursor moves > 0.5 px or
     the camera moves > 3 px (the same probe) since the last query; in
     between, the picks keep their beads and only their positions are
     re-projected (exact, every frame), so a scroll costs ~4 projections.
   - Exact positions include the CURRENT (three/flow.ts mirror, the same
     phases / amplitude the GPU uses): a labelled bead is pinned, so the
     flow is the only displacement the GPU applies to it, and the leader
     stays on the drawn bead. Label positions are refreshed every frame.
   - From vh 220 the target is protected: nothing within 120 px of it.
   - The C4c sweep-flash pick scans by bearing first and projects only
     the beads inside the window (no bins needed).
   ============================================================ */

import type * as THREE from "three";
import type { CursorLabel, LabelChipBox } from "../cinema/types";
import { LABEL_VALUE_MIN_STRENGTH } from "../cinema/copy";
import { flowOffsetPh, type FlowOut } from "./flow";
import { LABEL_CHIP, MOUSE_RADIUS, TWO_PI } from "./constants";

const GX = 12;
const GY = 8;
const MAX_LABELS = 4;
const MIN_SEP = 78;
const OFFSET_X = 13;
const OFFSET_Y = -11;
/** query pad on top of the measured drift (px) */
const PAD_PX = 12;
/** rebucket when the screen has drifted this far since the last bucketing (px) */
const REBIN_PX = 24;
/** "the camera moved": re-run the query (px) */
const MOVE_PX = 3;
const REFS = 18;

/** What the GPU applies to a pinned bead: the flow (phases, amplitude, third-wave weight). */
export interface FlowState {
  ph: [number, number, number];
  A: number;
  w3: number;
}

export class LabelPicker {
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly values: Float32Array;
  private readonly angles: Float32Array;
  // bins (positions at the last bucketing)
  private readonly bx: Float32Array;
  private readonly by: Float32Array;
  private readonly cellStart = new Int32Array(GX * GY + 1);
  private readonly cellItems: Int32Array;
  private readonly cellFill = new Int32Array(GX * GY);
  private binned = false;
  private binW = 0;
  private binH = 0;
  // drift probe
  private readonly refs = new Int32Array(REFS);
  private readonly refBX = new Float32Array(REFS);
  private readonly refBY = new Float32Array(REFS);
  private readonly refQX = new Float32Array(REFS);
  private readonly refQY = new Float32Array(REFS);
  private drift = 0;
  // the current camera
  private readonly e = new Float64Array(16);
  private w = 0;
  private h = 0;
  private flow: FlowState = { ph: [0, 0, 0], A: 0, w3: 1 };
  private readonly fo: FlowOut = { x: 0, y: 0, z: 0 };
  private readonly pt = { x: 0, y: 0 };
  // query state
  private lastMx = -1e9;
  private lastMy = -1e9;
  private readonly cand: Array<{ i: number; d: number; x: number; y: number }> = [];
  private readonly candPool: Array<{ i: number; d: number; x: number; y: number }> = [];
  private readonly picked: Array<{ x: number; y: number; w: number }> = [];
  private readonly pool: CursorLabel[] = [];
  /** dev: how many full bucketings happened */
  rebins = 0;

  constructor(positions: Float32Array, values: Float32Array, angles: Float32Array) {
    this.n = positions.length / 3;
    this.pos = positions;
    this.values = values;
    this.angles = angles;
    this.bx = new Float32Array(this.n);
    this.by = new Float32Array(this.n);
    this.cellItems = new Int32Array(this.n);
    for (let i = 0; i < MAX_LABELS; i++) this.pool.push({ x: 0, y: 0, value: 0, strength: 0, i: -1 });
    // reference beads: the extremes in x / y / z plus an even spread
    const pick = new Set<number>();
    const ext = (key: (i: number) => number) => {
      let lo = 0;
      let hi = 0;
      for (let i = 1; i < this.n; i++) {
        if (key(i) < key(lo)) lo = i;
        if (key(i) > key(hi)) hi = i;
      }
      pick.add(lo);
      pick.add(hi);
    };
    ext((i) => positions[i * 3]);
    ext((i) => positions[i * 3 + 1]);
    ext((i) => positions[i * 3 + 2]);
    ext((i) => positions[i * 3] + positions[i * 3 + 1]);
    ext((i) => positions[i * 3] - positions[i * 3 + 1]);
    for (let k = 0; pick.size < REFS && k < this.n; k++) pick.add(Math.floor(((k * 0.618034) % 1) * this.n));
    let j = 0;
    for (const i of pick) if (j < REFS) this.refs[j++] = i;
  }

  /** Exact CSS-px projection of bead i with the current camera (+ the flow if `flowed`). */
  private proj(i: number, flowed: boolean, out: { x: number; y: number }): boolean {
    let x = this.pos[i * 3];
    let y = this.pos[i * 3 + 1];
    let z = this.pos[i * 3 + 2];
    if (flowed && this.flow.A !== 0) {
      flowOffsetPh(x, y, this.flow.ph, this.flow.A, this.flow.w3, this.fo);
      x += this.fo.x;
      y += this.fo.y;
      z += this.fo.z;
    }
    const e = this.e;
    const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (!(cw > 1e-9)) return false;
    const nz = (e[2] * x + e[6] * y + e[10] * z + e[14]) / cw;
    if (nz <= -1 || nz >= 1) return false;
    out.x = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / cw * 0.5 + 0.5) * this.w;
    out.y = (-((e[1] * x + e[5] * y + e[9] * z + e[13]) / cw) * 0.5 + 0.5) * this.h;
    return true;
  }

  /**
   * Per frame: the current camera, viewport and flow. Rebuckets when needed; returns true when the
   * camera moved > MOVE_PX (at the reference beads) since the last query.
   */
  frame(camera: THREE.PerspectiveCamera, w: number, h: number, flow: FlowState): boolean {
    const a = camera.projectionMatrix.elements;
    const b = camera.matrixWorldInverse.elements;
    const e = this.e;
    // e = P · V (column-major)
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        e[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    this.w = w;
    this.h = h;
    this.flow = flow;
    if (!this.binned || w !== this.binW || h !== this.binH) {
      this.rebin();
      return true;
    }
    let drift = 0;
    let moved = 0;
    const p = this.pt;
    for (let k = 0; k < REFS; k++) {
      // a reference bead outside the clip volume at bucketing time carries no information
      if (this.refBX[k] < -1e8) continue;
      if (!this.proj(this.refs[k], false, p)) {
        drift = 1e9;
        break;
      }
      drift = Math.max(drift, Math.abs(p.x - this.refBX[k]), Math.abs(p.y - this.refBY[k]));
      if (this.refQX[k] > -1e8) moved = Math.max(moved, Math.abs(p.x - this.refQX[k]), Math.abs(p.y - this.refQY[k]));
      else moved = 1e9;
    }
    this.drift = drift;
    if (drift > REBIN_PX) {
      this.rebin();
      return true;
    }
    return moved > MOVE_PX;
  }

  /** Dev bench only: a forced full bucketing with the last frame()'s camera. */
  rebinNow(): void {
    this.rebin();
  }

  private rebin(): void {
    this.rebins++;
    const w = this.w;
    const h = this.h;
    this.binW = w;
    this.binH = h;
    const fill = this.cellFill;
    fill.fill(0);
    const p = this.pt;
    for (let i = 0; i < this.n; i++) {
      const on = this.proj(i, false, p) && p.x >= 0 && p.x < w && p.y >= 0 && p.y < h;
      this.bx[i] = on ? p.x : -1e9;
      this.by[i] = on ? p.y : -1e9;
      if (on) fill[this.cellIndex(p.x, p.y)]++;
    }
    const start = this.cellStart;
    start[0] = 0;
    for (let c = 0; c < GX * GY; c++) start[c + 1] = start[c] + fill[c];
    fill.fill(0);
    const items = this.cellItems;
    for (let i = 0; i < this.n; i++) {
      if (this.bx[i] < -1e8) continue;
      const c = this.cellIndex(this.bx[i], this.by[i]);
      items[start[c] + fill[c]++] = i;
    }
    for (let k = 0; k < REFS; k++) {
      const on = this.proj(this.refs[k], false, p);
      this.refBX[k] = on ? p.x : -1e9;
      this.refBY[k] = on ? p.y : -1e9;
    }
    this.binned = true;
    this.drift = 0;
  }

  private cellIndex(x: number, y: number): number {
    const cx = Math.min(GX - 1, Math.max(0, Math.floor((x / this.binW) * GX)));
    const cy = Math.min(GY - 1, Math.max(0, Math.floor((y / this.binH) * GY)));
    return cy * GX + cx;
  }

  private markQueried(): void {
    const p = this.pt;
    for (let k = 0; k < REFS; k++) {
      const on = this.proj(this.refs[k], false, p);
      this.refQX[k] = on ? p.x : -1e9;
      this.refQY[k] = on ? p.y : -1e9;
    }
  }

  /**
   * Cursor labels into `out` (reused). `mx/my` = mouse in CSS px (or NaN = none); `avoid` =
   * protected target centre (or null); `chip` = the chip box the labels keep apart.
   */
  query(
    camChanged: boolean,
    mx: number,
    my: number,
    avoid: { x: number; y: number } | null,
    chip: LabelChipBox | null,
    out: CursorLabel[],
  ): void {
    if (!Number.isFinite(mx) || !Number.isFinite(my)) {
      out.length = 0;
      this.lastMx = this.lastMy = -1e9;
      return;
    }
    if (!camChanged && Math.abs(mx - this.lastMx) <= 0.5 && Math.abs(my - this.lastMy) <= 0.5) {
      this.refresh(out);
      return;
    }
    this.lastMx = mx;
    this.lastMy = my;
    this.markQueried();

    const radius = MOUSE_RADIUS * 0.5 * this.h; // NDC·aspect units → CSS px (isotropic)
    const pad = PAD_PX + this.drift;
    const cand = this.cand;
    for (const c of cand) this.candPool.push(c);
    cand.length = 0;
    const cw = this.binW / GX;
    const ch = this.binH / GY;
    const x0 = Math.max(0, Math.floor((mx - radius - pad) / cw));
    const x1 = Math.min(GX - 1, Math.floor((mx + radius + pad) / cw));
    const y0 = Math.max(0, Math.floor((my - radius - pad) / ch));
    const y1 = Math.min(GY - 1, Math.floor((my + radius + pad) / ch));
    const p = this.pt;
    // cheap prefilter on the bucketed position: a bead can only reach the cursor radius if its
    // binned position lies within radius + pad (+ 16 px for the current's displacement)
    const reach = radius + pad + 16;
    const reach2 = reach * reach;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * GX + cx;
        for (let k = this.cellStart[c]; k < this.cellStart[c + 1]; k++) {
          const i = this.cellItems[k];
          const ddx = this.bx[i] - mx;
          const ddy = this.by[i] - my;
          if (ddx * ddx + ddy * ddy > reach2) continue;
          // exact, flowed position with the current camera
          if (!this.proj(i, true, p)) continue;
          if (p.x < 0 || p.y < 0 || p.x >= this.w || p.y >= this.h) continue;
          const d = Math.hypot(p.x - mx, p.y - my);
          if (d >= radius) continue;
          if (avoid && Math.hypot(p.x - avoid.x, p.y - avoid.y) < 120) continue;
          const o = this.candPool.pop() ?? { i: 0, d: 0, x: 0, y: 0 };
          o.i = i;
          o.d = d;
          o.x = p.x;
          o.y = p.y;
          cand.push(o);
        }
      }
    }
    cand.sort((a, b) => a.d - b.d);

    const box = chip ?? LABEL_CHIP;
    const picked = this.picked;
    picked.length = 0;
    out.length = 0;
    const gap = box.gap;
    for (const c of cand) {
      if (picked.length >= MAX_LABELS) break;
      const px = c.x;
      const py = c.y;
      const strength = 1 - c.d / radius;
      // the chip this candidate would show (full above the value threshold)
      const wc = strength > LABEL_VALUE_MIN_STRENGTH ? box.wFull : box.wRedacted;
      let ok = true;
      for (const pk of picked) {
        // same offset for every chip: they collide when the rows overlap and
        // the left chip reaches the right one's origin
        const rowsOverlap = Math.abs(py - pk.y) < box.h + gap;
        const colsOverlap = px >= pk.x ? px - pk.x < pk.w + gap : pk.x - px < wc + gap;
        if ((rowsOverlap && colsOverlap) || Math.hypot(px - pk.x, py - pk.y) < MIN_SEP) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      picked.push({ x: px, y: py, w: wc });
      const lab = this.pool[out.length];
      lab.x = Math.round((px + OFFSET_X) * 2) / 2;
      lab.y = Math.round((py + OFFSET_Y) * 2) / 2;
      lab.value = this.values[c.i];
      lab.strength = strength;
      lab.i = c.i;
      out.push(lab);
    }
  }

  /** Same picks, positions re-projected this frame (the flow moves the beads; leaders follow). */
  refresh(out: CursorLabel[]): void {
    const p = this.pt;
    for (const lab of out) {
      if (lab.i < 0 || !this.proj(lab.i, true, p)) continue;
      lab.x = Math.round((p.x + OFFSET_X) * 2) / 2;
      lab.y = Math.round((p.y + OFFSET_Y) * 2) / 2;
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
   * consecutive picks differ. Returns the index or −1. Uses the last frame().
   */
  pickBehindSweep(sweepAngle: number, window: number, margin: number, start: number): number {
    if (this.w <= 0) return -1;
    const n = this.n;
    const p = this.pt;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      let behind = (sweepAngle - this.angles[i]) % TWO_PI;
      if (behind < 0) behind += TWO_PI;
      if (behind > window) continue;
      if (!this.proj(i, true, p)) continue;
      if (p.x < margin || p.y < margin || p.x > this.w - margin || p.y > this.h - margin) continue;
      return i;
    }
    return -1;
  }

  /** Screen position of point i (CSS px, flowed, exact for this frame), or null if off screen. */
  screenOf(i: number): { x: number; y: number } | null {
    if (i < 0 || i >= this.n) return null;
    const p = { x: 0, y: 0 };
    if (!this.proj(i, true, p) || p.x < 0 || p.y < 0 || p.x >= this.w || p.y >= this.h) return null;
    return p;
  }

  valueOf(i: number): number {
    return this.values[i] ?? 0;
  }
}
