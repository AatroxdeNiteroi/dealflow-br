/* ============================================================
   cinema/dossier/dossier.timeline.ts — WP-DOSSIER entry build.

   J6 (card build parts) · C2a convergence · C2b cerco · C3a metamorfose
   · C3b fusão · C3c varredura · C3d faixa + selo · C3e desfecho · C4a
   collapse into the lit disc + the pinned "R$ 24,3 mi" · C4d exits.

   v3 "Sonar Líquido" (WP7, spec rev 3.1 §2.3, §3 J6–C4d, §5.4, §7):
   - every window comes from beats.ts TEXT_V3 / SHARED_WINDOWS (T below);
   - text is poured (INK) and evaporated (EVAPORATE) glyph by glyph by the
     glyph engine (`ctx.glyphs.scrub`, FrameOrder.Glyphs); the master only
     gates each MaskWords root at its pour start / exit end (liquid.ts);
   - the closes CONDENSE IN PLACE on opaque r 18 paper panels and
     evaporate from their far edge (no drops, no horizon clip, no cuts);
   - the card paper condenses out of the tarja (a pill hugging it relaxes
     to the 18 px card, `path(evenodd)` with the capsule tarja hole until
     the 850 swap, then `inset(… round 18)`), grows on cx-flow (C3a) and
     collapses radius-first into the disc (C4a: card → pill → circle);
   - capsule tarja + capsule wipe behind a capsule scan head with a gold
     nib, the number sharpening behind the scan (`--scan-x` mask);
   - C2a chips are ink comets (capsule + gold droplet head, stretch by
     speed, squash at impact, a thinner trail capsule lagging 3 vh);
   - shade with per-axis radius (scaled shadow keeps the card's corners),
     round halo, capsule range fill, pill seal / eyebrow / pinned chip;
   - the eyebrow reel crosses each cell exactly at its STATIONS_V3 vh.

   Two writers, never on the same (element, property):
   1. the MASTER (ctx.tl, time unit = vh): fixed-value tweens — panels,
      root gates, the eyebrow reel, hairlines, the range fill, dims;
   2. ONE per-frame writer (FrameOrder.Dossier): everything that depends
      on measured geometry or on the GL anchor — the paper clip (J6 build,
      C3a growth, C4a collapse), shade, tarja clip + thunk, tick dial,
      comets + trails, sparks, orbit, charge line, scan head → ruler,
      label shift, range ends, the amount (focus mask, pin flight) and
      the pinned label. A pure function of master vh (+ the anchor):
      exact reversal, no state, writes only on change.
   (The glyph spans inside every text root belong to the glyph writer.)
   Acts (time-based, reversible): `needle` @1450, `seal` @1475.

   Geometry: the card is laid out ONCE at its final Ch3 size; every
   earlier/later state is a clip of viewport-sized paper layers. Rects
   are measured on refresh from untransformed wrappers (one DOM snapshot
   per measure pass, shared by every registered key and the writer).
   ============================================================ */

import gsap from "gsap";
import { ACTS_AT, MASTER_END, PACE, RIPPLES, SHARED_WINDOWS, STATIONS_V3, TEXT_V3, type TextWindow } from "../beats";
import {
  BRACKET_MIN_SIDE,
  BRACKET_PAD,
  bezierQControl,
  circleRect,
  clamp01,
  fromDOMRect,
  inflateRect,
  lerp,
  lerpRect,
  progress,
  roundDevice,
  smoothstep,
  type Pt,
} from "../geometry";
import { claim } from "../dev/assert";
import { FrameOrder, LIVE_KEYS, RECT_KEYS, type AnchorScreen, type CinemaCtx, type Rect } from "../types";
import {
  CHIPS_DESKTOP,
  DIAL,
  buildSchedule,
  columnPoint,
  convergePlan,
  flight,
  lerpAngle,
  matchByAngle,
  newPathPt,
  normalAngleDeg,
  orbitU,
  rrPerimeter,
  rrPoint,
  stadiumAround,
  swarmVmax,
  tangentAngleDeg,
  tri,
  type ConvergePlan,
  type Flight,
  type PathPt,
  type RRect,
} from "./chips";
import { E, clampR, evenoddPath, f2, f3, flowPinned, insetRound, liquidText, q05, rrPath, tokenPx, type Win } from "./liquid";

const P = (v: number): number => v * PACE;
type W = Win;
const w = (a: number, b: number): W => [P(a), P(b)] as const;
const tw = (x: TextWindow): W => [x.from, x.to] as const;
const len = (x: W): number => x[1] - x[0];
const D = TEXT_V3.dossier;
const SW = SHARED_WINDOWS;

/* ── every DOSSIER window, master vh (v3 §2.3; TEXT_V3 / SHARED_WINDOWS) ── */
const T = {
  rootIn: P(790),
  rootOut: P(1852),
  // J6 — the card paper condenses out of the tarja (box cx-flow, radius pill → 18 cx-pour)
  paperIn: w(802, 850),
  /** the paper is small while it condenses: opaque early */
  paperFade: w(802, 824),
  shadeIn: w(836, 850),
  swap: P(850),
  hatch: w(850, 860),
  desc: tw(D.desc),
  rule: w(848, 860),
  slots: P(860),
  label: tw(D.label),
  eyebrowIn: tw(D.eyebrowIn),
  reelIn: tw(D.reelIn),
  caption: tw(D.caption),
  // C2b
  halo: w(1110, 1125),
  revIn: tw(D.revIn),
  c2In: tw(D.c2In),
  c2Lead: tw(D.c2Lead),
  c2Sub: tw(D.c2Sub),
  // C3a — the close is held (D4) until 1186, then evaporates from its far edge
  c2Evap: tw(D.c2Evap),
  c2PanelOut: tw(D.c2PanelOut),
  captionOut: tw(D.captionOut),
  revOut: tw(D.revOut),
  haloOut: tw(D.haloOut),
  reel1: tw(D.reel1),
  cardGrow: [SW.cardGrow.from, SW.cardGrow.to] as W,
  tarjaGrow: [SW.tarjaGrow.from, SW.tarjaGrow.to] as W,
  est: tw(D.est),
  // C3b / C3c
  lineBorn: tw(D.lineBorn),
  sweep: tw(D.sweep),
  focus: tw(D.focus),
  // C3d / C3e
  turn: w(1408, 1430),
  /** QA C3D-SCAN-SLASH: the line first falls clear of the number, then lies down */
  turnDrop: w(1408, 1418),
  turnLie: w(1414, 1430),
  glowOut: w(1424, 1430),
  ruler: w(1430, 1452),
  scale: w(1440, 1460),
  ends: w(1440, 1468),
  endsWords: tw(D.endsWords),
  c3In: tw(D.c3In),
  c3Lead: tw(D.c3Lead),
  c3Sub: tw(D.c3Sub),
  // C4a — the close is held (D7) until 1590
  c3Evap: tw(D.c3Evap),
  c3PanelOut: tw(D.c3PanelOut),
  reel2: tw(D.reel2),
  dimSeal: tw(D.dimSeal),
  dimRange: tw(D.dimRange),
  dimLabel: tw(D.dimLabel),
  dimHead: tw(D.dimHead),
  collapse: tw(D.collapse),
  /** the card centres on the disc while the disc still overfills the frame */
  collapseCentre: P(1612),
  /** the paper disc dissolves into the concentric, identical GL lit disc */
  paperOut: w(1630, 1640),
  shadeOut: w(1598, 1615),
  goldRim: w(1626, 1634),
  pinBg: w(1640, 1652),
  // C4d
  pinnedOut: tw(D.pinnedOut),
  eyebrowOut: tw(D.eyebrowOut),
  swarm: [SW.swarm.from, SW.swarm.to] as W,
} as const;
/** Read by the dev pour-before-plateau assert (§2.3): the v3 windows. */
export const DOSSIER_T = T;

/* Exit sub-windows inside the §2.3 exits: the line dissolves from its far
   edge, so a close's sub (the end of the text) leads its lead by 2 vh. */
const EXITS = {
  c2Sub: [T.c2Evap[0], T.c2Evap[1] - P(2)] as W,
  c2Lead: [T.c2Evap[0] + P(2), T.c2Evap[1]] as W,
  c3Sub: [T.c3Evap[0], T.c3Evap[1] - P(2)] as W,
  c3Lead: [T.c3Evap[0] + P(2), T.c3Evap[1]] as W,
  /** "O universo" evaporates; the pill follows 3 vh later */
  eyebrowText: [T.eyebrowOut[0], T.eyebrowOut[1] - P(3)] as W,
  eyebrowPill: [T.eyebrowOut[0] + P(3), T.eyebrowOut[1]] as W,
} as const;
/* Range ends: the tag pours, the number follows (both ends together). */
const ENDS = {
  tag: [T.endsWords[0], T.endsWords[1] - P(8)] as W,
  num: [T.endsWords[0] + P(6), T.endsWords[1]] as W,
} as const;

/** The pinned label's font size: the amount swaps to it at a matched size (§5 C4a). */
const PIN_FONT = 15;
const DEPTH_OPACITY = [0.9, 0.7, 0.5] as const;
const TAN: readonly [number, number, number] = [139, 106, 61];
const GOLD: readonly [number, number, number] = [207, 155, 30];
/** J6: the condensing paper starts as a pill hugging the tarja slot by this margin (px). */
const BUILD_HUG = 12;
/** C2a: each comet's trail capsule lags this far behind it on its path (vh). */
const TRAIL_LAG = P(3);
/** `.cx-dos__trail` CSS width (px): its length is a scaleX of it. */
const TRAIL_BASE = 100;
/** Comet stretch along the tangent by speed (scaleX ≤ 1 + STRETCH) and impact squash. */
const STRETCH = 0.6;
const SQUASH = 0.1;
/** C3c: the sharp/soft focus front's feather, as a fraction of the amount width. */
const FOCUS_FEATHER = 0.3;
/** The caption's paper plate fades in / out over this many vh (inside its pour / exit). */
const CAP_PLATE = P(6);

/* ── tiny style writer: only on change (no layout reads per frame) ── */
type Prop = "transform" | "opacity" | "visibility" | "clipPath" | "backgroundColor" | "borderRadius";

interface Snap {
  ver: number;
  vw: number;
  vhPx: number;
  card2: Rect;
  card3: Rect;
  tarja2: Rect;
  tarja3: Rect;
  amount: Rect;
  fontPx: number;
  slotEyebrow: Rect;
  slotCnpj: Rect;
  bar: Rect;
  seal: Rect;
  /** Range ends' start offsets (px, layout-relative — immune to their own transforms). */
  endMinDx: number;
  endMaxDx: number;
  /** Half the width "estimado" adds to the label (C3a centring shift). */
  estShift: number;
  /** Pinned label width (keeps it inside the viewport). */
  pinW: number;
  /** --lq-card (px): the card's corner radius. */
  rCard: number;
  /** C2 close panel rect at its rest (dev: the landing-path assert). */
  c2Rest: Rect;
}

interface Geo {
  ver: number;
  ring2: RRect;
  ring3: RRect;
  orbit: RRect;
  tick2: PathPt[];
  tick3: PathPt[];
  ang2: number[];
  ang3: number[];
  conv: ConvergePlan;
  col: Pt[];
  src: Pt[];
  ctrl: Pt[];
  dst: Pt[];
  vmax: number;
  orbitSpeed: number;
  scanLen: number;
  /** comet body length per chip (px, layout) */
  chipLen: number[];
}

/** One comet's state at a vh (flight, orbit or landing). */
interface Comet {
  x: number;
  y: number;
  a: number;
  speed: number;
  o: number;
  squash: number;
}

export function build(ctx: CinemaCtx): void {
  const root = document.querySelector<HTMLElement>(".cx-dos-stage");
  if (!root) return;
  const one = <E extends Element = HTMLElement>(sel: string): E => {
    const el = root.querySelector<E>(sel);
    if (!el) throw new Error(`[dossier] missing ${sel}`);
    return el;
  };
  const all = (sel: string): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(sel));

  const tl = ctx.tl;
  const field = ctx.field;
  const mobile = ctx.isMobile;
  const S = buildSchedule(mobile);
  const N = S.n;

  /* ── nodes ─────────────────────────────────────────────────── */
  const paper = one(".cx-dos__paper");
  const rim = one(".cx-dos__rim:not(.cx-dos__rim--gold)");
  const goldRim = one(".cx-dos__rim--gold");
  const shade = one(".cx-dos__shade");
  const sparks = all(".cx-dos__spark");
  const ticks = all(".cx-dos__tick");
  const chips = all(".cx-dos__chip");
  const trails = all(".cx-dos__trail");
  const scan = one(".cx-dos__scan");
  const scanGlow = one(".cx-dos__scan-glow");

  const eyebrow = one(".cx-dos__eyebrow");
  const strip = one(".cx-dos__strip");
  const cells = all(".cx-dos__cell");
  const hairs = all(".cx-dos__top .cx-dos__hair");
  const capI = one(".cx-dos__cap-i");

  const frame = one(".cx-dos__frame");
  const head = one(".cx-dos__head");
  const slotEyebrow = one(".cx-dos__slot--eyebrow");
  const slotCnpj = one(".cx-dos__slot--cnpj");
  const desc = one(".cx-dos__desc");
  const rule = one(".cx-dos__rule");
  const labelRow = one(".cx-dos__labelRow");
  const label = one(".cx-dos__label");
  const labelA = one(".cx-dos__labelA");
  const est = one(".cx-dos__est");

  const amountBox = one(".cx-dos__amountBox");
  const amount = one(".cx-dos__amount");
  const tarjaBox = one(".cx-dos__tarjaBox");
  const tarjaMove = one(".cx-dos__tarjaMove");
  const tarja = one(".cx-dos__tarja");
  const hatch = one(".cx-dos__tarja .cx-dos__hatch");
  const halo = one(".cx-dos__halo");
  const charge = one(".cx-dos__charge");

  const revnote = one(".cx-dos__revnote");
  const range = one(".cx-range");
  const endMin = one(".cx-range__end--min");
  const endMax = one(".cx-range__end--max");
  const endTags = all(".cx-range__tag");
  const endNums = all(".cx-range__num");
  const bar = one(".cx-range__bar");
  const scaleEl = one(".cx-range__scale");
  const track = one(".cx-range__track");
  const mark = one(".cx-range__mark");

  const sealSlot = one(".cx-dos__sealSlot");
  const seal = one(".cx-dos__seal");
  const check = one<SVGPathElement>(".cx-dos__check");

  const c2 = one(".cx-dos__close--c2");
  const c3 = one(".cx-dos__close--c3");
  const closesWrap = one(".cx-dos__closes");
  const pinned = one(".cx-dos__pinned");
  const pinnedBg = one(".cx-dos__pinned-bg");

  // mobile: 12 chips / ticks / sparks (never display:none for the swarm itself)
  for (let i = N; i < CHIPS_DESKTOP; i++) {
    for (const el of [sparks[i], ticks[i], chips[i], trails[i]]) if (el) el.style.display = "none";
  }

  /* ── measurement: ONE DOM snapshot per measure pass ─────────── */
  let memo: Snap | null = null;
  let snap: Snap | null = null;
  let snapVer = 0;

  const snapRect = (r: Rect): Rect => {
    const x0 = roundDevice(r.x);
    const y0 = roundDevice(r.y);
    const x1 = roundDevice(r.x + r.w);
    const y1 = roundDevice(r.y + r.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };

  /** Integration (850 swap): the centred flex layout leaves the tarja box at
   *  fractional DEVICE px. Chrome resolves clip-path against the pixel-
   *  snapped border box, so a sub-pixel translate (< .5 px, invisible) puts
   *  the origin on the grid and the clip math (fr/fb in the writer) rounds
   *  the far edges the same way. Measure-time only. */
  const snapTarja = (): void => {
    const st = tarjaBox.style;
    st.transform = "";
    st.width = "";
    st.height = "";
    const r = tarjaBox.getBoundingClientRect();
    const x0 = roundDevice(r.left);
    const y0 = roundDevice(r.top);
    // the whole border box on the device grid (origin AND size): no
    // snapping ambiguity left for the clip edges at any DPR
    st.width = `${roundDevice(r.left + r.width) - x0}px`;
    st.height = `${roundDevice(r.top + r.height) - y0}px`;
    const dx = Math.round((x0 - r.left) * 1000) / 1000;
    const dy = Math.round((y0 - r.top) * 1000) / 1000;
    st.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : "";
  };

  /** Integration (860 swap): on HiDPI screens the header slot text (laid out
   *  at a fractional position by the centred flex column) and RIG's
   *  translated tag half rasterize one device px apart vertically. A
   *  relative offset (layout, not transform; < .5 px) puts each slot box on
   *  whole CSS px, where both paths agree (Chrome, measured with the tag at
   *  rest on its slot: max 1/255 at DPR 1, 1.5 and 2; AA-only residue at
   *  1.25 and 3). At DPR 1 the unshifted layout already matches exactly. */
  const snapSlots = (): void => {
    const on = (window.devicePixelRatio || 1) > 1.1;
    for (const el of [slotEyebrow, slotCnpj]) {
      el.style.left = "";
      el.style.top = "";
      el.style.position = "";
      if (!on) continue;
      const r = el.getBoundingClientRect();
      const dx = Math.round((Math.round(r.left) - r.left) * 64) / 64;
      const dy = Math.round((Math.round(r.top) - r.top) * 64) / 64;
      el.style.position = "relative";
      el.style.left = dx ? `${dx}px` : "";
      el.style.top = dy ? `${dy}px` : "";
    }
  };

  const readDom = (): Snap => {
    snapTarja();
    snapSlots();
    const vw = root.clientWidth || window.innerWidth;
    const vhPx = root.clientHeight || window.innerHeight;
    const card3 = snapRect(fromDOMRect(frame.getBoundingClientRect()));
    const rn = revnote.getBoundingClientRect();
    const padB = parseFloat(getComputedStyle(frame).paddingBottom) || 0;
    // Ch2 = the top part of the Ch3 frame (header … rev-note), a little narrower
    const inset2 = mobile ? 0 : Math.round(Math.min(30, Math.max(14, card3.w * 0.05)));
    const card2 = snapRect({
      x: card3.x + inset2,
      y: card3.y,
      w: card3.w - 2 * inset2,
      h: rn.bottom + padB - card3.y,
    });
    const tb = fromDOMRect(tarjaBox.getBoundingClientRect());
    const tarja3 = tb;
    // Ch2 sub-rect (~318×40 at 1440): centred, device-pixel snapped (the swap at 850)
    const w2 = roundDevice(tb.w * 0.795);
    const h2 = roundDevice(Math.max(tb.h * 0.435, Math.min(tb.h, 28)));
    const tarja2 = {
      x: roundDevice(tb.x + (tb.w - w2) / 2),
      y: roundDevice(tb.y + (tb.h - h2) / 2),
      w: w2,
      h: h2,
    };
    const amt = fromDOMRect(amountBox.getBoundingClientRect());
    const fontPx = parseFloat(getComputedStyle(amountBox).fontSize) || 86;
    // layout offsets (offsetLeft/Width ignore the ends' own transforms)
    const barC = bar.offsetLeft + bar.offsetWidth / 2;
    const endMinDx = barC - 6 - (endMin.offsetLeft + endMin.offsetWidth);
    const endMaxDx = barC + 6 - endMax.offsetLeft;
    // "estimado" widens the label by (its right − "anual"'s right): half of it re-centres
    // (both rects carry the label's current translateX, so the difference does not)
    const words = labelA.querySelectorAll(".cx-mw");
    const anual = words[words.length - 1] as HTMLElement | undefined;
    const estShift = anual ? (est.getBoundingClientRect().right - anual.getBoundingClientRect().right) / 2 : 0;
    // the C2 close at rest: the closes slot, centred, lifted under the Ch2 card
    const wrap = closesWrap.getBoundingClientRect();
    const shift = card3.y + card3.h - (card2.y + card2.h);
    const c2Rest = {
      x: wrap.left + (wrap.width - c2.offsetWidth) / 2,
      y: wrap.top - shift,
      w: c2.offsetWidth,
      h: c2.offsetHeight,
    };
    return {
      ver: ++snapVer,
      vw,
      vhPx,
      card2,
      card3,
      tarja2,
      tarja3,
      amount: amt,
      fontPx,
      slotEyebrow: fromDOMRect(slotEyebrow.getBoundingClientRect()),
      slotCnpj: fromDOMRect(slotCnpj.getBoundingClientRect()),
      bar: fromDOMRect(bar.getBoundingClientRect()),
      seal: fromDOMRect(sealSlot.getBoundingClientRect()),
      endMinDx,
      endMaxDx,
      estShift,
      pinW: pinned.offsetWidth,
      rCard: tokenPx(root, "--lq-card", 18),
      c2Rest,
    };
  };
  const measure = (): Snap => {
    if (!memo) {
      memo = readDom();
      snap = memo;
      queueMicrotask(() => {
        memo = null;
      });
    }
    return memo;
  };
  const cur = (): Snap => snap ?? measure();

  // registry keys (§12.2) — all from the same snapshot
  ctx.rects.register(RECT_KEYS.dosCardCh2, () => measure().card2);
  ctx.rects.register(RECT_KEYS.dosCardCh3, () => measure().card3);
  ctx.rects.register(RECT_KEYS.dosTarjaCh2, () => measure().tarja2);
  ctx.rects.register(RECT_KEYS.dosTarjaCh3, () => measure().tarja3);
  ctx.rects.register(RECT_KEYS.dosSlotEyebrow, () => measure().slotEyebrow);
  ctx.rects.register(RECT_KEYS.dosSlotCnpj, () => measure().slotCnpj);

  /* ── derived geometry (recomputed when the snapshot changes) ── */
  let geo: Geo | null = null;

  const fallbackSources = (n: number, s: Snap): Pt[] => {
    // a ring just inside the viewport edges (NullField-free safety net)
    const out: Pt[] = [];
    const cx = s.vw / 2;
    const cy = s.vhPx / 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push({ x: cx + Math.cos(a) * (s.vw / 2 - 40), y: cy + Math.sin(a) * (s.vhPx / 2 - 40) });
    }
    return out;
  };

  const computeGeo = (s: Snap): Geo => {
    // the dial is a stadium concentric with the capsule tarja (§7 C2)
    const ring2 = stadiumAround(s.tarja2, 10);
    const ring3 = stadiumAround(s.tarja3, 10);
    const orbit = stadiumAround(s.tarja2, mobile ? 18 : 28);
    const tick2: PathPt[] = [];
    const tick3: PathPt[] = [];
    const ang2: number[] = [];
    const ang3: number[] = [];
    for (let i = 0; i < N; i++) {
      const u = i / N;
      tick2.push(rrPoint(ring2, u));
      tick3.push(rrPoint(ring3, u));
      ang2.push(normalAngleDeg(tick2[i]));
      ang3.push(normalAngleDeg(tick3[i]));
    }
    const scanLen = Math.round(s.tarja3.h + 12);
    const left: Pt = { x: s.tarja3.x, y: s.tarja3.y + s.tarja3.h / 2 };
    const conv = convergePlan(tick3, left);
    const col = conv.slot.map((k) => columnPoint(left, scanLen, k, N));

    // chip flights: P2 = tick (absorbed) or orbit slot (wave 3), sources matched by angle
    const dst: Pt[] = S.chips.map((c) => {
      if (c.slot < 0) return { x: tick2[c.tick].x, y: tick2[c.tick].y };
      const p = rrPoint(orbit, orbitU(c.slot, S.nOrb, c.end));
      return { x: p.x, y: p.y };
    });
    let pts = field.sampleScreenPoints(N, 0x5eed + N, P(1000), inflateRect(s.card2, 40));
    if (pts.length < N) pts = pts.concat(fallbackSources(N - pts.length, s));
    const c0: Pt = { x: s.tarja2.x + s.tarja2.w / 2, y: s.tarja2.y + s.tarja2.h / 2 };
    const match = matchByAngle(c0, dst, pts);
    const src = dst.map((_, i) => pts[match[i]] ?? pts[i % pts.length]);
    const ctrl = S.chips.map((c, i) => bezierQControl(src[i], dst[i], 0.25, c.sign));
    const vmax = swarmVmax(src.map((p0, i) => ({ p0, p2: dst[i] })));
    // orbit: perimeter·(quarter turn / 47 vh) expressed in the flight's px-per-window units
    const orbitSpeed = vmax > 0 ? clamp01((rrPerimeter(orbit) * DIAL.orbitRate * DIAL.flight) / vmax) : 0;
    const chipLen = chips.map((el) => el.offsetWidth || 0);

    // measure-time static styles (never per frame)
    shade.style.width = s.card3.w + "px";
    shade.style.height = s.card3.h + "px";
    scan.style.height = scanLen + "px";
    const lx = s.tarja2.x - s.tarja3.x;
    const ly = s.tarja2.y - s.tarja3.y;
    // the halo rings the Ch2 capsule (radius 999 in CSS: concentric, §7 E18)
    halo.style.left = lx + "px";
    halo.style.top = ly + "px";
    halo.style.width = s.tarja2.w + "px";
    halo.style.height = s.tarja2.h + "px";
    // the charge line rides the capsule's flat top edge (round caps)
    const r2 = s.tarja2.h / 2;
    charge.style.left = lx + r2 + "px";
    charge.style.top = ly + "px";
    charge.style.width = Math.max(0, s.tarja2.w - 2 * r2) + "px";
    sparks.forEach((el, i) => {
      if (i >= N) return;
      el.style.transform = `translate(${f2(src[i].x - 1.5)}px, ${f2(src[i].y - 1.5)}px)`;
    });

    // dev (§2.1 SHARED_WINDOWS.chipsLandStart): no orbiter landing path may
    // cross the C2 close panel while it is held (1172–1194)
    if (ctx.flags.DEV_ASSERT) {
      const hit: number[] = [];
      const c = s.c2Rest;
      S.chips.forEach((ch, k) => {
        if (!ch.land) return;
        const a = rrPoint(orbit, orbitU(ch.slot, S.nOrb, ch.land[0]));
        const b = tick2[ch.tick];
        for (let j = 0; j <= 8; j++) {
          const x = lerp(a.x, b.x, j / 8);
          const y = lerp(a.y, b.y, j / 8);
          if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
            hit.push(k);
            break;
          }
        }
      });
      if (hit.length) console.warn("[cinema/dossier] orbiter landing paths cross the C2 close panel:", hit);
    }

    return { ver: s.ver, ring2, ring3, orbit, tick2, tick3, ang2, ang3, conv, col, src, ctrl, dst, vmax, orbitSpeed, scanLen, chipLen };
  };
  const G = (): Geo => {
    const s = cur();
    if (!geo || geo.ver !== s.ver) geo = computeGeo(s);
    return geo;
  };

  /* ── the card box: ONE pure function shared by the paper and dos.liveBox ── */
  interface CardBox {
    box: Rect;
    radius: number;
    phase: "build" | "card" | "collapse" | "disc";
  }
  const anchorOr = (s: Snap): AnchorScreen => {
    const a = field.getAnchorScreen();
    if (a && a.visible && a.r > 0 && !a.inside) return a;
    const half = Math.min(s.card3.w, s.card3.h) / 2;
    return { x: s.card3.x + s.card3.w / 2, y: s.card3.y + s.card3.h / 2, r: Math.max(half, a?.r ?? 0), visible: true, inside: false };
  };
  const cardBoxAt = (vh: number): CardBox => {
    const s = cur();
    if (vh < T.swap) {
      // J6 (§3 J6): the paper CONDENSES OUT OF THE TARJA — a pill hugging the
      // tarja slot opens into the Ch2 card (cx-flow) while its radius relaxes
      // from the pill (h/2) to the card's 18 px (cx-pour). RIG's brackets
      // close in from the frame onto the same card (cardBuildBox) and sit
      // 8 px inside it from 850 on.
      const p = progress(T.paperIn[0], T.paperIn[1], vh);
      const box = lerpRect(inflateRect(s.tarja2, BUILD_HUG), s.card2, E.flow(p));
      const pill = Math.min(box.w, box.h) / 2;
      return { box, radius: lerp(pill, s.rCard, E.pour(p)), phase: "build" };
    }
    if (vh < T.cardGrow[0]) return { box: s.card2, radius: s.rCard, phase: "card" };
    if (vh < T.cardGrow[1]) {
      return { box: lerpRect(s.card2, s.card3, E.flow(progress(T.cardGrow[0], T.cardGrow[1], vh))), radius: s.rCard, phase: "card" };
    }
    if (vh < T.collapse[0]) return { box: s.card3, radius: s.rCard, phase: "card" };
    const a = anchorOr(s);
    if (vh >= T.collapse[1]) return { box: circleRect(a.x, a.y, a.r), radius: a.r, phase: "disc" };
    // C4a (§3 C4a): card → pill → circle. ONE object: the card centres on the
    // lit disc while the disc still overfills the frame (1605–1612), then
    // stays concentric and INSCRIBED in it (the GL rim is always outside the
    // paper). The clip RADIUS LEADS (cx-pour, 18 → min(w, h)/2) while the
    // BOX LAGS (cx-flow, card → disc), so the shape is a pill before it lands
    // as the lit disc; at 1640 the paper IS the disc (anchor ± r, radius r).
    const p = progress(T.collapse[0], T.collapse[1], vh);
    const t = E.flow(p);
    const tc = E.flow(progress(T.collapse[0], T.collapseCentre, vh));
    const W = s.card3.w;
    const H = s.card3.h;
    const cx = lerp(s.card3.x + W / 2, a.x, tc);
    const cy = lerp(s.card3.y + H / 2, a.y, tc);
    let bw = lerp(W, 2 * a.r, t);
    let bh = lerp(H, 2 * a.r, t);
    if (bw > W) bw = W;
    if (bh > H) bh = H;
    let rad = Math.min(lerp(s.rCard, Math.min(bw, bh) / 2, E.pour(p)), Math.min(bw, bh) / 2);
    // farthest point of the rounded rect from its centre
    const far = Math.hypot(Math.max(0, bw / 2 - rad), Math.max(0, bh / 2 - rad)) + rad;
    if (far > a.r && far > 0) {
      const k = a.r / far;
      bw *= k;
      bh *= k;
      rad *= k;
    }
    return { box: { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh }, radius: rad, phase: "collapse" };
  };

  // dos.liveBox — the current paper box (RIG: card ride, C4a ring)
  ctx.live.provide<() => Rect>(LIVE_KEYS.dosLiveBox, () => {
    const b = cardBoxAt(ctx.vh());
    return { x: b.box.x, y: b.box.y, w: b.box.w, h: b.box.h };
  });

  /* ── pre-states (motion only; CSS default = the readable final state) ── */
  gsap.set(eyebrow, { autoAlpha: 0, y: 10, scale: 0.96 });
  gsap.set(strip, { yPercent: 100 / 3 });
  gsap.set(hairs, { scaleX: 0 });
  gsap.set([slotEyebrow, slotCnpj], { opacity: 0 });
  gsap.set(rule, { scaleX: 0 });
  gsap.set(hatch, { opacity: 0 });
  gsap.set([c2, c3], { autoAlpha: 0, scale: 0.97 });
  gsap.set(scaleEl, { clipPath: "inset(0% 50% 0% 50% round 999px)" });
  gsap.set(mark, { xPercent: -50, yPercent: -50 });

  /* ── the master (fixed-value tweens; time unit = vh) ─────────── */
  tl.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, T.rootIn);
  tl.to(root, { autoAlpha: 0, duration: 0.01 }, T.rootOut);

  // J6 — the card's contents pour in as the paper settles (INK, §5.3)
  liquidText(ctx, "dos.desc", desc, { pour: T.desc });
  tl.to(rule, { scaleX: 1, duration: len(T.rule), ease: "cx-flow" }, T.rule[0]);
  tl.to(hatch, { opacity: 1, duration: len(T.hatch), ease: "cx-flow" }, T.hatch[0]);
  // = RIG tag → 0 (it hides at vh ≥ 860): the step ENDS at 860 so the two
  // never leave a frame with neither on screen (both are opaque and identical)
  tl.to([slotEyebrow, slotCnpj], { opacity: 1, duration: 0.01 }, T.slots - 0.01);
  liquidText(ctx, "dos.label", labelA, { pour: T.label });
  // the eyebrow pill condenses (cx-pour arrival), its reel rolls cell 0 up
  tl.to(eyebrow, { autoAlpha: 1, duration: len(T.eyebrowIn) * 0.6, ease: "cx-flow" }, T.eyebrowIn[0]);
  tl.to(eyebrow, { y: 0, scale: 1, duration: len(T.eyebrowIn), ease: "cx-pour" }, T.eyebrowIn[0]);
  tl.to(strip, { yPercent: 0, duration: len(T.reelIn), ease: "cx-flow" }, T.reelIn[0]);
  tl.to(hairs, { scaleX: 1, duration: len(T.caption), ease: "cx-flow" }, T.caption[0]);
  liquidText(ctx, "dos.caption", capI, { pour: T.caption, exit: T.captionOut });
  // its paper plate condenses with the first glyphs and dries with the last
  // (the root gate then steps while the plate is at 0: no pop over the field)
  tl.fromTo(capI, { "--cap-plate": 0 }, { "--cap-plate": 1, duration: CAP_PLATE, ease: "cx-flow", immediateRender: false }, T.caption[0]);
  tl.to(capI, { "--cap-plate": 0, duration: CAP_PLATE, ease: "cx-evap" }, T.captionOut[1] - CAP_PLATE);

  // C2b — the halo, the note, the close (condensed in place under the Ch2 card)
  tl.to(halo, { opacity: 1, duration: len(T.halo), ease: "cx-flow" }, T.halo[0]);
  liquidText(ctx, "dos.revnote", revnote, { pour: T.revIn, exit: T.revOut });
  const closeShift = (): number => {
    const s = cur();
    return s.card3.y + s.card3.h - (s.card2.y + s.card2.h);
  };
  /** A close panel condenses in place: opacity leads (opaque before its first
   *  word is legible), scale .97 → 1 settles over the whole window (cx-flow). */
  const condense = (el: HTMLElement, win: W, y?: () => number): void => {
    const opaque = win[0] + len(win) * 0.6;
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: opaque - win[0], ease: "cx-flow", immediateRender: false }, win[0]);
    const from: gsap.TweenVars = { scale: 0.97 };
    const to: gsap.TweenVars = { scale: 1, duration: len(win), ease: "cx-flow", immediateRender: false };
    if (y) {
      from.y = y;
      to.y = y;
    }
    tl.fromTo(el, from, to, win[0]);
  };
  /** …and evaporates after its text (cx-evap; a hair of scale, no drop). */
  const evaporate = (el: HTMLElement, win: W): void => {
    tl.to(el, { autoAlpha: 0, scale: 0.985, duration: len(win), ease: "cx-evap" }, win[0]);
  };
  condense(c2, T.c2In, () => -closeShift());
  liquidText(ctx, "dos.c2.lead", c2.querySelector(".cx-dos__close-lead"), { pour: T.c2Lead, exit: EXITS.c2Lead });
  liquidText(ctx, "dos.c2.sub", c2.querySelector(".cx-dos__close-sub"), { pour: T.c2Sub, exit: EXITS.c2Sub });

  // C3a — the close evaporates from its far edge, the panel follows; the
  // caption and the note leave; the reel rolls to "A estimativa" exactly at
  // the station (1198, STATIONS_V3)
  evaporate(c2, T.c2PanelOut);
  tl.to(hairs, { scaleX: 0, duration: len(T.captionOut), ease: "cx-flow" }, T.captionOut[0]);
  const stationAt = (id: "estimativa" | "universo"): number => STATIONS_V3.find((st) => st.id === id)!.at;
  const pin = (win: W, at: number): number => clamp01((at - win[0]) / len(win));
  tl.to(strip, { yPercent: -100 / 3, duration: len(T.reel1), ease: flowPinned(pin(T.reel1, stationAt("estimativa"))) }, T.reel1[0]);
  tl.to(halo, { opacity: 0, duration: len(T.haloOut), ease: "cx-evap" }, T.haloOut[0]);
  liquidText(ctx, "dos.est", est, { pour: T.est });

  // C3d — the range fill opens from the centre as a capsule; the ends pour
  tl.to(scaleEl, { clipPath: "inset(0% 0% 0% 0% round 999px)", duration: len(T.scale), ease: "cx-flow" }, T.scale[0]);
  endTags.forEach((el, i) => liquidText(ctx, `dos.range.tag${i}`, el, { pour: ENDS.tag }));
  endNums.forEach((el, i) => liquidText(ctx, `dos.range.num${i}`, el, { pour: ENDS.num }));

  // C3e — the close condenses in place (the panel is opaque before the first word)
  condense(c3, T.c3In);
  liquidText(ctx, "dos.c3.lead", c3.querySelector(".cx-dos__close-lead"), { pour: T.c3Lead, exit: EXITS.c3Lead });
  liquidText(ctx, "dos.c3.sub", c3.querySelector(".cx-dos__close-sub"), { pour: T.c3Sub, exit: EXITS.c3Sub });

  // C4a — the close evaporates, the reel rolls to "O universo" (1602), the card empties
  evaporate(c3, T.c3PanelOut);
  tl.to(strip, { yPercent: -200 / 3, duration: len(T.reel2), ease: flowPinned(pin(T.reel2, stationAt("universo"))) }, T.reel2[0]);
  tl.to(sealSlot, { opacity: 0, duration: len(T.dimSeal), ease: "cx-flow" }, T.dimSeal[0]);
  tl.to(range, { opacity: 0, duration: len(T.dimRange), ease: "cx-flow" }, T.dimRange[0]);
  tl.to(labelRow, { opacity: 0, duration: len(T.dimLabel), ease: "cx-flow" }, T.dimLabel[0]);
  tl.to([head, rule], { opacity: 0, duration: len(T.dimHead), ease: "cx-flow" }, T.dimHead[0]);

  // C4d — "O universo" evaporates, then its pill
  liquidText(ctx, "dos.eyebrow.out", cells[cells.length - 1], { exit: EXITS.eyebrowText });
  tl.to(eyebrow, { autoAlpha: 0, y: -6, duration: len(EXITS.eyebrowPill), ease: "cx-evap" }, EXITS.eyebrowPill[0]);

  /* ── acts (time-based, reversible; §4.5) ─────────────────────── */
  const needle = gsap
    .timeline({ paused: true })
    .fromTo(
      mark,
      { y: -36, scale: 0.7, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: 0.6, ease: "back.out(1.6)" },
    );
  ctx.acts.register({ id: "needle", at: ACTS_AT.needle, tl: needle });
  const sealAct = gsap
    .timeline({ paused: true })
    .fromTo(seal, { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: 0.22, ease: "rk-settle" })
    .fromTo(check, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.3, ease: "rk-settle" }, 0.3);
  ctx.acts.register({ id: "seal", at: ACTS_AT.seal, tl: sealAct });

  /* ── ink ripples (§7.8): the C2a impacts + the seal ─────────── */
  if (ctx.flags.RIPPLES) {
    S.chips.forEach((c) => {
      if (c.slot >= 0) return;
      const at = S.lit[c.tick][0];
      field.addRipple({ vh: at, at: () => {
        const p = G().tick2[c.tick];
        return { x: p.x, y: p.y };
      } });
    });
    field.addRipple({ vh: RIPPLES.at.seal, at: () => {
      const r = cur().seal;
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    } });
  }

  /* ── the per-frame writer (FrameOrder.Dossier) ───────────────── */
  const cache = new Map<HTMLElement, Partial<Record<Prop, string>>>();
  const put = (el: HTMLElement, p: Prop, v: string): void => {
    let c = cache.get(el);
    if (!c) cache.set(el, (c = {}));
    if (c[p] !== v) {
      c[p] = v;
      el.style[p] = v;
    }
  };
  const vars = new Map<string, string>();
  const putVar = (el: HTMLElement, name: string, v: string): void => {
    if (vars.get(name) === v) return;
    vars.set(name, v);
    el.style.setProperty(name, v);
  };
  const hide = (el: HTMLElement): void => put(el, "visibility", "hidden");
  const show = (el: HTMLElement, opacity = 1): void => {
    if (opacity <= 0.002) return hide(el);
    put(el, "visibility", "visible");
    put(el, "opacity", f3(opacity));
  };
  const xf = (x: number, y: number, rot = 0, sx = 1, sy = 1, centre = true): string =>
    `translate(${f2(x)}px, ${f2(y)}px)` +
    (rot ? ` rotate(${f2(rot)}deg)` : "") +
    (sx !== 1 || sy !== 1 ? ` scale(${f3(sx)}, ${f3(sy)})` : "") +
    (centre ? " translate(-50%, -50%)" : "");
  const snapBox = (b: Rect): Rect => {
    const x0 = roundDevice(b.x);
    const y0 = roundDevice(b.y);
    return { x: x0, y: y0, w: roundDevice(b.x + b.w) - x0, h: roundDevice(b.y + b.h) - y0 };
  };
  const mix = (a: readonly number[], b: readonly number[], t: number): string =>
    `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;

  const fl: Flight = { x: 0, y: 0, angle: 0, speed: 0 };
  const op = newPathPt();
  let swarm = false;
  let focusing: boolean | null = null;

  const scanX = (s: Snap, vh: number): number => s.tarja3.x + s.tarja3.w * progress(T.sweep[0], T.sweep[1], vh);

  const tickPos = (g: Geo, i: number, vh: number, out: { x: number; y: number; a: number }) => {
    const k = vh < T.tarjaGrow[0] ? 0 : E.flow(progress(T.tarjaGrow[0], T.tarjaGrow[1], vh));
    const a = g.tick2[i];
    const b = g.tick3[i];
    out.x = lerp(a.x, b.x, k);
    out.y = lerp(a.y, b.y, k);
    out.a = lerpAngle(g.ang2[i], g.ang3[i], k);
    return out;
  };
  const tp = { x: 0, y: 0, a: 0 };

  /** A comet at `vh`: flight (Bézier, unchanged), orbit, or landing. False when not live. */
  const cometAt = (g: Geo, k: number, vh: number, out: Comet): boolean => {
    const c = S.chips[k];
    if (vh < c.start || (c.land ? vh >= c.land[1] : vh >= c.end)) return false;
    let o: number = DEPTH_OPACITY[c.depth];
    let squash = 0;
    if (vh < c.end) {
      const t = progress(c.start, c.end, vh);
      flight(g.src[k], g.ctrl[k], g.dst[k], t, g.vmax, fl);
      out.x = fl.x;
      out.y = fl.y;
      out.a = fl.angle;
      out.speed = fl.speed;
      o *= progress(0, 0.1, t);
      if (!c.land) {
        // impact: squash into the tick, then evaporate (closed form in vh)
        squash = progress(1 - DIAL.impactFrac, 1, t);
        o *= 1 - E.evap(squash);
      }
    } else {
      // orbiter: on the stadium around the tarja ("o cercam"), then lands on its tick
      rrPoint(g.orbit, orbitU(c.slot, S.nOrb, vh), op);
      out.x = op.x;
      out.y = op.y;
      out.a = tangentAngleDeg(op.tx, op.ty);
      const moving = vh < DIAL.orbitPause[0] || vh >= DIAL.orbitPause[1];
      out.speed = moving ? g.orbitSpeed : 0;
      if (c.land && vh >= c.land[0]) {
        const b = progress(c.land[0], c.land[1], vh);
        const e = E.flow(b);
        tickPos(g, c.tick, vh, tp);
        out.x = lerp(out.x, tp.x, e);
        out.y = lerp(out.y, tp.y, e);
        squash = progress(0.55, 1, b);
        o *= 1 - E.evap(squash);
      }
    }
    out.o = o;
    out.squash = squash;
    return true;
  };
  const cm: Comet = { x: 0, y: 0, a: 0, speed: 0, o: 0, squash: 0 };
  const cl: Comet = { x: 0, y: 0, a: 0, speed: 0, o: 0, squash: 0 };

  /** Where the pinned label's left-centre sits, kept on screen.
   *  QA D2 (deliberate deviation from §8 C4a "anchor.x + r + 12"): x is
   *  derived from the RIG bracket box (bbox ⊕ 14, min 44 square), not the
   *  disc edge, so the label's paper chip (inset −6/−9 px) sits OUTSIDE
   *  the brackets — the lock never cuts into it, the 1.25× ring pulse
   *  included (clear while half < 40 px). */
  const PIN_BG_X = 9;
  const PIN_GAP = 10;
  const pinAt = (s: Snap, a: AnchorScreen, reach = a.r): Pt => {
    const half = Math.max(Math.max(a.r, reach) + BRACKET_PAD, BRACKET_MIN_SIDE / 2);
    return {
      x: Math.max(12, Math.min(a.x + half + PIN_BG_X + PIN_GAP, s.vw - 12 - s.pinW)),
      y: Math.max(20, Math.min(a.y - 8, s.vhPx - 20)),
    };
  };

  const render = (vh: number): void => {
    const s = cur();
    const g = G();

    // compositor hints only while the swarm flies
    const sw = vh >= T.swarm[0] && vh < T.swarm[1];
    if (sw !== swarm) {
      swarm = sw;
      root.classList.toggle("is-swarm", sw);
    }

    /* paper · rims · shade */
    // no WebGL (NullField): the paper disc stays as the company point after
    // 1640 (tracking the fallback anchor) until the stage root goes off
    const discFallback = !field.ok;
    const live = vh >= T.paperIn[0] && (vh < T.collapse[1] || discFallback);
    if (!live) {
      hide(paper);
      hide(rim);
      hide(goldRim);
      hide(shade);
    } else {
      const cb = cardBoxAt(vh);
      const box = snapBox(cb.box);
      const r = clampR(box, cb.radius);
      const building = cb.phase === "build";
      // C4a end: the paper disc, already concentric and the same size as the
      // GL lit disc beneath it, dissolves into it (shading + gold core come
      // up gradually instead of popping in at the 1640 handoff)
      // (no WebGL: there is no lit disc to dissolve into — the paper disc
      // itself stays as the referent, with the gold ring, see `live`)
      const o = building
        ? E.flow(progress(T.paperFade[0], T.paperFade[1], vh))
        : discFallback
          ? 1
          : 1 - smoothstep(T.paperOut[0], T.paperOut[1], vh);
      if (building) {
        // the capsule tarja slot stays open until the swap: CH1's capsule bars
        // (z 4) fuse there; outer and hole are true arcs (path, evenodd)
        put(paper, "clipPath", evenoddPath(rrPath(box, r), rrPath(s.tarja2, s.tarja2.h / 2)));
        put(rim, "clipPath", evenoddPath(rrPath(inflateRect(box, 1), r + 1), rrPath(box, r)));
      } else {
        put(paper, "clipPath", insetRound(s.vw, s.vhPx, box, r));
        put(rim, "clipPath", insetRound(s.vw, s.vhPx, inflateRect(box, 1), r > 0.05 ? r + 1 : 0));
      }
      show(paper, o);
      // the rim layers are FILLED viewport layers behind the paper: once the
      // paper fades they would tint through it (a gold wash on paper), so
      // they leave the moment the dissolve starts; the GL rim is the edge
      if (o >= 0.999 || building) show(rim, o);
      else hide(rim);
      // integration: no DOM gold ring with WebGL — the card stays inscribed in
      // the GL lit disc, whose own gold rim is the edge the eye follows (a
      // second ring a few px inside it read as two objects). Without WebGL
      // the DOM disc is the lit point, so it carries the ring itself.
      const gr = discFallback && cb.phase !== "build" && cb.phase !== "card" ? progress(T.goldRim[0], T.goldRim[1], vh) : 0;
      if (gr > 0) {
        put(goldRim, "clipPath", insetRound(s.vw, s.vhPx, inflateRect(box, 1), r > 0.05 ? r + 1 : 0));
        show(goldRim, gr);
      } else hide(goldRim);
      const so =
        o *
        (building ? smoothstep(T.shadeIn[0], T.shadeIn[1], vh) : 1) *
        (1 - E.evap(progress(T.shadeOut[0], T.shadeOut[1], vh)));
      if (so > 0.002 && box.w > 0 && box.h > 0) {
        // §7 E17: the shadow is a static box scaled to the clip box, so its
        // radius is compensated per axis — the scaled shadow has the card's
        // corners (a paint, never a layout; written only on change)
        const sx = box.w / s.card3.w;
        const sy = box.h / s.card3.h;
        put(shade, "transform", xf(box.x, box.y, 0, sx, sy, false));
        put(shade, "borderRadius", `${q05(r / sx)}px / ${q05(r / sy)}px`);
        show(shade, so);
      } else hide(shade);
    }

    /* tarja: the Ch2 capsule → the full capsule (clip only, the hatch never
       stretches) → eaten by a capsule wipe whose rounded front follows the scan */
    if (vh < T.swap || vh >= T.sweep[1]) {
      hide(tarja);
    } else {
      // the tarja's border box sits on the device grid (snapTarja), so the
      // Ch2 clip lands exactly on CH1's snapped bars at the 850 swap at any
      // DPR (was 1 device px short at the right/bottom edges at DPR 2)
      const fx = s.tarja3.x;
      const fy = s.tarja3.y;
      const fr = roundDevice(s.tarja3.x + s.tarja3.w);
      const fb = roundDevice(s.tarja3.y + s.tarja3.h);
      let L = s.tarja2.x - fx;
      let Tp = s.tarja2.y - fy;
      let R = fr - (s.tarja2.x + s.tarja2.w);
      let B = fb - (s.tarja2.y + s.tarja2.h);
      if (vh >= T.tarjaGrow[0]) {
        const k = 1 - E.flow(progress(T.tarjaGrow[0], T.tarjaGrow[1], vh));
        L *= k;
        Tp *= k;
        R *= k;
        B *= k;
      }
      if (vh >= T.sweep[0]) L = Math.max(L, scanX(s, vh) - fx);
      const cw = Math.max(0, fr - fx - L - R);
      const ch = Math.max(0, fb - fy - Tp - B);
      const rr = Math.min(cw, ch) / 2;
      put(tarja, "clipPath", `inset(${f2(Tp)}px ${f2(R)}px ${f2(B)}px ${f2(L)}px round ${f2(rr)}px)`);
      show(tarja, 1);
    }
    // thunk: a 1 px triangular bump per impact (C2a)
    let thunk = 0;
    if (vh >= DIAL.waveStarts[0] && vh < T.swarm[1]) for (const e of S.impacts) thunk += tri(e, e + DIAL.litLen, vh);
    put(tarjaMove, "transform", thunk > 0 ? `translateY(${f2(thunk)}px)` : "none");

    // charge line: impacts + landings so far / N (18/26 in Ch2, 26/26 as the orbiters land)
    let count = 0;
    if (vh >= DIAL.waveStarts[0]) for (let i = 0; i < N; i++) count += progress(S.lit[i][0], S.lit[i][1], vh);
    const chargeO = 1 - E.evap(progress(T.haloOut[0], T.haloOut[1], vh));
    if (count > 0.001 && chargeO > 0.002) {
      put(charge, "transform", `scaleX(${f3(count / N)})`);
      show(charge, chargeO);
    } else hide(charge);

    /* tick dial (round-capped capsule ticks) */
    for (let i = 0; i < N; i++) {
      const el = ticks[i];
      const d = S.draw[i];
      const cw = g.conv.win[i];
      if (vh < d[0] || vh >= cw[1]) {
        hide(el);
        continue;
      }
      const drawn = progress(d[0], d[1], vh);
      const lit = progress(S.lit[i][0], S.lit[i][0] + DIAL.litLen / 2, vh);
      let o = lerp(0.3 * drawn, 1, lit);
      let sy = drawn * (1 + 0.6 * tri(S.lit[i][0], S.lit[i][1], vh));
      tickPos(g, i, vh, tp);
      let x = tp.x;
      let y = tp.y;
      let a = tp.a;
      if (vh >= cw[0]) {
        const c = E.flow(progress(cw[0], cw[1], vh));
        x = lerp(x, g.col[i].x, c);
        y = lerp(y, g.col[i].y, c);
        a = lerpAngle(a, Math.round(a / 180) * 180, c);
        o *= 1 - progress(cw[1] - DIAL.convergeFade, cw[1], vh);
        sy = lerp(sy, 1, c);
      }
      put(el, "transform", xf(x, y, a, 1, Math.max(0.001, sy)));
      put(el, "backgroundColor", lit > 0 ? mix(TAN, GOLD, lit) : "");
      show(el, o);
    }

    /* ink comets + their lagging trails + sparks */
    // QA D8: trails retract before the R4 plateau and grow back after it
    // (no frozen smudge at the reading rest; every plateau stays static)
    const trailK = 1 - progress(P(1146), DIAL.orbitPause[0], vh) * (1 - progress(DIAL.orbitPause[1], P(1174), vh));
    for (let k = 0; k < N; k++) {
      const c = S.chips[k];
      const el = chips[k];
      const trail = trails[k];
      const spark = sparks[k];
      const so = tri(c.start, c.start + DIAL.flight * DIAL.sparkFrac, vh);
      if (so > 0.002) show(spark, so);
      else hide(spark);
      if (!cometAt(g, k, vh, cm)) {
        hide(el);
        if (!mobile) hide(trail);
        continue;
      }
      // stretched along the tangent by speed (≤ 1.6), squashed to 0.9 at impact
      const sx = (1 + STRETCH * cm.speed) * (1 - SQUASH * cm.squash);
      const sy = 1 + 0.8 * SQUASH * cm.squash;
      put(el, "transform", xf(cm.x, cm.y, cm.a, sx, sy));
      show(el, cm.o);
      if (mobile) continue;
      // the trail capsule: from the comet's position TRAIL_LAG vh ago to its tail
      cometAt(g, k, Math.max(c.start, vh - TRAIL_LAG), cl);
      const ra = (cm.a * Math.PI) / 180;
      const ux = Math.cos(ra);
      const uy = Math.sin(ra);
      const half = (g.chipLen[k] * sx) / 2;
      const tx = cm.x - ux * half;
      const ty = cm.y - uy * half;
      const dx = tx - cl.x;
      const dy = ty - cl.y;
      const L = Math.hypot(dx, dy) * trailK;
      if (L > 0.75 && dx * ux + dy * uy > 0 && cm.o > 0.01) {
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        put(
          trail,
          "transform",
          `translate(${f2(tx)}px, ${f2(ty)}px) rotate(${f2(ang)}deg) translate(${f2(-L)}px, -50%) scale(${f3(L / TRAIL_BASE)}, 1)`,
        );
        show(trail, cm.o * 0.55);
      } else hide(trail);
    }

    /* the instrument line: born from the ticks → eats the tarja → turns into the ruler */
    if (vh < T.lineBorn[0] || vh >= T.turn[1]) {
      hide(scan);
    } else {
      const x0 = s.tarja3.x;
      const cy = s.tarja3.y + s.tarja3.h / 2;
      let x = x0;
      let y = cy;
      let rot = 0;
      let sx = 1;
      let sy = 1;
      let glow = 1;
      if (vh < T.sweep[0]) {
        sy = lerp(0.07, 1, E.flow(progress(T.lineBorn[0], T.lineBorn[1], vh)));
      } else if (vh < T.turn[0]) {
        x = scanX(s, vh);
      } else {
        // QA C3D-SCAN-SLASH: rotating about its centre while travelling cut
        // diagonally through "mi" (a strike-through over the number just
        // revealed). It now falls straight down at the tarja's right edge
        // first (power2.out, §8.1 arc), clear of the glyphs, THEN lies down
        // and travels under the number — same 1408 start, same pixel-exact
        // 1430 handoff to the ruler track.
        const drop = progress(T.turnDrop[0], T.turnDrop[1], vh);
        const dy = 1 - (1 - drop) * (1 - drop);
        const b = E.flow(progress(T.turnLie[0], T.turnLie[1], vh));
        x = lerp(x0 + s.tarja3.w, s.bar.x + s.bar.w / 2, b);
        y = lerp(cy, s.bar.y + s.bar.h / 2, dy);
        rot = 90 * b;
        sx = lerp(1, 0.75, b); // 2 px → the track's 1.5 px
        glow = 1 - progress(T.glowOut[0], T.glowOut[1], vh);
      }
      put(scan, "transform", xf(x, y, rot, sx, sy));
      put(scanGlow, "opacity", f3(glow));
      show(scan, 1);
    }
    // the ruler takes over at the scan's exact length, then opens from the centre
    if (vh < T.ruler[0]) {
      hide(track);
    } else {
      const k = E.flow(progress(T.ruler[0], T.ruler[1], vh));
      const from = s.bar.w > 0 ? Math.min(1, g.scanLen / s.bar.w) : 1;
      put(track, "transform", `scaleX(${f3(lerp(from, 1, k))})`);
      show(track, 1);
    }
    const ek = 1 - E.flow(progress(T.ends[0], T.ends[1], vh));
    put(endMin, "transform", ek > 0 ? `translateX(${f2(s.endMinDx * ek)}px)` : "none");
    put(endMax, "transform", ek > 0 ? `translateX(${f2(s.endMaxDx * ek)}px)` : "none");

    // label: "Faturamento anual" stays centred until "estimado" pours in beside it
    const lk = 1 - E.flow(progress(T.est[0], T.est[1], vh));
    put(label, "transform", lk > 0 ? `translateX(${f2(s.estShift * lk)}px)` : "none");

    /* the amount: present under the tarja from the moment it covers it;
       C3c: it sharpens BEHIND the scan (a feathered front tracks the scan x,
       `--scan-x`) and settles its scale; C4a: it flies to the pinned label */
    const A = s.amount;
    if (vh < T.tarjaGrow[1] || vh >= T.collapse[1]) {
      hide(amount);
    } else if (vh < T.collapse[0]) {
      const k = E.flow(progress(T.focus[0], T.focus[1], vh));
      const sc = lerp(1.03, 1, k);
      put(amount, "transform", sc !== 1 ? `translate(${f2(((1 - sc) * A.w) / 2)}px, ${f2(((1 - sc) * A.h) / 2)}px) scale(${f3(sc)})` : "none");
      const isFocus = vh < T.focus[1];
      if (isFocus !== focusing) {
        focusing = isFocus;
        amount.classList.toggle("is-focus", isFocus);
      }
      if (isFocus) {
        // front e (amount-local px): F behind the scan before 1290, F ahead of it at 1385
        const F = Math.max(12, FOCUS_FEATHER * A.w);
        const local = (scanX(s, vh) - (A.x + ((1 - sc) * A.w) / 2)) / sc;
        putVar(amount, "--scan-x", `${q05(local + F * (2 * k - 1))}px`);
        putVar(amount, "--scan-f", `${q05(F)}px`);
      }
      show(amount, 1);
    } else {
      const a = anchorOr(s);
      const t = E.flow(progress(T.collapse[0], T.collapse[1], vh));
      const sc = Math.pow(PIN_FONT / s.fontPx, t);
      // beside the collapsing card while it is wider than the disc, then beside the disc
      const cb = cardBoxAt(vh);
      const pin = pinAt(s, a, cb.box.x + cb.box.w - a.x);
      const lx = lerp(A.x, pin.x, t);
      const ly = lerp(A.y + A.h / 2, pin.y, t);
      put(amount, "transform", `translate(${f2(lx - A.x)}px, ${f2(ly - (sc * A.h) / 2 - A.y)}px) scale(${f3(sc)})`);
      show(amount, 1);
    }

    /* pinned "R$ 24,3 mi" (pill): tracks the lit point every frame (breath included) */
    if (vh < T.collapse[1] || vh >= T.pinnedOut[1]) {
      hide(pinned);
    } else {
      const a = field.getAnchorScreen();
      if (!a || !a.visible) {
        hide(pinned);
      } else {
        const pin = pinAt(s, a);
        put(pinned, "transform", `translate(${f2(pin.x)}px, ${f2(pin.y - PIN_FONT / 2)}px)`);
        put(pinnedBg, "opacity", f3(E.flow(progress(T.pinBg[0], T.pinBg[1], vh))));
        show(pinned, 1 - E.evap(progress(T.pinnedOut[0], T.pinnedOut[1], vh)));
      }
    }
  };

  ctx.frame.add(FrameOrder.Dossier, (vh) => render(vh));

  // dev: the per-frame writer owns these (element, property) pairs
  if (ctx.flags.DEV_ASSERT) {
    claim("DOSSIER", [paper, rim, goldRim, shade, tarja, charge, scan, track, amount, pinned, ...ticks, ...chips, ...trails, ...sparks], [
      "transform",
      "opacity",
      "visibility",
      "clipPath",
    ]);
    claim("DOSSIER", [tarjaMove, label, endMin, endMax], ["transform"]);
    claim("DOSSIER", [scanGlow, pinnedBg], ["opacity"]);
    claim("DOSSIER", ticks, ["backgroundColor"]);
    claim("DOSSIER", [shade], ["borderRadius"]);
    claim("DOSSIER", [amount], ["--scan-x", "--scan-f"]);
    // §7 G1: the root's on/off steps happen while every child is at 0
    const content0 = Math.min(T.paperIn[0], T.desc[0], T.eyebrowIn[0]);
    const contentEnd = Math.max(EXITS.eyebrowPill[1], T.pinnedOut[1], T.paperOut[1]);
    if (content0 < T.rootIn || contentEnd > T.rootOut) {
      console.warn("[cinema/dossier] the stage root steps while content is visible", { content0, contentEnd });
    }
    // §11 item 11: the C2 close is gone before the card grows
    if (T.c2PanelOut[1] > T.cardGrow[0]) console.warn("[cinema/dossier] the C2 close panel outlives the card grow start");
  }

  /* ── settle: deterministic start / end states (§11.3, §11.5) ─── */
  ctx.settle.register(
    "dossier",
    {
      start() {
        render(0);
        gsap.set(root, { autoAlpha: 0 });
      },
      end() {
        render(MASTER_END);
        gsap.set(root, { autoAlpha: 0 });
      },
    },
    ".cx-dos-stage, .cx-dos-static",
  );

  ctx.onDestroy(() => {
    root.classList.remove("is-swarm");
    amount.classList.remove("is-focus");
    cache.clear();
    vars.clear();
  });
}
