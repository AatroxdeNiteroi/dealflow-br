/* ============================================================
   cinema/ch1/labels.ts — cursor label pool + `--sweep-bearing` sink.
   Owner: WP-CH1.

   WP0 seed: a straight port of the old Landing `onFrame` label code
   onto the clock's Labels slot (4-label pool, values only above
   strength .62, labels only in radar mode), gated by score.labelsGate,
   plus the scoped bearing sink on the Gateway emblem (`.grl`, never
   :root). WP-CH1 adds target suppression, the sweep-flash pool mode,
   the HUD and write-on-change text per §7.7.
   ============================================================ */

import { FrameOrder, type CinemaCtx } from "../types";
import { runtime } from "../runtime";
import { COMPANY_NAMES, LABEL_VALUE_MIN_STRENGTH, NAME_REDACTED, REDACTED, formatBRL } from "../copy";

const POOL = 4;

interface Label {
  el: HTMLDivElement;
  name: HTMLSpanElement;
  val: HTMLSpanElement;
  /** last written state (write on change only) */
  shown: boolean;
  idx: number;
  full: boolean;
}

export function build(ctx: CinemaCtx): void {
  const layer = ctx.labelLayer;
  const labels: Label[] = [];
  for (let i = 0; i < POOL; i++) {
    const el = document.createElement("div");
    el.className = "lp-label";
    const dot = document.createElement("span");
    dot.className = "lp-label-dot";
    const text = document.createElement("span");
    text.className = "lp-label-text";
    const name = document.createElement("span");
    name.className = "lp-label-name";
    const val = document.createElement("span");
    val.className = "lp-label-val";
    text.append(name, val);
    el.append(dot, text);
    layer.append(el);
    labels.push({ el, name, val, shown: false, idx: -1, full: false });
  }

  let radar = false;
  ctx.onPhase((p) => {
    radar = p === "radar";
  });

  const hide = (lab: Label) => {
    if (!lab.shown) return;
    lab.el.style.opacity = "0";
    lab.shown = false;
  };
  const hideAll = () => labels.forEach(hide);

  let lastBearing = -1;
  ctx.frame.add(FrameOrder.Labels, () => {
    const f = ctx.field.frameData;

    // the gateway emblem is a mini radar: its needle mirrors the live bearing
    const gate = runtime.gateEl();
    if (gate) {
      const b = f.sweepBearing | 0;
      if (b !== lastBearing) {
        gate.style.setProperty("--sweep-bearing", String(b));
        lastBearing = b;
      }
    } else {
      lastBearing = -1;
    }

    const gateK = radar ? ctx.field.score.labelsGate : 0;
    if (gateK <= 0) {
      hideAll();
      return;
    }
    const cur = f.cursorLabels;
    for (let i = 0; i < labels.length; i++) {
      const lab = labels[i];
      const c = cur[i];
      if (!c) {
        hide(lab);
        continue;
      }
      lab.el.style.opacity = String(Math.min(1, c.strength * 1.4) * gateK);
      lab.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
      lab.shown = true;
      const full = c.strength > LABEL_VALUE_MIN_STRENGTH;
      if (lab.idx !== c.i || lab.full !== full) {
        lab.idx = c.i;
        lab.full = full;
        lab.el.classList.toggle("is-redacted", !full);
        lab.name.textContent = full ? COMPANY_NAMES[c.i % COMPANY_NAMES.length] : NAME_REDACTED;
        lab.val.textContent = full ? formatBRL(c.value) : REDACTED;
      }
    }
  });

  ctx.settle.register("ch1.labels", { start: hideAll, end: hideAll }, ".lp-labels");
  ctx.onDestroy(() => labels.forEach((l) => l.el.remove()));
}
