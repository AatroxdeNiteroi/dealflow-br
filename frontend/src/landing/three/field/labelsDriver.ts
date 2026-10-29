/* ============================================================
   three/field/labelsDriver.ts — cursor labels, sweep-flash and (v3)
   echo-chip picks (spec rev 3.1 §4.1, §4.9). Moved verbatim from
   PointField.updateLabels by WP0 → owned by WP3.

   preUpdate(f): the pinned list f.pinned = this driver's cursor picks ∪
   field.setPinned() (the WP6 chip pool); WP0 forwards the external list.
   update(f): v2's updateLabels — radar-mode cursor labels (gate open,
   cursor on, not in the Gateway) and the C4c redacted sweep-flash pick.
   v3 (WP3): LabelPicker bin-only projection reading the runtime chip box
   (f.labelChip from setLabelChip), echo chip picks → frameData.echoes.
   ============================================================ */

import type * as THREE from "three";
import { PACE } from "../../cinema/beats";
import type { CursorLabel, FieldFrameData } from "../../cinema/types";
import { LabelPicker } from "../labels";
import type { DriverInit, FieldDriver, FieldFrame, FieldHost } from "./frame";

const LABEL_TARGET_FROM = 220 * PACE;
const FLASH_EVERY = 0.4;
const FLASH_WINDOW = 0.08;

export class LabelsDriver implements FieldDriver {
  private labels!: LabelPicker;
  private camera!: THREE.PerspectiveCamera;
  private frameData!: FieldFrameData;
  private host!: FieldHost;
  private baseCount = 0;
  /** indices pinned by the DOM chip owner (setPinned), −1 = empty */
  private readonly external = new Int32Array(8).fill(-1);

  // sweep-flash (C4c)
  private flashIdx = -1;
  private nextFlashT = 0;
  private flashSeq = 0;
  private readonly flash: CursorLabel = { x: 0, y: 0, value: 0, strength: 1, i: -1 };

  init(k: DriverInit): void {
    this.labels = new LabelPicker(k.base.positions, k.base.values, k.base.angles);
    this.camera = k.camera;
    this.frameData = k.frameData;
    this.host = k.host;
    this.baseCount = k.base.count;
  }

  /** f.pinned = external ∪ cursor picks (WP0: the external list only). */
  preUpdate(f: FieldFrame): void {
    f.pinned.set(this.external);
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
    if (s.labelsGate > 0 && mouseOn && !f.inGateway) {
      const camChanged = this.labels.sync(this.camera, w, h);
      const mx = (f.mouse.x * 0.5 + 0.5) * w;
      const my = (-f.mouse.y * 0.5 + 0.5) * h;
      const avoid = vh >= LABEL_TARGET_FROM && f.anchor.visible ? f.anchor : null;
      this.labels.query(camChanged, mx, my, avoid, fd.cursorLabels);
    } else if (fd.cursorLabels.length) {
      this.labels.reset(fd.cursorLabels);
    }

    if (s.sweepFlash > 0) {
      this.labels.sync(this.camera, w, h);
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
  }

  /** ≤ 8 indices from the DOM chip owner (written on change only). */
  setPinned(indices: readonly number[]): void {
    this.external.fill(-1);
    for (let i = 0; i < Math.min(8, indices.length); i++) this.external[i] = indices[i] | 0;
  }

  dispose(): void {}
}
