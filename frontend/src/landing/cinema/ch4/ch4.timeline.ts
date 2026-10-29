/* ============================================================
   cinema/ch4/ch4.timeline.ts — WP-CH4 entry build: Cap. 4 "O universo"
   DOM (spec §5 C4b–C4d, §3.7, §4.5 `countSettle`).

   v3 "Sonar Líquido" (WP7, spec rev 3.1 §2.3 CH4_T, §3 C4b–C4d, §5.4,
   §7 E5/C4/D3): windows from beats.ts TEXT_V3.ch4; both plates are
   OPAQUE paper panels r 18 that condense in place (opacity leads, scale
   .97 → 1, cx-flow) and evaporate (cx-evap); text pours glyph by glyph
   (INK) and evaporates from its far edge (EVAPORATE) on the glyph engine.

   What it says, beat by beat (master vh; all scrubbed parts are pure
   functions of vh and reverse exactly):
     1649        stage root on (its children are still at 0)
     1652–1668   PANEL condenses before the count (opaque by 1661.6)
     1660–1676   label "empresas de capital fechado no radar" pours (INK)
     1680–1748   ODOMETER lifts out of redaction in step with the dust
                 wave: reel k rolls █ → its digit over [1680+8k, 1716+8k],
                 most significant first. Per-frame writer (FrameOrder
                 Dossier): device-pixel-rounded translateY, motion blur
                 ≤ 1.5 px proportional to the reel's real speed (a frozen
                 frame is always sharp; never on mobile). Feathered
                 windows; the redaction cell is an ink capsule.
     1752        ACT countSettle (time-based, reversible): the last reel
                 kicks into its detent (back.out(1.15)), the gold hairline
                 draws from the centre (rk-settle) — "count locked" — and
                 the digits' weight settles 640 → 500 (fixed-width cells,
                 desktop; FLAGS.ODO_WGHT)
     1758–1766   CLOSE condenses in the lower band (opaque by 1762.8)
     1762–1776   lead pours; 1770–1782 sub pours (full at the R7 plateau)
     R7 1782–1798  nothing moves; the close is held (D9) until 1848
     1848–1859   the close evaporates (sub first, from the far edge);
                 its plate follows 1852–1859
     1850–1866   the panel evaporates: its label 1850–1858 on the opaque
                 plate, then the plate 1859–1866 (never with the close's)
     1868        stage root off → every ch4 layer at 0 well before 1880

   Outputs: `ch4.panel`, `ch4.close` rects (untransformed slots, for
   RIG's leader and CH1's sweep-flash exclusion); settle hooks.
   Writers (single owner each): master → root/panel/close + the text
   roots' gates; glyph writer → the glyph spans; frame writer → strip
   transform + filter + will-change; act → last detent yPercent +
   hairline scaleX + `--odo-w`.
   ============================================================ */

import gsap from "gsap";
import { ACTS_AT, MARKS, MASTER_END, PACE, TEXT_V3 } from "../beats";
import { CH4_COPY } from "../copy";
import { fromDOMRect, progress, roundDevice, sineInOut } from "../geometry";
import { claim } from "../dev/assert";
import { FrameOrder, RECT_KEYS, type CinemaCtx, type Rect } from "../types";
import { drainPlate, liquidText, pourPlate, type PlateLines } from "../dossier/liquid";
import { reelTargets } from "./Reels";

const P = (v: number): number => v * PACE;
const C = TEXT_V3.ch4;
type Span = { from: number; to: number };
const span = (from: number, to: number): Span => ({ from, to });
/** opacity leads the condense: the plate is opaque at 60 % of its window */
const opaqueAt = (w: Span): number => w.from + 0.6 * (w.to - w.from);

/** Every CH4 window, in master vh (v3 §2.3 CH4_T). */
export const CH4_T = {
  stageOn: P(1649),
  panelIn: { from: C.panelIn.from, opaque: opaqueAt(C.panelIn), to: C.panelIn.to },
  label: span(C.label.from, C.label.to),
  /** reel k rolls over [from + k·step, from + k·step + len] (unchanged) */
  reels: TEXT_V3.ch4Reels,
  closeIn: { from: C.closeIn.from, opaque: opaqueAt(C.closeIn), to: C.closeIn.to },
  lead: span(C.lead.from, C.lead.to),
  sub: span(C.sub.from, C.sub.to),
  /** the close's text evaporates from its far edge (sub first, then lead) */
  closeOut: span(C.closeOut.from, C.closeOut.to),
  subOut: span(C.closeOut.from, C.closeOut.from + P(9)),
  leadOut: span(C.closeOut.from + P(2), C.closeOut.from + P(11)),
  /** …and its plate follows while the last glyphs dry (inside closeOut) */
  closePlateOut: span(C.closeOut.from + P(4), C.closeOut.from + P(11)),
  /** the count panel (panelOut 1850–1866): its label evaporates on the still
   *  opaque plate, then the plate (count + hairline) leaves — only once the
   *  close's plate is gone, so the two plates are never semi-transparent
   *  together (§11 item 11 over 1750–1870) */
  panelOut: span(C.panelOut.from, C.panelOut.to),
  labelOut: span(C.panelOut.from, C.panelOut.from + P(8)),
  panelPlateOut: span(C.closeOut.from + P(11), C.panelOut.to),
  stageOff: TEXT_V3.ch4StageOff,
} as const;

/** Reel window/cell height in em (CSS mirror). */
const CELL_EM = 1.14;
/** Motion blur: px at full, and the reel speed (cells/s) that reaches it. */
const BLUR_MAX = 1.5;
const BLUR_FULL_CPS = 14;
/** will-change only while the odometer segment is live (§10.5). */
const LIVE_FROM = CH4_T.reels.from - P(8);
const LIVE_TO = ACTS_AT.countSettle + P(4);
/** countSettle weight settle (Playfair wght axis; fixed-width cells only). */
const ODO_W_ROLL = 640;
const ODO_W_REST = 500;

interface Reel {
  strip: HTMLElement;
  target: number;
  from: number;
  to: number;
  /** last written translateY (px) */
  y: number;
  /** position in cells at the previous frame (speed) */
  pos: number;
  blur: number;
  /** last written blur, quantised (−1 = "none" written) */
  blurW: number;
}

export function build(ctx: CinemaCtx): void {
  const root = document.querySelector<HTMLElement>(".cx-ch4-stage");
  if (!root) return;
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const panelSlot = q(".cx-ch4__slot--panel");
  const closeSlot = q(".cx-ch4__slot--close");
  const panel = q(".cx-ch4__panel");
  const close = q(".cx-ch4__close");
  const label = q(".cx-ch4__label");
  const lead = q(".cx-ch4__lead");
  const sub = q(".cx-ch4__sub");
  const rule = q(".cx-ch4__rule");
  const reelsEl = q(".cx-ch4__reels");
  const strips = Array.from(root.querySelectorAll<HTMLElement>(".cx-ch4__strip"));
  const detents = Array.from(root.querySelectorAll<HTMLElement>(".cx-ch4__detent"));
  const firstCell = q(".cx-ch4__cell");
  if (!panelSlot || !closeSlot || !panel || !close || !label || !lead || !sub || !rule || !strips.length) return;

  const tl = ctx.tl;
  const { reels: R } = CH4_T;

  /* ── odometer writer state (see the frame writer below) ───────── */
  let lastVh = NaN;
  let forceReels = true;
  let live: boolean | null = null;
  let blurring = false;

  /* ── refresh-time geometry (nothing reads layout per frame) ────── */
  let cellPx = 0;
  const measureCell = () => {
    const h = firstCell ? parseFloat(getComputedStyle(firstCell).height) : NaN;
    // fallback: the count's font size × the cell em
    cellPx = Number.isFinite(h) && h > 0 ? h : parseFloat(getComputedStyle(strips[0]).fontSize) * CELL_EM;
  };
  const slotRect = (el: HTMLElement): Rect => fromDOMRect(el.getBoundingClientRect());
  ctx.rects.register(RECT_KEYS.ch4Panel, () => {
    measureCell(); // same timing as the rects (after fonts.ready, on every refreshInit)
    forceReels = true;
    return slotRect(panelSlot);
  });
  ctx.rects.register(RECT_KEYS.ch4Close, () => slotRect(closeSlot));

  /* ── master: stage root (on/off while every child is at 0, §7 G1) ── */
  tl.to(root, { autoAlpha: 1, duration: P(1) }, CH4_T.stageOn);
  tl.to(root, { autoAlpha: 0, duration: P(1) }, CH4_T.stageOff);

  /** A plate condenses in place: opacity leads (opaque before its first
   *  word is legible), scale .97 → 1 settles over the whole window. */
  const condense = (el: HTMLElement, w: { from: number; opaque: number; to: number }, swell?: number, text?: PlateLines) => {
    gsap.set(el, { autoAlpha: 0, scale: 0.97 });
    // motion r1: a capsule band swells into the plate with the first glyphs (liquid.ts
    // pourPlate); opaque over the first 30 % of the window (was w.opaque, 60 %)
    const opaque = w.from + 0.3 * (w.to - w.from);
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: opaque - w.from, ease: "cx-flow", immediateRender: false }, w.from);
    tl.fromTo(el, { scale: 0.97 }, { scale: 1, duration: w.to - w.from, ease: "cx-flow", immediateRender: false }, w.from);
    pourPlate(tl, el, w.from, w.to, swell, text);
  };
  /** …and evaporates: drains back into the band (first 60 %), then dries (cx-evap). */
  const evaporate = (el: HTMLElement, w: Span, split = false) => {
    const d = w.to - w.from;
    drainPlate(tl, el, w.from, w.to, split);
    tl.to(el, { scale: 0.985, duration: d, ease: "cx-evap" }, w.from);
    tl.to(el, { autoAlpha: 0, duration: 0.55 * d, ease: "cx-evap" }, w.from + 0.45 * d);
  };

  /* ── C4b: the panel condenses BEFORE the count; the label pours ── */
  // the count is the panel's content from its first frame: it swells from the window start
  condense(panel, CH4_T.panelIn);
  liquidText(ctx, "ch4.label", label, { pour: [CH4_T.label.from, CH4_T.label.to], exit: [CH4_T.labelOut.from, CH4_T.labelOut.to] });

  /* ── C4c: the close condenses; lead then sub pour (full at 1782) ── */
  // motion r2: the close then grows line by line behind the ink (open by the sub's end − 4)
  condense(close, CH4_T.closeIn, CH4_T.lead.from, {
    blocks: [
      { root: lead, from: CH4_T.lead.from, to: CH4_T.lead.to },
      { root: sub, from: CH4_T.sub.from, to: CH4_T.sub.to },
    ],
    openBy: CH4_T.sub.to - P(4),
  });
  liquidText(ctx, "ch4.lead", lead, { pour: [CH4_T.lead.from, CH4_T.lead.to], exit: [CH4_T.leadOut.from, CH4_T.leadOut.to] });
  liquidText(ctx, "ch4.sub", sub, { pour: [CH4_T.sub.from, CH4_T.sub.to], exit: [CH4_T.subOut.from, CH4_T.subOut.to] });

  /* ── C4d: held until the D9 break (1848), then evaporate in place:
     the close's plate first, then the count panel's (never together) ── */
  evaporate(close, CH4_T.closePlateOut, true);
  evaporate(panel, CH4_T.panelPlateOut);

  /* ── the odometer: per-frame writer (pure function of vh + damped blur) ─ */
  const targets = reelTargets(CH4_COPY.count);
  const reels: Reel[] = strips.map((strip, k) => ({
    strip,
    target: targets[k] ?? 0,
    from: R.from + R.step * k,
    to: R.from + R.step * k + R.len,
    y: NaN,
    pos: 0,
    blur: 0,
    blurW: NaN,
  }));
  const blurOn = !ctx.isMobile; // §9.2: no blur filters anywhere on mobile
  if (ctx.flags.DEV_ASSERT) claim("CH4", strips, blurOn ? ["transform", "filter", "willChange"] : ["transform", "willChange"]);

  const posAt = (r: Reel, vh: number) => sineInOut(progress(r.from, r.to, vh)) * r.target;

  const writeBlur = (r: Reel, b: number) => {
    // quantised to 0.05 px; "none" below that (no idle filter layers)
    const qb = b < 0.05 ? 0 : Math.round(b * 20) / 20;
    if (qb === r.blurW) return;
    r.strip.style.filter = qb === 0 ? "none" : `blur(${qb}px)`;
    r.blurW = qb;
  };

  const writeReels = (vh: number, dt: number) => {
    const moved = vh !== lastVh;
    const isLive = vh >= LIVE_FROM && vh <= LIVE_TO;
    if (isLive !== live) {
      const wc = isLive ? (blurOn ? "transform, filter" : "transform") : "auto";
      for (const r of reels) r.strip.style.willChange = wc;
      live = isLive;
    }
    let anyBlur = false;
    for (const r of reels) {
      const pos = posAt(r, vh);
      if (moved || forceReels) {
        const y = roundDevice(-pos * cellPx);
        if (forceReels || y !== r.y) {
          r.strip.style.transform = `translateY(${y}px)`;
          r.y = y;
        }
      }
      if (blurOn) {
        // speed in cells per second → blur; rises fast, decays smoothly
        const cps = dt > 0 ? Math.abs(pos - r.pos) / dt : 0;
        const want = BLUR_MAX * Math.min(1, cps / BLUR_FULL_CPS);
        const lambda = want > r.blur ? 28 : 9;
        r.blur = r.blur + (want - r.blur) * (1 - Math.exp(-lambda * Math.max(dt, 0)));
        if (r.blur < 0.02 && want === 0) r.blur = 0;
        writeBlur(r, r.blur);
        if (r.blur > 0) anyBlur = true;
      }
      r.pos = pos;
    }
    forceReels = false;
    lastVh = vh;
    return anyBlur;
  };

  /** Jump the reels to the exact state at `vh` (settle, refresh): no blur. */
  const snapReels = (vh: number) => {
    for (const r of reels) {
      r.blur = 0;
      r.blurW = NaN;
      r.pos = posAt(r, vh);
    }
    forceReels = true;
    writeReels(vh, 0);
    for (const r of reels) writeBlur(r, 0);
  };

  measureCell();
  snapReels(ctx.vh());

  ctx.frame.add(FrameOrder.Dossier, (vh, _t, dt) => {
    if (vh === lastVh && !forceReels && !blurring) return;
    blurring = writeReels(vh, dt);
  });

  /* ── act countSettle (1752): last reel locks + the panel hairline ─ */
  const lastDetent = detents[detents.length - 1];
  const act = gsap.timeline({ paused: true });
  if (lastDetent) {
    // a continuous impulse (0 → −6% of a cell → 0): the reel carries past
    // its detent and springs back. Starting from rest avoids the jump a
    // from-offset start would make on the act's first frame; at ±6% the
    // neighbouring digit stays ≥ 0.1em outside the window.
    act.to(lastDetent, { yPercent: -6, duration: 0.09, ease: "power2.out" }, 0);
    act.to(lastDetent, { yPercent: 0, duration: 0.21, ease: "back.out(1.15)" }, 0.09);
  }
  act.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "rk-settle" }, 0);
  // §3 C4b / §5.4: the digits' weight settles 640 → 500 with the lock
  // (variable Playfair wght; the reel cells are fixed-width and contained,
  // so no glyph moves). Desktop only (mobile starts at T2; scope-cut list).
  const odoWeight = !!reelsEl && ctx.flags.ODO_WGHT && !ctx.isMobile;
  if (odoWeight && reelsEl) {
    gsap.set(reelsEl, { "--odo-w": ODO_W_ROLL });
    act.fromTo(reelsEl, { "--odo-w": ODO_W_ROLL }, { "--odo-w": ODO_W_REST, duration: 0.3, ease: "back.out(1.15)" }, 0);
  }
  ctx.acts.register({ id: "countSettle", at: ACTS_AT.countSettle, tl: act });

  /* ── settle: deterministic start/end (teleport, return home) ──── */
  ctx.settle.register(
    "ch4.stage",
    {
      start() {
        // the master is already at 0 (pre-states rendered); reels to █
        snapReels(0);
        lastVh = NaN;
      },
      end() {
        snapReels(MASTER_END);
        lastVh = NaN;
        // every ch4 layer at autoAlpha 0 (the master leaves it there too)
        gsap.set(root, { autoAlpha: 0 });
      },
    },
    ".cx-ch4-stage",
  );

  ctx.onDestroy(() => {
    for (const r of reels) {
      r.strip.style.willChange = "";
      r.strip.style.filter = "";
    }
  });

  if (ctx.flags.DEV_ASSERT) {
    if (CH4_T.stageOff > MARKS.layersOff) {
      console.warn("[cinema/ch4] stage turns off after MARKS.layersOff — every ch4 layer must be at 0 by 1880");
    }
    // §7 G1: the stage root steps only while every child is at 0
    const firstIn = Math.min(CH4_T.panelIn.from, CH4_T.label.from, CH4_T.closeIn.from);
    const lastOut = Math.max(CH4_T.closePlateOut.to, CH4_T.panelPlateOut.to, CH4_T.leadOut.to, CH4_T.subOut.to, CH4_T.labelOut.to);
    if (firstIn < CH4_T.stageOn + P(1) || lastOut > CH4_T.stageOff) {
      console.warn("[cinema/ch4] the stage root steps while content is visible", { firstIn, lastOut });
    }
    // §11 item 11: the two plates are never semi-transparent at the same time
    if (CH4_T.closePlateOut.to > CH4_T.panelPlateOut.from || CH4_T.closeIn.from < CH4_T.panelIn.to) {
      console.warn("[cinema/ch4] the panel and the close cross-fade (§11 item 11)");
    }
  }
}
