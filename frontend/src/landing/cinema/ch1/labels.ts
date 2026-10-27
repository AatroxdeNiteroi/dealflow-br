/* ============================================================
   cinema/ch1/labels.ts — the 4-label pool + `--sweep-bearing` sink.
   Owner: WP-CH1. Runs in the clock's Labels slot (after field.update).

   Two mutually exclusive modes, both radar-phase only (§7.7, §11.10):
   1. CURSOR (vh < 300, score.labelsGate > 0): the field's cursorLabels,
      6 names in full + 6 half-redacted (COMPANY_NAMES[i % 12]), values
      only above strength .62, NAME_REDACTED / REDACTED otherwise.
      From vh 220 every label near the chosen target is suppressed (the
      instrument is narrowing onto ONE company); labelsGate fades them
      all over 260–300.
   2. SWEEP-FLASH (C4c, score.sweepFlash, 1720–1800): every 400 ms take
      at most one point just behind the sweep's leading edge
      (frameData.sweepFlash) that lies on screen and outside the Ch4
      panel / close (and the pinned company), and show it ALWAYS
      redacted for 900 ms with 160 ms fades. Ambient, time-based,
      direction-agnostic; full values are never shown.
   Text is written only when the shown content changes; per-frame writes
   are transform and opacity only.
   ============================================================ */

import { FrameOrder, RECT_KEYS, type CinemaCtx, type CursorLabel, type Rect } from "../types";
import { PACE } from "../beats";
import { FLAGS } from "../flags";
import { claim } from "../dev/assert";
import { runtime } from "../runtime";
import { COMPANY_NAMES, LABEL_VALUE_MIN_STRENGTH, NAME_REDACTED, REDACTED, formatBRL } from "../copy";
import { progress, smoothstep, viewH, viewW } from "../geometry";

const POOL = 4;

/** Target suppression (J2): labels within 120 px of the projected target, from vh 220. */
const SUPPRESS = { from: 214 * PACE, full: 226 * PACE, radius: 120, soft: 36, ringPad: 40 } as const;
/** Approximate label box from its translate origin (top-left), px. */
const LABEL_BOX = { dx: -2, dy: -2, w: 168, h: 42 } as const;

/** C4c sweep-flash cadence (seconds). */
const FLASH = { every: 0.4, hold: 0.9, fade: 0.16, keepOut: 12, spacing: 96, anchorPad: 90 } as const;

/* label content kinds (write on change) */
const K_NONE = -1;
const K_FLASH = -2;

interface Label {
  el: HTMLDivElement;
  name: HTMLSpanElement;
  val: HTMLSpanElement;
  /** last written opacity / transform */
  o: string;
  t: string;
  /** content: point index, K_FLASH, or K_NONE */
  idx: number;
  full: boolean;
  flash: boolean;
}

interface Flash {
  lab: Label;
  i: number;
  t0: number;
  x: number;
  y: number;
  out: boolean;
}

const rectHit = (a: Rect, b: Rect, pad: number): boolean =>
  b.w > 0 &&
  b.h > 0 &&
  a.x < b.x + b.w + pad &&
  a.x + a.w > b.x - pad &&
  a.y < b.y + b.h + pad &&
  a.y + a.h > b.y - pad;

/** Distance from a point to a rect (0 inside). */
const distToRect = (px: number, py: number, r: Rect): number => {
  const dx = px < r.x ? r.x - px : px > r.x + r.w ? px - (r.x + r.w) : 0;
  const dy = py < r.y ? r.y - py : py > r.y + r.h ? py - (r.y + r.h) : 0;
  return Math.hypot(dx, dy);
};

export interface LabelsApi {
  hideAll(): void;
}

export function buildLabels(ctx: CinemaCtx): LabelsApi {
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
    labels.push({ el, name, val, o: "", t: "", idx: K_NONE, full: false, flash: false });
  }
  if (FLAGS.DEV_ASSERT) claim("CH1", labels.map((l) => l.el), ["opacity", "transform"]);

  let radar = false;
  ctx.onPhase((p) => {
    radar = p === "radar";
  });

  const setO = (lab: Label, v: string) => {
    if (lab.o === v) return;
    lab.o = v;
    lab.el.style.opacity = v;
  };
  const setT = (lab: Label, x: number, y: number) => {
    const v = `translate3d(${Math.round(x * 2) / 2}px, ${Math.round(y * 2) / 2}px, 0)`;
    if (lab.t === v) return;
    lab.t = v;
    lab.el.style.transform = v;
  };
  const setMode = (lab: Label, flash: boolean) => {
    if (lab.flash === flash) return;
    lab.flash = flash;
    lab.el.classList.toggle("cx-flash", flash);
  };
  const setContent = (lab: Label, idx: number, full: boolean) => {
    if (lab.idx === idx && lab.full === full) return;
    lab.idx = idx;
    lab.full = full;
    lab.el.classList.toggle("is-redacted", !full);
    lab.name.textContent = full ? COMPANY_NAMES[idx % COMPANY_NAMES.length] : NAME_REDACTED;
    // value text is written by the caller when full (it depends on the point)
    if (!full) lab.val.textContent = REDACTED;
  };

  const hide = (lab: Label) => setO(lab, "0");

  /* ── sweep-flash state ──────────────────────────────────────── */
  let flashes: Flash[] = [];
  let nextPick = 0;
  const releaseFlashes = () => {
    for (const f of flashes) hide(f.lab);
    flashes = [];
  };

  const hideAll = () => {
    labels.forEach(hide);
    flashes = [];
    nextPick = 0;
  };

  /* ── mode 1: cursor labels ─────────────────────────────────── */
  const cursorMode = (vh: number, gateK: number) => {
    const cur = ctx.field.frameData.cursorLabels;
    const supK = progress(SUPPRESS.from, SUPPRESS.full, vh);
    const a = supK > 0 ? ctx.field.getAnchorScreen() : null;
    const radius = a ? Math.max(SUPPRESS.radius, a.r + SUPPRESS.ringPad) * supK : 0;
    for (let i = 0; i < labels.length; i++) {
      const lab = labels[i];
      setMode(lab, false);
      const c: CursorLabel | undefined = cur[i];
      if (!c) {
        hide(lab);
        continue;
      }
      let k = 1;
      if (a && a.visible && radius > 0) {
        const box: Rect = { x: c.x + LABEL_BOX.dx, y: c.y + LABEL_BOX.dy, w: LABEL_BOX.w, h: LABEL_BOX.h };
        k = smoothstep(radius, radius + SUPPRESS.soft, distToRect(a.x, a.y, box));
      }
      const op = Math.min(1, c.strength * 1.4) * gateK * k;
      if (op <= 0.002) {
        hide(lab);
        continue;
      }
      setT(lab, c.x, c.y);
      setO(lab, (Math.round(op * 1000) / 1000).toString());
      const full = c.strength > LABEL_VALUE_MIN_STRENGTH;
      const changed = lab.idx !== c.i || lab.full !== full;
      setContent(lab, c.i, full);
      if (full && changed) lab.val.textContent = formatBRL(c.value);
    }
  };

  /* ── mode 2: C4c sweep-flash (always redacted) ─────────────── */
  const flashOk = (c: CursorLabel): boolean => {
    const vw = viewW();
    const vhPx = viewH();
    const box: Rect = { x: c.x + LABEL_BOX.dx, y: c.y + LABEL_BOX.dy, w: LABEL_BOX.w, h: LABEL_BOX.h };
    if (box.x < 8 || box.y < 8 || box.x + box.w > vw - 8 || box.y + box.h > vhPx - 8) return false;
    if (rectHit(box, ctx.rects.get(RECT_KEYS.ch4Panel), FLASH.keepOut)) return false;
    if (rectHit(box, ctx.rects.get(RECT_KEYS.ch4Close), FLASH.keepOut)) return false;
    // never over the pinned company (its ring and "R$ 24,3 mi")
    const a = ctx.field.getAnchorScreen();
    if (a.visible && distToRect(a.x, a.y, box) < a.r + FLASH.anchorPad) return false;
    for (const f of flashes) if (Math.hypot(f.x - c.x, f.y - c.y) < FLASH.spacing) return false;
    return true;
  };

  const flashMode = (t: number) => {
    // the cursor pool yields entirely to the flash mode
    for (const lab of labels) if (!flashes.some((f) => f.lab === lab)) hide(lab);
    if (t >= nextPick) {
      nextPick = t + FLASH.every;
      const c = ctx.field.frameData.sweepFlash;
      // "" = never written (CSS default opacity 0)
      const free = labels.find((l) => !flashes.some((f) => f.lab === l) && (l.o === "0" || l.o === ""));
      if (c && free && flashOk(c)) {
        setMode(free, true);
        setContent(free, K_FLASH, false);
        setT(free, c.x, c.y);
        setO(free, "1");
        flashes.push({ lab: free, i: c.i, t0: t, x: c.x, y: c.y, out: false });
      }
    }
    const live = ctx.field.frameData.sweepFlash;
    flashes = flashes.filter((f) => {
      const age = t - f.t0;
      // follow the same point while the field keeps reporting it
      if (live && live.i === f.i && !f.out) {
        f.x = live.x;
        f.y = live.y;
        setT(f.lab, f.x, f.y);
      }
      if (!f.out && age >= FLASH.hold - FLASH.fade) {
        f.out = true;
        hide(f.lab);
      }
      return age < FLASH.hold;
    });
  };

  let lastBearing = -1;
  ctx.frame.add(FrameOrder.Labels, (vh, t) => {
    const f = ctx.field.frameData;

    // the gateway emblem is a mini radar: its needle mirrors the live bearing
    // (scoped to `.grl`, never :root; written only when the 0.1° value
    // changes — whole degrees visibly step while the emblem glides at ~2×)
    const gate = runtime.gateEl();
    if (gate) {
      const b = Math.round(f.sweepBearing * 10) / 10;
      if (b !== lastBearing) {
        gate.style.setProperty("--sweep-bearing", String(b));
        lastBearing = b;
      }
    } else {
      lastBearing = -1;
    }

    if (!radar) {
      if (flashes.length) releaseFlashes();
      labels.forEach(hide);
      return;
    }
    const score = ctx.field.score;
    if (score.sweepFlash > 0) {
      flashMode(t);
      return;
    }
    if (flashes.length) releaseFlashes();
    const gateK = score.labelsGate;
    if (gateK <= 0) {
      labels.forEach(hide);
      return;
    }
    cursorMode(vh, gateK);
  });

  ctx.onDestroy(() => labels.forEach((l) => l.el.remove()));
  return { hideAll };
}
