/* ============================================================
   cinema/rig/rig.timeline.ts — WP-RIG entry build (§5, §3.7, §4.5).

   ONE per-frame writer (FrameOrder.Anchors = 20, right after
   field.update, so the brackets never lag the 3D by a frame) owns
   every animated DOM property of `.cx-rig`. Everything it writes is a
   pure function of master vh + the GL anchor + three proxy objects:
     - `fx`     act values (lock / ringLock), tweened by the two paused
                act timelines the runner plays and reverses (§4.5);
     - `draws`  the G3 bracket draw-in (time-based, on reveal);
     - rects    measured at refresh (registry, never per frame).
   So scrolling back replays every state exactly; only the acts are
   time-based, and they reverse with hysteresis.

   Bracket box, one function of vh (base box; act + pulse scales are
   applied about its centre afterwards):
     <240        frame       viewport inset 26 (mobile 18)
     240–340     search      frame → disc bbox ⊕ 14 (min 44), sine.inOut
     340–440     silhouette  disc bbox ⊕ 14, clamped to the 16 px inset
                             (sealed onto the inset over 410–440)
     440–800     frame       16 px inset (inside the company)
     800–850     card build  geometry.cardBuildBox (shared with DOSSIER)
     850–1568    card ride   card@ch2 − 8 → card@ch3 over 1186–1226
     1568–1642   collapse    dos.liveBox ⊕ (0 → 14 over 1605–1640)
     1642–1800   disc ring   disc bbox ⊕ 14, tracking the anchor
     1800–1830   release     ring → frame, fading out; root off ≥ 1830
   Acts: `lock` @345 (squeeze .92 → back.out(1.6) 1, gold flash, tag
   wipe), `ringLock` @1645 (1.12 → back.out(1.6) 1, gold flash).
   Scrubbed ring pulse 1768–1780 (1 → 1.25 → 1).

   Tag (§3.7): wipes in at the lock pinned 18 px above the TL bracket,
   parks at top centre over 400–480 ("you are inside it"), splits into
   `dos.slot.eyebrow` / `dos.slot.cnpj` over 830–858 and hands over to
   DOSSIER at 860 in the same frame. Each half is laid out at its
   SLOT's native type (synced from `[data-cx-slot]`) and shown scaled
   down inside the tag, so at the swap it is at scale(1): the same
   rasterization as the dossier's own text (pixel-identical).
   Leader (C4c): close top-centre → bracket box bottom-centre, drawn
   1762–1774, retracted 1798–1808. On-dark: each bracket and the tag
   invert when field.isDarkAt says their own centre is over dark (§3.2).

   Outputs: `rig.box` (live getter, the displayed bracket box) and the
   settle hook (start: undrawn + hidden; end: hidden).
   ============================================================ */

import gsap from "gsap";
import { FrameOrder, LIVE_KEYS, RECT_KEYS, type AnchorScreen, type CinemaCtx, type Rect } from "../types";
import { ACTS_AT, PACE } from "../beats";
import {
  CARD_BUILD,
  cardBuildBox,
  circleRect,
  clamp,
  clampToViewport,
  inflateRect,
  lerp,
  lerpRect,
  padRect,
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

const P = (v: number): number => v * PACE;
type Win = readonly [number, number];

/** Every RIG window, base vh × PACE (spec §5; beats.ts owns the beats). */
export const RIG_WINDOWS = {
  /** J2: brackets leave the frame and contract onto the target. */
  search: [P(240), P(340)] as Win,
  /** J3: pushed out by the silhouette; sealed onto the 16 px inset. */
  silhouette: [P(340), P(440)] as Win,
  silhouetteSeal: [P(410), P(440)] as Win,
  /** J6: brackets draw the card (geometry.CARD_BUILD). */
  cardBuild: [P(CARD_BUILD.from), P(CARD_BUILD.to)] as Win,
  /** C3a: the card grows from its Ch2 bounds to its full Ch3 bounds. */
  cardGrow: [P(1186), P(1226)] as Win,
  /** C4a: hand-over from the computed ride box to `dos.liveBox`. */
  rideLive: [P(1568), P(1578)] as Win,
  /** C4a: the card collapses into the disc (padding 0 → 14). */
  collapse: [P(1605), P(1640)] as Win,
  /** C4a: hand-over from the collapse box to the live disc bbox. */
  ring: [P(1632), P(1642)] as Win,
  /** C4c: scrubbed ring pulse 1 → 1.25 → 1. */
  pulse: [P(1768), P(1780)] as Win,
  /** C4d: brackets expand back to the frame and fade. */
  release: [P(1800), P(1830)] as Win,
  releaseFade: [P(1808), P(1830)] as Win,
  /** J3: tag moves from the TL bracket to top centre. */
  tagPark: [P(400), P(480)] as Win,
  /** J6 split, three overlapping legs: the separator fades; half B
   *  line-breaks under half A (drop, then carriage return); the stacked
   *  pair flies into the dossier header and lands 2 vh before the swap. */
  tagSep: [P(830), P(836)] as Win,
  tagDrop: [P(830), P(840)] as Win,
  tagReturn: [P(834), P(844)] as Win,
  tagFly: [P(840), P(858)] as Win,
  /** J6: RIG tag → 0 and DOSSIER slot text → 1 in the same frame. */
  tagSwap: P(860),
  /** C4c / C4d leader hairline. */
  leaderDraw: [P(1762), P(1774)] as Win,
  leaderRetract: [P(1798), P(1808)] as Win,
} as const;
const W = RIG_WINDOWS;

/* ── geometry constants (px) ──────────────────────────────────── */
/** bbox(anchor) ⊕ 14 px, at least a 44 px square (§5 J2). */
const PAD = 14;
const MIN_SIDE = 44;
/** J3 clamp and the interior frame (also cardBuildBox's start). */
const INNER_INSET = 16;
/** Frame mode: viewport corners (G3, J1, release target). */
const FRAME_INSET = { desktop: 26, mobile: 18 } as const;
/** Arm length = min(box side) × ratio, between ARM_MIN and --rig-arm. */
const ARM_RATIO = 0.28;
const ARM_MIN = 8;
/** Frame-mode brackets read as instrument chrome; they reach full ink as they lock. */
const FRAME_ALPHA = 0.55;
/** Tag: top edge 18 px above the TL vertex; park y; keep-in-viewport margin. */
const TAG_GAP = 18;
const TAG_PARK_Y = { desktop: 64, mobile: 56 } as const;
const TAG_EDGE = 12;
/** Tag max width (mobile fallback breaks before "CNPJ", §9.2). */
const TAG_SIDE_GUTTER = 16;
/** Ring pulse amplitude (1 → 1.25 → 1). */
const PULSE = 0.25;
/** `.cx-rig__leader` CSS width; the length is a scaleX of it. */
const LEADER_BASE = 256;

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
    private readonly el: HTMLElement,
    private readonly name: "transform" | "opacity" | "visibility" | "clipPath" | "color",
  ) {}
  set(v: string): void {
    if (v === this.last) return;
    this.last = v;
    this.el.style[this.name] = v;
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
}

/* ============================================================ */

export function build(ctx: CinemaCtx): void {
  const root = document.querySelector<HTMLElement>(".cx-rig");
  const frameInset = ctx.isMobile ? FRAME_INSET.mobile : FRAME_INSET.desktop;
  const parkY = ctx.isMobile ? TAG_PARK_Y.mobile : TAG_PARK_Y.desktop;

  if (!root) {
    // markup missing (should not happen): keep the contract alive
    ctx.live.provide<() => Rect>(LIVE_KEYS.rigBox, () => viewportInset(frameInset));
    ctx.settle.register("rig", { start() {}, end() {} }, ".cx-rig");
    return;
  }

  /* ── nodes ─────────────────────────────────────────────────── */
  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const brackets = (["tl", "tr", "br", "bl"] as const).map((c) => q(`.cx-rig__bracket--${c}`));
  const armsH = brackets.map((b) => b.querySelector<HTMLElement>(".cx-rig__arm--h")!);
  const armsV = brackets.map((b) => b.querySelector<HTMLElement>(".cx-rig__arm--v")!);
  const tag = q(".cx-rig__tag");
  const halfA = q(".cx-rig__half--a");
  const halfB = q(".cx-rig__half--b");
  const sep = q(".cx-rig__sep");
  const nib = q(".cx-rig__nib");
  const leader = q(".cx-rig__leader");

  if (FLAGS.DEV_ASSERT) {
    claim("RIG", [root, ...brackets, ...armsH, ...armsV, tag, halfA, halfB, sep, nib, leader], [
      "transform",
      "opacity",
      "visibility",
      "clipPath",
      "color",
    ]);
  }

  /* ── cached writers ────────────────────────────────────────── */
  const rootOpacity = new Prop(root, "opacity");
  const rootVis = new Prop(root, "visibility");
  let lastFlash = -1;
  const bT = brackets.map((b) => new Prop(b, "transform"));
  const bO = brackets.map((b) => new Prop(b, "opacity"));
  const bDark = brackets.map((b) => new Flag(b, "is-on-dark"));
  const hT = armsH.map((a) => new Prop(a, "transform"));
  const vT = armsV.map((a) => new Prop(a, "transform"));
  const tagT = new Prop(tag, "transform");
  const tagO = new Prop(tag, "opacity");
  const tagV = new Prop(tag, "visibility");
  const tagClip = new Prop(tag, "clipPath");
  const tagDark = new Flag(tag, "is-on-dark");
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
    rootOpacity, rootVis, ...bT, ...bO, ...bDark, ...hT, ...vT, tagT, tagO, tagV, tagClip, tagDark,
    aT, bTf, aC, bC, sepT, sepO, nibT, nibO, ldT, ldO,
  ];
  const invalidate = (): void => {
    for (const w of all) w.reset();
    lastFlash = -1;
  };

  /* ── proxies: acts + reveal (the only time-based inputs) ───── */
  const fx = { lockS: 1, ringS: 1, lockFlash: 0, ringFlash: 0, tag: 0 };
  const draws = [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }];
  let drawTw: gsap.core.Tween | null = null;
  let revealed = false;

  // Act `lock` @345 (§4.5): the reticle clamps (a 60 ms squeeze to .92,
  // then .92 → 1 back.out(1.6) 220 ms), the arms flash ink → #d99f1c →
  // ink over 300 ms, and the tag wipes in (clip inset(0 100% 0 0) →
  // inset(0), 240 ms rk-settle) a beat after the clamp: lock, then name.
  const lockTl = gsap.timeline({ paused: true });
  lockTl
    .to(fx, { lockS: 0.92, duration: 0.06, ease: "rk-settle" }, 0)
    .to(fx, { lockS: 1, duration: 0.22, ease: "back.out(1.6)" }, 0.06)
    .to(fx, { lockFlash: 1, duration: 0.08, ease: "rk-settle" }, 0)
    .to(fx, { lockFlash: 0, duration: 0.22, ease: "rk-settle" }, 0.08)
    .to(fx, { tag: 1, duration: 0.24, ease: "rk-settle" }, 0.08);
  ctx.acts.register({ id: "lock", at: ACTS_AT.lock, tl: lockTl });

  // Act `ringLock` @1645: the brackets close onto the lit disc from
  // outside (1 → 1.12 in 60 ms, 1.12 → 1 back.out(1.6) 220 ms) + flash.
  const ringTl = gsap.timeline({ paused: true });
  ringTl
    .to(fx, { ringS: 1.12, duration: 0.06, ease: "rk-settle" }, 0)
    .to(fx, { ringS: 1, duration: 0.22, ease: "back.out(1.6)" }, 0.06)
    .to(fx, { ringFlash: 1, duration: 0.08, ease: "rk-settle" }, 0)
    .to(fx, { ringFlash: 0, duration: 0.22, ease: "rk-settle" }, 0.08);
  ctx.acts.register({ id: "ringLock", at: ACTS_AT.ringLock, tl: ringTl });

  /* ── refresh-time measurement (never per frame) ────────────── */
  const meas = {
    armMax: ctx.isMobile ? 20 : 30,
    tagW: 0,
    tagH: 14,
    tagFs: ctx.isMobile ? 9.5 : 10.5,
    tagInk: [60, 46, 31, 1] as RGBA,
    sepX: 0,
    sepY: 0,
    sepShown: true,
    synced: false,
    a: { ox: 0, oy: 0, k: 1, end: 1, color: null } as HalfMeasure,
    b: { ox: 0, oy: 0, k: 1, end: 1, color: null } as HalfMeasure,
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

  const measureTag = (): Rect => {
    const rcs = getComputedStyle(root);
    const arm = parseFloat(rcs.getPropertyValue("--rig-arm"));
    if (arm > 0) meas.armMax = arm;
    meas.tagInk = parseColor(rcs.getPropertyValue("--rig-tag-ink")) ?? meas.tagInk;
    meas.tagFs = parseFloat(getComputedStyle(tag).fontSize) || meas.tagFs;

    const syncA = syncTypography(halfA, SLOT_SEL.a);
    const syncB = syncTypography(halfB, SLOT_SEL.b);
    meas.synced = !!(syncA && syncB);

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
    a.k = syncA ? meas.tagFs / syncA.fs : 1;
    b.k = syncB ? meas.tagFs / syncB.fs : 1;
    const aw = ra.width * a.k;
    const ah = ra.height * a.k;
    const bw = rb.width * b.k;
    const bh = rb.height * b.k;
    const lineH = Math.max(ah, bh, rs.height);
    const oneLine = aw + rs.width + bw <= viewW() - 2 * TAG_SIDE_GUTTER;
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
    nib.style.height = `${Math.round(lineH)}px`;
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
  const discBox = (a: AnchorScreen): Rect => padRect(circleRect(a.x, a.y, a.r), PAD, MIN_SIDE);

  const liveBox = ctx.live.use<() => Rect | undefined>(LIVE_KEYS.dosLiveBox);
  /** Fallback ride (no `dos.liveBox`): the Ch2 paper grows to the Ch3 paper. */
  const rideBox = (vh: number): Rect => {
    const c2 = ctx.rects.get(RECT_KEYS.dosCardCh2);
    const c3 = ctx.rects.get(RECT_KEYS.dosCardCh3);
    if (!(c3.w > 0)) return c2;
    return lerpRect(c2, c3, sineInOut(progress(W.cardGrow[0], W.cardGrow[1], vh)));
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
      return inside(lerpRect(frame, discBox(a), sineInOut(progress(W.search[0], W.search[1], vh))));
    }
    if (vh < W.silhouette[1]) {
      const a = anchor();
      // inside the sphere every screen point is the silhouette: the corners
      const sil = a.inside ? inner : inside(discBox(a));
      if (vh < W.silhouetteSeal[0]) return sil;
      return lerpRect(sil, inner, smooth01(progress(W.silhouetteSeal[0], W.silhouetteSeal[1], vh)));
    }
    if (vh < W.cardBuild[0]) return inner;
    if (vh < W.cardBuild[1]) return cardBuildBox(vh, ctx.rects.get(RECT_KEYS.dosCardCh2), vw, vhPx);
    // card ride + collapse (integration): ONE source, the dossier paper.
    // The brackets sit 8 px inside it (the card's registration corners,
    // continuous with cardBuildBox's end at 850) through Ch2 and Ch3, then
    // open from −8 to ⊕14 as the card collapses into the disc (C4a).
    if (vh < W.ring[1]) {
      const pad = lerp(-CARD_BUILD.endInset, PAD, smooth01(progress(W.collapse[0], W.collapse[1], vh)));
      let b = inflateRect(paperBox(vh), pad);
      if (vh >= W.ring[0]) b = lerpRect(b, discBox(anchor()), smooth01(progress(W.ring[0], W.ring[1], vh)));
      return b;
    }
    if (vh < W.release[0]) return discBox(anchor());
    if (vh < W.release[1]) return lerpRect(discBox(anchor()), frame, sineInOut(progress(W.release[0], W.release[1], vh)));
    return frame;
  };

  const pulseScale = (vh: number): number => {
    if (vh <= W.pulse[0] || vh >= W.pulse[1]) return 1;
    return 1 + PULSE * Math.sin(Math.PI * progress(W.pulse[0], W.pulse[1], vh));
  };

  const bracketAlpha = (vh: number): number => {
    if (vh < W.search[0]) return FRAME_ALPHA;
    if (vh < W.search[1]) return lerp(FRAME_ALPHA, 1, sineInOut(progress(W.search[0], W.search[1], vh)));
    if (vh < W.releaseFade[0]) return 1;
    return 1 - smooth01(progress(W.releaseFade[0], W.releaseFade[1], vh));
  };

  /** field.isDarkAt, guarded by its own definition (§7.9): once the dawn is
   *  complete and until the membrane crossing (camera still inside a
   *  cleared sphere, then the lit exterior) nothing on screen is dark.
   *  (Shields the brackets from an adapter that mis-reports `inside`.) */
  const MEMBRANE = P(1605);
  const darkAt = (vh: number, x: number, y: number): boolean => {
    if (ctx.field.score.dawn >= 1 && vh < MEMBRANE) return false;
    return ctx.field.isDarkAt(x, y);
  };

  /** Displayed box (acts + pulse about the base box centre). */
  const displayBox = (vh: number, base: Rect): Rect => scaleAbout(base, fx.lockS * fx.ringS * pulseScale(vh));

  let lastBox: Rect = viewportInset(frameInset);
  let lastBoxVh = Number.NaN;

  /* ── writers ───────────────────────────────────────────────── */
  const writeRoot = (show: boolean): void => {
    rootOpacity.set(show ? "1" : "0");
    rootVis.set(show ? "visible" : "hidden");
  };

  let armLen = meas.armMax;
  const writeBrackets = (box: Rect, vh: number, g: number): void => {
    const L = clamp(Math.min(box.w, box.h) * ARM_RATIO, ARM_MIN, meas.armMax);
    armLen = L;
    const lenK = L / meas.armMax;
    const alpha = r3(bracketAlpha(vh));
    const x0 = snap(box.x, g);
    const y0 = snap(box.y, g);
    const x1 = snap(box.x + box.w, g);
    const y1 = snap(box.y + box.h, g);
    const vx = [x0, x1, x1, x0];
    const vy = [y0, y0, y1, y1];
    const sx = [1, -1, -1, 1]; // inward direction per corner
    const sy = [1, 1, -1, -1];
    const probe = L * 0.4;
    for (let i = 0; i < 4; i++) {
      bT[i].set(`translate(${vx[i]}px, ${vy[i]}px)`);
      bO[i].set(String(alpha));
      const k = r3(lenK * draws[i].v);
      hT[i].set(`scaleX(${k})`);
      vT[i].set(`scaleY(${k})`);
      bDark[i].set(darkAt(vh, vx[i] + sx[i] * probe, vy[i] + sy[i] * probe));
    }
  };

  const writeFlash = (): void => {
    const f = Math.round(Math.max(fx.lockFlash, fx.ringFlash) * 100) / 100;
    if (f === lastFlash) return;
    lastFlash = f;
    root.style.setProperty("--rig-flash", String(f));
  };

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
    const ey = sineInOut(progress(W.tagDrop[0], W.tagDrop[1], vh));
    if (ey <= 0 || !(sa.w > 0 && sb.w > 0)) {
      writeComposed();
      return false;
    }
    const ex = sineInOut(progress(W.tagReturn[0], W.tagReturn[1], vh));
    const e2 = sineInOut(progress(W.tagFly[0], W.tagFly[1], vh));
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
    aC.set(splitColor(a, e2));
    bC.set(splitColor(b, e2));
    return true;
  };

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
    // there is no room above, so the tag slides right of the bracket's
    // arm instead of sitting on it (continuous in the overlap)
    const pinY = Math.max(TAG_EDGE, base.y - TAG_GAP);
    const overlap = pinY + meas.tagH + 3 - base.y;
    const slide = overlap > 0 ? smooth01(Math.min(1, overlap / Math.max(1, meas.tagH))) * (armLen + 10) : 0;
    const pinX = clamp(base.x + slide, TAG_EDGE, Math.max(TAG_EDGE, vw - meas.tagW - TAG_EDGE));
    const parkX = (vw - meas.tagW) / 2;
    const k = sineInOut(progress(W.tagPark[0], W.tagPark[1], vh));
    const x = snap(lerp(pinX, parkX, k), g);
    const y = snap(lerp(pinY, parkY, k), g);
    tagT.set(`translate(${x}px, ${y}px)`);

    // the lock wipe, led by a gold nib; clip released once open (the
    // halves must be free to leave the tag box in the split)
    if (p < 1) {
      tagClip.set(`inset(0px ${r3((1 - p) * 100)}% 0px 0px)`);
      const nx = snap(x + p * meas.tagW - 1, g);
      nibT.set(`translate(${nx}px, ${y}px)`);
      nibO.set(String(r3(Math.min(1, p / 0.08) * (1 - smooth01(progress(0.82, 1, p))))));
    } else {
      tagClip.set("none");
      nibO.set("0");
    }

    sepT.set(`translate(${r3(meas.sepX)}px, ${r3(meas.sepY)}px)`);
    sepO.set(meas.sepShown ? String(r3(1 - smooth01(progress(W.tagSep[0], W.tagSep[1], vh)))) : "0");
    const splitting = writeSplit(vh, x, y);
    tagDark.set(!splitting && darkAt(vh, x + meas.tagW / 2, y + meas.tagH / 2));
  };

  const writeLeader = (vh: number, box: Rect): void => {
    let d = 0;
    if (vh >= W.leaderDraw[0] && vh < W.leaderRetract[1]) {
      d = vh < W.leaderRetract[0]
        ? sineInOut(progress(W.leaderDraw[0], W.leaderDraw[1], vh))
        : 1 - sineInOut(progress(W.leaderRetract[0], W.leaderRetract[1], vh));
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
    ldT.set(`translate(${r3(fx0)}px, ${r3(fy0 - 0.5)}px) rotate(${r3(ang)}rad) scaleX(${r3((len * d) / LEADER_BASE)})`);
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
    writeFlash();
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
    // G3 t=0: the four brackets draw out of their vertices at the viewport
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
      anchor: () => ({ ...ctx.field.getAnchorScreen() }),
      vh: () => ctx.vh(),
      fx: () => ({ lockS: fx.lockS, ringS: fx.ringS, lockFlash: fx.lockFlash, ringFlash: fx.ringFlash, tag: fx.tag }),
      meas: () => JSON.parse(JSON.stringify(meas)),
    };
  }
}
