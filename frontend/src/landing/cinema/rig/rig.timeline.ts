/* ============================================================
   cinema/rig/rig.timeline.ts — WP6 entry build (RIG). Spec rev 3.1
   §3 J2–J6 / C3a / C4, §1.4 items 3 and 7, §7 D1, §2.1 SHARED_WINDOWS.

   ONE per-frame writer (FrameOrder.Anchors = 20, right after
   field.update, so the reticle never lags the 3D by a frame) owns every
   animated DOM property of `.cx-rig`. Everything it writes is a pure
   function of master vh + the GL anchor + three proxy objects:
     - `fx`     act values (lock / ringLock), tweened by the two paused
                act timelines the runner plays and reverses;
     - `draws`  the G3 corner draw-in (time-based, on reveal);
     - rects    measured at refresh (registry, never per frame).
   So scrolling back replays every state exactly; only the acts are
   time-based, and they reverse with hysteresis.

   Reticle box (base; act, pulse and closure swell scale it about its centre):
     <240        frame       viewport inset 26 (mobile 18)
     240–340     search      frame (→ a centred square over 240–280) → disc bbox ⊕ 14
                             (min 44), cx-ink-dry (radar r1; was sine.inOut);
                             336–352 rides GL ring0's live projection
     340–440     silhouette  disc bbox ⊕ 14, clamped to the 16 px inset
                             (sealed onto the inset over 410–440)
     440–800     frame       16 px inset (inside the company)
     800–850     card build  geometry.cardBuildBox (shared with DOSSIER)
     850–1605    card ride   the dossier paper − 8 (cardGrow 1202–1236, cx-flow)
     1605–1642   collapse    paper ⊕ (−8 → 14), then the disc bbox ⊕ 14
     1642–1848   disc ring   disc bbox ⊕ 14, tracking the anchor
     1848–1878   release     ring → frame (cx-flow), fading 1856–1878
   Reticle SHAPE (arm, corner radius rr — v3, §7 D1):
     <240        L corners, rr 4
     240–292     the corners BEND (cx-ink-dry, radar r1; was 240–336 cx-flow):
                 rr → arm, arm → side/2, so the
                 four quarter arcs close into ONE circle of radius disc r +
                 14 as the hunt locks; a cx-meniscus swell (≤ 2.4 %) over
                 318–340 settles exactly at 340, where GL ring0 hands over
                 (field.ringScreen(0), ≤ 1 px)
     340–368     circle (the lock act squeezes it .92 → 1 at 345)
     368–440     the circle OPENS back into corners on the silhouette
                 box (cx-flow): rr → 4, arm → v2's arm
     440–800     v2 geometry and timing, round caps / joins, rr 4 (§1.4)
     800–822     rr 4 → 10 (card mode: concentric with the 18 px card,
                 the corners 8 px inside the paper)
     1605–1640   the corners stay concentric with the collapsing paper
                 (its radius leads, cx-pour) and close into the circle
     1640–1848   circle (ringLock @1645, pulse 1768–1780)
     1848–1878   the circle opens (rr → 4) as the reticle releases
   Acts: `lock` @345 (squeeze .92 → back.out(1.6) 1, gold arc flash,
   field.time.lockPulse 1 → 0 over 260 ms for the GL meniscus ring, the
   tag's capsule opens behind a gold droplet and its glyphs pour, 300
   ms), `ringLock` @1645 (1.12 → back.out(1.6) 1, gold flash).

   Tag: paper text on an ink capsule (TAG_PLATE), pinned 18 px above the
   TL vertex, parks at top centre over 400–470 (unchanged arc), splits
   into `dos.slot.eyebrow` / `dos.slot.cnpj` over 830–858 while its
   capsule drains and its ink soaks into the letters (830–840), and
   hands over to DOSSIER at 860 in the same frame. Each half is laid out
   at its SLOT's native type (synced from `[data-cx-slot]`) and shown
   scaled inside the tag, so at the swap it is at scale(1): the dossier's
   own text (pixel-identical).
   Leader (C4c): close top-centre → reticle bottom-centre, drawn
   1762–1774 (cx-flow), retracted 1848–1858 (cx-evap) — it stays with
   the close until its break. On-dark: each corner cross-fades ink ↔
   paper (220 ms cx-flow) when field.isDarkAt says its own corner is
   over dark.

   Outputs: `rig.box` (live getter, the displayed reticle box) and the
   settle hook (start: undrawn + hidden; end: hidden).
   ============================================================ */

import gsap from "gsap";
import { FrameOrder, LIVE_KEYS, RECT_KEYS, type AnchorScreen, type CinemaCtx, type Rect } from "../types";
import { ACTS_AT, PACE, SHARED_WINDOWS } from "../beats";
import {
  CARD_BUILD,
  BRACKET_MIN_SIDE,
  BRACKET_PAD,
  cardBuildBox,
  circleRect,
  clamp,
  clampToViewport,
  inflateRect,
  lerp,
  lerpRect,
  padRect,
  power2Out,
  progress,
  sineInOut,
  smooth01,
  viewH,
  viewW,
  viewportInset,
} from "../geometry";
import { FLAGS } from "../flags";
import { IS_DEV } from "../env";
import { claim } from "../dev/assert";
import { GCell, eases, inkAt, newState, seededRot } from "../ch1/ink";

const P = (v: number): number => v * PACE;
type Win = readonly [number, number];
const sw = (w: { readonly from: number; readonly to: number }): Win => [w.from, w.to];

/** Every RIG window, master vh (beats.ts owns the beats; shared ones come from SHARED_WINDOWS). */
export const RIG_WINDOWS = {
  /** J2: the reticle leaves the frame and contracts onto the target. */
  search: [P(240), P(340)] as Win,
  /** J2 (radar r1): the frame rounds up into a square before it contracts (the circle's room). */
  square: [P(240), P(280)] as Win,
  /** J2: the corners bend into one circle (radar r1: cx-ink-dry, closed by 292 — a capsule, then a
   *  circle, as the reticle shrinks; was 240–336 cx-flow, a big rounded rectangle until ~305). */
  bend: [P(240), P(292)] as Win,
  /** J2 → R1 (radar r1): the DOM circle rides GL ring0's live projection (time layer included),
   *  so the hand-off holds in motion, not only in still frames; in over 336–340, out over 348–352. */
  handoff: [P(336), P(352)] as Win,
  /** J2: the closure's meniscus swell, exactly 1 again at the 340 hand-off. */
  swell: [P(318), P(340)] as Win,
  /** J3: pushed out by the silhouette; sealed onto the 16 px inset. */
  silhouette: [P(340), P(440)] as Win,
  silhouetteSeal: [P(410), P(440)] as Win,
  /** J3: the circle opens back into corners. */
  open: [P(368), P(440)] as Win,
  /** J6: the reticle draws the card (geometry.CARD_BUILD). */
  cardBuild: [P(CARD_BUILD.from), P(CARD_BUILD.to)] as Win,
  /** J6: card-mode corner radius 4 → 10. */
  cardRr: [P(800), P(822)] as Win,
  /** C3a: the card grows (shared with DOSSIER, cx-flow). */
  cardGrow: sw(SHARED_WINDOWS.cardGrow),
  /** C4a: hand-over from the computed ride box to `dos.liveBox`. */
  rideLive: [P(1568), P(1578)] as Win,
  /** C4a: the card collapses into the disc (padding −8 → 14). */
  collapse: [P(1605), P(1640)] as Win,
  /** C4a: hand-over from the collapse box to the live disc bbox. */
  ring: [P(1632), P(1642)] as Win,
  /** C4c: disc pulse 1 → 1.25 → 1. */
  pulse: sw(SHARED_WINDOWS.pulse),
  /** C4d: the reticle opens back to the frame and fades (after the Ch4 close). */
  release: sw(SHARED_WINDOWS.release),
  releaseFade: sw(SHARED_WINDOWS.releaseFade),
  /** J3: tag moves from the TL corner to top centre. */
  tagPark: [P(400), P(480)] as Win,
  /** QA J3-TAG-UTURN: ONE monotone arc from the pose the tag had when it
   *  left the corner (cached at 400); the first 6 vh blend from the live
   *  pose (continuous both ways); the arc ends at 470. */
  tagLeave: [P(400), P(406)] as Win,
  tagArc: [P(400), P(470)] as Win,
  /** J6 split: the capsule drains and the letters take its ink, in the same
   *  short window and on the same curve (the cross-over is a ~0.1 s blink). */
  tagPlateOut: [P(830), P(834)] as Win,
  tagInk: [P(830), P(834)] as Win,
  tagRedact: [P(834), P(846)] as Win,
  /** J6 split, three overlapping legs: the separator fades; half B
   *  line-breaks under half A (drop, then carriage return); the stacked
   *  pair flies into the dossier header and lands 2 vh before the swap. */
  tagSep: [P(830), P(836)] as Win,
  tagDrop: [P(830), P(840)] as Win,
  tagReturn: [P(834), P(844)] as Win,
  tagFly: [P(840), P(858)] as Win,
  /** J6: RIG tag → 0 and DOSSIER slot text → 1 in the same frame. */
  tagSwap: P(860),
  /** C4c / C4d leader hairline (it stays until the Ch4 close's break). */
  leaderDraw: sw(SHARED_WINDOWS.leaderDraw),
  leaderRetract: sw(SHARED_WINDOWS.leaderRetract),
} as const;
const W = RIG_WINDOWS;

/* ── geometry constants (px) ──────────────────────────────────── */
/** bbox(anchor) ⊕ 14 px, at least a 44 px square (§5 J2). */
const PAD = BRACKET_PAD;
const MIN_SIDE = BRACKET_MIN_SIDE;
/** J3 clamp and the interior frame (also cardBuildBox's start). */
const INNER_INSET = 16;
/** Frame mode: viewport corners (G3, J1, release target). */
const FRAME_INSET = { desktop: 26, mobile: 18 } as const;
/** Arm length = min(box side) × ratio, between ARM_MIN and --rig-arm. */
const ARM_RATIO = 0.28;
const ARM_MIN = 8;
/** Corner radius: frame / interior (§1.4 item 7 cap, --lq-reticle-rr) and card mode (--lq-reticle-card). */
const RR_FRAME = 4;
const RR_CARD = 10;
/** The dossier card's radius (--lq-card): the collapse corners stay concentric with it. */
const CARD_R = 18;
/** Frame-mode corners read as instrument chrome; they reach full ink as they lock. */
const FRAME_ALPHA = 0.55;
/** Tag: top edge 18 px above the TL vertex; park y; keep-in-viewport margin. */
const TAG_GAP = 18;
const TAG_PARK_Y = { desktop: 64, mobile: 56 } as const;
const TAG_EDGE = 12;
/** Tag max width (mobile fallback breaks before "CNPJ", §9.2). */
const TAG_SIDE_GUTTER = 16;
/** The ink capsule's padding around the tag box (rig.css .cx-rig__plate). */
const PLATE_PAD = { desktop: { x: 10, y: 4 }, mobile: { x: 8, y: 3 } } as const;
/** Disc pulse amplitude (1 → 1.25 → 1) and the closure swell gain. */
const PULSE = 0.25;
const SWELL = 0.6;
/** `.cx-rig__leader` CSS width; the length is a scaleX of it. */
const LEADER_BASE = 256;
/** Gold droplet radius (5 px, CSS). */
const NIB_R = 2.5;
/** Lock pour, in units of the act's tag progress (0..1 over 300 ms). */
const POUR = { open: 0.55, from: 0.12, glyph: 0.5 } as const;

/** DOSSIER's header slot text nodes (typography source for the swap). */
const SLOT_SEL = {
  a: '.cx-dos-stage [data-cx-slot="eyebrow"]',
  b: '.cx-dos-stage [data-cx-slot="cnpj"]',
} as const;
const TYPO_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textTransform",
  "fontVariantNumeric",
  "fontFeatureSettings",
  "letterSpacing",
  "lineHeight",
] as const;

/* ── small pure helpers ───────────────────────────────────────── */

const DPR_GRID = (): number => Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
/** Device-pixel rounding, never finer than 0.5 CSS px (no shimmer at rest). */
const snap = (v: number, g: number): number => Math.round(v * g) / g;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

const scaleAbout = (r: Rect, s: number): Rect => {
  if (s === 1) return r;
  const w = r.w * s;
  const h = r.h * s;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
};

type RGBA = readonly [number, number, number, number];
function parseColor(v: string): RGBA | null {
  const s = v.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) {
    const h = m[1];
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1];
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    const h = m[1];
    const a = m[2] ? parseInt(m[2], 16) / 255 : 1;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : Number(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  return null;
}
const sameColor = (a: RGBA, b: RGBA): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
const mixColor = (a: RGBA, b: RGBA, t: number): string => {
  const c = (i: number) => Math.round(lerp(a[i], b[i], t));
  const al = r3(lerp(a[3], b[3], t));
  return al >= 1 ? `rgb(${c(0)}, ${c(1)}, ${c(2)})` : `rgba(${c(0)}, ${c(1)}, ${c(2)}, ${al})`;
};

/** Cached style writer: touches the DOM only when the value changes. */
class Prop {
  private last: string | null = null;
  constructor(
    private readonly el: HTMLElement | SVGElement,
    private readonly name: string,
  ) {}
  set(v: string): void {
    if (v === this.last) return;
    this.last = v;
    this.el.style.setProperty(this.name, v);
  }
  reset(): void {
    this.last = null;
  }
}
class Flag {
  private last: boolean | null = null;
  constructor(
    private readonly el: HTMLElement,
    private readonly cls: string,
  ) {}
  set(on: boolean): void {
    if (on === this.last) return;
    this.last = on;
    this.el.classList.toggle(this.cls, on);
  }
  reset(): void {
    this.last = null;
  }
}
/** The corner path's `d`, written to its three strokes only when ρ = rr/arm changes. */
class CornerPath {
  private last = Number.NaN;
  constructor(private readonly paths: SVGPathElement[]) {}
  set(rho: number): void {
    const q = Math.round(clamp(rho, 0, 1) * 1024) / 1024;
    if (q === this.last) return;
    this.last = q;
    const r = String(q);
    const d = `M0,1 L0,${r} A${r},${r} 0 0 1 ${r},0 L1,0`;
    for (const p of this.paths) p.setAttribute("d", d);
  }
  reset(): void {
    this.last = Number.NaN;
  }
}

interface HalfMeasure {
  /** Displayed top-left inside the tag box (tag-local px). */
  ox: number;
  oy: number;
  /** Displayed scale inside the tag (tag font-size ÷ the half's own). */
  k: number;
  /** Scale at the slot: 1 when synced (native slot type), else an estimate. */
  end: number;
  /** Slot text colour (split colour target), or null = keep the tag ink. */
  color: RGBA | null;
  /** the half's own font size (px), for the glyph pour */
  fs: number;
}

/* ============================================================ */

export function build(ctx: CinemaCtx): void {
  const root = document.querySelector<HTMLElement>(".cx-rig");
  const frameInset = ctx.isMobile ? FRAME_INSET.mobile : FRAME_INSET.desktop;
  const parkY = ctx.isMobile ? TAG_PARK_Y.mobile : TAG_PARK_Y.desktop;
  const platePad = ctx.isMobile ? PLATE_PAD.mobile : PLATE_PAD.desktop;
  const plateOn = FLAGS.TAG_PLATE;

  if (!root) {
    // markup missing (should not happen): keep the contract alive
    ctx.live.provide<() => Rect>(LIVE_KEYS.rigBox, () => viewportInset(frameInset));
    ctx.settle.register("rig", { start() {}, end() {} }, ".cx-rig");
    return;
  }
  const E = eases();
  root.classList.toggle("no-plate", !plateOn);

  /* ── nodes ─────────────────────────────────────────────────── */
  const q = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
  const brackets = (["tl", "tr", "br", "bl"] as const).map((c) => q<HTMLElement>(`.cx-rig__bracket--${c}`));
  const groups = brackets.map((b) => b.querySelector<SVGGElement>(".cx-rig__g")!);
  const paths = brackets.map((b) => Array.from(b.querySelectorAll<SVGPathElement>(".cx-rig__p")));
  const tag = q<HTMLElement>(".cx-rig__tag");
  const plate = q<HTMLElement>(".cx-rig__plate");
  const halfA = q<HTMLElement>(".cx-rig__half--a");
  const halfB = q<HTMLElement>(".cx-rig__half--b");
  const txtA = halfA.querySelector<HTMLElement>(".cx-rig__txt")!;
  const txtB = halfB.querySelector<HTMLElement>(".cx-rig__txt")!;
  const glA = halfA.querySelector<HTMLElement>(".cx-rig__gl")!;
  const glB = halfB.querySelector<HTMLElement>(".cx-rig__gl")!;
  const plainB = halfB.querySelector<HTMLElement>(".cx-rig__plain")!;
  const sep = q<HTMLElement>(".cx-rig__sep");
  const nib = q<HTMLElement>(".cx-rig__nib");
  const leader = q<HTMLElement>(".cx-rig__leader");

  if (FLAGS.DEV_ASSERT) {
    claim("RIG", [root, ...brackets, tag, halfA, halfB, sep, nib, leader, plate, txtA, txtB, plainB, glA, glB], [
      "transform",
      "opacity",
      "visibility",
      "clipPath",
      "color",
    ]);
    claim("RIG", groups as unknown as Element[], ["transform"]);
    claim("RIG", paths.flat() as unknown as Element[], ["d"]);
  }

  /* ── cached writers ────────────────────────────────────────── */
  const rootOpacity = new Prop(root, "opacity");
  const rootVis = new Prop(root, "visibility");
  let lastFlash = -1;
  let lastRedact = -1;
  const bT = brackets.map((b) => new Prop(b, "transform"));
  const bO = brackets.map((b) => new Prop(b, "opacity"));
  const bDark = brackets.map((b) => new Flag(b, "is-on-dark"));
  const gT = groups.map((g) => new Prop(g, "transform"));
  const corner = paths.map((p) => new CornerPath(p));
  const tagT = new Prop(tag, "transform");
  const tagO = new Prop(tag, "opacity");
  const tagV = new Prop(tag, "visibility");
  const tagDark = new Flag(tag, "is-on-dark");
  const plateClip = new Prop(plate, "clip-path");
  const plateO = new Prop(plate, "opacity");
  const txtV = [new Prop(txtA, "visibility"), new Prop(txtB, "visibility")];
  const glV = [new Prop(glA, "visibility"), new Prop(glB, "visibility")];
  const plainV = new Prop(plainB, "visibility");
  const aT = new Prop(halfA, "transform");
  const bTf = new Prop(halfB, "transform");
  const aC = new Prop(halfA, "color");
  const bC = new Prop(halfB, "color");
  const sepT = new Prop(sep, "transform");
  const sepO = new Prop(sep, "opacity");
  const nibT = new Prop(nib, "transform");
  const nibO = new Prop(nib, "opacity");
  const ldT = new Prop(leader, "transform");
  const ldO = new Prop(leader, "opacity");
  const all: Array<{ reset(): void }> = [
    rootOpacity, rootVis, ...bT, ...bO, ...bDark, ...gT, ...corner, tagT, tagO, tagV, tagDark, plateClip, plateO,
    ...txtV, ...glV, plainV, aT, bTf, aC, bC, sepT, sepO, nibT, nibO, ldT, ldO,
  ];
  /** glyph cells of the lock pour (rebuilt at refresh) */
  let pourCells: GCell[] = [];
  let pourEm: number[] = [];
  let pourRho: number[] = [];
  const invalidate = (): void => {
    for (const w of all) w.reset();
    for (const c of pourCells) c.reset();
    lastFlash = -1;
    lastRedact = -1;
  };

  /* ── proxies: acts + reveal (the only time-based inputs) ───── */
  const fx = { lockS: 1, ringS: 1, lockFlash: 0, ringFlash: 0, tag: 0 };
  const draws = [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }];
  let drawTw: gsap.core.Tween | null = null;
  let revealed = false;

  // Act `lock` @345: the reticle clamps (a 60 ms squeeze to .92, then .92 →
  // 1 back.out(1.6) 220 ms), the arcs flash gold over 300 ms (the gold
  // cools back to ink on cx-ink-dry), the GL meniscus ring flashes
  // (field.time.lockPulse: up in 30 ms, back over 260 ms on cx-meniscus —
  // an instrument closure; clamped at 0, so the 4 % meniscus only
  // shortens the tail and the 0..1 contract holds), and the tag pours a
  // beat after the clamp (capsule + glyphs, 300 ms): lock, then name.
  const lockTl = gsap.timeline({ paused: true });
  lockTl
    .to(fx, { lockS: 0.92, duration: 0.06, ease: "rk-settle" }, 0)
    .to(fx, { lockS: 1, duration: 0.22, ease: "back.out(1.6)" }, 0.06)
    .to(fx, { lockFlash: 1, duration: 0.08, ease: "rk-settle" }, 0)
    .to(fx, { lockFlash: 0, duration: 0.22, ease: "cx-ink-dry" }, 0.08)
    .to(ctx.field.time, { lockPulse: 1, duration: 0.03, ease: "cx-flow" }, 0)
    .to(
      ctx.field.time,
      { lockPulse: 0, duration: 0.26, ease: "cx-meniscus", modifiers: { lockPulse: (v: number) => Math.max(0, v) } },
      0.03,
    )
    .to(fx, { tag: 1, duration: 0.3, ease: "cx-flow" }, 0.06);
  ctx.acts.register({ id: "lock", at: ACTS_AT.lock, tl: lockTl });

  // Act `ringLock` @1645: the circle closes onto the lit disc from outside
  // (1 → 1.12 in 60 ms, 1.12 → 1 back.out(1.6) 220 ms) + flash.
  const ringTl = gsap.timeline({ paused: true });
  ringTl
    .to(fx, { ringS: 1.12, duration: 0.06, ease: "rk-settle" }, 0)
    .to(fx, { ringS: 1, duration: 0.22, ease: "back.out(1.6)" }, 0.06)
    .to(fx, { ringFlash: 1, duration: 0.08, ease: "rk-settle" }, 0)
    .to(fx, { ringFlash: 0, duration: 0.22, ease: "cx-ink-dry" }, 0.08);
  ctx.acts.register({ id: "ringLock", at: ACTS_AT.ringLock, tl: ringTl });

  /* ── refresh-time measurement (never per frame) ────────────── */
  const meas = {
    armMax: ctx.isMobile ? 20 : 30,
    stroke: 1.5,
    tagW: 0,
    tagH: 14,
    tagFs: ctx.isMobile ? 9.5 : 10.5,
    tagInk: [251, 249, 244, 1] as RGBA,
    sepX: 0,
    sepY: 0,
    sepShown: true,
    synced: false,
    slotCapsules: false,
    a: { ox: 0, oy: 0, k: 1, end: 1, color: null, fs: 10.5 } as HalfMeasure,
    b: { ox: 0, oy: 0, k: 1, end: 1, color: null, fs: 10.5 } as HalfMeasure,
  };

  /** Lay a tag half out in its slot's own type (scale-invariant units),
   *  so at the swap it is the dossier's text at scale(1). Needs
   *  `data-cx-slot="eyebrow|cnpj"` on DOSSIER's slot text nodes;
   *  without it the half keeps the tag's type and scales by height. */
  const syncTypography = (half: HTMLElement, sel: string): { fs: number; color: RGBA | null } | null => {
    for (const p of TYPO_PROPS) half.style[p] = "";
    const slot = document.querySelector<HTMLElement>(sel);
    if (!slot) return null;
    const cs = getComputedStyle(slot);
    const fs = parseFloat(cs.fontSize);
    if (!(fs > 0)) return null;
    const st = half.style;
    st.fontFamily = cs.fontFamily;
    st.fontSize = cs.fontSize;
    st.fontWeight = cs.fontWeight;
    st.fontStyle = cs.fontStyle;
    st.textTransform = cs.textTransform;
    st.fontVariantNumeric = cs.fontVariantNumeric;
    st.fontFeatureSettings = cs.fontFeatureSettings;
    st.letterSpacing = cs.letterSpacing;
    st.lineHeight = cs.lineHeight;
    return { fs, color: parseColor(cs.color) };
  };

  /** The glyph layer of a half: one absolute cell per character at its
   *  measured (kerned) x; "███" runs as one capsule cell; spaces skipped. */
  const buildGlyphLayer = (txt: HTMLElement, gl: HTMLElement, fs: number, out: GCell[], em: number[]): void => {
    gl.textContent = "";
    const base = txt.getBoundingClientRect();
    const range = document.createRange();
    const walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const node = n as Text;
      const s = node.data;
      const red = !!(node.parentElement && node.parentElement.classList.contains("cx-redact"));
      if (red) {
        range.setStart(node, 0);
        range.setEnd(node, s.length);
        const r = range.getBoundingClientRect();
        const el = document.createElement("i");
        el.className = "cx-rig__ch cx-redact";
        el.textContent = s;
        el.style.left = `${r3(r.left - base.left)}px`;
        gl.append(el);
        out.push(new GCell(el));
        em.push(fs);
        continue;
      }
      for (let i = 0; i < s.length; i++) {
        const ch = s.charAt(i);
        if (ch === " ") continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        const el = document.createElement("span");
        el.className = "cx-rig__ch";
        el.textContent = ch;
        el.style.left = `${r3(r.left - base.left)}px`;
        gl.append(el);
        out.push(new GCell(el));
        em.push(fs);
      }
    }
    range.detach?.();
  };

  const measureTag = (): Rect => {
    const rcs = getComputedStyle(root);
    const arm = parseFloat(rcs.getPropertyValue("--rig-arm"));
    if (arm > 0) meas.armMax = arm;
    const stroke = parseFloat(rcs.getPropertyValue("--rig-stroke"));
    if (stroke > 0) meas.stroke = stroke;
    // the var, not the computed colour (a bare v2 tag may be mid on-dark flip)
    meas.tagInk = parseColor(rcs.getPropertyValue("--rig-tag-ink")) ?? meas.tagInk;
    meas.tagFs = parseFloat(getComputedStyle(tag).fontSize) || meas.tagFs;

    const syncA = syncTypography(halfA, SLOT_SEL.a);
    const syncB = syncTypography(halfB, SLOT_SEL.b);
    meas.synced = !!(syncA && syncB);
    // the split lands on whatever the dossier slot shows: capsules or glyphs
    meas.slotCapsules = !!document.querySelector(`${SLOT_SEL.b} .cx-redact`);

    // natural (untransformed) boxes; the halves and the separator are
    // absolutely positioned at the tag origin, composed by transform
    halfA.style.transform = "none";
    halfB.style.transform = "none";
    sep.style.transform = "none";
    const ra = halfA.getBoundingClientRect();
    const rb = halfB.getBoundingClientRect();
    const rs = sep.getBoundingClientRect();
    const a = meas.a;
    const b = meas.b;
    a.fs = syncA ? syncA.fs : meas.tagFs;
    b.fs = syncB ? syncB.fs : meas.tagFs;
    a.k = syncA ? meas.tagFs / syncA.fs : 1;
    b.k = syncB ? meas.tagFs / syncB.fs : 1;
    const aw = ra.width * a.k;
    const ah = ra.height * a.k;
    const bw = rb.width * b.k;
    const bh = rb.height * b.k;
    const lineH = Math.max(ah, bh, rs.height);
    const oneLine = aw + rs.width + bw + 2 * platePad.x <= viewW() - 2 * TAG_SIDE_GUTTER;
    a.ox = 0;
    a.oy = (lineH - ah) / 2;
    meas.sepShown = oneLine;
    meas.sepX = aw;
    meas.sepY = (lineH - rs.height) / 2;
    if (oneLine) {
      b.ox = aw + rs.width;
      b.oy = (lineH - bh) / 2;
      meas.tagW = b.ox + bw;
      meas.tagH = lineH;
    } else {
      // mobile fallback: break before "CNPJ"
      b.ox = 0;
      b.oy = lineH + (lineH - bh) / 2;
      meas.tagW = Math.max(aw, bw);
      meas.tagH = 2 * lineH;
    }
    const slotA = ctx.rects.get(RECT_KEYS.dosSlotEyebrow);
    const slotB = ctx.rects.get(RECT_KEYS.dosSlotCnpj);
    a.end = syncA ? 1 : clamp(slotA.h > 0 && ra.height > 0 ? slotA.h / ra.height : 1, 0.5, 4);
    b.end = syncB ? 1 : clamp(slotB.h > 0 && rb.height > 0 ? slotB.h / rb.height : 1, 0.5, 4);
    a.color = syncA?.color ?? null;
    b.color = syncB?.color ?? null;
    tag.style.width = `${r3(meas.tagW)}px`;
    tag.style.height = `${r3(meas.tagH)}px`;

    // the lock pour's glyph layers, at the halves' own (synced) type
    const cells: GCell[] = [];
    const em: number[] = [];
    buildGlyphLayer(txtA, glA, a.fs, cells, em);
    buildGlyphLayer(txtB, glB, b.fs, cells, em);
    pourCells = cells;
    pourEm = em;
    pourRho = cells.map((_, i) => seededRot(i + 11));
    invalidate();
    return { x: 0, y: 0, w: meas.tagW, h: meas.tagH };
  };
  // private key; measured with the shared ones (after document.fonts.ready
  // and on every refreshInit), after DOSSIER's slot rects (build order)
  ctx.rects.register("rig.tag", measureTag);

  /* ── box: one pure function of vh (+ anchor, rects, acts) ──── */
  let lastAnchor: AnchorScreen | null = null;
  const anchor = (): AnchorScreen => {
    const a = ctx.field.getAnchorScreen();
    if (a.visible && a.r > 0 && Number.isFinite(a.x) && Number.isFinite(a.y)) lastAnchor = a;
    return lastAnchor ?? a;
  };
  /** bbox(disc) ⊕ 14, plus half a stroke: the corner strokes sit half a
   *  stroke inside the box (v2's arms covered [vertex, vertex + stroke]),
   *  so the closed circle's centre line is exactly disc r + 14, the radius
   *  of GL ring0 at the 340 hand-off (field.ringScreen(0), §4.7). */
  const discBox = (a: AnchorScreen): Rect => padRect(circleRect(a.x, a.y, a.r), PAD + meas.stroke / 2, MIN_SIDE);

  /** GL ring0 as a reticle box: the closed circle's centre line is exactly ringScreen(0).r. */
  const ringBox = (): Rect | null => {
    const gl = ctx.field.ringScreen(0);
    if (!gl.visible || !(gl.r > 0) || !Number.isFinite(gl.x) || !Number.isFinite(gl.y)) return null;
    const S = 2 * gl.r + meas.stroke;
    return { x: gl.x - S / 2, y: gl.y - S / 2, w: S, h: S };
  };
  /** Over W.handoff the box rides GL ring0 (eased in over 4 vh, out over the last 4). */
  const handoff = (vh: number, a: AnchorScreen, b: Rect): Rect => {
    if (vh <= W.handoff[0] || vh >= W.handoff[1] || a.inside) return b;
    const k =
      smooth01(progress(W.handoff[0], W.handoff[0] + P(4), vh)) *
      (1 - smooth01(progress(W.handoff[1] - P(4), W.handoff[1], vh)));
    if (k <= 0) return b;
    const g = ringBox();
    return g ? lerpRect(b, g, k) : b;
  };

  const liveBox = ctx.live.use<() => Rect | undefined>(LIVE_KEYS.dosLiveBox);
  /** Fallback ride (no `dos.liveBox`): the Ch2 paper grows to the Ch3 paper (cx-flow, shared window). */
  const rideBox = (vh: number): Rect => {
    const c2 = ctx.rects.get(RECT_KEYS.dosCardCh2);
    const c3 = ctx.rects.get(RECT_KEYS.dosCardCh3);
    if (!(c3.w > 0)) return c2;
    return lerpRect(c2, c3, E.flow(progress(W.cardGrow[0], W.cardGrow[1], vh)));
  };
  /** The dossier's live PAPER box (pure function of vh + anchor, evaluated now). */
  const paperBox = (vh: number): Rect => {
    const lb = liveBox();
    return lb && lb.w > 0 && lb.h > 0 ? lb : rideBox(vh);
  };

  const baseBox = (vh: number): Rect => {
    const vw = viewW();
    const vhPx = viewH();
    const frame = viewportInset(frameInset, vw, vhPx);
    if (vh < W.search[0]) return frame;
    const inner = viewportInset(INNER_INSET, vw, vhPx);
    const inside = (r: Rect) => clampToViewport(r, INNER_INSET, vw, vhPx);
    if (vh < W.search[1]) {
      const a = anchor();
      // radar r1: front-loaded (cx-ink-dry) out of a frame that first rounds up into a square, so
      // the reticle reads as a bubble contracting onto the target, never a viewfinder box
      const side = Math.min(frame.w, frame.h);
      const sq: Rect = { x: frame.x + (frame.w - side) / 2, y: frame.y + (frame.h - side) / 2, w: side, h: side };
      const src = lerpRect(frame, sq, E.flow(progress(W.square[0], W.square[1], vh)));
      return handoff(vh, a, inside(lerpRect(src, discBox(a), E.dry(progress(W.search[0], W.search[1], vh)))));
    }
    if (vh < W.silhouette[1]) {
      const a = anchor();
      // inside the sphere every screen point is the silhouette: the corners
      const sil = a.inside ? inner : handoff(vh, a, inside(discBox(a)));
      if (vh < W.silhouetteSeal[0]) return sil;
      return lerpRect(sil, inner, smooth01(progress(W.silhouetteSeal[0], W.silhouetteSeal[1], vh)));
    }
    if (vh < W.cardBuild[0]) return inner;
    if (vh < W.cardBuild[1]) return cardBuildBox(vh, ctx.rects.get(RECT_KEYS.dosCardCh2), vw, vhPx);
    // card ride + collapse: ONE source, the dossier paper. The corners sit
    // 8 px inside it (concentric with its 18 px radius) through Ch2 and Ch3,
    // then open from −8 to ⊕14 as the card collapses into the disc (C4a).
    if (vh < W.ring[1]) {
      const pad = lerp(-CARD_BUILD.endInset, PAD, smooth01(progress(W.collapse[0], W.collapse[1], vh)));
      let b = inflateRect(paperBox(vh), pad);
      if (vh >= W.ring[0]) b = lerpRect(b, discBox(anchor()), smooth01(progress(W.ring[0], W.ring[1], vh)));
      return b;
    }
    if (vh < W.release[0]) return discBox(anchor());
    if (vh < W.release[1]) return lerpRect(discBox(anchor()), frame, E.flow(progress(W.release[0], W.release[1], vh)));
    return frame;
  };

  const pulseScale = (vh: number): number => {
    if (vh <= W.pulse[0] || vh >= W.pulse[1]) return 1;
    return 1 + PULSE * Math.sin(Math.PI * progress(W.pulse[0], W.pulse[1], vh)) ** 2;
  };
  /** The closure's meniscus: ≤ 2.4 % swell, exactly 1 at 340 (the GL hand-off). */
  const swellScale = (vh: number): number => {
    if (vh <= W.swell[0] || vh >= W.swell[1]) return 1;
    return 1 + SWELL * Math.max(0, E.meniscus(progress(W.swell[0], W.swell[1], vh)) - 1);
  };

  const bracketAlpha = (vh: number): number => {
    if (vh < W.search[0]) return FRAME_ALPHA;
    if (vh < W.search[1]) return lerp(FRAME_ALPHA, 1, E.flow(progress(W.search[0], W.search[1], vh)));
    if (vh < W.releaseFade[0]) return 1;
    return 1 - E.evap(progress(W.releaseFade[0], W.releaseFade[1], vh));
  };

  /** Corner shape for the displayed box: arm length and corner radius (px). */
  const shape = (vh: number, box: Rect): { arm: number; rr: number } => {
    const s = meas.stroke;
    const minSide = Math.min(box.w, box.h);
    const half = Math.max(0, minSide / 2 - s / 2);
    const base = Math.min(half, clamp(minSide * ARM_RATIO, ARM_MIN, meas.armMax));
    const L = (arm: number, rr: number) => ({ arm, rr: Math.min(rr, arm) });
    if (vh < W.search[0]) return L(base, RR_FRAME);
    if (vh < W.silhouette[0]) {
      const k = E.dry(progress(W.bend[0], W.bend[1], vh));
      const arm = lerp(base, half, k);
      return L(arm, lerp(RR_FRAME, arm, k));
    }
    if (vh < W.open[0]) return L(half, half);
    if (vh < W.open[1]) {
      const o = E.flow(progress(W.open[0], W.open[1], vh));
      return L(lerp(half, base, o), lerp(half, RR_FRAME, o));
    }
    if (vh < W.cardBuild[0]) return L(base, RR_FRAME);
    if (vh < W.collapse[0]) return L(base, lerp(RR_FRAME, RR_CARD, E.flow(progress(W.cardRr[0], W.cardRr[1], vh))));
    if (vh < W.collapse[1]) {
      // concentric with the collapsing paper: its radius leads (cx-pour,
      // 18 → min/2, as DOSSIER's clip), the arms close into the circle
      const p = progress(W.collapse[0], W.collapse[1], vh);
      const arm = lerp(base, half, E.flow(p));
      const pad = lerp(-CARD_BUILD.endInset, PAD, smooth01(p));
      const paper = paperBox(vh);
      const rCard = lerp(CARD_R, Math.min(paper.w, paper.h) / 2, E.pour(p));
      return L(arm, Math.max(0, rCard + pad));
    }
    if (vh < W.release[0]) return L(half, half);
    if (vh < W.release[1]) {
      const o = E.flow(progress(W.release[0], W.release[1], vh));
      return L(lerp(half, base, o), lerp(half, RR_FRAME, o));
    }
    return L(base, RR_FRAME);
  };

  /** field.isDarkAt, guarded by its own definition (§7.9): once the dawn is
   *  complete and until the membrane crossing (camera still inside a
   *  cleared sphere, then the lit exterior) nothing on screen is dark. */
  const MEMBRANE = P(1605);
  const darkAt = (vh: number, x: number, y: number): boolean => {
    if (ctx.field.score.dawn >= 1 && vh < MEMBRANE) return false;
    return ctx.field.isDarkAt(x, y);
  };

  /** Displayed box (acts + pulse + closure swell about the base box centre). */
  const displayBox = (vh: number, base: Rect): Rect =>
    scaleAbout(base, fx.lockS * fx.ringS * pulseScale(vh) * swellScale(vh));

  let lastBox: Rect = viewportInset(frameInset);
  let lastBoxVh = Number.NaN;
  let lastShape = { arm: 0, rr: 0 };
  const lastArc = { x: 0, y: 0, r: 0 };

  /* ── writers ───────────────────────────────────────────────── */
  const writeRoot = (show: boolean): void => {
    rootOpacity.set(show ? "1" : "0");
    rootVis.set(show ? "visible" : "hidden");
  };

  const writeBrackets = (box: Rect, vh: number, g: number): void => {
    const sh = shape(vh, box);
    lastShape = sh;
    const alpha = r3(bracketAlpha(vh));
    const x0 = snap(box.x, g);
    const y0 = snap(box.y, g);
    const x1 = snap(box.x + box.w, g);
    const y1 = snap(box.y + box.h, g);
    const vx = [x0, x1, x1, x0];
    const vy = [y0, y0, y1, y1];
    const sx = [1, -1, -1, 1]; // inward direction per corner
    const sy = [1, 1, -1, -1];
    // the stroke's centre line sits half a stroke inside the box (v2's arms
    // covered [vertex, vertex + stroke]): crisp at DPR 1, same pixels
    const h = meas.stroke / 2;
    const rho = sh.arm > 0 ? sh.rr / sh.arm : 0;
    // the TL corner's arc (the circle itself once the corners have closed)
    lastArc.x = x0 + h + sh.rr;
    lastArc.y = y0 + h + sh.rr;
    lastArc.r = sh.rr;
    // on-dark probe ON the stroke: the corner arc's midpoint (+2 px inward) —
    // a probe inside the box would read the disc itself once the corners
    // close into the circle around it
    const probe = Math.min(sh.rr, sh.arm) * (1 - Math.SQRT1_2) + 2;
    for (let i = 0; i < 4; i++) {
      const L = r3(sh.arm * draws[i].v);
      bT[i].set(`translate(${r3(vx[i] + sx[i] * h)}px, ${r3(vy[i] + sy[i] * h)}px)`);
      bO[i].set(L > 0.01 ? String(alpha) : "0");
      gT[i].set(`scale(${r3(sx[i] * L)}, ${r3(sy[i] * L)})`);
      corner[i].set(rho);
      bDark[i].set(darkAt(vh, vx[i] + sx[i] * probe, vy[i] + sy[i] * probe));
    }
  };

  const writeActVars = (vh: number): void => {
    const f = Math.round(Math.max(fx.lockFlash, fx.ringFlash) * 100) / 100;
    if (f !== lastFlash) {
      lastFlash = f;
      root.style.setProperty("--rig-flash", String(f));
    }
    // "███": capsules while parked; in the split they become whatever the slot shows
    const target = meas.slotCapsules ? 1 : 0;
    const red = Math.round(lerp(1, target, E.flow(progress(W.tagRedact[0], W.tagRedact[1], vh))) * 100) / 100;
    if (red !== lastRedact) {
      lastRedact = red;
      root.style.setProperty("--rig-redact", String(red));
    }
  };

  /** The tag's text colour during the split: its ink soaks into the letters. */
  const splitColor = (m: HalfMeasure, e: number): string =>
    e > 0 && m.color && !sameColor(m.color, meas.tagInk) ? mixColor(meas.tagInk, m.color, e) : "";

  /** Tag-local composition (the parked tag): halves scaled to the tag size. */
  const writeComposed = (): void => {
    const a = meas.a;
    const b = meas.b;
    aT.set(`translate(${r3(a.ox)}px, ${r3(a.oy)}px) scale(${r3(a.k)})`);
    bTf.set(`translate(${r3(b.ox)}px, ${r3(b.oy)}px) scale(${r3(b.k)})`);
    aC.set("");
    bC.set("");
  };

  /** J6 830–858. A flies (translate + scale) from its place in the parked
   *  tag onto `dos.slot.eyebrow`. B rides A's scaled frame: its offset
   *  from A morphs from "inline, after the separator" to the header's own
   *  stacked offset (slotB − slotA, in A's units) — y first, then x, so it
   *  never crosses A — and scales onto `dos.slot.cnpj`. Both land on
   *  their slots exactly (scale 1 when synced) at 858 and hold. */
  const writeSplit = (vh: number, x: number, y: number): boolean => {
    const sa = ctx.rects.get(RECT_KEYS.dosSlotEyebrow);
    const sb = ctx.rects.get(RECT_KEYS.dosSlotCnpj);
    // the three legs flow (cx-flow, §3 J6)
    const ey = E.flow(progress(W.tagDrop[0], W.tagDrop[1], vh));
    if (ey <= 0 || !(sa.w > 0 && sb.w > 0)) {
      writeComposed();
      return false;
    }
    const ex = E.flow(progress(W.tagReturn[0], W.tagReturn[1], vh));
    const e2 = E.flow(progress(W.tagFly[0], W.tagFly[1], vh));
    const a = meas.a;
    const b = meas.b;
    // A: its own flight (screen px)
    const sA = lerp(a.k, a.end, e2);
    const ax = lerp(x + a.ox, sa.x, e2);
    const ay = lerp(y + a.oy, sa.y, e2);
    aT.set(`translate(${r3(ax - x)}px, ${r3(ay - y)}px) scale(${r3(sA)})`);
    // B: offset in A's own units, inline → the header's stacked layout
    const relX = lerp((b.ox - a.ox) / a.k, (sb.x - sa.x) / a.end, ex);
    const relY = lerp((b.oy - a.oy) / a.k, (sb.y - sa.y) / a.end, ey);
    const bx = ax + relX * sA;
    const by = ay + relY * sA;
    bTf.set(`translate(${r3(bx - x)}px, ${r3(by - y)}px) scale(${r3(lerp(b.k, b.end, e2))})`);
    // with the plate the letters take its ink while it drains; without it, v2 (with the flight)
    const ec = plateOn ? E.flow(progress(W.tagInk[0], W.tagInk[1], vh)) : e2;
    aC.set(splitColor(a, ec));
    bC.set(splitColor(b, ec));
    return true;
  };

  const st = newState();
  /** Lock pour (glyph INK, ltr) and the capsule opening, from the act's tag progress p.
   *  From the end of the capsule → glyph cross-fade on (the split lands on a
   *  slot that shows glyphs), half B shows its plain twin: one text node, the
   *  slot's own subpixel glyph positions (the 860 swap stays pixel-identical). */
  const writePour = (p: number, x: number, y: number, g: number, vh: number): void => {
    const pouring = p < 1;
    const plain = !pouring && !meas.slotCapsules && vh >= W.tagRedact[1];
    txtV[0].set(pouring ? "hidden" : "");
    txtV[1].set(pouring || plain ? "hidden" : "");
    plainV.set(plain ? "inherit" : "hidden");
    glV[0].set(pouring ? "inherit" : "hidden");
    glV[1].set(pouring ? "inherit" : "hidden");
    const n = pourCells.length;
    if (pouring) {
      const span = 1 - POUR.from - POUR.glyph;
      for (let j = 0; j < n; j++) {
        const qg = (p - POUR.from - (n > 1 ? (j * span) / (n - 1) : 0)) / POUR.glyph;
        inkAt(E, qg, pourEm[j], pourRho[j], ctx.isMobile, st);
        pourCells[j].write(st);
      }
      // the separator pours with the glyph halfway through the line
      const qs = (p - POUR.from - span / 2) / POUR.glyph;
      sepO.set(meas.sepShown ? String(r3(E.bloom(clamp(qs * 1.6, 0, 1)))) : "0");
    }
    // the capsule opens left → right behind a gold droplet
    const e = plateOn ? E.flow(clamp(p / POUR.open, 0, 1)) : 1;
    if (plateOn && e < 1) {
      plateClip.set(`inset(0px ${r3((1 - e) * 100)}% 0px 0px round 999px)`);
      const pw = meas.tagW + 2 * platePad.x;
      const nx = snap(x - platePad.x + e * pw - NIB_R - 1, g);
      const ny = snap(y + meas.tagH / 2 - NIB_R, g);
      nibT.set(`translate(${nx}px, ${ny}px)`);
      nibO.set(String(r3(Math.min(1, e / 0.08) * (1 - smooth01(progress(0.82, 1, e))))));
    } else {
      nibO.set("0");
    }
  };

  let tagPin0: { x: number; y: number; vw: number } | null = null;
  const writeTag = (vh: number, base: Rect, g: number): void => {
    const p = fx.tag;
    const show = p > 0.001 && vh < W.tagSwap;
    tagO.set(show ? "1" : "0");
    tagV.set(show ? "visible" : "hidden");
    if (!show) {
      nibO.set("0");
      return;
    }
    const vw = viewW();
    // pinned above the TL vertex; when the box is pushed into the corner
    // there is no room above, so the tag slides right of the corner's
    // arm instead of sitting on it (continuous in the overlap)
    const pinY = Math.max(TAG_EDGE + platePad.y, base.y - TAG_GAP);
    const overlap = pinY + meas.tagH + 3 - base.y;
    const slide = overlap > 0 ? smooth01(Math.min(1, overlap / Math.max(1, meas.tagH))) * (lastShape.arm + 10) : 0;
    const edgeX = TAG_EDGE + platePad.x;
    const pinX = clamp(base.x + platePad.x + slide, edgeX, Math.max(edgeX, vw - meas.tagW - edgeX));
    const parkX = (vw - meas.tagW) / 2;
    let x: number;
    let y: number;
    if (vh < W.tagPark[0]) {
      tagPin0 = { x: pinX, y: pinY, vw };
      x = snap(pinX, g);
      y = snap(pinY, g);
    } else {
      // no frame before 400 at this size (a jump): start from wherever it is
      if (!tagPin0 || tagPin0.vw !== vw) tagPin0 = { x: pinX, y: pinY, vw };
      const d = smooth01(progress(W.tagLeave[0], W.tagLeave[1], vh));
      const rx = lerp(pinX, tagPin0.x, d);
      const ry = lerp(pinY, tagPin0.y, d);
      const t = progress(W.tagArc[0], W.tagArc[1], vh);
      x = snap(lerp(rx, parkX, sineInOut(t)), g);
      y = snap(lerp(ry, parkY, power2Out(t)), g);
    }
    tagT.set(`translate(${x}px, ${y}px)`);

    writePour(p, x, y, g, vh);
    sepT.set(`translate(${r3(meas.sepX)}px, ${r3(meas.sepY)}px)`);
    if (p >= 1) sepO.set(meas.sepShown ? String(r3(1 - smooth01(progress(W.tagSep[0], W.tagSep[1], vh)))) : "0");
    const splitting = writeSplit(vh, x, y);
    // the split: the capsule drains toward the text's centre and fades while
    // its ink soaks into the letters (kept whole if there is no slot to land on)
    if (plateOn) {
      const po = splitting ? E.flow(progress(W.tagPlateOut[0], W.tagPlateOut[1], vh)) : 0;
      if (p >= POUR.open) plateClip.set(po > 0 ? `inset(0px ${r3(50 * po)}% 0px ${r3(50 * po)}% round 999px)` : "none");
      plateO.set(po >= 1 ? "0" : String(r3(1 - po)));
    }
    // the plate keeps the tag paper-on-ink everywhere; only v2's bare tag inverts
    tagDark.set(!plateOn && !splitting && darkAt(vh, x + meas.tagW / 2, y + meas.tagH / 2));
  };

  const writeLeader = (vh: number, box: Rect): void => {
    let d = 0;
    if (vh >= W.leaderDraw[0] && vh < W.leaderRetract[1]) {
      d = vh < W.leaderRetract[0]
        ? E.flow(progress(W.leaderDraw[0], W.leaderDraw[1], vh))
        : 1 - E.evap(progress(W.leaderRetract[0], W.leaderRetract[1], vh));
    }
    if (d <= 0.001) {
      ldO.set("0");
      return;
    }
    const c = ctx.rects.get(RECT_KEYS.ch4Close);
    let fx0: number, fy0: number, tx: number, ty: number;
    if (c.y >= box.y + box.h) {
      // close below the ring: its top-centre → the box's bottom-centre
      fx0 = c.x + c.w / 2;
      fy0 = c.y;
      tx = box.x + box.w / 2;
      ty = box.y + box.h;
    } else if (c.y + c.h <= box.y) {
      // close above the ring (defensive): bottom-centre → top-centre
      fx0 = c.x + c.w / 2;
      fy0 = c.y + c.h;
      tx = box.x + box.w / 2;
      ty = box.y;
    } else {
      ldO.set("0");
      return;
    }
    const len = Math.hypot(tx - fx0, ty - fy0);
    if (len < 1) {
      ldO.set("0");
      return;
    }
    const ang = Math.atan2(ty - fy0, tx - fx0);
    ldT.set(`translate(${r3(fx0)}px, ${r3(fy0 - 0.625)}px) rotate(${r3(ang)}rad) scaleX(${r3((len * d) / LEADER_BASE)})`);
    ldO.set("1");
  };

  /* ── the frame function (Anchors = 20) ─────────────────────── */
  ctx.frame.add(FrameOrder.Anchors, (vh) => {
    const show = revealed && vh < W.release[1];
    writeRoot(show);
    if (!show) return;
    const g = DPR_GRID();
    const base = baseBox(vh);
    const box = displayBox(vh, base);
    lastBox = box;
    lastBoxVh = vh;
    writeBrackets(box, vh, g);
    writeActVars(vh);
    writeTag(vh, base, g);
    writeLeader(vh, box);
  });

  /* ── outputs ───────────────────────────────────────────────── */
  ctx.live.provide<() => Rect>(LIVE_KEYS.rigBox, () => {
    const vh = ctx.vh();
    if (vh !== lastBoxVh) {
      lastBox = displayBox(vh, baseBox(vh));
      lastBoxVh = vh;
    }
    return lastBox;
  });

  /* ── reveal (G3) / phase ───────────────────────────────────── */
  ctx.onReveal(({ quiet }) => {
    revealed = true;
    drawTw?.kill();
    drawTw = null;
    invalidate();
    if (quiet) {
      for (const d of draws) d.v = 1;
      return;
    }
    // G3 t=0: the four corners draw out of their vertices at the viewport
    // corners, clockwise, 300 ms rk-settle, 50 ms stagger
    drawTw = gsap.fromTo(draws, { v: 0 }, { v: 1, duration: 0.3, ease: "rk-settle", stagger: 0.05, overwrite: true });
  });
  ctx.onPhase((p) => {
    if (p === "gateway") {
      revealed = false;
      drawTw?.kill();
      drawTw = null;
    }
  });

  /* ── settle ────────────────────────────────────────────────── */
  ctx.settle.register(
    "rig",
    {
      // master 0 under the Gateway: undrawn, hidden, re-drawn on reveal
      start() {
        drawTw?.kill();
        drawTw = null;
        revealed = false;
        for (const d of draws) d.v = 0;
        lastAnchor = null;
        lastBoxVh = Number.NaN;
        invalidate();
        writeRoot(false);
      },
      // master 1 (teleport): every rig layer at autoAlpha 0; drawn, so a
      // scroll back up from the plans finds the ring intact
      end() {
        drawTw?.kill();
        drawTw = null;
        for (const d of draws) d.v = 1;
        lastBoxVh = Number.NaN;
        invalidate();
        writeRoot(false);
      },
    },
    ".cx-rig",
  );

  ctx.onDestroy(() => {
    drawTw?.kill();
    drawTw = null;
  });

  // initial state: hidden until the reveal
  writeRoot(false);

  if (IS_DEV) {
    (window as unknown as Record<string, unknown>).__cxRig = {
      box: () => ({ ...lastBox }),
      shape: () => ({ ...lastShape }),
      anchor: () => ({ ...ctx.field.getAnchorScreen() }),
      vh: () => ctx.vh(),
      fx: () => ({ lockS: fx.lockS, ringS: fx.ringS, lockFlash: fx.lockFlash, ringFlash: fx.ringFlash, tag: fx.tag }),
      meas: () => JSON.parse(JSON.stringify(meas)),
      /** §11 item 24 / WP6 done-when: the DOM circle (the drawn arc's centre
       *  line) vs GL ring0 (CSS px), and vs the anchor's r + 14 (what ring0
       *  is at 340 once WP2's drain lands; WP0's stub reports the hub ring). */
      handoff: () => {
        const dom = { ...lastArc };
        const gl = ctx.field.ringScreen(0);
        const a = ctx.field.getAnchorScreen();
        const ref = { x: a.x, y: a.y, r: a.r + PAD };
        return {
          dom,
          gl,
          ref,
          dxy: Math.hypot(dom.x - gl.x, dom.y - gl.y),
          dr: Math.abs(dom.r - gl.r),
          dxyRef: Math.hypot(dom.x - ref.x, dom.y - ref.y),
          drRef: Math.abs(dom.r - ref.r),
          shape: { ...lastShape },
        };
      },
    };
  }
}
