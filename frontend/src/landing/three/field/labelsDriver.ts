/* ============================================================
   three/field/labelsDriver.ts — cursor labels, sweep-flash and the
   pinned beads (spec rev 3.1 §4.1, §4.4, §4.9). Owner: WP3.

   preUpdate(f): f.pinned = field.setPinned() (the WP6 chip pool: echo /
   decoy / cursor chips) ∪ this driver's cursor picks of the previous
   frame, ≤ 8, external first; the uPinned uniform is written only when
   the list changes.
   setPinned(indices) merges at once (the DOM chip writers run between
   field.update and field.render, so the chip's bead is pinned in the
   same frame's draw).
   update(f): radar-mode cursor labels (gate open, cursor on, not in the
   Gateway) through the LabelPicker (bin-only projection, the runtime
   chip box from setLabelChip, exact FLOWED positions: a pinned bead only
   moves with the current, so leaders stay on the drawn bead), the C4c
   redacted sweep-flash pick; then the pins are merged again so this
   frame's picks are pinned in this frame's draw (uniforms upload at
   render time).
   Dev: window.__cxLabels.syncP95() — LabelPicker cost (ms) over the last
   240 frames it ran (§10 WP3: ≤ 0.05 ms p95).
   ============================================================ */

import type * as THREE from "three";
import { PACE } from "../../cinema/beats";
import { IS_DEV } from "../../cinema/env";
import type { CursorLabel, FieldFrameData } from "../../cinema/types";
import { LabelPicker, type FlowState } from "../labels";
import type { DriverInit, FieldDriver, FieldFrame, FieldHost, PointUniforms } from "./frame";

const LABEL_TARGET_FROM = 220 * PACE;
const FLASH_EVERY = 0.4;
const FLASH_WINDOW = 0.08;

export class LabelsDriver implements FieldDriver {
  private labels!: LabelPicker;
  private camera!: THREE.PerspectiveCamera;
  private frameData!: FieldFrameData;
  private host!: FieldHost;
  private pu!: PointUniforms;
  private frame!: FieldFrame;
  private baseCount = 0;
  /** indices pinned by the DOM chip owner (setPinned), −1 = empty */
  private readonly external = new Int32Array(8).fill(-1);
  private readonly uploaded = new Int32Array(8).fill(-1);
  private readonly flow: FlowState = { ph: [0, 0, 0], A: 0, w3: 1 };

  // sweep-flash (C4c)
  private flashIdx = -1;
  private nextFlashT = 0;
  private flashSeq = 0;
  private readonly flash: CursorLabel = { x: 0, y: 0, value: 0, strength: 1, i: -1 };

  // dev timing
  private readonly cost: number[] = [];
  private runs = 0;

  init(k: DriverInit): void {
    this.labels = new LabelPicker(k.base.positions, k.base.values, k.base.angles);
    this.camera = k.camera;
    this.frameData = k.frameData;
    this.host = k.host;
    this.pu = k.pu;
    this.frame = k.frame;
    this.baseCount = k.base.count;
    if (IS_DEV) {
      const w = window as unknown as { __cxLabels?: unknown };
      w.__cxLabels = {
        syncP95: () => {
          if (!this.cost.length) return 0;
          const s = this.cost.slice().sort((a, b) => a - b);
          return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
        },
        samples: () => this.cost.slice(),
        rebins: () => this.labels.rebins,
        /** frames the picker ran (labels or sweep-flash wanted) */
        runs: () => this.runs,
        pinned: () => Array.from(this.uploaded),
        /**
         * Per-call cost (µs) of the picker's paths, timed over `n` repeats each (the page timer is
         * too coarse for one call): `query` = a full re-query at the current cursor (the cost of a
         * frame whose cursor or camera moved), `rebin` = a full bucketing. With rebins/runs < 5 %,
         * the frame p95 is the query cost.
         */
        bench: (n = 400) => {
          const f = this.frame;
          const w = this.host.w;
          const h = this.host.h;
          const mx = f.mouse.on ? (f.mouse.x * 0.5 + 0.5) * w : w * 0.45;
          const my = f.mouse.on ? (-f.mouse.y * 0.5 + 0.5) * h : h * 0.45;
          const out: CursorLabel[] = [];
          this.labels.frame(this.camera, w, h, this.flow);
          let t0 = performance.now();
          for (let i = 0; i < n; i++) {
            this.labels.frame(this.camera, w, h, this.flow);
            this.labels.query(true, mx + (i & 7), my, f.anchor.visible ? f.anchor : null, f.labelChip, out);
          }
          const query = ((performance.now() - t0) * 1000) / n;
          const rb = this.labels.rebins;
          t0 = performance.now();
          for (let i = 0; i < n; i++) this.labels.rebinNow();
          const rebin = ((performance.now() - t0) * 1000) / n;
          this.labels.rebins = rb;
          this.labels.reset(out);
          return { queryUs: query, rebinUs: rebin, labels: out.length };
        },
      };
    }
  }

  /** f.pinned = external ∪ last cursor picks. */
  preUpdate(f: FieldFrame): void {
    this.mergePins(f);
  }

  /** labels (radar mode, gate open, mouse on) + the C4c sweep-flash pick */
  update(f: FieldFrame): void {
    const vh = f.vh;
    const t = f.t;
    const sweepMod = f.legacySweepMod;
    const s = f.score;
    const fd = this.frameData;
    const w = this.host.w;
    const h = this.host.h;
    const mouseOn = f.mouse.on;
    const wantLabels = s.labelsGate > 0 && mouseOn && !f.inGateway;
    const wantFlash = s.sweepFlash > 0;
    const t0 = IS_DEV && (wantLabels || wantFlash) ? performance.now() : 0;

    // what the GPU applies to a pinned bead this frame (shared uniforms)
    const ph = this.pu.uFlowPhase.value as THREE.Vector3;
    this.flow.ph[0] = ph.x;
    this.flow.ph[1] = ph.y;
    this.flow.ph[2] = ph.z;
    this.flow.A = this.pu.uFlowAmp.value as number;
    this.flow.w3 = this.pu.uFlowW3.value as number;

    let camChanged = false;
    if (wantLabels || wantFlash) {
      this.runs++;
      camChanged = this.labels.frame(this.camera, w, h, this.flow);
    }

    if (wantLabels) {
      const mx = (f.mouse.x * 0.5 + 0.5) * w;
      const my = (-f.mouse.y * 0.5 + 0.5) * h;
      const avoid = vh >= LABEL_TARGET_FROM && f.anchor.visible ? f.anchor : null;
      this.labels.query(camChanged, mx, my, avoid, f.labelChip, fd.cursorLabels);
    } else if (fd.cursorLabels.length) {
      this.labels.reset(fd.cursorLabels);
    }

    if (wantFlash) {
      if (t >= this.nextFlashT || this.flashIdx < 0) {
        this.nextFlashT = t + FLASH_EVERY;
        const start = (this.flashSeq++ * 7919) % Math.max(1, this.baseCount);
        this.flashIdx = this.labels.pickBehindSweep(sweepMod, FLASH_WINDOW, 48, start);
      }
      const p = this.labels.screenOf(this.flashIdx);
      if (p) {
        const fl = this.flash;
        fl.x = Math.round((p.x + 13) * 2) / 2;
        fl.y = Math.round((p.y - 11) * 2) / 2;
        fl.value = this.labels.valueOf(this.flashIdx);
        fl.strength = 1;
        fl.i = this.flashIdx;
        fd.sweepFlash = fl;
      } else fd.sweepFlash = null;
    } else {
      fd.sweepFlash = null;
      this.flashIdx = -1;
    }

    // this frame's picks are pinned in this frame's draw
    this.mergePins(f);

    if (t0) {
      this.cost.push(performance.now() - t0);
      if (this.cost.length > 240) this.cost.shift();
    }
  }

  /** external (WP6 chip pool) ∪ cursor picks → f.pinned and uPinned (written only on change). */
  private mergePins(f: FieldFrame): void {
    const out = f.pinned;
    out.fill(-1);
    let n = 0;
    const add = (i: number): void => {
      if (i < 0 || n >= 8) return;
      for (let k = 0; k < n; k++) if (out[k] === i) return;
      out[n++] = i;
    };
    for (let k = 0; k < 8; k++) add(this.external[k]);
    const labs = this.frameData.cursorLabels;
    for (let k = 0; k < labs.length; k++) add(labs[k].i);
    let changed = false;
    for (let k = 0; k < 8; k++) {
      if (this.uploaded[k] !== out[k]) {
        this.uploaded[k] = out[k];
        changed = true;
      }
    }
    if (changed) {
      const u = this.pu.uPinned.value as Float32Array;
      for (let k = 0; k < 8; k++) u[k] = out[k];
    }
  }

  /**
   * ≤ 8 indices from the DOM chip owner. Merged at once: the chip writers run after
   * field.update and before field.render, so a chip shown this frame is pinned in this
   * frame's draw (uniforms upload at render time) — never one frame of dimple under a leader.
   */
  setPinned(indices: readonly number[]): void {
    let changed = false;
    for (let i = 0; i < 8; i++) {
      const v = i < indices.length ? indices[i] : -1;
      const idx = Number.isFinite(v) && v >= 0 && v < this.baseCount ? v | 0 : -1;
      if (this.external[i] !== idx) {
        this.external[i] = idx;
        changed = true;
      }
    }
    if (changed && this.frame) this.mergePins(this.frame);
  }

  dispose(): void {
    if (IS_DEV) {
      const w = window as unknown as { __cxLabels?: unknown };
      delete w.__cxLabels;
    }
  }
}
