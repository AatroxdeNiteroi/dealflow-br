/* ============================================================
   cinema/ch1/respiro.ts — the respiro, J4–J6 (§5). Owner: WP-CH1.

   One frame writer (FrameOrder.Labels, after field.update in the same
   tick, so it reads THIS frame's field.score.dawn). Every value is a
   pure function of master vh (+ refresh-time rects), written only when
   it changes, so the sequence reverses exactly and idles at 0 writes.

   J4 480–657  words written in LIGHT: mask rise (yPercent 110 → 0,
               sine.out), opacity, blur 6 → 0 (desktop, words ≤ 220 px),
               normal words cool from gold-hot #e6b54a to paper; em words
               are gold #cf9b1e with a gold-as-light glow on the dark.
   J5 673–770  the ink twin is revealed by `circle(frontR at 50% 50%)`,
               frontR = dawnFrontPx(field.score.dawn) — the GL formula.
               A light word goes to 0 as soon as the front has passed its
               farthest corner + 12 px; an em word's glow fades out before
               the front reaches it (no gold haze on paper).
   J6 770–872  non-em ink words dolly past the lens about the screen
               centre; the six em words are redacted by flat-ink bars
               (scaleX from the left, a 2 px gold nib on the leading
               edge); the bars fly to the six slices of `dos.tarja@ch2`
               (x sine.inOut, y power2.out) and land pixel-identical at
               850, where DOSSIER's tarja takes over (CH1 hides the bars
               for vh ≥ 850; DOSSIER shows its tarja for vh ≥ 850).
   ============================================================ */

import { FrameOrder, RECT_KEYS, type CinemaCtx, type Rect } from "../types";
import { PACE } from "../beats";
import { FLAGS } from "../flags";
import { claim } from "../dev/assert";
import { RESPIRO_WORDS } from "../copy";
import {
  dawnFrontPx,
  lerp,
  power2Out,
  progress,
  roundDevice,
  sineInOut,
  sineOut,
  smoothstep,
} from "../geometry";

const P = (v: number): number => v * PACE;

/* ── sub-event windows (spec §5, absolute master vh × PACE) ─────── */
export const RESPIRO_T = {
  /** layer visible (first light word starts at 490) → swap */
  on: P(486),
  /** J4 word k rises over [490 + 6.5k, 514 + 6.5k]; the last ends at 618 */
  rise: { start: P(490), step: P(6.5), len: P(24) },
  /** em glow fades in over 12 vh after its word has landed */
  glowIn: P(12),
  /** J6 white-word dolly */
  dolly: { from: P(770), to: P(830) },
  /** J6 em redaction: bar i over [775 + 5i, 783 + 5i] */
  sweep: { start: P(775), step: P(5), len: P(8) },
  /** J6 fusion: bar i over [815 + 2i, 840 + 2i] */
  fuse: { start: P(815), step: P(2), len: P(25) },
  /** CH1 bars → DOSSIER `.cx-dos__tarja`, same frame, pixel-identical */
  swap: P(850),
} as const;

/* dolly: c = 0.15 → 0.40, s = (0.5 − 0.15)/(0.5 − c); gone once s > 1.6 */
const DOLLY_C0 = 0.15;
const DOLLY_C1 = 0.4;
const DOLLY_FADE: readonly [number, number] = [1.2, 1.6];
const BLUR_MAX = 6;
/** blur only on small words (§10.5: words ≤ 220 px) */
const BLUR_MAX_W = 220;
/** the light copy hides once frontR > farthest corner + 12 px (the GL edge band) */
const FRONT_BAND = 12;
/** em glow (18 px) must be gone before the soft band touches the word */
const GLOW_PX = 18;
const GLOW_FADE = 40;
/** light colours: filament cooling gold-hot → paper */
const HOT = [0xe6, 0xb5, 0x4a] as const;
const COOL = [0xfb, 0xf9, 0xf4] as const;
/** redaction bar over an em word, in em of the copy (Playfair, line-height 1.2) */
const BAR_Y = 0.22;
const BAR_H = 1.02;
const BAR_PAD_X = 0.05;

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

interface Word {
  k: number;
  em: boolean;
  /** index among em words (0..5), −1 otherwise */
  e: number;
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
  const inkCopy = ink.querySelector<HTMLElement>(".cx-respiro__copy")!;
  const lightWords = Array.from(light.querySelectorAll<HTMLElement>(".cx-respiro__w"));
  const inkWords = Array.from(ink.querySelectorAll<HTMLElement>(".cx-respiro__w"));
  const barEls = Array.from(barsLayer.querySelectorAll<HTMLElement>(".cx-respiro__bar"));
  const nibEls = Array.from(barsLayer.querySelectorAll<HTMLElement>(".cx-respiro__nib"));
  const n = RESPIRO_WORDS.length;
  if (lightWords.length !== n || inkWords.length !== n) {
    console.warn("[cinema/ch1] respiro word count mismatch — J4–J6 disabled");
    return null;
  }

  let e = 0;
  const words: Word[] = RESPIRO_WORDS.map((w, k) => ({
    k,
    em: !!w.em,
    e: w.em ? e++ : -1,
    lightOuter: cell(lightWords[k]),
    lightInner: cell(lightWords[k].querySelector<HTMLElement>(".cx-mw__i")!),
    inkInner: cell(inkWords[k].querySelector<HTMLElement>(".cx-mw__i")!),
  }));
  const emWords = words.filter((w) => w.em);
  const bars = barEls.map(cell);
  const nibs = nibEls.map(cell);
  const rootC = cell(root);
  const lightC = cell(light);
  const inkC = cell(ink);
  const barsC = cell(barsLayer);

  if (FLAGS.DEV_ASSERT) {
    claim("CH1", root, ["opacity", "visibility"]);
    claim("CH1", light, ["visibility"]);
    claim("CH1", ink, ["visibility", "clipPath"]);
    claim("CH1", lightWords, ["opacity"]);
    claim("CH1", words.map((w) => w.lightInner.el), ["transform", "opacity", "filter", "color", "textShadow"]);
    claim("CH1", words.map((w) => w.inkInner.el), ["transform", "opacity", "filter", "visibility"]);
    claim("CH1", [...barEls, ...nibEls], ["transform", "opacity", "visibility", "width", "height"]);
  }

  const desktop = !ctx.isMobile;

  /* ── refresh-time measurement: `respiro.words` (inner text boxes) ── */
  let fontPx = 16;
  let centre = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const measureWords = (): Rect[] => {
    const fs = parseFloat(getComputedStyle(inkCopy).fontSize);
    if (fs > 0) fontPx = fs;
    const lb = ink.getBoundingClientRect();
    centre = { x: lb.left + lb.width / 2, y: lb.top + lb.height / 2 };
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
      return { x: r.x - BAR_PAD_X * fs, y: r.y + BAR_Y * fs, w: r.w + 2 * BAR_PAD_X * fs, h: BAR_H * fs };
    });
    const tarjaOk = tarja.w > 1 && tarja.h > 1;
    const m = emWords.length;
    let barTo: Rect[];
    if (tarjaOk) {
      // device-pixel edges (= the layout snapping of DOSSIER's tarja box);
      // inner seams overlap 1 px so the six flat-ink slices read as one
      const edge = (j: number) => roundDevice(tarja.x + (tarja.w * j) / m);
      const top = roundDevice(tarja.y);
      const bottom = roundDevice(tarja.y + tarja.h);
      barTo = emWords.map((_, i) => ({
        x: edge(i),
        y: top,
        w: edge(i + 1) - edge(i) + (i < m - 1 ? 1 : 0),
        h: bottom - top,
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
    nibs.forEach((nb) => put(nb, "height", f2(fs) + "px"));
    return { words: list, cx, cy, fs, far, near, narrow, barFrom, barTo, tarjaOk };
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

  /* ── J4: words written in light ─────────────────────────────── */
  const T = RESPIRO_T;
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

      const y = 110 * (1 - sineOut(p));
      put(inner, "transform", p >= 1 ? "none" : `translate3d(0, ${f2(y)}%, 0)`);
      put(inner, "opacity", f3(sineOut(progress(0, 0.6, p))));
      const blur = desktop && g.narrow[w.k] ? BLUR_MAX * (1 - sineOut(progress(0, 0.85, p))) : 0;
      put(inner, "filter", blur > 0.05 ? `blur(${f2(blur)}px)` : "none");
      if (!w.em) {
        const c = sineInOut(progress(0.15, 1, p));
        const ch = (i: number) => Math.round(lerp(HOT[i], COOL[i], c));
        put(inner, "color", `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`);
      } else {
        // the mask opens only once the word has landed; the glow then fades in,
        // and fades out again before the dawn front reaches the word
        cls(w.lightOuter, "is-open", p >= 1);
        const near = g.near[w.k] - FRONT_BAND - GLOW_PX;
        const gl = progress(b, b + T.glowIn, vh) * (1 - progress(near - GLOW_FADE, near, frontR));
        put(inner, "text-shadow", gl > 0.004 ? `0 0 18px rgba(207, 155, 30, ${f3(0.35 * gl)})` : "none");
      }
    }
  };

  /* ── J5 + J6: ink twin (dawn clip, dolly, em text under its bar) ─ */
  const writeInk = (g: Geo, vh: number, frontR: number, dawn: number) => {
    const on = dawn > 0;
    // the clip is written first, whatever happens next (it is the twin's only mask)
    put(inkC, "clip-path", dawn >= 1 ? "none" : `circle(${on ? f2(frontR) : "0"}px at 50% 50%)`);
    show(inkC, on);
    if (!on) return;

    const u = progress(T.dolly.from, T.dolly.to, vh);
    const c = lerp(DOLLY_C0, DOLLY_C1, u);
    const s = (0.5 - DOLLY_C0) / (0.5 - c);
    const op = 1 - smoothstep(DOLLY_FADE[0], DOLLY_FADE[1], s);
    const blurK = desktop ? progress(1, DOLLY_FADE[1], s) : 0;
    for (const w of words) {
      const inner = w.inkInner;
      if (w.em) {
        // the word's text goes once its bar has completed (it sits under the bar)
        const done = vh >= T.sweep.start + T.sweep.step * w.e + T.sweep.len;
        showIn(inner, !done);
        continue;
      }
      const live = s > 1 && op > 0;
      cls(inner, "is-live", live);
      showIn(inner, op > 0);
      if (op <= 0) continue;
      const blur = g.narrow[w.k] ? BLUR_MAX * blurK : 0;
      put(inner, "opacity", f3(op));
      if (s <= 1) {
        put(inner, "transform", "none");
        put(inner, "filter", "none");
        continue;
      }
      const r = g.words[w.k];
      const wx = r.x + r.w / 2;
      const wy = r.y + r.h / 2;
      const tx = (wx - g.cx) * (s - 1);
      const ty = (wy - g.cy) * (s - 1);
      put(inner, "transform", `translate3d(${f2(tx)}px, ${f2(ty)}px, 0) scale(${f3(s)})`);
      put(inner, "filter", blur > 0.05 ? `blur(${f2(blur)}px)` : "none");
    }
  };

  /* ── J6: redaction bars + nibs → the six tarja slices ────────── */
  const writeBars = (g: Geo, vh: number) => {
    const on = vh >= T.sweep.start;
    show(barsC, on);
    if (!on) return;
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const nib = nibs[i];
      const s0 = T.sweep.start + T.sweep.step * i;
      const f0 = T.fuse.start + T.fuse.step * i;
      if (vh < s0 || !g.barFrom[i]) {
        showIn(bar, false);
        showIn(nib, false);
        cls(bar, "is-live", false);
        cls(nib, "is-live", false);
        continue;
      }
      const ps = sineInOut(progress(s0, s0 + T.sweep.len, vh));
      const pf = progress(f0, f0 + T.fuse.len, vh);
      const A = g.barFrom[i];
      const B = g.barTo[i];
      let x: number;
      let y: number;
      let w: number;
      let h: number;
      if (pf <= 0) {
        x = A.x;
        y = A.y;
        w = A.w * ps;
        h = A.h;
      } else {
        // x sine.inOut, y power2.out → the path arcs. Width follows x and
        // height follows y, so mid-flight the six slugs already share the
        // tarja's height and baseline and read as one line closing up.
        const ex = sineInOut(pf);
        const ey = power2Out(pf);
        const cxp = lerp(A.x + A.w / 2, B.x + B.w / 2, ex);
        const cyp = lerp(A.y + A.h / 2, B.y + B.h / 2, ey);
        w = lerp(A.w, B.w, ex);
        h = lerp(A.h, B.h, ey);
        x = cxp - w / 2;
        y = cyp - h / 2;
      }
      const visible = w > 0.01 && (g.tarjaOk || pf < 1);
      showIn(bar, visible);
      cls(bar, "is-live", visible && pf < 1);
      if (visible) {
        put(
          bar,
          "transform",
          pf >= 1
            ? `translate3d(${f2(B.x)}px, ${f2(B.y)}px, 0)`
            : `translate3d(${f2(x)}px, ${f2(y)}px, 0) scale(${f3(w / B.w)}, ${f3(h / B.h)})`,
        );
        // no tarja to land on (DOSSIER missing): the bars fade where they are
        put(bar, "opacity", g.tarjaOk ? "1" : f3(1 - pf));
      }
      // the gold nib rides the leading edge while the bar sweeps
      const nibOn = pf <= 0 && ps > 0 && ps < 1;
      showIn(nib, nibOn);
      cls(nib, "is-live", nibOn);
      if (nibOn) {
        put(nib, "transform", `translate3d(${f2(A.x + A.w * ps - 1)}px, ${f2(A.y + (A.h - g.fs) / 2)}px, 0)`);
        put(nib, "opacity", f3(Math.min(1, ps / 0.06, (1 - ps) / 0.08)));
      }
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
