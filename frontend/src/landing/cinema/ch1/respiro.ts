/* ============================================================
   cinema/ch1/respiro.ts — the respiro, J4–J6. Owner: WP6
   (spec rev 3.1 §1.4 items 1 and 7, §3 J4–J6, §5.3, §5.4, §7 C1).

   One frame writer (FrameOrder.Labels, after field.update in the same
   tick, so it reads THIS frame's field.score.dawn). Every value is a
   pure function of master vh (+ refresh-time rects), written only when
   it changes, so the sequence reverses exactly and idles at 0 writes.

   J4 480–657  PROTECTED. Word k keeps its v2 window [472 + 7.6k, +24],
               its word-level blur 6 → 0 and its word-level HOT → COOL
               colour (per glyph only behind FLAGS.RESPIRO_GLYPH_COOL,
               default off). What changes (§1.4 item 1): no mask line —
               the words CONDENSE in LIGHT: glyph j of word k over
               [a_k + j·6/(n_k − 1), + 18], y 0.32em → 0 (cx-ink-settle),
               opacity cx-ink-bloom(min(1, 1.4q)), through WP5's glyph
               cells (`ctx.glyphs.cells`). Without glyph cells (word mode,
               GLYPHS=0, CPU text tier, cells not measured yet) the same
               grammar runs per word. Em gold + the 18 px glow unchanged.
   J5 673–770  PROTECTED, unchanged: the ink twin is revealed by
               `circle(frontR at 50% 50%)` (the GL dawn front); a light
               word goes to 0 once the front has passed it.
   J6 770–872  The ink-twin words dolly (geometry unchanged) and, instead
               of the giant fading ghost, EVAPORATE glyph by glyph from the
               far edge over 778–800 (TEXT_V3.inkTwinEvap). The six em
               words are covered by INK CAPSULES (radius h/2): an ink drop
               lands on the word and smears across it (cx-flow), led by a
               5 px gold droplet; over 815 + 2i → 840 + 2i the capsules
               fly to the six slices of `dos.tarja@ch2` (x cx-flow, y
               power2.out), stretch along their speed (scaleX 1 +
               min(0.35, 0.02·|dx/dvh|), volume kept), squash to 0.94 as
               they land, and their inner ends flatten so the six read as
               ONE capsule. At rest they are translate-only, scale 1, and
               from the last landing (849.5) to the swap they are drawn as
               one capsule element with DOSSIER's tarja box and clip, so
               the 850 swap with the capsule tarja is pixel-identical.
               The capsule is rounded by ONE clip (`inset(0 round …)`, the
               tarja's own technique) from the drop to the landing, its
               radii compensated per axis under the flight's non-uniform
               scale (rx/sx / ry/sy — paint only, never a layout).
   ============================================================ */

import { FrameOrder, RECT_KEYS, type CinemaCtx, type GlyphCells, type Rect } from "../types";
import { PACE, TEXT_V3 } from "../beats";
import { FLAGS } from "../flags";
import { claim } from "../dev/assert";
import { RESPIRO_WORDS } from "../copy";
import { dawnFrontPx, lerp, power2Out, progress, roundDevice, sineInOut, smoothstep } from "../geometry";
import { eases, evapAt, lightAt, newState } from "./ink";

const P = (v: number): number => v * PACE;

/* ── sub-event windows (absolute master vh × PACE) ─────────────── */
export const RESPIRO_T = {
  /** layer visible (first light word starts at 472) → swap */
  on: P(468),
  /** J4 word k rises over [472 + 7.6k, 496 + 7.6k] (unchanged, §1.4) */
  rise: { start: P(472), step: P(7.6), len: P(24) },
  /** LIGHT inside a word: glyph j starts j·6/(n − 1) after the word and lasts 18 */
  light: { spread: P(6), glyph: P(18) },
  /** em glow fades in over 12 vh after its word has landed */
  glowIn: P(12),
  /** J6 white-word dolly (geometry unchanged) */
  dolly: { from: P(770), to: P(830) },
  /** J6 the dollying ink words evaporate (rtl), 8 vh per glyph */
  evap: { from: TEXT_V3.inkTwinEvap.from, to: TEXT_V3.inkTwinEvap.to, glyph: P(8) },
  /** J6 em redaction: capsule i over [775 + 5i, 783 + 5i] */
  sweep: { start: P(775), step: P(5), len: P(8) },
  /** J6 fusion: capsule i over [815 + 2i, 839.5 + 2i] (spec 840 + 2i: the last
   *  capsule lands 0.5 vh before the 850 swap, so it is at rest — translate
   *  only, the tarja's own clip — on both sides of the swap) */
  fuse: { start: P(815), step: P(2), len: P(24.5) },
  /** CH1 bars → DOSSIER `.cx-dos__tarja`, same frame, pixel-identical */
  swap: P(850),
} as const;

/* dolly: c = 0.15 → 0.40, s = (0.5 − 0.15)/(0.5 − c) */
const DOLLY_C0 = 0.15;
const DOLLY_C1 = 0.4;
const BLUR_MAX = 6;
/** EVAPORATE word blur (desktop), px */
const EVAP_BLUR = 3;
/** blur only on small words (words ≤ 220 px) */
const BLUR_MAX_W = 220;
/** the light copy hides once frontR > farthest corner + 12 px (the GL edge band) */
const FRONT_BAND = 12;
/** em glow (18 px) must be gone before the soft band touches the word */
const GLOW_PX = 18;
const GLOW_FADE = 40;
/** light colours: filament cooling gold-hot → paper */
const HOT = [0xe6, 0xb5, 0x4a] as const;
const COOL = [0xfb, 0xf9, 0xf4] as const;
/** redaction capsule over an em word, in em of the copy (Playfair, line-height 1.2) */
const BAR_Y = 0.22;
const BAR_H = 1.02;
/** the capsule overhangs the word box so its round ends still cover the glyphs */
const BAR_EXT = 0.16;
/** a capsule is never narrower than 1.1 × its height ("e", "—") */
const BAR_MIN_W = 1.1;
/** the drop lands over the first 22 % of the sweep, then smears across */
const DROP = 0.22;
/** flight: stretch along the speed, squash on landing, merge the inner ends */
const STRETCH = { k: 0.02, max: 0.35 } as const;
const SQUASH = { from: 0.78, depth: 0.06 } as const;
const MERGE: readonly [number, number] = [0.5, 1];
/** gold droplet nib (5 px, CSS) */
const NIB_R = 2.5;

/* GlyphCells.writeGlyph takes y in EM of the glyph (+ = down; WP5's
   contract), so the grammars are evaluated with em = 1 for glyph cells. */

/* ── write-on-change style cells ────────────────────────────────── */

interface Cell {
  el: HTMLElement;
  v: Record<string, string>;
}
const cell = (el: HTMLElement): Cell => ({ el, v: {} });
function put(c: Cell, prop: string, value: string): void {
  if (c.v[prop] === value) return;
  c.v[prop] = value;
  c.el.style.setProperty(prop, value);
}
/** Layers (whose CSS default is hidden): explicit visible / hidden. */
function show(c: Cell, on: boolean): void {
  put(c, "visibility", on ? "visible" : "hidden");
}
/** Descendants: never `visible` (that would pierce a hidden ancestor) — inherit / hidden. */
function showIn(c: Cell, on: boolean): void {
  put(c, "visibility", on ? "inherit" : "hidden");
}
function cls(c: Cell, name: string, on: boolean): void {
  const k = "." + name;
  const s = on ? "1" : "0";
  if (c.v[k] === s) return;
  c.v[k] = s;
  c.el.classList.toggle(name, on);
}
const f3 = (n: number): string => (Math.round(n * 1000) / 1000).toString();
const f2 = (n: number): string => (Math.round(n * 100) / 100).toString();
const q05 = (n: number): string => (Math.round(n * 20) / 20).toString();

interface Word {
  k: number;
  em: boolean;
  /** index among em words (0..5), −1 otherwise */
  e: number;
  /** index among non-em words (reading order), −1 for em words */
  ne: number;
  lightOuter: Cell;
  lightInner: Cell;
  inkInner: Cell;
}

interface Geo {
  words: Rect[];
  cx: number;
  cy: number;
  fs: number;
  far: number[];
  near: number[];
  narrow: boolean[];
  barFrom: Rect[];
  barTo: Rect[];
  /** DOSSIER's Ch2 tarja (dos.tarja@ch2), the six slices' union */
  tarja: Rect;
  tarjaOk: boolean;
}

export interface RespiroApi {
  /** Write the state for `vh` now (settle). */
  apply(vh: number): void;
}

export function buildRespiro(ctx: CinemaCtx): RespiroApi | null {
  const root = document.querySelector<HTMLElement>("body > .cx-respiro");
  const light = root?.querySelector<HTMLElement>(".cx-respiro--light") ?? null;
  const ink = root?.querySelector<HTMLElement>(".cx-respiro--ink") ?? null;
  const barsLayer = root?.querySelector<HTMLElement>(".cx-respiro__bars") ?? null;
  if (!root || !light || !ink || !barsLayer) {
    console.warn("[cinema/ch1] respiro DOM not found — J4–J6 disabled");
    return null;
  }
  const E = eases();
  const inkCopy = ink.querySelector<HTMLElement>(".cx-respiro__copy")!;
  const lightCopy = light.querySelector<HTMLElement>(".cx-respiro__copy")!;
  const lightWords = Array.from(light.querySelectorAll<HTMLElement>(".cx-respiro__w"));
  const inkWords = Array.from(ink.querySelectorAll<HTMLElement>(".cx-respiro__w"));
  const barEls = Array.from(barsLayer.querySelectorAll<HTMLElement>(".cx-respiro__bar"));
  const nibEls = Array.from(barsLayer.querySelectorAll<HTMLElement>(".cx-respiro__nib"));
  const tarjaEl = barsLayer.querySelector<HTMLElement>(".cx-respiro__tarja");
  const n = RESPIRO_WORDS.length;
  if (lightWords.length !== n || inkWords.length !== n) {
    console.warn("[cinema/ch1] respiro word count mismatch — J4–J6 disabled");
    return null;
  }

  let e = 0;
  let ne = 0;
  const words: Word[] = RESPIRO_WORDS.map((w, k) => ({
    k,
    em: !!w.em,
    e: w.em ? e++ : -1,
    ne: w.em ? -1 : ne++,
    lightOuter: cell(lightWords[k]),
    lightInner: cell(lightWords[k].querySelector<HTMLElement>(".cx-mw__i")!),
    inkInner: cell(inkWords[k].querySelector<HTMLElement>(".cx-mw__i")!),
  }));
  const emWords = words.filter((w) => w.em);
  const plainWords = words.filter((w) => !w.em);
  const bars = barEls.map(cell);
  const nibs = nibEls.map(cell);
  const rootC = cell(root);
  const lightC = cell(light);
  const inkC = cell(ink);
  const barsC = cell(barsLayer);
  const tarjaC = tarjaEl ? cell(tarjaEl) : null;

  if (FLAGS.DEV_ASSERT) {
    claim("CH1", root, ["opacity", "visibility"]);
    claim("CH1", light, ["visibility"]);
    claim("CH1", ink, ["visibility", "clipPath"]);
    claim("CH1", lightWords, ["opacity"]);
    claim("CH1", words.map((w) => w.lightInner.el), ["transform", "opacity", "filter", "color", "textShadow"]);
    claim("CH1", words.map((w) => w.inkInner.el), ["transform", "opacity", "filter", "visibility"]);
    claim("CH1", [...barEls, ...nibEls, ...(tarjaEl ? [tarjaEl] : [])], ["transform", "opacity", "visibility", "width", "height", "clipPath"]);
  }

  const desktop = !ctx.isMobile;
  const glyphCool = FLAGS.RESPIRO_GLYPH_COOL;

  /* ── glyph cells (WP5): re-acquired at refresh (glyph geometry is measured there) ── */
  let lightCells: GlyphCells | null = null;
  let inkCells: GlyphCells | null = null;
  const acquireCells = () => {
    try {
      lightCells = ctx.glyphs.cells(lightCopy);
      inkCells = ctx.glyphs.cells(inkCopy);
    } catch (err) {
      lightCells = inkCells = null;
      console.warn("[cinema/ch1] glyph cells unavailable — respiro in word mode", err);
    }
  };
  acquireCells();
  /** glyph elements of word k in `c`, or null (word mode for that word) */
  const glyphsOf = (c: GlyphCells | null, k: number): HTMLElement[] | null => {
    if (!c || ctx.glyphs.mode !== "glyph") return null;
    const w = c.words[k];
    return w && w.glyphs.length > 0 ? w.glyphs : null;
  };

  /* ── refresh-time measurement: `respiro.words` (inner text boxes) ── */
  let fontPx = 16;
  let centre = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const measureWords = (): Rect[] => {
    const fs = parseFloat(getComputedStyle(inkCopy).fontSize);
    if (fs > 0) fontPx = fs;
    const lb = ink.getBoundingClientRect();
    centre = { x: lb.left + lb.width / 2, y: lb.top + lb.height / 2 };
    acquireCells();
    // the outer `.cx-mw` is never transformed: its padding box minus padding = the text box
    return inkWords.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      return { x: r.left + pl, y: r.top + pt, w: Math.max(0, r.width - pl - pr), h: Math.max(0, r.height - pt - pb) };
    });
  };
  ctx.rects.registerList(RECT_KEYS.respiroWords, measureWords);

  /* ── derived geometry, recomputed only when an input changes ──── */
  let geo: Geo | null = null;
  let seenWords: Rect[] | null = null;
  let seenTarja: Rect | null = null;
  let seenTarjaSig = "";

  const derive = (list: Rect[], tarja: Rect): Geo => {
    const { x: cx, y: cy } = centre;
    const fs = fontPx;
    const far: number[] = [];
    const near: number[] = [];
    const narrow: boolean[] = [];
    for (const r of list) {
      const dx0 = r.x - cx;
      const dx1 = r.x + r.w - cx;
      const dy0 = r.y - cy;
      const dy1 = r.y + r.h - cy;
      far.push(Math.hypot(Math.max(Math.abs(dx0), Math.abs(dx1)), Math.max(Math.abs(dy0), Math.abs(dy1))));
      const nx = dx0 > 0 ? dx0 : dx1 < 0 ? -dx1 : 0;
      const ny = dy0 > 0 ? dy0 : dy1 < 0 ? -dy1 : 0;
      near.push(Math.hypot(nx, ny));
      narrow.push(r.w <= BLUR_MAX_W);
    }
    const barFrom: Rect[] = emWords.map((w) => {
      const r = list[w.k];
      const h = BAR_H * fs;
      const wNat = r.w + 2 * BAR_EXT * fs;
      const bw = Math.max(wNat, BAR_MIN_W * h);
      return { x: r.x + r.w / 2 - bw / 2, y: r.y + BAR_Y * fs, w: bw, h };
    });
    const tarjaOk = tarja.w > 1 && tarja.h > 1;
    const m = emWords.length;
    let barTo: Rect[];
    if (tarjaOk) {
      // the OUTER edges are DOSSIER's capsule tarja exactly (it clips
      // `dos.tarja@ch2` unrounded, `inset(… round h/2)`), so the 850 swap
      // is pixel-identical; the inner seams sit on device pixels and overlap
      // 1 px, so the six flat-ink slices read as one
      const edge = (j: number) => (j <= 0 ? tarja.x : j >= m ? tarja.x + tarja.w : roundDevice(tarja.x + (tarja.w * j) / m));
      barTo = emWords.map((_, i) => ({
        x: edge(i),
        y: tarja.y,
        w: edge(i + 1) - edge(i) + (i < m - 1 ? 1 : 0),
        h: tarja.h,
      }));
    } else {
      barTo = barFrom.map((r) => ({ ...r }));
    }
    // the bar's LAYOUT box is its landing slice: at 850 it is translate-only,
    // scale 1 — crisp and identical to the tarja
    bars.forEach((b, i) => {
      put(b, "width", f2(barTo[i].w) + "px");
      put(b, "height", f2(barTo[i].h) + "px");
    });
    if (tarjaC) {
      put(tarjaC, "width", f2(tarja.w) + "px");
      put(tarjaC, "height", f2(tarja.h) + "px");
    }
    return { words: list, cx, cy, fs, far, near, narrow, barFrom, barTo, tarja, tarjaOk };
  };

  const ensureGeo = (): Geo | null => {
    const list = ctx.rects.getList(RECT_KEYS.respiroWords);
    const tarja = ctx.rects.get(RECT_KEYS.dosTarjaCh2);
    const sig = `${tarja.x}|${tarja.y}|${tarja.w}|${tarja.h}`;
    if (list !== seenWords || tarja !== seenTarja || sig !== seenTarjaSig) {
      seenWords = list;
      seenTarja = tarja;
      seenTarjaSig = sig;
      geo = list.length === n ? derive(list, tarja) : null;
    }
    return geo;
  };

  const st = newState();
  const T = RESPIRO_T;
  const coolRgb = (c: number): number => {
    const ch = (i: number) => Math.round(lerp(HOT[i], COOL[i], c));
    return (ch(0) << 16) | (ch(1) << 8) | ch(2);
  };

  /* ── J4: words written in LIGHT ─────────────────────────────── */
  const writeLight = (g: Geo, vh: number, frontR: number, dawn: number) => {
    const on = dawn < 1;
    show(lightC, on);
    if (!on) return;
    for (const w of words) {
      const a = T.rise.start + T.rise.step * w.k;
      const b = a + T.rise.len;
      const p = progress(a, b, vh);
      const inner = w.lightInner;
      cls(inner, "is-live", p > 0 && p < 1);
      // the front has fully passed this word (+ the soft band): its light is gone
      const passed = frontR > g.far[w.k] + FRONT_BAND;
      put(w.lightOuter, "opacity", passed ? "0" : "1");
      if (passed) continue;

      const glyphs = glyphsOf(lightCells, w.k);
      if (glyphs && lightCells) {
        // glyph mode: the mover stays put; each glyph condenses (ltr)
        put(inner, "transform", "none");
        put(inner, "opacity", "1");
        lightCells.setWord(w.k, p);
        if (p > 0 && p < 1) {
          const nk = glyphs.length;
          for (let j = 0; j < nk; j++) {
            const s0 = a + (nk > 1 ? (j * T.light.spread) / (nk - 1) : 0);
            const qg = (vh - s0) / T.light.glyph;
            lightAt(E, qg, 1, st);
            const rgb = glyphCool && !w.em ? coolRgb(sineInOut(progress(0.15, 1, Math.max(0, Math.min(1, qg))))) : -1;
            lightCells.writeGlyph(w.k, j, st.y, st.op, 0, 0, rgb);
          }
        }
      } else {
        // word mode: the same LIGHT grammar on the whole word (no mask line)
        lightAt(E, p, g.fs, st);
        put(inner, "transform", p >= 1 ? "none" : `translate3d(0, ${q05(st.y)}px, 0)`);
        put(inner, "opacity", f3(st.op));
      }
      const blur = desktop && g.narrow[w.k] ? BLUR_MAX * (1 - Math.sin((Math.PI / 2) * progress(0, 0.85, p))) : 0;
      put(inner, "filter", blur > 0.05 ? `blur(${f2(blur)}px)` : "none");
      if (!w.em) {
        // per-word cooling (v2, unchanged); per glyph only behind RESPIRO_GLYPH_COOL
        if (!(glyphCool && glyphs)) {
          const c = sineInOut(progress(0.15, 1, p));
          const ch = (i: number) => Math.round(lerp(HOT[i], COOL[i], c));
          put(inner, "color", `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`);
        }
      } else {
        // the glow fades in once the word has landed, and fades out again
        // before the dawn front reaches the word
        const near = g.near[w.k] - FRONT_BAND - GLOW_PX;
        const gl = progress(b, b + T.glowIn, vh) * (1 - progress(near - GLOW_FADE, near, frontR));
        put(inner, "text-shadow", gl > 0.004 ? `0 0 18px rgba(207, 155, 30, ${f3(0.35 * gl)})` : "none");
      }
    }
  };

  /* ── J5 + J6: ink twin (dawn clip, dolly + EVAPORATE, em text under its capsule) ─ */
  const evSpan = T.evap.to - T.evap.from;
  const writeInk = (g: Geo, vh: number, frontR: number, dawn: number) => {
    const on = dawn > 0;
    // the clip is written first, whatever happens next (it is the twin's only mask)
    put(inkC, "clip-path", dawn >= 1 ? "none" : `circle(${on ? f2(frontR) : "0"}px at 50% 50%)`);
    show(inkC, on);
    if (!on) return;

    const u = progress(T.dolly.from, T.dolly.to, vh);
    const c = lerp(DOLLY_C0, DOLLY_C1, u);
    const s = (0.5 - DOLLY_C0) / (0.5 - c);

    // EVAPORATE order (rtl over the plain words): glyph totals for the stagger
    let total = 0;
    const counts: number[] = [];
    const glyphLists: Array<HTMLElement[] | null> = [];
    for (const w of plainWords) {
      const gl = glyphsOf(inkCells, w.k);
      glyphLists.push(gl);
      const cnt = gl ? gl.length : 1;
      counts.push(cnt);
      total += cnt;
    }
    const stagger = total > 1 ? (evSpan - T.evap.glyph) / (total - 1) : 0;

    let before = 0;
    for (let iw = 0; iw < plainWords.length; iw++) {
      const w = plainWords[iw];
      const inner = w.inkInner;
      const cnt = counts[iw];
      // rank of this word's first / last glyph from the END of the block
      const rFirst = total - 1 - before;
      const rLast = total - cnt - before;
      before += cnt;
      const startFirst = T.evap.from + rFirst * stagger; // the word's first glyph leaves last
      const startLast = T.evap.from + rLast * stagger;
      const wordQ = progress(startLast, startFirst + T.evap.glyph, vh);
      const gone = wordQ >= 1;
      const live = s > 1 && !gone && vh > startLast - 1;
      cls(inner, "is-live", live);
      showIn(inner, !gone);
      if (gone) continue;

      const blur = desktop && g.narrow[w.k] ? EVAP_BLUR * E.evap(wordQ) : 0;
      put(inner, "filter", blur > 0.05 ? `blur(${f2(blur)}px)` : "none");
      const r = g.words[w.k];
      const tx = s > 1 ? (r.x + r.w / 2 - g.cx) * (s - 1) : 0;
      const ty = s > 1 ? (r.y + r.h / 2 - g.cy) * (s - 1) : 0;
      const gl = glyphLists[iw];
      if (gl && inkCells) {
        put(inner, "opacity", "1");
        put(inner, "transform", s > 1 ? `translate3d(${f2(tx)}px, ${f2(ty)}px, 0) scale(${f3(s)})` : "none");
        inkCells.setWord(w.k, 1 - wordQ);
        if (wordQ > 0) {
          for (let j = 0; j < cnt; j++) {
            const rank = rFirst - j; // reading order j → rank from the end
            const qg = (vh - (T.evap.from + rank * stagger)) / T.evap.glyph;
            evapAt(E, qg, 1, st);
            inkCells.writeGlyph(w.k, j, st.y, st.op);
          }
        }
      } else {
        evapAt(E, wordQ, g.fs, st);
        put(inner, "opacity", f3(st.op));
        const yev = st.y;
        put(
          inner,
          "transform",
          s <= 1 && yev === 0
            ? "none"
            : `translate3d(${f2(tx)}px, ${f2(ty)}px, 0) scale(${f3(s)})${yev !== 0 ? ` translateY(${q05(yev)}px)` : ""}`,
        );
      }
    }
    for (const w of emWords) {
      // the word's text goes once its capsule has completed (it sits under it)
      const done = vh >= T.sweep.start + T.sweep.step * w.e + T.sweep.len;
      showIn(w.inkInner, !done);
    }
  };

  /* ── J6: ink capsules + gold droplets → the six tarja slices ──── */
  const flowSlope = (t: number): number => {
    const h = 1e-3;
    const a = Math.max(0, t - h);
    const b = Math.min(1, t + h);
    return (E.flow(b) - E.flow(a)) / (b - a);
  };
  /** The capsule's rounding, ONE technique from the drop to the landing:
   *  `clip-path: inset(0 round …)` (DOSSIER's capsule tarja is rounded the
   *  same way, so the 850 swap matches its anti-aliasing), the radii
   *  compensated per axis for the flight's non-uniform scale (paint only). */
  const clipRound = (bar: Cell, sx: number, sy: number, rl: number, rr: number) => {
    const ax = (v: number) => q05(v / sx);
    const ay = (v: number) => q05(v / sy);
    put(
      bar,
      "clip-path",
      sx === 1 && sy === 1
        ? `inset(0px round ${f2(rl)}px ${f2(rr)}px ${f2(rr)}px ${f2(rl)}px)`
        : `inset(0px round ${ax(rl)}px ${ax(rr)}px ${ax(rr)}px ${ax(rl)}px / ${ay(rl)}px ${ay(rr)}px ${ay(rr)}px ${ay(rl)}px)`,
    );
  };

  const writeBars = (g: Geo, vh: number) => {
    const on = vh >= T.sweep.start;
    const landedAll = T.fuse.start + T.fuse.step * (bars.length - 1) + T.fuse.len;
    show(barsC, on);
    cls(barsC, "is-live", on && vh < landedAll);
    if (!on) return;
    const m = bars.length;
    // once all six have landed they ARE the tarja: one capsule element with
    // DOSSIER's box and clip (translate only, scale 1) holds until the swap
    const one = !!tarjaC && g.tarjaOk && vh >= landedAll;
    if (tarjaC) {
      showIn(tarjaC, one);
      if (one) {
        put(tarjaC, "transform", `translate3d(${f2(g.tarja.x)}px, ${f2(g.tarja.y)}px, 0)`);
        const r = f2(g.tarja.h / 2);
        put(tarjaC, "clip-path", `inset(0px round ${r}px)`);
      }
    }
    for (let i = 0; i < m; i++) {
      if (one) {
        showIn(bars[i], false);
        showIn(nibs[i], false);
        continue;
      }
      const bar = bars[i];
      const nib = nibs[i];
      const s0 = T.sweep.start + T.sweep.step * i;
      const f0 = T.fuse.start + T.fuse.step * i;
      const A = g.barFrom[i];
      const B = g.barTo[i];
      if (vh < s0 || !A || !B) {
        showIn(bar, false);
        showIn(nib, false);
        continue;
      }
      const u = progress(s0, s0 + T.sweep.len, vh);
      const pf = progress(f0, f0 + T.fuse.len, vh);
      let x: number;
      let y: number;
      let w: number;
      let h: number;
      let rl: number;
      let rr: number;
      let nibOn = false;
      if (pf <= 0) {
        if (u < DROP) {
          // the ink drop lands at the word's start (cx-pour: a 1.5 % meniscus)
          const d = Math.max(0, E.pour(u / DROP));
          const D = A.h * d;
          x = A.x + A.h / 2 - D / 2;
          y = A.y + A.h / 2 - D / 2;
          w = D;
          h = D;
        } else {
          // … and smears across it (cx-flow), led by the gold droplet
          const k = E.flow((u - DROP) / (1 - DROP));
          x = A.x;
          y = A.y;
          w = A.h + (A.w - A.h) * k;
          h = A.h;
          nibOn = u < 1;
          if (nibOn) {
            const fadeIn = Math.min(1, (u - DROP) / 0.08);
            const fadeOut = Math.min(1, (1 - u) / 0.12);
            put(nib, "transform", `translate3d(${f2(x + w - NIB_R - 0.5)}px, ${f2(y + h / 2 - NIB_R)}px, 0)`);
            put(nib, "opacity", f3(Math.max(0, Math.min(fadeIn, fadeOut))));
          }
        }
        rl = h / 2;
        rr = h / 2;
      } else {
        const ex = E.flow(pf);
        const ey = power2Out(pf);
        const acx = A.x + A.w / 2;
        const acy = A.y + A.h / 2;
        const bcx = B.x + B.w / 2;
        const bcy = B.y + B.h / 2;
        const cxp = lerp(acx, bcx, ex);
        const cyp = lerp(acy, bcy, ey);
        let w0 = lerp(A.w, B.w, ex);
        let h0 = lerp(A.h, B.h, ey);
        if (pf < 1) {
          // stretch along the (horizontal) speed, keeping the drop's volume
          const vx = Math.abs(bcx - acx) * flowSlope(pf) / T.fuse.len;
          const stretch = 1 + Math.min(STRETCH.max, STRETCH.k * vx);
          // squash as it meets the tarja (0.94 at the deepest, 1 exactly at landing)
          const sq = SQUASH.depth * Math.sin(Math.PI * progress(SQUASH.from, 1, pf)) ** 2;
          w0 *= stretch * (1 + sq / 2);
          h0 *= (1 / Math.sqrt(stretch)) * (1 - sq);
        }
        w = w0;
        h = h0;
        x = cxp - w / 2;
        y = cyp - h / 2;
        // inner ends flatten: the six capsules close into ONE capsule
        const mg = smoothstep(MERGE[0], MERGE[1], pf);
        const full = h / 2;
        rl = i === 0 ? full : full * (1 - mg);
        rr = i === m - 1 ? full : full * (1 - mg);
      }
      showIn(nib, nibOn);
      const visible = w > 0.01 && h > 0.01 && (g.tarjaOk || pf < 1);
      showIn(bar, visible);
      if (!visible) continue;
      if (pf >= 1) {
        // landed: translate only, scale 1, the tarja's own clip
        put(bar, "transform", `translate3d(${f2(B.x)}px, ${f2(B.y)}px, 0)`);
        clipRound(bar, 1, 1, i === 0 ? B.h / 2 : 0, i === m - 1 ? B.h / 2 : 0);
      } else {
        const sx = w / B.w;
        const sy = h / B.h;
        put(bar, "transform", `translate3d(${f2(x)}px, ${f2(y)}px, 0) scale(${f3(sx)}, ${f3(sy)})`);
        clipRound(bar, sx, sy, rl, rr);
      }
      // no tarja to land on (DOSSIER missing): the capsules fade where they are
      put(bar, "opacity", g.tarjaOk ? "1" : f3(1 - pf));
    }
  };

  const apply = (vh: number) => {
    const g = vh >= T.on && vh < T.swap ? ensureGeo() : null;
    const on = !!g;
    put(rootC, "opacity", on ? "1" : "0");
    show(rootC, on);
    if (!g) {
      // off: every sub-layer hidden too (cheap, on change only)
      show(lightC, false);
      show(inkC, false);
      show(barsC, false);
      return;
    }
    const dawn = ctx.field.score.dawn;
    const frontR = dawn > 0 ? dawnFrontPx(dawn) : 0;
    writeLight(g, vh, frontR, dawn);
    writeInk(g, vh, frontR, dawn);
    writeBars(g, vh);
  };

  ctx.frame.add(FrameOrder.Labels, (vh) => apply(vh));
  return { apply };
}
