/* ============================================================
   cinema/ch4/ch4.timeline.ts — WP-CH4 entry build: Cap. 4 "O universo"
   DOM (spec §5 C4b–C4d, §3.7, §4.5 `countSettle`).

   What it says, beat by beat (master vh; all scrubbed parts are pure
   functions of vh and reverse exactly):
     1649        stage root on (its children are still at 0)
     1652–1668   PANEL lands before the count (opacity by 1662, y 24 → 0)
     1660–1672   label "empresas de capital fechado no radar" rises
     1680–1748   ODOMETER lifts out of redaction in step with the dust
                 wave: reel k rolls █ → its digit over [1680+8k, 1716+8k],
                 most significant first. Per-frame writer (FrameOrder
                 Dossier): device-pixel-rounded translateY, motion blur
                 ≤ 1.5 px proportional to the reel's real speed (a frozen
                 frame is always sharp; never on mobile)
     1752        ACT countSettle (time-based, reversible): the last reel
                 kicks into its detent (back.out(1.15)), the gold hairline
                 draws from the centre (rk-settle) — "count locked"
     1756–1780   CLOSE lands in the lower band; lead then sub mask-rise
     R7 1782–1798  nothing moves
     1820–1850   close exits upward (y −32, scale .98, autoAlpha 0;
                 sine.in / power1.in: readable, then lifts away)
     1830–1862   panel exits upward (y −40, scale .98, autoAlpha 0)
     1862        stage root off → every ch4 layer at 0 well before 1880

   Outputs: `ch4.panel`, `ch4.close` rects (untransformed slots, for
   RIG's leader and CH1's sweep-flash exclusion); settle hooks.
   Writers (single owner each): master → root/panel/close/label/words;
   frame writer → strip transform + filter + will-change; act →
   last detent yPercent + hairline scaleX.
   ============================================================ */

import gsap from "gsap";
import { ACTS_AT, MARKS, MASTER_END, PACE } from "../beats";
import { CH4_COPY } from "../copy";
import { fromDOMRect, progress, roundDevice, sineInOut } from "../geometry";
import { maskRise } from "../MaskWords";
import { claim } from "../dev/assert";
import { FrameOrder, RECT_KEYS, type CinemaCtx, type Rect } from "../types";
import { reelTargets } from "./Reels";

const P = (v: number): number => v * PACE;

/** Every CH4 window, in master vh (spec §5 C4b–C4d). */
export const CH4_T = {
  stageOn: P(1649),
  panelIn: { from: P(1652), opaque: P(1662), to: P(1668) },
  label: { from: P(1660), to: P(1672) },
  /** reel k rolls over [from + k·step, from + k·step + len] */
  reels: { from: P(1680), step: P(8), len: P(36) },
  closeIn: { from: P(1756), opaque: P(1762), to: P(1768) },
  lead: { from: P(1757), to: P(1768) },
  sub: { from: P(1768), to: P(1780) },
  closeOut: { from: P(1820), to: P(1850) },
  panelOut: { from: P(1830), to: P(1862) },
  stageOff: P(1862),
} as const;

/** Reel window/cell height in em (CSS mirror). */
const CELL_EM = 1.14;
/** Motion blur: px at full, and the reel speed (cells/s) that reaches it. */
const BLUR_MAX = 1.5;
const BLUR_FULL_CPS = 14;
/** will-change only while the odometer segment is live (§10.5). */
const LIVE_FROM = CH4_T.reels.from - P(8);
const LIVE_TO = ACTS_AT.countSettle + P(4);

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

  /* ── master: stage root ───────────────────────────────────────── */
  tl.to(root, { autoAlpha: 1, duration: P(1) }, CH4_T.stageOn);
  tl.to(root, { autoAlpha: 0, duration: P(1) }, CH4_T.stageOff);

  /* ── master: the panel lands BEFORE the count (C4b) ───────────── */
  gsap.set(panel, { autoAlpha: 0, y: 24 });
  tl.to(panel, { autoAlpha: 1, duration: CH4_T.panelIn.opaque - CH4_T.panelIn.from }, CH4_T.panelIn.from);
  tl.to(panel, { y: 0, duration: CH4_T.panelIn.to - CH4_T.panelIn.from, ease: "sine.out" }, CH4_T.panelIn.from);
  maskRise(tl, label, CH4_T.label.from, CH4_T.label.to, { stagger: P(1) });

  /* ── master: the close (C4c) ─────────────────────────────────── */
  gsap.set(close, { autoAlpha: 0, y: 16 });
  tl.to(close, { autoAlpha: 1, duration: CH4_T.closeIn.opaque - CH4_T.closeIn.from }, CH4_T.closeIn.from);
  tl.to(close, { y: 0, duration: CH4_T.closeIn.to - CH4_T.closeIn.from, ease: "sine.out" }, CH4_T.closeIn.from);
  maskRise(tl, lead, CH4_T.lead.from, CH4_T.lead.to, { stagger: P(1) });
  // 12 words in 12 vh: a 0.6 vh stagger keeps each word's rise ≈ 5.4 vh
  maskRise(tl, sub, CH4_T.sub.from, CH4_T.sub.to, { stagger: P(0.6) });

  /* ── master: directional exits (C4d) — upward, no blur on containers.
     Both channels accelerate away (sine.in / power1.in): the container
     starts to lift while still fully readable, then leaves — a frozen
     mid-exit frame is never a muddy half-fade. ─────────────────────── */
  const out = (el: HTMLElement, w: { from: number; to: number }, y: number) => {
    const d = w.to - w.from;
    tl.to(el, { y, scale: 0.98, duration: d, ease: "sine.in" }, w.from);
    tl.to(el, { autoAlpha: 0, duration: d, ease: "power1.in" }, w.from);
  };
  out(close, CH4_T.closeOut, -32);
  out(panel, CH4_T.panelOut, -40);

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

  if (ctx.flags.DEV_ASSERT && CH4_T.stageOff > MARKS.layersOff) {
    console.warn("[cinema/ch4] stage turns off after MARKS.layersOff — every ch4 layer must be at 0 by 1880");
  }
}
