/* ============================================================
   cinema/dossier/dossier.timeline.ts — WP-DOSSIER entry build.

   J6 (card build parts) · C2a convergence · C2b cerco · C3a metamorfose
   · C3b fusão · C3c varredura · C3d faixa + selo · C3e desfecho · C4a
   collapse into the lit disc + the pinned "R$ 24,3 mi" · C4d exits.

   Two writers, never on the same (element, property):
   1. the MASTER (ctx.tl, time unit = vh): fixed-value tweens — masks,
      fades, the eyebrow reel, hairlines, clips in % (est, scale, note),
      the closes (function-based y, re-evaluated on refresh);
   2. ONE per-frame writer (FrameOrder.Dossier): everything that depends
      on measured geometry or on the GL anchor — the paper clip (J6 build,
      C3a growth, C4a collapse), tarja clip + thunk, tick dial, chips,
      sparks, orbit, charge line, scan line → ruler, label shift, range
      ends, the amount (focus scale, pin flight) and the pinned label.
      It is a pure function of master vh (+ the anchor): exact reversal,
      no state, writes only on change.
   Acts (time-based, reversible): `needle` @1450, `seal` @1475.

   Geometry: the card is laid out ONCE at its final Ch3 size; every
   earlier/later state is a clip of viewport-sized paper layers. Rects
   are measured on refresh from untransformed wrappers (one DOM snapshot
   per measure pass, shared by every registered key and the writer).
   ============================================================ */

import gsap from "gsap";
import { ACTS_AT, MASTER_END, PACE, RIPPLES } from "../beats";
import {
  CARD_BUILD,
  bezierQControl,
  cardBuildBox,
  circleRect,
  clamp01,
  fromDOMRect,
  inflateRect,
  lerp,
  lerpRect,
  progress,
  roundDevice,
  sineInOut,
  smoothstep,
  viewportInset,
  type Pt,
} from "../geometry";
import { maskRise } from "../MaskWords";
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
  rrectAround,
  stadiumAround,
  swarmVmax,
  tangentAngleDeg,
  tri,
  type ConvergePlan,
  type Flight,
  type PathPt,
  type RRect,
} from "./chips";

const P = (v: number): number => v * PACE;
type W = readonly [number, number];
const w = (a: number, b: number): W => [P(a), P(b)] as const;
const len = (x: W): number => x[1] - x[0];

/* ── every DOSSIER window, in base vh (§5) ─────────────────────── */
const T = {
  rootIn: P(790),
  rootOut: P(1852),
  // J6
  paperIn: w(802, 846),
  shadeIn: w(836, 850),
  swap: P(850),
  hatch: w(850, 860),
  desc: w(840, 862),
  rule: w(848, 860),
  slots: P(860),
  label: w(852, 866),
  eyebrowIn: w(852, 862),
  reelIn: w(854, 866),
  caption: w(856, 870),
  // C2b
  halo: w(1110, 1125),
  revIn: w(1118, 1132),
  c2In: w(1124, 1134),
  c2Lead: w(1126, 1142),
  c2Sub: w(1138, 1150),
  // C3a
  c2Drop: w(1168, 1200),
  captionOut: w(1170, 1182),
  reel1: w(1172, 1188),
  revOut: w(1172, 1184),
  haloOut: w(1186, 1196),
  cardGrow: w(1186, 1226),
  tarjaGrow: w(1190, 1228),
  est: w(1200, 1216),
  // C3b / C3c
  lineBorn: w(1250, 1268),
  sweep: w(1272, 1382),
  focus: w(1290, 1385),
  // C3d / C3e
  turn: w(1408, 1430),
  glowOut: w(1424, 1430),
  ruler: w(1430, 1452),
  scale: w(1440, 1460),
  ends: w(1440, 1468),
  endsWords: w(1442, 1466),
  c3In: w(1490, 1520),
  c3Lead: w(1500, 1530),
  c3Sub: w(1526, 1546),
  // C4a
  c3Drop: w(1568, 1590),
  reel2: w(1572, 1588),
  dimSeal: w(1575, 1581),
  dimRange: w(1579, 1585),
  dimLabel: w(1583, 1589),
  dimHead: w(1587, 1593),
  collapse: w(1605, 1640),
  shadeOut: w(1605, 1615),
  goldRim: w(1615, 1630),
  pinBg: w(1640, 1652),
  // C4d
  pinnedOut: w(1800, 1812),
  eyebrowOut: w(1835, 1850),
  swarm: w(895, 1200),
} as const;

/** The pinned label's font size: the amount swaps to it at a matched size (§5 C4a). */
const PIN_FONT = 15;
const DEPTH_OPACITY = [0.9, 0.7, 0.5] as const;
const TAN: readonly [number, number, number] = [139, 106, 61];
const GOLD: readonly [number, number, number] = [207, 155, 30];

/* ── tiny style writer: only on change (no layout reads per frame) ── */
type Prop = "transform" | "opacity" | "visibility" | "clipPath" | "backgroundColor";
const f2 = (v: number): string => (Math.round(v * 100) / 100).toString();
const f3 = (v: number): string => (Math.round(v * 1000) / 1000).toString();

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
  const trails = chips.map((c) => c.querySelector<HTMLElement>(".cx-dos__trail")!);
  const scan = one(".cx-dos__scan");
  const scanGlow = one(".cx-dos__scan-glow");

  const eyebrow = one(".cx-dos__eyebrow");
  const strip = one(".cx-dos__strip");
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
  const labelMasks = all(".cx-dos__label > .cx-mw");
  const est = one(".cx-dos__est");
  const labelWords = labelMasks.filter((m) => m !== est).map((m) => m.firstElementChild as HTMLElement);

  const amountBox = one(".cx-dos__amountBox");
  const amount = one(".cx-dos__amount");
  const valueSharp = one(".cx-dos__value:not(.cx-dos__value--soft)");
  const valueSoft = one(".cx-dos__value--soft");
  const tarjaBox = one(".cx-dos__tarjaBox");
  const tarjaMove = one(".cx-dos__tarjaMove");
  const tarja = one(".cx-dos__tarja");
  const hatch = one(".cx-dos__tarja .cx-dos__hatch");
  const halo = one(".cx-dos__halo");
  const charge = one(".cx-dos__charge");

  const revnote = one(".cx-dos__revnote");
  const revnoteI = one(".cx-dos__revnote-i");
  const range = one(".cx-range");
  const endMin = one(".cx-range__end--min");
  const endMax = one(".cx-range__end--max");
  const bar = one(".cx-range__bar");
  const scaleEl = one(".cx-range__scale");
  const track = one(".cx-range__track");
  const mark = one(".cx-range__mark");

  const sealSlot = one(".cx-dos__sealSlot");
  const seal = one(".cx-dos__seal");
  const check = one<SVGPathElement>(".cx-dos__check");

  const c2 = one(".cx-dos__close--c2");
  const c3 = one(".cx-dos__close--c3");
  const pinned = one(".cx-dos__pinned");
  const pinnedBg = one(".cx-dos__pinned-bg");

  // mobile: 12 chips / ticks / sparks (never display:none for the swarm itself)
  for (let i = N; i < CHIPS_DESKTOP; i++) {
    for (const el of [sparks[i], ticks[i], chips[i]]) if (el) el.style.display = "none";
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

  const readDom = (): Snap => {
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
    const anual = labelMasks[1];
    const estShift = anual ? (est.offsetLeft + est.offsetWidth - (anual.offsetLeft + anual.offsetWidth)) / 2 : 0;
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
    const ring2 = rrectAround(s.tarja2, 10, 8);
    const ring3 = rrectAround(s.tarja3, 10, 10);
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

    // measure-time static styles (never per frame)
    shade.style.width = s.card3.w + "px";
    shade.style.height = s.card3.h + "px";
    scan.style.height = scanLen + "px";
    const lx = s.tarja2.x - s.tarja3.x;
    const ly = s.tarja2.y - s.tarja3.y;
    for (const el of [halo, charge]) {
      el.style.left = lx + "px";
      el.style.top = ly + "px";
      el.style.width = s.tarja2.w + "px";
    }
    halo.style.height = s.tarja2.h + "px";
    sparks.forEach((el, i) => {
      if (i >= N) return;
      el.style.transform = `translate(${f2(src[i].x - 1.5)}px, ${f2(src[i].y - 1.5)}px)`;
    });
    return { ver: s.ver, ring2, ring3, orbit, tick2, tick3, ang2, ang3, conv, col, src, ctrl, dst, vmax, orbitSpeed, scanLen };
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
      // J6: the paper follows the brackets (cardBuildBox), 8 px outside them —
      // the brackets end as the card's registration corners (old .ch2 corners)
      const b = vh < CARD_BUILD.from * PACE ? viewportInset(CARD_BUILD.viewportInset) : cardBuildBox(vh, s.card2);
      return { box: inflateRect(b, CARD_BUILD.endInset), radius: 0, phase: "build" };
    }
    if (vh < T.cardGrow[0]) return { box: s.card2, radius: 0, phase: "card" };
    if (vh < T.cardGrow[1]) {
      return { box: lerpRect(s.card2, s.card3, sineInOut(progress(T.cardGrow[0], T.cardGrow[1], vh))), radius: 0, phase: "card" };
    }
    if (vh < T.collapse[0]) return { box: s.card3, radius: 0, phase: "card" };
    const a = anchorOr(s);
    if (vh >= T.collapse[1]) return { box: circleRect(a.x, a.y, a.r), radius: a.r, phase: "disc" };
    // C4a: the card narrows into a pill, then scales with the disc so that at
    // 1640 it IS the projected disc (anchor ± r, radius r) — never grows
    const t = sineInOut(progress(T.collapse[0], T.collapse[1], vh));
    const W = s.card3.w;
    const H = s.card3.h;
    const short = Math.min(W, H);
    const sDisc = Math.min(1, a.r / (short / 2));
    const sc = lerp(1, sDisc, clamp01(t / 0.25)); // guards a pop if the disc is already small at 1605
    const cx = lerp(s.card3.x + W / 2, a.x, t);
    const cy = lerp(s.card3.y + H / 2, a.y, t);
    const bw = lerp(sc * W, sc * short, t);
    const bh = lerp(sc * H, sc * short, t);
    return { box: { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh }, radius: (t * Math.min(bw, bh)) / 2, phase: "collapse" };
  };

  // dos.liveBox — the current paper box (RIG: card ride, C4a ring)
  ctx.live.provide<() => Rect>(LIVE_KEYS.dosLiveBox, () => {
    const b = cardBoxAt(ctx.vh());
    return { x: b.box.x, y: b.box.y, w: b.box.w, h: b.box.h };
  });

  /* ── pre-states (motion only; CSS default = the readable final state) ── */
  gsap.set(eyebrow, { autoAlpha: 0, y: 12 });
  gsap.set(strip, { yPercent: 100 / 3 });
  gsap.set(hairs, { scaleX: 0 });
  gsap.set(capI, { yPercent: 105, opacity: 0 });
  gsap.set([slotEyebrow, slotCnpj], { opacity: 0 });
  gsap.set(rule, { scaleX: 0 });
  gsap.set(est, { clipPath: "inset(0% 100% 0% 0%)" });
  gsap.set(hatch, { opacity: 0 });
  gsap.set(revnoteI, { clipPath: "inset(0% 100% 0% 0%)", yPercent: 0, opacity: 1 });
  gsap.set(c2, { autoAlpha: 0 });
  gsap.set(c3, { autoAlpha: 0 });
  gsap.set(scaleEl, { clipPath: "inset(0% 50% 0% 50%)" });
  gsap.set(valueSharp, { opacity: 0 });
  gsap.set(valueSoft, { opacity: 1 });
  gsap.set(mark, { xPercent: -50, yPercent: -50, rotation: 45 });

  /* ── the master (fixed-value tweens; time unit = vh) ─────────── */
  tl.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, T.rootIn);
  tl.to(root, { autoAlpha: 0, duration: 0.01 }, T.rootOut);

  // J6 — the card's contents arrive as the paper settles
  maskRise(tl, desc, T.desc[0], T.desc[1], { stagger: P(1) });
  tl.to(rule, { scaleX: 1, duration: len(T.rule), ease: "sine.inOut" }, T.rule[0]);
  tl.to(hatch, { opacity: 1, duration: len(T.hatch) }, T.hatch[0]);
  tl.to([slotEyebrow, slotCnpj], { opacity: 1, duration: 0.01 }, T.slots); // = RIG tag → 0, same frame
  maskRise(tl, labelWords, T.label[0], T.label[1], { stagger: P(1) });
  tl.to(eyebrow, { autoAlpha: 1, y: 0, duration: len(T.eyebrowIn), ease: "sine.out" }, T.eyebrowIn[0]);
  tl.to(strip, { yPercent: 0, duration: len(T.reelIn), ease: "sine.inOut" }, T.reelIn[0]);
  tl.to(hairs, { scaleX: 1, duration: len(T.caption), ease: "sine.inOut" }, T.caption[0]);
  tl.to(capI, { yPercent: 0, opacity: 1, duration: len(T.caption), ease: "sine.out" }, T.caption[0]);

  // C2b — the halo, the note, the close
  tl.to(halo, { opacity: 1, duration: len(T.halo) }, T.halo[0]);
  tl.to(revnoteI, { clipPath: "inset(0% 0% 0% 0%)", duration: len(T.revIn) }, T.revIn[0]);
  // the Ch2 close sits under the Ch2 card (the frame below it is still empty)
  const closeShift = (): number => {
    const s = cur();
    return s.card3.y + s.card3.h - (s.card2.y + s.card2.h);
  };
  tl.fromTo(
    c2,
    { autoAlpha: 0, y: () => 24 - closeShift() },
    { autoAlpha: 1, y: () => -closeShift(), duration: len(T.c2In), ease: "sine.out", immediateRender: false },
    T.c2In[0],
  );
  maskRise(tl, c2.querySelector(".cx-dos__close-lead")!, T.c2Lead[0], T.c2Lead[1], { stagger: P(1) });
  maskRise(tl, c2.querySelector(".cx-dos__close-sub")!, T.c2Sub[0], T.c2Sub[1], { stagger: P(1) });

  // C3a — camera parallax out (never a fade), caption retracts, the reel rolls
  tl.fromTo(
    c2,
    { y: () => -closeShift(), scale: 1 },
    {
      y: () => -closeShift() + window.innerHeight * 0.55,
      scale: 1.1,
      duration: len(T.c2Drop),
      ease: "sine.inOut",
      immediateRender: false,
    },
    T.c2Drop[0],
  );
  tl.to(c2, { autoAlpha: 0, duration: 0.01 }, T.c2Drop[1]);
  tl.to(hairs, { scaleX: 0, duration: len(T.captionOut), ease: "sine.inOut" }, T.captionOut[0]);
  tl.to(capI, { yPercent: -105, opacity: 0, duration: len(T.captionOut), ease: "sine.inOut" }, T.captionOut[0]);
  tl.to(strip, { yPercent: -100 / 3, duration: len(T.reel1), ease: "sine.inOut" }, T.reel1[0]);
  tl.to(revnoteI, { yPercent: -105, opacity: 0, duration: len(T.revOut), ease: "sine.inOut" }, T.revOut[0]);
  tl.to(halo, { opacity: 0, duration: len(T.haloOut) }, T.haloOut[0]);
  tl.to(est, { clipPath: "inset(0% 0% 0% 0%)", duration: len(T.est), ease: "sine.inOut" }, T.est[0]);

  // C3c — the focus pull (sharp/soft crossfade on the same glyphs; no filter)
  tl.to(valueSharp, { opacity: 1, duration: len(T.focus) }, T.focus[0]);
  tl.to(valueSoft, { opacity: 0, duration: len(T.focus) }, T.focus[0]);

  // C3d — the ruler's micro-scale and its ends
  tl.to(scaleEl, { clipPath: "inset(0% 0% 0% 0%)", duration: len(T.scale), ease: "sine.inOut" }, T.scale[0]);
  maskRise(tl, endMin, T.endsWords[0], T.endsWords[1], { stagger: P(2) });
  maskRise(tl, endMax, T.endsWords[0], T.endsWords[1], { stagger: P(2) });

  // C3e — the close enters from below (inverse parallax)
  tl.to(c3, { autoAlpha: 1, duration: 0.01 }, T.c3In[0]);
  tl.fromTo(
    c3,
    { y: () => window.innerHeight * 0.4 },
    { y: 0, duration: len(T.c3In), ease: "sine.inOut", immediateRender: false },
    T.c3In[0],
  );
  maskRise(tl, c3.querySelector(".cx-dos__close-lead")!, T.c3Lead[0], T.c3Lead[1], { stagger: P(1) });
  maskRise(tl, c3.querySelector(".cx-dos__close-sub")!, T.c3Sub[0], T.c3Sub[1], { stagger: P(1) });

  // C4a — the close drops away, the reel rolls to "O universo", the card empties
  tl.fromTo(
    c3,
    { y: 0 },
    { y: () => window.innerHeight * 0.45, duration: len(T.c3Drop), ease: "sine.inOut", immediateRender: false },
    T.c3Drop[0],
  );
  tl.to(c3, { autoAlpha: 0, duration: 0.01 }, T.c3Drop[1]);
  tl.to(strip, { yPercent: -200 / 3, duration: len(T.reel2), ease: "sine.inOut" }, T.reel2[0]);
  tl.to(sealSlot, { opacity: 0, duration: len(T.dimSeal) }, T.dimSeal[0]);
  tl.to(range, { opacity: 0, duration: len(T.dimRange) }, T.dimRange[0]);
  tl.to(labelRow, { opacity: 0, duration: len(T.dimLabel) }, T.dimLabel[0]);
  tl.to([head, rule], { opacity: 0, duration: len(T.dimHead) }, T.dimHead[0]);

  // C4d — the eyebrow exits upward
  tl.to(eyebrow, { y: -12, autoAlpha: 0, duration: len(T.eyebrowOut), ease: "sine.inOut" }, T.eyebrowOut[0]);

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
  const insetClip = (s: Snap, b: Rect, radius: number): string => {
    const t = b.y;
    const l = b.x;
    const r = s.vw - (b.x + b.w);
    const btm = s.vhPx - (b.y + b.h);
    return `inset(${f2(t)}px ${f2(r)}px ${f2(btm)}px ${f2(l)}px${radius > 0.05 ? ` round ${f2(radius)}px` : ""})`;
  };
  const loop = (b: Rect): string =>
    `${f2(b.x)}px ${f2(b.y)}px, ${f2(b.x + b.w)}px ${f2(b.y)}px, ${f2(b.x + b.w)}px ${f2(b.y + b.h)}px, ${f2(b.x)}px ${f2(b.y + b.h)}px, ${f2(b.x)}px ${f2(b.y)}px`;
  const holePoly = (outer: Rect, hole: Rect): string => `polygon(evenodd, ${loop(outer)}, ${loop(hole)})`;
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

  const scanX = (s: Snap, vh: number): number => s.tarja3.x + s.tarja3.w * progress(T.sweep[0], T.sweep[1], vh);

  const tickPos = (g: Geo, i: number, vh: number, out: { x: number; y: number; a: number }) => {
    const k = vh < T.tarjaGrow[0] ? 0 : sineInOut(progress(T.tarjaGrow[0], T.tarjaGrow[1], vh));
    const a = g.tick2[i];
    const b = g.tick3[i];
    out.x = lerp(a.x, b.x, k);
    out.y = lerp(a.y, b.y, k);
    out.a = lerpAngle(g.ang2[i], g.ang3[i], k);
    return out;
  };
  const tp = { x: 0, y: 0, a: 0 };

  /** Where the pinned label's left-centre sits: (anchor.x + r + 12, anchor.y − 8), kept on screen. */
  const pinAt = (s: Snap, a: AnchorScreen, reach = a.r): Pt => ({
    x: Math.max(12, Math.min(a.x + Math.max(a.r, reach) + 12, s.vw - 12 - s.pinW)),
    y: Math.max(20, Math.min(a.y - 8, s.vhPx - 20)),
  });

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
    const live = vh >= CARD_BUILD.from * PACE && vh < T.collapse[1];
    if (!live) {
      hide(paper);
      hide(rim);
      hide(goldRim);
      hide(shade);
    } else {
      const cb = cardBoxAt(vh);
      const box = snapBox(cb.box);
      const building = cb.phase === "build";
      const o = building ? smoothstep(T.paperIn[0], T.paperIn[1], vh) : 1;
      if (building) {
        // the tarja slot stays open until the swap: CH1's bars (z 4) fuse there
        put(paper, "clipPath", holePoly(box, s.tarja2));
        put(rim, "clipPath", `polygon(evenodd, ${loop(inflateRect(box, 1))}, ${loop(box)})`);
      } else {
        put(paper, "clipPath", insetClip(s, box, cb.radius));
        put(rim, "clipPath", insetClip(s, inflateRect(box, 1), cb.radius > 0.05 ? cb.radius + 1 : 0));
      }
      show(paper, o);
      show(rim, o);
      const gr = cb.phase === "collapse" ? progress(T.goldRim[0], T.goldRim[1], vh) : 0;
      if (gr > 0) {
        put(goldRim, "clipPath", insetClip(s, inflateRect(box, 1), cb.radius > 0.05 ? cb.radius + 1 : 0));
        show(goldRim, gr);
      } else hide(goldRim);
      const so =
        o *
        (building ? smoothstep(T.shadeIn[0], T.shadeIn[1], vh) : 1) *
        (1 - progress(T.shadeOut[0], T.shadeOut[1], vh));
      if (so > 0.002) {
        put(shade, "transform", xf(box.x, box.y, 0, box.w / s.card3.w, box.h / s.card3.h, false));
        show(shade, so);
      } else hide(shade);
    }

    /* tarja: the Ch2 sub-rect → full box (clip only, the hatch never stretches) → eaten */
    if (vh < T.swap || vh >= T.sweep[1]) {
      hide(tarja);
    } else {
      const fx = s.tarja3.x;
      const fy = s.tarja3.y;
      let L = s.tarja2.x - fx;
      let Tp = s.tarja2.y - fy;
      let R = fx + s.tarja3.w - (s.tarja2.x + s.tarja2.w);
      let B = fy + s.tarja3.h - (s.tarja2.y + s.tarja2.h);
      if (vh >= T.tarjaGrow[0]) {
        const k = 1 - sineInOut(progress(T.tarjaGrow[0], T.tarjaGrow[1], vh));
        L *= k;
        Tp *= k;
        R *= k;
        B *= k;
      }
      if (vh >= T.sweep[0]) L = Math.max(L, scanX(s, vh) - fx);
      put(tarja, "clipPath", `inset(${f2(Tp)}px ${f2(R)}px ${f2(B)}px ${f2(L)}px)`);
      show(tarja, 1);
    }
    // thunk: a 1 px triangular bump per impact (C2a)
    let thunk = 0;
    if (vh >= DIAL.waveStarts[0] && vh < T.swarm[1]) for (const e of S.impacts) thunk += tri(e, e + DIAL.litLen, vh);
    put(tarjaMove, "transform", thunk > 0 ? `translateY(${f2(thunk)}px)` : "none");

    // charge line: impacts + landings so far / N (18/26 in Ch2, 26/26 as the orbiters land)
    let count = 0;
    if (vh >= DIAL.waveStarts[0]) for (let i = 0; i < N; i++) count += progress(S.lit[i][0], S.lit[i][1], vh);
    const chargeO = 1 - progress(T.haloOut[0], T.haloOut[1], vh);
    if (count > 0.001 && chargeO > 0.002) {
      put(charge, "transform", `scaleX(${f3(count / N)})`);
      show(charge, chargeO);
    } else hide(charge);

    /* tick dial */
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
        const c = sineInOut(progress(cw[0], cw[1], vh));
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

    /* chips + sparks */
    for (let k = 0; k < N; k++) {
      const c = S.chips[k];
      const el = chips[k];
      const spark = sparks[k];
      const so = tri(c.start, c.start + DIAL.flight * DIAL.sparkFrac, vh);
      if (so > 0.002) show(spark, so);
      else hide(spark);
      if (vh < c.start || (c.land ? vh >= c.land[1] : vh >= c.end)) {
        hide(el);
        continue;
      }
      const depthO = DEPTH_OPACITY[c.depth];
      let x: number;
      let y: number;
      let a: number;
      let sx = 1;
      let sc = 1;
      let o = depthO;
      let speed = 0;
      if (vh < c.end) {
        const t = progress(c.start, c.end, vh);
        flight(g.src[k], g.ctrl[k], g.dst[k], t, g.vmax, fl);
        x = fl.x;
        y = fl.y;
        a = fl.angle;
        speed = fl.speed;
        sx = 1 + 0.8 * Math.sin(Math.PI * t);
        o *= progress(0, 0.1, t);
        if (!c.land) {
          const hit = progress(1 - DIAL.impactFrac, 1, t);
          sc = lerp(1, 0.6, hit);
          o *= 1 - hit;
        }
      } else {
        // orbiter: on the stadium around the tarja ("o cercam"), then lands on its tick
        const u = orbitU(c.slot, S.nOrb, vh);
        rrPoint(g.orbit, u, op);
        x = op.x;
        y = op.y;
        a = tangentAngleDeg(op.tx, op.ty);
        const moving = vh < DIAL.orbitPause[0] || vh >= DIAL.orbitPause[1];
        speed = moving ? g.orbitSpeed : 0;
        if (c.land && vh >= c.land[0]) {
          const b = progress(c.land[0], c.land[1], vh);
          const e = sineInOut(b);
          tickPos(g, c.tick, vh, tp);
          x = lerp(x, tp.x, e);
          y = lerp(y, tp.y, e);
          const hit = progress(0.55, 1, b);
          sc = lerp(1, 0.6, hit);
          o *= 1 - hit;
        }
      }
      put(el, "transform", xf(x, y, a, sx * sc, sc));
      if (!mobile) put(trails[k], "transform", `scaleX(${f3(Math.min(3, 1 + 2 * speed))})`);
      show(el, o);
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
        sy = lerp(0.07, 1, sineInOut(progress(T.lineBorn[0], T.lineBorn[1], vh)));
      } else if (vh < T.turn[0]) {
        x = scanX(s, vh);
      } else {
        const b = sineInOut(progress(T.turn[0], T.turn[1], vh));
        x = lerp(x0 + s.tarja3.w, s.bar.x + s.bar.w / 2, b);
        y = lerp(cy, s.bar.y + s.bar.h / 2, b);
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
      const k = sineInOut(progress(T.ruler[0], T.ruler[1], vh));
      const from = s.bar.w > 0 ? Math.min(1, g.scanLen / s.bar.w) : 1;
      put(track, "transform", `scaleX(${f3(lerp(from, 1, k))})`);
      show(track, 1);
    }
    const ek = 1 - sineInOut(progress(T.ends[0], T.ends[1], vh));
    put(endMin, "transform", ek > 0 ? `translateX(${f2(s.endMinDx * ek)}px)` : "none");
    put(endMax, "transform", ek > 0 ? `translateX(${f2(s.endMaxDx * ek)}px)` : "none");

    // label: "Faturamento anual" stays centred while "estimado" is clipped
    const lk = 1 - sineInOut(progress(T.est[0], T.est[1], vh));
    put(label, "transform", lk > 0 ? `translateX(${f2(s.estShift * lk)}px)` : "none");

    /* the amount: present under the tarja from the moment it covers it;
       focus scale in C3c; in C4a it flies out and swaps to the pinned label */
    const A = s.amount;
    if (vh < T.tarjaGrow[1] || vh >= T.collapse[1]) {
      hide(amount);
    } else if (vh < T.collapse[0]) {
      const sc = lerp(1.03, 1, progress(T.focus[0], T.focus[1], vh));
      put(amount, "transform", sc !== 1 ? `translate(${f2(((1 - sc) * A.w) / 2)}px, ${f2(((1 - sc) * A.h) / 2)}px) scale(${f3(sc)})` : "none");
      show(amount, 1);
    } else {
      const a = anchorOr(s);
      const t = sineInOut(progress(T.collapse[0], T.collapse[1], vh));
      const sc = Math.pow(PIN_FONT / s.fontPx, t);
      // beside the collapsing card while it is wider than the disc, then beside the disc
      const cb = cardBoxAt(vh);
      const pin = pinAt(s, a, cb.box.x + cb.box.w - a.x);
      const lx = lerp(A.x, pin.x, t);
      const ly = lerp(A.y + A.h / 2, pin.y, t);
      put(amount, "transform", `translate(${f2(lx - A.x)}px, ${f2(ly - (sc * A.h) / 2 - A.y)}px) scale(${f3(sc)})`);
      show(amount, 1);
    }

    /* pinned "R$ 24,3 mi": tracks the lit point every frame (breath included) */
    if (vh < T.collapse[1] || vh >= T.pinnedOut[1]) {
      hide(pinned);
    } else {
      const a = field.getAnchorScreen();
      if (!a || !a.visible) {
        hide(pinned);
      } else {
        const pin = pinAt(s, a);
        put(pinned, "transform", `translate(${f2(pin.x)}px, ${f2(pin.y - PIN_FONT / 2)}px)`);
        put(pinnedBg, "opacity", f3(progress(T.pinBg[0], T.pinBg[1], vh)));
        show(pinned, 1 - progress(T.pinnedOut[0], T.pinnedOut[1], vh));
      }
    }
  };

  ctx.frame.add(FrameOrder.Dossier, (vh) => render(vh));

  // dev: the per-frame writer owns these (element, property) pairs
  if (ctx.flags.DEV_ASSERT) {
    claim("DOSSIER", [paper, rim, goldRim, shade, tarja, charge, scan, track, amount, pinned, ...ticks, ...chips, ...sparks], [
      "transform",
      "opacity",
      "visibility",
      "clipPath",
    ]);
    claim("DOSSIER", [tarjaMove, label, endMin, endMax, ...trails], ["transform"]);
    claim("DOSSIER", [scanGlow, pinnedBg], ["opacity"]);
    claim("DOSSIER", ticks, ["backgroundColor"]);
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
    cache.clear();
  });
}
