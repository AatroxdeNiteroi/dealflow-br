/* ============================================================
   cinema/dossier/liquid.ts — v3 "Sonar Líquido" helpers shared by the
   dossier and Ch4 builds (WP7; spec rev 3.1 §1.2, §2.3, §5.4, §7).

   - E: the v3 eases as plain functions, resolved ONCE (never per frame).
   - liquidText(): registers a scrubbed text block on the glyph engine
     (INK pour and/or EVAPORATE exit) and gates its MaskWords ROOT with
     two master steps (autoAlpha) at the pour start and the exit end, so
     a block the writer has not evaluated yet can never show its CSS
     default (readable) state, and a block that has left is off even if
     a later full write ordered its blocks differently.
   - flowPinned(): cx-flow composed with a monotone power time-warp so a
     reel's cell crossing (its 50 % point) lands exactly on a station vh.
   - Path builders for the liquid clips: rounded rects / capsules as
     `path(evenodd, …)` (J6 card build with the tarja hole) and
     `inset(… round r)`.
   Pure (no DOM reads); every output string is quantised so the
   writers' write-on-change caches stay effective.
   ============================================================ */

import gsap from "gsap";
import { cxEase } from "../eases";
import type { CinemaCtx, Rect } from "../types";

export type Win = readonly [number, number];

/** The v3 eases as functions (resolved once at import; eases.ts registers them). */
export const E = {
  flow: cxEase("cx-flow"),
  pour: cxEase("cx-pour"),
  evap: cxEase("cx-evap"),
  settle: cxEase("cx-ink-settle"),
  dry: cxEase("cx-ink-dry"),
} as const;

/** Master-step length of a gate (vh): content is at 0 on both sides of it. */
export const GATE = 0.01;

export const f2 = (v: number): string => (Math.round(v * 100) / 100).toString();
export const f3 = (v: number): string => (Math.round(v * 1000) / 1000).toString();
/** Quantised to 0.05 px (shade radius, mask edges). */
export const q05 = (v: number): string => (Math.round(v * 20) / 20).toString();

/* ── text blocks on the glyph engine (§5.2–§5.4) ────────────────── */

export interface LiquidTextOpts {
  /** INK pour window (master vh). The root is off before its start. */
  pour?: Win;
  /** EVAPORATE window (master vh). The root is off from its end. */
  exit?: Win;
  /** Word-level blur (desktop T0/T1 only; the engine applies its own tier rule). */
  blur?: boolean;
}

/**
 * Register `root` (a MaskWords root) as one or two scrubbed glyph blocks and
 * gate the root's autoAlpha at the pour start / exit end (hard steps while
 * every glyph is at opacity 0, §7 G1). Returns the root for claims.
 *
 * Integration note (WP5): a root may carry BOTH a pour and an exit block;
 * the engine must resolve them per root (the governing block at vh is the
 * last one whose window has started, else the first one's pre-state).
 */
export function liquidText(ctx: CinemaCtx, id: string, root: Element | null | undefined, o: LiquidTextOpts): HTMLElement | null {
  if (!root) return null;
  const el = root as HTMLElement;
  const blur = o.blur ?? !ctx.isMobile;
  if (o.pour) {
    ctx.glyphs.scrub({ id, root: el, grammar: "ink", from: o.pour[0], to: o.pour[1], blur });
    gsap.set(el, { autoAlpha: 0 });
    ctx.tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: GATE, immediateRender: false }, o.pour[0]);
  }
  if (o.exit) {
    // motion r1: short glyphs (4 vh, default 8) so the rtl front travels 6–10 vh of the window:
    // the exit reads as evaporating from the far edge, not as a block fade (fewer live glyphs too)
    ctx.glyphs.scrub({ id: `${id}:out`, root: el, grammar: "evaporate", from: o.exit[0], to: o.exit[1], blur, glyphDur: 4 });
    ctx.tl.to(el, { autoAlpha: 0, duration: GATE }, o.exit[1] - GATE);
  }
  return el;
}

/* ── a plate poured as a capsule (motion r1) ─────────────────────
   A close / count plate condenses as ink: a 34 px capsule band across its
   middle (12 % in from each side, radius clamped to a pill) swells into the
   r18 plate, and drains back into that band on exit, instead of an empty
   box fading in before its text and lingering after it. The clip lives in
   CSS (`--cp-v / --cp-s / --cp-r`, dossier.css / ch4.css, motion only); its
   open state sits PLATE_PAD px outside the box with concentric corners, so
   the warm shadows are never cut at rest. Function values: re-read on the
   director's refresh replay (invalidate), never per frame. */
const BAND_H = 34;
const BAND_SIDE = 0.12;
const PLATE_PAD = 96;
const px = (v: number): string => `${q05(v)}px`;
const bandV = (el: HTMLElement) => (): string => px(Math.max(0, (el.offsetHeight - BAND_H) / 2));
const bandS = (el: HTMLElement) => (): string => px(BAND_SIDE * el.offsetWidth);
const openR = (el: HTMLElement) => (): string => px((parseFloat(getComputedStyle(el).borderTopLeftRadius) || 18) + PLATE_PAD);
const OPEN = px(-PLATE_PAD);
const pourEase = cxEase("cx-pour");

/**
 * In: the band condenses at `from` (the plate's opacity window) and holds as
 * a pill until `swell` (its first glyph), then swells into the plate by `to`
 * (cx-pour). One tween: its ease is flat until the swell, so the scrub stays
 * a pure function of vh. Measured: a band that swells from the window start
 * is ≈ 93 % open before the first glyph (cx-pour at 0.4), i.e. the empty box.
 */
export function pourPlate(tl: gsap.core.Timeline, el: HTMLElement, from: number, to: number, swell = from): void {
  const a = to > from ? Math.min(0.9, Math.max(0, (swell - from) / (to - from))) : 0;
  const ease = a > 0 ? (t: number): number => (t <= a ? 0 : pourEase((t - a) / (1 - a))) : "cx-pour";
  tl.fromTo(
    el,
    { "--cp-v": bandV(el), "--cp-s": bandS(el), "--cp-e": bandS(el), "--cp-r": "999px" },
    { "--cp-v": OPEN, "--cp-s": OPEN, "--cp-e": OPEN, "--cp-r": openR(el), duration: to - from, ease, immediateRender: false },
    from,
  );
}

/**
 * Out: the plate drains back into the band from its FAR edge, behind the
 * text's rtl evaporation front: the end side over the first 60 % of the
 * window, the start side and the height over 25–85 % (cx-flow both), so no
 * glyph that is still drying gets sliced by a symmetric squeeze.
 */
export function drainPlate(tl: gsap.core.Timeline, el: HTMLElement, from: number, to: number): void {
  const d = to - from;
  tl.fromTo(el, { "--cp-e": OPEN }, { "--cp-e": bandS(el), duration: 0.6 * d, ease: "cx-flow", immediateRender: false }, from);
  tl.fromTo(
    el,
    { "--cp-v": OPEN, "--cp-s": OPEN, "--cp-r": openR(el) },
    { "--cp-v": bandV(el), "--cp-s": bandS(el), "--cp-r": "999px", duration: 0.6 * d, ease: "cx-flow", immediateRender: false },
    from + 0.25 * d,
  );
}

/* ── station-pinned reel ease ───────────────────────────────────── */

/**
 * cx-flow with its half-way point moved to `tPin` (0 < tPin < 1): the reel
 * shows the next cell exactly from the station's vh on, so the rail, the
 * eyebrow and aria-live name the same chapter at every vh. The warp t^a is
 * monotone with zero end slopes preserved (cx-flow's are 0), no overshoot.
 */
export function flowPinned(tPin: number): (t: number) => number {
  const f = E.flow;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (f(m) < 0.5) lo = m;
    else hi = m;
  }
  const t50 = (lo + hi) / 2;
  const p = Math.min(0.98, Math.max(0.02, tPin));
  const a = Math.log(t50) / Math.log(p);
  return (t: number): number => f(Math.pow(t <= 0 ? 0 : t >= 1 ? 1 : t, a));
}

/* ── liquid clip builders (viewport px; the layers are inset 0) ─── */

/** Corner radius clamped to the box (a capsule at min(w, h) / 2). */
export const clampR = (b: Rect, r: number): number => Math.max(0, Math.min(r, b.w / 2, b.h / 2));

/** One closed rounded-rect sub-path, clockwise, arcs for the corners. */
export function rrPath(b: Rect, r: number): string {
  const rr = clampR(b, r);
  const x0 = b.x;
  const y0 = b.y;
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  if (rr < 0.05) return `M${f2(x0)} ${f2(y0)}H${f2(x1)}V${f2(y1)}H${f2(x0)}Z`;
  const R = f2(rr);
  const A = `A${R} ${R} 0 0 1 `;
  return (
    `M${f2(x0 + rr)} ${f2(y0)}H${f2(x1 - rr)}${A}${f2(x1)} ${f2(y0 + rr)}` +
    `V${f2(y1 - rr)}${A}${f2(x1 - rr)} ${f2(y1)}` +
    `H${f2(x0 + rr)}${A}${f2(x0)} ${f2(y1 - rr)}` +
    `V${f2(y0 + rr)}${A}${f2(x0 + rr)} ${f2(y0)}Z`
  );
}

/** `clip-path: path(evenodd, …)` of several sub-paths (outer + holes). */
export const evenoddPath = (...subs: string[]): string => `path(evenodd, "${subs.join(" ")}")`;

/** `inset(… round r)` of box `b` inside a `vw × vh` layer (r clamped; square below 0.05 px). */
export function insetRound(vw: number, vhPx: number, b: Rect, r: number): string {
  const rr = clampR(b, r);
  const t = b.y;
  const l = b.x;
  const rt = vw - (b.x + b.w);
  const bt = vhPx - (b.y + b.h);
  return `inset(${f2(t)}px ${f2(rt)}px ${f2(bt)}px ${f2(l)}px${rr > 0.05 ? ` round ${f2(rr)}px` : ""})`;
}

/** A length token (`--lq-card`, `--lq-panel`) read from computed style, px. */
export function tokenPx(el: Element, name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}
