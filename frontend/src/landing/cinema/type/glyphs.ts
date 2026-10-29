/* ============================================================
   cinema/type/glyphs.ts — the glyph engine (spec rev 3.1 §5.1–§5.3). WP5.

   Text condenses glyph by glyph (INK on paper, LIGHT in the dark) and
   evaporates from the far edge. Every glyph is an absolutely placed cell
   at the KERNED x of its character inside the whole word (Range rects,
   measured once per refresh, ligature clusters merged), so the rest swap
   (glyph layer → word layer) moves no glyph.

   Markup: cinema/MaskWords.tsx. Grammars: ./grammars.ts.

   Layers per word (visibility only — never display, never layout):
     HIDDEN   word layer hidden, glyph layer hidden
     LIVE     word layer hidden, glyph layer shown (0 < p < 1)
     SETTLED  word layer shown,  glyph layer hidden (the CSS default)

   API (cinema/types.ts GlyphEngine):
   - scrub(spec)   a scrubbed block (pure f(vh)). Several specs may share a
                   root (an INK pour and its EVAPORATE exit): the writer
                   composes them (opacity ×, y +) so an exit that overlaps a
                   pour never pops. Writer at FrameOrder.Glyphs (31): each
                   frame it evaluates every root with a spec window
                   [from − 1, to + 1] touching [min(prevVh, vh), max(prevVh, vh)],
                   so a block crossed in one big step still ends terminal.
                   writeAll(vh) (jump / settle) evaluates every root once.
   - play(root, g, {dur, stagger, delay})  time-based variant: one proxy
                   tween drives the same cells (Gateway, dock verb, tag,
                   chips). The pre-state is written at once (like
                   immediateRender); an EVAPORATE starts from whatever is on
                   screen (a click mid-pour never pops a glyph to full ink).
   - cells(root)   low-level cells for custom writers (respiro LIGHT, HUD):
                     words[k] = { el: mover .cx-mw__i, glyphs: .cx-ch[], x0, w }
                     setWord(k, p)      p = the word's PRESENCE: p ≤ 0 hidden,
                                        0 < p < 1 live (glyph layer when the
                                        word has glyphs, else the word layer),
                                        p ≥ 1 settled. For an exit pass 1 − q.
                     writeGlyph(k, j, yEm, op, rot?, skew?, rgb?)
                                        y in EM of the glyph (+ = down), write-
                                        on-change (0.05 px / 0.004); rgb 0xRRGGBB
                                        or −1 = inherit. Mobile drops skew/rot.
                     writeWordBlur(k, px)   blur on the mover (word level).
                   A word is in glyph mode iff words[k].glyphs.length > 0; the
                   engine only fills or empties that array while the word is
                   at rest (last setWord p ≤ 0 or ≥ 1), never mid-animation.
   - mode          "glyph" | "word" (FLAGS.GLYPHS, CPU text tier).

   Budget (§5.2): ≤ 140 writes per frame (cell transform/opacity, mover and
   layer writes). Over the cap the writer first collapses words at
   p ≤ 0.02 / ≥ 0.98 to their word layer, then defers LIVE glyph words to
   the next frame (round robin over roots and over the words of a root;
   the state is pure f(vh), so a one-frame defer is invisible). A terminal
   word (hidden / settled: one layer swap) is never deferred, so a jump
   across every block ends terminal in that very frame. Layer promotion (will-change on the
   glyph layer) per LIVE word, ≤ 8 words at once, never per glyph.

   Lazy measurement (§5.1): roots are measured after 90 ticker frames
   (the governor's boot sample) and document.fonts.ready, block by block
   in timeline order, in idle chunks ≤ 4 ms. A root not measured yet when
   it goes live renders in WORD mode (it never waits). ScrollTrigger
   refresh and font loads re-measure (live roots at once, the rest idle).

   Text tier (§4.9): the writer times its own frame slot (the same slot
   WP1's clock times for ctx.perf.glyphMs); if its p95 over 60 frames with
   a live block exceeds 1.5 ms (fine pointer) / 3.0 ms (coarse), blocks that
   have not started switch to word mode (checked between blocks only; live
   blocks finish as they are). The p95 is modelled from the median cost per
   write (glyphWriterP95), so a thread suspension inside a pass (GC, OS
   preemption, DevTools CPU throttling) cannot flip the session. Word blur is
   desktop T0/T1 only and off in word mode.
   ============================================================ */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { GlyphBlockSpec, GlyphCells, GlyphEngine, Grammar } from "../types";
import { FLAGS } from "../flags";
import { IS_DEV } from "../env";
import { runtime } from "../runtime";
import { GLYPH_PROMOTE_CAP, GLYPH_WRITE_CAP, claimFrameWriter, glyphBudget } from "../dev/assert";
import {
  BLUR_MAX_WORD_PX,
  GRAMMAR_DEFAULTS,
  LIGHT,
  MOBILE_STAGGER_VH,
  WORD_RISE_MIN,
  bleedOrder,
  grammarBlur,
  grammarState,
  inkRho,
  seedOf,
  type GlyphState,
} from "./grammars";

export interface GlyphWriter extends GlyphEngine {
  /** The frame fn the cinema registers at FrameOrder.Glyphs. */
  frame(vh: number): void;
  /** Write every registered block's state at vh (jump / settle / refresh). */
  writeAll(vh: number): void;
  /** Drop every block and listener (cinema destroy). */
  dispose(): void;
}

export interface GlyphPlayOpts {
  /** seconds per glyph (default: ink 0.6, evaporate 0.26) */
  dur?: number;
  /** seconds between consecutive glyphs along the grammar's order */
  stagger?: number;
  /** seconds before the first glyph starts (inside the returned timeline) */
  delay?: number;
}

/* ── environment (read once: the cinema is built once per load) ── */

const HAS_DOM = typeof window !== "undefined" && typeof document !== "undefined";
const mq = (q: string): boolean => HAS_DOM && typeof window.matchMedia === "function" && window.matchMedia(q).matches;
/** ≤ 720 px or a coarse pointer: opacity and y only, 0.5 vh stagger floor (§5.3). */
const MOBILE = mq("(max-width: 720px), (pointer: coarse)");
const COARSE = mq("(pointer: coarse)");
const REDUCED = mq("(prefers-reduced-motion: reduce)");

const BOOT_FRAMES = 90;
const CHUNK_MS = 4;
const TIER_FRAMES = 60;
const TIER_MS = COARSE ? 3.0 : 1.5;
/** EVAPORATE time variant: the block's spread is capped (the 16 vh scrub rule's twin). */
const EVAP_SPREAD_MIN = 0.16;
const EVAP_SPREAD_K = 0.6;

/** Engine-wide mode (FLAGS.GLYPHS, then the CPU text tier). */
let MODE: "glyph" | "word" = FLAGS.GLYPHS && !REDUCED ? "glyph" : "word";

const HIDDEN = 0;
const LIVE = 1;
const SETTLED = 2;
const WORD = 0;
const GLYPH = 1;

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

/* ── records ──────────────────────────────────────────────────── */

interface Cell {
  el: HTMLElement;
  text: string;
  /** layout x (px) from the mover's left edge (kerned) */
  x: number;
  /** written `left` (quantised) */
  xw: number;
  /** INK ρ_g (deg) */
  rho: number;
  /** last written values (NaN = never) */
  y: number;
  op: number;
  sk: number;
  r: number;
  rgb: number;
}

interface Word {
  /** `.cx-mw__i` — the word mover */
  el: HTMLElement;
  /** its parent: the untransformed word box */
  outer: HTMLElement;
  /** `.cx-mw__w` word layer (in flow) */
  w: HTMLElement | null;
  /** `.cx-mw__g` glyph layer */
  g: HTMLElement | null;
  text: string;
  cells: Cell[];
  /** index of the word's first glyph in the root's flattened list */
  g0: number;
  x0: number;
  wd: number;
  top: number;
  line: number;
  fs: number;
  /** written layer state (−1 = unknown) */
  layer: number;
  wHidden: boolean;
  gShown: boolean;
  promoted: boolean;
  /** written glyph-layer blur / mover blur (px) */
  blur: number;
  mBlur: number;
  /** word-mode mover writes */
  wm: boolean;
  wy: number;
  wop: number;
  /** cells() view */
  pub: { el: HTMLElement; glyphs: HTMLElement[]; x0: number; w: number };
  pubVer: number;
  lastP: number;
}

interface Spec {
  s: GlyphBlockSpec;
  g: Grammar;
  isIn: boolean;
  from: number;
  to: number;
  ver: number;
  built: number;
  gA: Float64Array;
  gD: Float64Array;
  wA: Float64Array;
  wB: Float64Array;
}

interface Root {
  el: Element;
  words: Word[];
  seed: number;
  measured: boolean;
  stale: boolean;
  geomVer: number;
  sig: string;
  nLines: number;
  N: number;
  dBleed: Float64Array;
  dRtl: Float64Array;
  dLtr: Float64Array;
  wBleed: Float64Array;
  specs: Spec[];
  mode: number;
  live: boolean;
  dirty: boolean;
  blurOK: boolean;
  scrub: boolean;
  custom: boolean;
  queued: boolean;
  prio: number;
  /** first word to evaluate next pass (the one the write cap deferred) */
  wStart: number;
  /** the time variant that currently owns the root (a newer play takes over at its start) */
  playTl: gsap.core.Timeline | null;
}

const EMPTY_F64 = new Float64Array(0);
const ROOTS = new WeakMap<Element, Root>();

function childByClass(el: Element, cls: string): HTMLElement | null {
  for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.classList.contains(cls)) return c as HTMLElement;
  return null;
}

function moversOf(el: Element): HTMLElement[] {
  if (el.classList.contains("cx-mw__i")) return [el as HTMLElement];
  return Array.from(el.querySelectorAll<HTMLElement>(".cx-mw__i"));
}

function makeWord(el: HTMLElement): Word {
  return {
    el,
    outer: (el.parentElement as HTMLElement | null) ?? el,
    w: childByClass(el, "cx-mw__w"),
    g: childByClass(el, "cx-mw__g"),
    text: "",
    cells: [],
    g0: 0,
    x0: 0,
    wd: 0,
    top: 0,
    line: 0,
    fs: 16,
    layer: -1,
    wHidden: false,
    gShown: false,
    promoted: false,
    blur: 0,
    mBlur: 0,
    wm: false,
    wy: Number.NaN,
    wop: Number.NaN,
    pub: { el, glyphs: [], x0: 0, w: 0 },
    pubVer: -2,
    lastP: Number.NaN,
  };
}

function rootOf(el: Element): Root {
  let R = ROOTS.get(el);
  if (!R) {
    R = {
      el,
      words: moversOf(el).map(makeWord),
      seed: seedOf((el.textContent ?? "") + "|" + (el.className && typeof el.className === "string" ? el.className : "")),
      measured: false,
      stale: false,
      geomVer: 0,
      sig: "",
      nLines: 1,
      N: 0,
      dBleed: EMPTY_F64,
      dRtl: EMPTY_F64,
      dLtr: EMPTY_F64,
      wBleed: EMPTY_F64,
      specs: [],
      mode: WORD,
      live: false,
      dirty: true,
      blurOK: false,
      scrub: false,
      custom: false,
      queued: false,
      prio: Number.POSITIVE_INFINITY,
      wStart: 0,
      playTl: null,
    };
    ROOTS.set(el, R);
  }
  return R;
}

/** Re-collect the words if the root's DOM changed (pooled chips / dock verbs). */
function syncWords(R: Root): void {
  const els = moversOf(R.el);
  let same = els.length === R.words.length;
  if (same) for (let i = 0; i < els.length; i++) if (els[i] !== R.words[i].el) { same = false; break; }
  if (same) return;
  const old = new Map(R.words.map((W) => [W.el, W] as const));
  R.words = els.map((el) => {
    const W = old.get(el);
    if (!W) return makeWord(el);
    W.w = childByClass(el, "cx-mw__w");
    W.g = childByClass(el, "cx-mw__g");
    return W;
  });
  R.measured = false;
}

function textSig(R: Root): string {
  let s = "";
  for (const W of R.words) s += (W.w ? W.w.textContent : W.el.textContent) + "\u0001";
  return s;
}

/* ── clusters: what one glyph cell holds ──────────────────────── */

const COMBINING = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe00-\ufe0f\ufe20-\ufe2f\u200c\u200d]/;
/** After an "f", these may form a common ligature (fi, fl, ff, ffi, ffl, fj, ft, fb, fh, fk):
 *  merged into one cell, which the browser shapes exactly as the word does. */
const LIG_NEXT = "fijlbhkt";

export interface Cluster {
  s: number;
  e: number;
  t: string;
}

/** Split a word into glyph cells (code points; combining marks and f-ligature clusters merged). */
export function clusterize(text: string): Cluster[] {
  const out: Cluster[] = [];
  let i = 0;
  for (const ch of text) {
    const len = ch.length;
    const last = out.length ? out[out.length - 1] : null;
    const merge =
      !!last && (COMBINING.test(ch) || last.t.endsWith("\u200d") || (last.t.endsWith("f") && LIG_NEXT.includes(ch)));
    if (merge && last) {
      last.e += len;
      last.t += ch;
    } else out.push({ s: i, e: i + len, t: ch });
    i += len;
  }
  return out;
}

/* ── measurement (refresh time only; never per frame) ─────────── */

let RANGE: Range | null = null;
const PLAY_ROOTS = new Set<Root>();

function claimCells(R: Root, W: Word): void {
  if (!IS_DEV || !FLAGS.DEV_ASSERT || !R.scrub) return;
  claimFrameWriter("CORE", W.cells.map((c) => c.el), ["transform", "opacity"]);
  if (W.g) claimFrameWriter("CORE", W.g, ["visibility", "filter", "will-change"]);
  if (W.w) claimFrameWriter("CORE", W.w, ["visibility"]);
}

/**
 * Measure a root's glyph geometry: per character Range rects relative to the
 * word mover (scale-normalised), clusters with a zero-width rect merged into
 * the previous cell, cells created / re-placed in its glyph layer, lines and
 * the grammar orders. Reads first, then writes. Returns false when the root
 * is not laid out (display: none) — it stays in word mode.
 */
function measureRoot(R: Root): boolean {
  if (!HAS_DOM || !R.el.isConnected) return false;
  syncWords(R);
  R.stale = false;
  const words = R.words;
  const n = words.length;
  const range = RANGE ?? (RANGE = document.createRange());
  const rootBox = R.el.getBoundingClientRect();
  if (!(rootBox.width > 0) && !(rootBox.height > 0)) {
    // not laid out (display: none, detached): stays in word mode, retried on the next refresh
    R.measured = false;
    return false;
  }
  const glyphOn = MODE === "glyph";
  const fsCache = new Map<string, number>();
  const plans: Array<{ cl: Cluster[]; xs: number[] } | null> = [];
  // Screen px → the mover's own px. offsetWidth is ROUNDED to an integer, so
  // `rect.width / offsetWidth` is never a scale by itself (a 100.4 px word would
  // read 1.004 and push its last glyph 0.4 px off): a box counts as scaled only
  // when its rect and its layout width disagree by more than that rounding, and
  // the scale is then taken from the widest box available (the root).
  const rw = (R.el as HTMLElement).offsetWidth || 0;
  const scRoot = rw > 0 && Math.abs(rootBox.width - rw) > 1 ? rootBox.width / rw : 1;
  for (const W of words) {
    const ow = W.el.offsetWidth;
    const mr = W.el.getBoundingClientRect();
    if (!(ow > 0) || !(mr.width > 0)) {
      W.wd = 0;
      plans.push(null);
      continue;
    }
    const sc = Math.abs(mr.width - ow * scRoot) > 1 ? mr.width / ow : scRoot;
    const ob = W.outer.getBoundingClientRect();
    W.top = (ob.top - rootBox.top) / sc;
    W.x0 = (ob.left - rootBox.left) / sc;
    W.wd = ow;
    const key = W.outer.className + "|" + W.el.className;
    let fs = fsCache.get(key);
    if (fs === undefined) {
      fs = parseFloat(getComputedStyle(W.w ?? W.el).fontSize) || 16;
      fsCache.set(key, fs);
    }
    W.fs = fs;
    const tn =
      W.w && W.g && W.w.childNodes.length === 1 && W.w.firstChild && W.w.firstChild.nodeType === 3
        ? (W.w.firstChild as Text)
        : null;
    W.text = (W.w ?? W.el).textContent ?? "";
    if (!tn || !glyphOn) {
      plans.push(null);
      continue;
    }
    const cl: Cluster[] = [];
    const xs: number[] = [];
    for (const c of clusterize(tn.data)) {
      range.setStart(tn, c.s);
      range.setEnd(tn, c.e);
      const rr = range.getBoundingClientRect();
      if (cl.length && !(rr.width > 0.01)) {
        const last = cl[cl.length - 1];
        last.e = c.e;
        last.t += c.t;
        continue;
      }
      cl.push({ s: c.s, e: c.e, t: c.t });
      xs.push((rr.left - mr.left) / sc);
    }
    plans.push({ cl, xs });
  }

  // ── writes: cells (created once, re-placed on refresh) ──
  let gi = 0;
  for (let k = 0; k < n; k++) {
    const W = words[k];
    const p = plans[k];
    W.g0 = gi;
    if (!p || !W.g) {
      // word mode (text tier) keeps existing cells untouched: a custom writer may hold them
      if (glyphOn && W.cells.length && W.g) {
        W.g.textContent = "";
        W.cells = [];
      }
      gi += W.cells.length;
      continue;
    }
    let same = W.cells.length === p.cl.length;
    if (same) for (let j = 0; j < p.cl.length; j++) if (W.cells[j].text !== p.cl[j].t) { same = false; break; }
    if (!same) {
      const frag = document.createDocumentFragment();
      W.cells = p.cl.map((c) => {
        const el = document.createElement("span");
        el.className = "cx-ch";
        el.textContent = c.t;
        frag.appendChild(el);
        return { el, text: c.t, x: 0, xw: Number.NaN, rho: 0, y: Number.NaN, op: Number.NaN, sk: Number.NaN, r: Number.NaN, rgb: -1 };
      });
      W.g.replaceChildren(frag);
      if (W.blur) {
        W.g.style.filter = "";
        W.blur = 0;
      }
      claimCells(R, W);
    }
    for (let j = 0; j < W.cells.length; j++) {
      const c = W.cells[j];
      c.x = p.xs[j];
      const xq = Math.round(c.x * 100) / 100;
      if (xq !== c.xw) {
        c.el.style.left = xq + "px";
        c.xw = xq;
      }
      c.rho = inkRho(gi + j, R.seed);
    }
    gi += W.cells.length;
  }
  R.N = gi;

  // ── lines (a new line when a word box drops by half an em) ──
  let L = 0;
  let lineTop = n ? words[0].top : 0;
  const lineLeft: number[] = [];
  const lineRight: number[] = [];
  for (const W of words) {
    if (W.top > lineTop + 0.5 * W.fs) {
      L++;
      lineTop = W.top;
    }
    W.line = L;
    lineLeft[L] = Math.min(lineLeft[L] ?? Infinity, W.x0);
    lineRight[L] = Math.max(lineRight[L] ?? -Infinity, W.x0 + W.wd);
  }
  R.nLines = L + 1;

  // ── orders ──
  const N = gi;
  const dB = new Float64Array(N);
  const dR = new Float64Array(N);
  const dL = new Float64Array(N);
  const wB = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const W = words[k];
    const left = lineLeft[W.line] ?? 0;
    const lw = (lineRight[W.line] ?? 0) - left;
    wB[k] = bleedOrder(W.x0 - left + W.wd / 2, lw, W.line, R.nLines, W.fs, R.seed);
    for (let j = 0; j < W.cells.length; j++) {
      const g = W.g0 + j;
      dB[g] = bleedOrder(W.x0 - left + W.cells[j].x, lw, W.line, R.nLines, W.fs, R.seed);
      dL[g] = N > 1 ? g / (N - 1) : 0;
    }
  }
  // normalise to exactly [0, 1]: the first glyph starts at `from`, the last ends at `to`
  normalise(dB);
  normalise(wB);
  for (let g = 0; g < N; g++) dR[g] = 1 - dB[g];
  R.dBleed = dB;
  R.dRtl = dR;
  R.dLtr = dL;
  R.wBleed = wB;
  R.measured = true;
  R.geomVer++;
  R.sig = textSig(R);
  R.dirty = true;
  if (R.custom) for (const W of words) if (!(W.lastP > 0 && W.lastP < 1)) publish(R, W);
  return true;
}

function normalise(a: Float64Array): void {
  if (a.length < 2) {
    if (a.length) a[0] = 0;
    return;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < lo) lo = a[i];
    if (a[i] > hi) hi = a[i];
  }
  const span = hi - lo;
  for (let i = 0; i < a.length; i++) a[i] = span > 1e-9 ? (a[i] - lo) / span : 0;
}

/* ── lazy scheduler: after the boot sample and the fonts, idle chunks ── */

const QUEUE: Root[] = [];
let queueSorted = true;
let gateArmed = false;
let gateOpen = false;
let chunkPending = false;

function armGate(): void {
  if (gateArmed || !HAS_DOM) return;
  gateArmed = true;
  let ticks = 0;
  const onTick = () => {
    if (++ticks < BOOT_FRAMES) return;
    gsap.ticker.remove(onTick);
    const ready: Promise<unknown> = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(() => {
      gateOpen = true;
      pump();
    });
  };
  gsap.ticker.add(onTick);
}

function enqueue(R: Root): void {
  if (R.queued) return;
  R.queued = true;
  QUEUE.push(R);
  queueSorted = false;
  pump();
}

function pump(): void {
  if (!gateOpen || chunkPending || !QUEUE.length) return;
  chunkPending = true;
  const ric = (window as unknown as { requestIdleCallback?: (cb: (d: IdleDeadline) => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  if (ric) ric(runChunk, { timeout: 100 });
  else window.setTimeout(() => runChunk(null), 32);
}

function runChunk(deadline: IdleDeadline | null): void {
  chunkPending = false;
  if (!queueSorted) {
    QUEUE.sort((a, b) => a.prio - b.prio);
    queueSorted = true;
  }
  const t0 = now();
  let first = true;
  while (QUEUE.length) {
    if (!first) {
      if (now() - t0 > CHUNK_MS) break;
      if (deadline && !deadline.didTimeout && deadline.timeRemaining() < 1) break;
    }
    first = false;
    const R = QUEUE.shift() as Root;
    R.queued = false;
    if (R.el.isConnected) measureRoot(R);
  }
  pump();
}

/* ── writes ───────────────────────────────────────────────────── */

let PROMOTED = 0;
let budgetFrame = -1;
let budgetOpen = false;
let lastRunFrame = -1;

function budgetBoundary(f: number): void {
  if (budgetOpen) {
    glyphBudget.promote(PROMOTED);
    glyphBudget.end();
  }
  glyphBudget.begin();
  budgetOpen = true;
  budgetFrame = f;
}

/** Per-frame budget accounting shared by the writer, the time variants and custom writers. */
function budget(n: number): void {
  const f = gsap.ticker.frame;
  if (f !== budgetFrame) budgetBoundary(f);
  if (n) glyphBudget.write(n);
}

/** The scrub writer's pass: a second pass inside one ticker frame (jump → writeAll,
 *  then the frame slot) is a frame of its own for the 140-write cap. */
function budgetForRun(): void {
  const f = gsap.ticker.frame;
  if (f === lastRunFrame) budgetBoundary(f);
  else budget(0);
  lastRunFrame = f;
}

function promote(W: Word): void {
  if (W.promoted || !W.g || PROMOTED >= GLYPH_PROMOTE_CAP) return;
  W.g.style.willChange = "transform, opacity";
  W.promoted = true;
  PROMOTED++;
}

function demote(W: Word): void {
  if (!W.promoted || !W.g) return;
  W.g.style.willChange = "";
  W.promoted = false;
  PROMOTED--;
}

/** Layer swap (visibility only). Returns the number of writes. */
function setLayer(W: Word, state: number): number {
  if (!W.w && !W.g) {
    // no layers (hand markup): the mover carries the hidden state; writeMover the rest
    W.layer = state;
    return state === HIDDEN ? writeMover(W, W.wy === W.wy ? W.wy : 0, 0) : 0;
  }
  if (W.layer === state) return 0;
  let n = 0;
  const wHidden = state !== SETTLED;
  const gShown = state === LIVE;
  if (W.w && W.wHidden !== wHidden) {
    W.w.style.visibility = wHidden ? "hidden" : "";
    W.wHidden = wHidden;
    n++;
  }
  if (W.g && W.gShown !== gShown) {
    // `inherit`, never `visible`: a hidden stage must stay hidden
    W.g.style.visibility = gShown ? "inherit" : "";
    W.gShown = gShown;
    n++;
  }
  if (gShown) promote(W);
  else {
    demote(W);
    if (W.blur && W.g) {
      W.g.style.filter = "";
      W.blur = 0;
      n++;
    }
  }
  W.layer = state;
  return n;
}

function tf(y: number, sk: number, r: number): string {
  if (y === 0 && sk === 0 && r === 0) return "";
  let s = "translate(0px, " + y + "px)";
  if (sk !== 0) s += " skewX(" + sk + "deg)";
  if (r !== 0) s += " rotate(" + r + "deg)";
  return s;
}

/** Write one glyph cell if it changed (0.05 px / 0.004 / 0.05°). Returns 1 if written. */
function writeCell(c: Cell, yPx: number, op: number, sk: number, r: number, rgb: number): number {
  const y = Math.round(yPx * 20) / 20;
  const o = op <= 0 ? 0 : op >= 1 ? 1 : Math.round(op * 250) / 250;
  const s = Math.round(sk * 20) / 20;
  const rr = Math.round(r * 20) / 20;
  let w = 0;
  if (y !== c.y || s !== c.sk || rr !== c.r) {
    c.el.style.transform = tf(y, s, rr);
    c.y = y;
    c.sk = s;
    c.r = rr;
    w = 1;
  }
  if (o !== c.op) {
    c.el.style.opacity = o >= 1 ? "" : String(o);
    c.op = o;
    w = 1;
  }
  if (rgb !== c.rgb) {
    c.el.style.color = rgb < 0 ? "" : "#" + (rgb & 0xffffff).toString(16).padStart(6, "0");
    c.rgb = rgb;
    w = 1;
  }
  return w;
}

/** Word mode: the mover carries y (em) and opacity. Returns the number of writes. */
function writeMover(W: Word, yEm: number, op: number): number {
  const y = Math.round(yEm * 1000) / 1000;
  const o = op <= 0 ? 0 : op >= 1 ? 1 : Math.round(op * 250) / 250;
  let n = 0;
  if (y !== W.wy) {
    W.el.style.transform = y === 0 ? "" : "translate(0px, " + y + "em)";
    W.wy = y;
    n++;
  }
  if (o !== W.wop) {
    W.el.style.opacity = o >= 1 ? "" : String(o);
    W.wop = o;
    n++;
  }
  W.wm = true;
  return n;
}

function writeLayerBlur(W: Word, px: number): number {
  if (!W.g) return 0;
  const v = Math.round(px * 20) / 20;
  if (v === W.blur) return 0;
  W.g.style.filter = v > 0 ? "blur(" + v + "px)" : "";
  W.blur = v;
  return 1;
}

function clearMovers(R: Root): void {
  for (const W of R.words) {
    if (!W.wm) continue;
    W.el.style.transform = "";
    W.el.style.opacity = "";
    W.wm = false;
    W.wy = Number.NaN;
    W.wop = Number.NaN;
  }
}

/** Commit a root's render mode (only ever at rest). */
function commitMode(R: Root, m: number): void {
  if (R.mode === m) return;
  if (m === GLYPH) clearMovers(R);
  R.mode = m;
}

function blurAllowed(): boolean {
  if (MOBILE || MODE !== "glyph") return false;
  const f = runtime.fieldOrNull();
  return !f || f.tier <= 1;
}

/** cells() view: (re)publish a word's glyph list — only called while the word is at rest. */
function publish(R: Root, W: Word): void {
  const on = MODE === "glyph" && R.measured && !R.stale && W.cells.length > 0;
  const ver = on ? R.geomVer : -1;
  W.pub.x0 = W.x0;
  W.pub.w = W.wd;
  if (W.pubVer === ver) return;
  W.pub.glyphs.length = 0;
  if (on) for (const c of W.cells) W.pub.glyphs.push(c.el);
  W.pubVer = ver;
}

/* ── scrub timing ─────────────────────────────────────────────── */

function makeSpec(s: GlyphBlockSpec): Spec {
  return {
    s,
    g: s.grammar,
    isIn: s.grammar !== "evaporate",
    from: s.from,
    to: Math.max(s.from, s.to),
    ver: -1,
    built: -1,
    gA: EMPTY_F64,
    gD: EMPTY_F64,
    wA: EMPTY_F64,
    wB: EMPTY_F64,
  };
}

function orderOf(R: Root, order: "bleed" | "ltr" | "rtl"): Float64Array {
  return order === "rtl" ? R.dRtl : order === "ltr" ? R.dLtr : R.dBleed;
}

function wordOrder(R: Root, order: "bleed" | "ltr" | "rtl", k: number): number {
  const n = R.words.length;
  const idx = n > 1 ? k / (n - 1) : 0;
  if (order === "ltr") return idx;
  if (R.measured && R.wBleed.length === n) return order === "rtl" ? 1 - R.wBleed[k] : R.wBleed[k];
  return order === "rtl" ? 1 - idx : idx;
}

/**
 * Glyph (or word) windows of one spec over its root's current geometry.
 * The block's window is exact: the first glyph starts at `from`, the last
 * ends at `to`. INK/LIGHT words rise for ≥ wordRiseMin vh: a word whose
 * glyph spread is short gets a longer per-glyph duration.
 */
function buildTiming(R: Root, S: Spec): void {
  const n = R.words.length;
  const span = Math.max(0, S.to - S.from);
  const def = GRAMMAR_DEFAULTS[S.g];
  const gd = Math.max(1e-3, S.s.glyphDur ?? def.glyphDur);
  const wrm = S.isIn ? S.s.wordRiseMin ?? WORD_RISE_MIN : 0;
  const order = S.s.order ?? def.order;
  const wA = new Float64Array(n);
  const wB = new Float64Array(n);
  const glyphs = R.mode === GLYPH && R.measured;
  const wordWindow = (k: number): void => {
    let Dw = S.g === "light" ? LIGHT.lead + LIGHT.glyph : S.isIn ? Math.max(gd, wrm) : gd;
    Dw = Math.min(Dw, span);
    const a = S.from + wordOrder(R, order, k) * (span - Dw);
    wA[k] = a;
    wB[k] = a + Dw;
  };
  if (!glyphs) {
    for (let k = 0; k < n; k++) wordWindow(k);
    S.gA = EMPTY_F64;
    S.gD = EMPTY_F64;
  } else {
    const N = R.N;
    const gA = new Float64Array(N);
    const gD = new Float64Array(N);
    if (S.g === "light") {
      // ltr inside each word: glyph j over [a_k + j·6/(n_k − 1), +18] (scaled if the span is short)
      const win = LIGHT.lead + LIGHT.glyph;
      const sc = Math.min(1, span / win);
      for (let k = 0; k < n; k++) {
        const W = R.words[k];
        const a = S.from + (n > 1 ? (k * Math.max(0, span - win * sc)) / (n - 1) : 0);
        const m = W.cells.length;
        for (let j = 0; j < m; j++) {
          gA[W.g0 + j] = a + (m > 1 ? (j * LIGHT.lead * sc) / (m - 1) : 0);
          gD[W.g0 + j] = Math.max(1e-6, LIGHT.glyph * sc);
        }
      }
    } else {
      const d = orderOf(R, order);
      const dd = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        const W = R.words[k];
        let lo = 1;
        let hi = 0;
        for (let j = 0; j < W.cells.length; j++) {
          const v = d[W.g0 + j];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        dd[k] = hi > lo ? hi - lo : 0;
      }
      // per-word duration D_k = max(gd, wrm − spread_k), spread_k = Δd_k·(span − Dmax): monotone fixpoint
      const Dk = new Float64Array(n);
      let Dmax = Math.min(gd, span);
      for (let it = 0; it < 8; it++) {
        const Sp = Math.max(0, span - Dmax);
        let m = 0;
        for (let k = 0; k < n; k++) {
          let D = gd;
          if (S.isIn) D = Math.max(gd, wrm - dd[k] * Sp);
          D = Math.min(D, span);
          Dk[k] = D;
          if (D > m) m = D;
        }
        if (Math.abs(m - Dmax) < 1e-9) break;
        Dmax = m;
      }
      const Sp = Math.max(0, span - Dmax);
      for (let k = 0; k < n; k++) {
        const W = R.words[k];
        for (let j = 0; j < W.cells.length; j++) {
          const g = W.g0 + j;
          let a = S.from + d[g] * Sp;
          if (MOBILE) a = S.from + Math.floor((a - S.from) / MOBILE_STAGGER_VH + 1e-9) * MOBILE_STAGGER_VH;
          gA[g] = a;
          gD[g] = Math.max(1e-6, Dk[k]);
        }
      }
    }
    for (let k = 0; k < n; k++) {
      const W = R.words[k];
      if (!W.cells.length) {
        wordWindow(k);
        continue;
      }
      let a = Infinity;
      let b = -Infinity;
      for (let j = 0; j < W.cells.length; j++) {
        const g = W.g0 + j;
        if (gA[g] < a) a = gA[g];
        if (gA[g] + gD[g] > b) b = gA[g] + gD[g];
      }
      wA[k] = a;
      wB[k] = b;
    }
    S.gA = gA;
    S.gD = gD;
  }
  S.wA = wA;
  S.wB = wB;
  S.ver = R.geomVer;
  S.built = R.mode;
}

function wordP(S: Spec, k: number, vh: number): number {
  const a = S.wA[k];
  const b = S.wB[k];
  if (vh >= b) return vh >= a ? 1 : 0;
  if (vh <= a) return 0;
  return (vh - a) / (b - a);
}

/* ── the scrub writer's evaluation of one root ────────────────── */

interface FrameCtx {
  writes: number;
  deferred: number;
  maxWrites: number;
}

const GOV: { inS: Spec | null; outS: Spec | null } = { inS: null, outS: null };
const ST: GlyphState = { op: 1, yEm: 0, yPct: 0, skew: 0, rot: 0, blur: 0 };
const GOPT: { rho: number; mobile: boolean } = { rho: 0, mobile: MOBILE };
const WOPT: { rho: number; mobile: boolean } = { rho: 0, mobile: true };

/** The spec governing vh, and the pour it may overlap (in × out composition). */
function governing(R: Root, vh: number): void {
  const sp = R.specs;
  let i = -1;
  for (let k = 0; k < sp.length; k++) {
    if (sp[k].from <= vh) i = k;
    else break;
  }
  GOV.inS = null;
  GOV.outS = null;
  if (i < 0) {
    if (sp[0].isIn) GOV.inS = sp[0];
    else GOV.outS = sp[0];
    return;
  }
  const s = sp[i];
  if (s.isIn) {
    GOV.inS = s;
    return;
  }
  GOV.outS = s;
  for (let j = i - 1; j >= 0; j--) {
    if (!sp[j].isIn) continue;
    if (vh < sp[j].to) GOV.inS = sp[j];
    break;
  }
}

function touches(R: Root, lo: number, hi: number): boolean {
  for (const S of R.specs) if (S.to + 1 >= lo && S.from - 1 <= hi) return true;
  return false;
}

function evalRoot(R: Root, vh: number, E: FrameCtx): void {
  if (!R.specs.length) return;
  if (!R.live) {
    // between blocks: commit the render mode (text tier / measurement) and the blur gate
    commitMode(R, MODE === "glyph" && R.measured && !R.stale ? GLYPH : WORD);
    R.blurOK = blurAllowed();
  }
  governing(R, vh);
  const inS = GOV.inS;
  const outS = GOV.outS;
  if (inS && (inS.ver !== R.geomVer || inS.built !== R.mode)) buildTiming(R, inS);
  if (outS && (outS.ver !== R.geomVer || outS.built !== R.mode)) buildTiming(R, outS);
  const tight = E.writes > GLYPH_WRITE_CAP * 0.6;
  const blurIn = !!inS && inS.s.blur !== false && R.blurOK;
  const blurOut = !!outS && outS.s.blur !== false && R.blurOK;
  let live = false;
  const nW = R.words.length;
  // a root deferred last frame starts where it stopped (no word starves)
  const k0 = R.wStart < nW ? R.wStart : 0;
  R.wStart = 0;
  let deferredFirst = -1;
  for (let i = 0; i < nW; i++) {
    const k = (k0 + i) % nW;
    const W = R.words[k];
    let pIn = inS ? wordP(inS, k, vh) : 1;
    let pOut = outS ? wordP(outS, k, vh) : 0;
    if (tight) {
      // over-budget collapse: nearly-done words go to their word layer
      if (pIn > 0 && pIn <= 0.02) pIn = 0;
      else if (pIn >= 0.98 && pIn < 1) pIn = 1;
      if (pOut > 0 && pOut <= 0.02) pOut = 0;
      else if (pOut >= 0.98 && pOut < 1) pOut = 1;
    }
    const moving = (pIn > 0 && pIn < 1) || (pOut > 0 && pOut < 1);
    const glyphMode = R.mode === GLYPH && W.cells.length > 0;
    // Only a LIVE glyph word (one write per changed cell) ever waits a frame.
    // A terminal word (hidden / settled) costs one layer swap, ≤ 3 writes, and
    // is always written now: a one-frame jump across every block (scrollbar
    // drag, dock flight, fling) ends with every block terminal in that frame.
    const cost = 3 + W.cells.length;
    if (moving && glyphMode && E.writes > 0 && E.writes + cost > GLYPH_WRITE_CAP) {
      E.deferred += cost;
      R.dirty = true;
      if (deferredFirst < 0) deferredFirst = k;
      if (moving) live = true;
      continue;
    }
    if (!glyphMode) {
      // word level: the mover carries the grammar; the word layer stays shown
      let op = 1;
      let y = 0;
      if (inS && pIn < 1) {
        grammarState(inS.g, pIn, ST, WOPT);
        op = ST.op;
        y = ST.yEm;
      }
      if (outS && pOut > 0) {
        grammarState("evaporate", pOut, ST, WOPT);
        op *= ST.op;
        y += ST.yEm;
      }
      E.writes += setLayer(W, SETTLED) + writeMover(W, y, op);
      if (moving) live = true;
      continue;
    }
    const state = pIn <= 0 || pOut >= 1 ? HIDDEN : pIn >= 1 && pOut <= 0 ? SETTLED : LIVE;
    E.writes += setLayer(W, state);
    if (state !== LIVE) continue;
    live = true;
    const inLive = !!inS && pIn < 1;
    const outLive = !!outS && pOut > 0;
    for (let j = 0; j < W.cells.length; j++) {
      const c = W.cells[j];
      const g = W.g0 + j;
      let op = 1;
      let y = 0;
      let sk = 0;
      let rot = 0;
      if (inLive && inS) {
        GOPT.rho = c.rho;
        grammarState(inS.g, (vh - inS.gA[g]) / inS.gD[g], ST, GOPT);
        op = ST.op;
        y = ST.yEm;
        sk = ST.skew;
        rot = ST.rot;
      }
      if (outLive && outS) {
        grammarState("evaporate", (vh - outS.gA[g]) / outS.gD[g], ST, GOPT);
        op *= ST.op;
        y += ST.yEm;
      }
      E.writes += writeCell(c, y * W.fs, op, sk, rot, -1);
    }
    if ((blurIn || blurOut) && W.wd <= BLUR_MAX_WORD_PX) {
      const b = Math.max(blurIn && inLive && inS ? grammarBlur(inS.g, pIn) : 0, blurOut && outLive ? grammarBlur("evaporate", pOut) : 0);
      E.writes += writeLayerBlur(W, b);
    }
  }
  if (deferredFirst >= 0) R.wStart = deferredFirst;
  R.live = live;
}

/* ── time variants (play) ─────────────────────────────────────── */

interface PlayPlan {
  glyph: boolean;
  g: Grammar;
  dur: number;
  /** per glyph start (s) */
  t0: Float64Array;
  /** per word window (s) */
  ws: Float64Array;
  we: Float64Array;
  /** EVAPORATE base: per glyph op / y (em) / skew / rot; per word op / y (word mode) */
  bOp: Float64Array;
  bY: Float64Array;
  bSk: Float64Array;
  bR: Float64Array;
  wOp: Float64Array;
  wY: Float64Array;
}

function preparePlay(R: Root, g: Grammar, dur: number, spread: number): PlayPlan {
  syncWords(R);
  if (MODE === "glyph" && (!R.measured || R.stale || R.sig !== textSig(R))) measureRoot(R);
  const glyph = MODE === "glyph" && R.measured;
  // capture the EVAPORATE base before the mode commit can clear a word-mode mover
  const n = R.words.length;
  const N = glyph ? R.N : 0;
  const bOp = new Float64Array(N);
  const bY = new Float64Array(N);
  const bSk = new Float64Array(N);
  const bR = new Float64Array(N);
  const wOp = new Float64Array(n);
  const wY = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const W = R.words[k];
    const hidden = W.layer === HIDDEN || (W.wm && W.wop === 0);
    wOp[k] = hidden ? 0 : W.wm && W.wop === W.wop ? W.wop : 1;
    wY[k] = W.wm && W.wy === W.wy ? W.wy : 0;
    for (let j = 0; j < (glyph ? W.cells.length : 0); j++) {
      const c = W.cells[j];
      const gi = W.g0 + j;
      if (W.layer === LIVE && c.op === c.op) {
        bOp[gi] = c.op;
        bY[gi] = W.fs > 0 && c.y === c.y ? c.y / W.fs : 0;
        bSk[gi] = c.sk === c.sk ? c.sk : 0;
        bR[gi] = c.r === c.r ? c.r : 0;
      } else {
        bOp[gi] = wOp[k];
        bY[gi] = wY[k];
      }
    }
  }
  commitMode(R, glyph ? GLYPH : WORD);
  const order = GRAMMAR_DEFAULTS[g].order;
  const t0 = new Float64Array(N);
  const ws = new Float64Array(n);
  const we = new Float64Array(n);
  const d = glyph ? orderOf(R, order) : EMPTY_F64;
  for (let k = 0; k < n; k++) {
    const W = R.words[k];
    if (!glyph || !W.cells.length) {
      const a = wordOrder(R, order, k) * spread;
      ws[k] = a;
      we[k] = a + dur;
      continue;
    }
    let a = Infinity;
    for (let j = 0; j < W.cells.length; j++) {
      const gi = W.g0 + j;
      t0[gi] = d[gi] * spread;
      if (t0[gi] < a) a = t0[gi];
    }
    let b = -Infinity;
    for (let j = 0; j < W.cells.length; j++) b = Math.max(b, t0[W.g0 + j] + dur);
    ws[k] = a;
    we[k] = b;
  }
  return { glyph, g, dur, t0, ws, we, bOp, bY, bSk, bR, wOp, wY };
}

function renderPlay(R: Root, P: PlayPlan, t: number): void {
  const isIn = P.g !== "evaporate";
  let writes = 0;
  // a font landed mid-play: re-place the cells (positions only; the plan's order stands)
  if (R.stale && P.glyph && MODE === "glyph") measureRoot(R);
  for (let k = 0; k < R.words.length; k++) {
    const W = R.words[k];
    const span = P.we[k] - P.ws[k];
    const p = t <= P.ws[k] ? 0 : t >= P.we[k] ? 1 : span > 0 ? (t - P.ws[k]) / span : 1;
    if (!P.glyph || !W.cells.length) {
      let op: number;
      let y: number;
      if (isIn) {
        grammarState(P.g, p, ST, WOPT);
        op = ST.op;
        y = ST.yEm;
      } else {
        grammarState("evaporate", p, ST, WOPT);
        op = P.wOp[k] * ST.op;
        y = P.wY[k] + ST.yEm;
      }
      if (W.w || W.g) writes += setLayer(W, isIn ? (p <= 0 ? HIDDEN : SETTLED) : p >= 1 || P.wOp[k] <= 0 ? HIDDEN : SETTLED);
      writes += writeMover(W, y, op);
      continue;
    }
    if (isIn) {
      const state = p <= 0 ? HIDDEN : p >= 1 ? SETTLED : LIVE;
      writes += setLayer(W, state);
      if (state !== LIVE) continue;
      for (let j = 0; j < W.cells.length; j++) {
        const c = W.cells[j];
        GOPT.rho = c.rho;
        grammarState(P.g, (t - P.t0[W.g0 + j]) / P.dur, ST, GOPT);
        writes += writeCell(c, ST.yEm * W.fs, ST.op, ST.skew, ST.rot, -1);
      }
      continue;
    }
    // EVAPORATE from the captured base
    let full = true;
    let none = true;
    for (let j = 0; j < W.cells.length; j++) {
      const b = P.bOp[W.g0 + j];
      if (b < 1 || P.bY[W.g0 + j] !== 0 || P.bSk[W.g0 + j] !== 0 || P.bR[W.g0 + j] !== 0) full = false;
      if (b > 0) none = false;
    }
    const state = p >= 1 || none ? HIDDEN : p <= 0 && full ? SETTLED : LIVE;
    writes += setLayer(W, state);
    if (state !== LIVE) continue;
    for (let j = 0; j < W.cells.length; j++) {
      const c = W.cells[j];
      const gi = W.g0 + j;
      grammarState("evaporate", (t - P.t0[gi]) / P.dur, ST, GOPT);
      writes += writeCell(c, (P.bY[gi] + ST.yEm) * W.fs, P.bOp[gi] * ST.op, P.bSk[gi], P.bR[gi], -1);
    }
  }
  budget(writes);
}

function countClusters(R: Root): number {
  let n = 0;
  for (const W of R.words) n += clusterize((W.w ?? W.el).textContent ?? "").length;
  return n;
}

/** Hide (or show) every word of a root at once — the time variant's pre-state. */
function restAll(R: Root, state: number): void {
  let n = 0;
  for (const W of R.words) n += setLayer(W, state);
  budget(n);
}

/**
 * Time-based variant (§5.3 "time variants"): Gateway (0.9 s, 18 / 12 ms),
 * cue (0.5 s), dock verb (in 220 ms / 8 ms; out 140 ms / 6 ms), tag at the
 * lock (300 ms), chips (in 240 ms, out 160 ms). Usable outside a cinema
 * build (the Gateway has no ctx). Blur is off for time variants.
 */
export function playGlyphs(root: Element, g: Grammar, o: GlyphPlayOpts = {}): gsap.core.Timeline {
  const tl = gsap.timeline();
  if (!HAS_DOM || REDUCED) return tl;
  // the Gateway plays before the cinema (and its engine) exists: font loads must still re-place cells
  hookFonts();
  const R = rootOf(root);
  syncWords(R);
  for (const P of PLAY_ROOTS) if (!P.el.isConnected) PLAY_ROOTS.delete(P);
  PLAY_ROOTS.add(R);
  const isIn = g !== "evaporate";
  const dur = Math.max(0.01, o.dur ?? (isIn ? 0.6 : 0.26));
  const stagger = Math.max(0, o.stagger ?? (isIn ? 0.012 : 0.006));
  const delay = Math.max(0, o.delay ?? 0);
  const N = countClusters(R);
  let spread = Math.max(0, N - 1) * stagger;
  if (!isIn) spread = Math.min(spread, Math.max(EVAP_SPREAD_MIN, EVAP_SPREAD_K * dur));
  const total = dur + spread;
  if (isIn) restAll(R, HIDDEN);
  const st = { t: 0 };
  let plan: PlayPlan | null = null;
  const ensure = (): PlayPlan => plan ?? (plan = preparePlay(R, g, dur, spread));
  tl.to(
    st,
    {
      t: total,
      duration: total,
      ease: "none",
      immediateRender: false,
      onStart: () => {
        // the newest play owns the root from its start (a verb swapped out mid-pour)
        if (R.playTl && R.playTl !== tl) R.playTl.kill();
        R.playTl = tl;
        plan = preparePlay(R, g, dur, spread);
      },
      onUpdate: () => renderPlay(R, ensure(), st.t),
      onComplete: () => {
        for (const W of R.words) demote(W);
        if (R.playTl === tl) R.playTl = null;
      },
    },
    delay,
  );
  return tl;
}

/** Measure roots in the next idle slot (≤ `timeout` ms), e.g. the Gateway text before its boot pour. */
export function primeGlyphs(roots: Element[], timeout = 500): void {
  if (!HAS_DOM || REDUCED || MODE !== "glyph") return;
  hookFonts();
  const list = roots.map(rootOf);
  list.forEach((R) => PLAY_ROOTS.add(R));
  const run = () => list.forEach((R) => !R.measured && R.el.isConnected && measureRoot(R));
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  if (ric) ric(run, { timeout });
  else window.setTimeout(run, 50);
}

/* ── font loads re-measure every known root (play roots included) ── */

let fontsHooked = false;
const ENGINES = new Set<() => void>();
function hookFonts(): void {
  if (fontsHooked || !HAS_DOM || !document.fonts || typeof document.fonts.addEventListener !== "function") return;
  fontsHooked = true;
  document.fonts.addEventListener("loadingdone", () => {
    for (const R of PLAY_ROOTS) {
      if (!R.el.isConnected) {
        PLAY_ROOTS.delete(R);
        continue;
      }
      R.stale = true;
    }
    ENGINES.forEach((fn) => fn());
  });
}

/* ── text tier ────────────────────────────────────────────────── */

const SAMP = new Float64Array(TIER_FRAMES);
const SAMP_W = new Float64Array(TIER_FRAMES);
const SORT_A = new Float64Array(TIER_FRAMES);
const SORT_B = new Float64Array(TIER_FRAMES);
let sampN = 0;
let sampI = 0;
let sampFresh = false;
/** The writer's fixed cost per pass (root evaluation, timing), in write-equivalents. */
const PASS_K = 8;

function sample(ms: number, writes: number): void {
  SAMP[sampI] = ms;
  SAMP_W[sampI] = writes;
  sampI = (sampI + 1) % TIER_FRAMES;
  if (sampN < TIER_FRAMES) sampN++;
  sampFresh = true;
}

function pct(a: Float64Array, n: number, q: number): number {
  const v = a.subarray(0, n).sort();
  return v[Math.min(n - 1, Math.floor(n * q))];
}

/** Raw p95 (ms) of the writer's frame time over the last 60 frames with a live block (QA). */
export function glyphWriterP95Raw(): number {
  if (!sampN) return 0;
  SORT_A.set(SAMP.subarray(0, sampN));
  return pct(SORT_A, sampN, 0.95);
}

/**
 * The text tier's p95 (ms): the writer's own cost over the last 60 frames with
 * a live block, modelled as c·(writes + K) at the p95 write count, where c is
 * the MEDIAN cost per write-equivalent. Wall time alone is not the writer's
 * cost: a thread suspension inside the pass (OS preemption, GC, DevTools CPU
 * throttling, which pauses the main thread in slices) lands in a few frames
 * and would flip the whole session to word mode for good. The median per-write
 * cost ignores those frames; a writer that is genuinely slow is slow in every
 * frame, so its median rises and the tier still trips.
 */
export function glyphWriterP95(): number {
  if (!sampN) return 0;
  for (let i = 0; i < sampN; i++) {
    SORT_A[i] = SAMP[i] / (SAMP_W[i] + PASS_K);
    SORT_B[i] = SAMP_W[i] + PASS_K;
  }
  return pct(SORT_A, sampN, 0.5) * pct(SORT_B, sampN, 0.95);
}

function checkTier(): void {
  if (MODE !== "glyph" || sampN < TIER_FRAMES || !sampFresh) return;
  sampFresh = false;
  const p = glyphWriterP95();
  if (p > TIER_MS) {
    MODE = "word";
    console.info(`[cinema/glyphs] text tier: writer p95 ${p.toFixed(2)} ms > ${TIER_MS} ms — word mode for blocks not started yet`);
  }
}

/* ── the engine ───────────────────────────────────────────────── */

export function createGlyphEngine(): GlyphWriter {
  armGate();
  hookFonts();
  const scrubRoots: Root[] = [];
  const customRoots: Root[] = [];
  const E: FrameCtx = { writes: 0, deferred: 0, maxWrites: 0 };
  let prevVh = Number.NaN;
  let lastVh = 0;
  let rr = 0;
  let disposed = false;
  /** dev / QA only: the cinema's own frame slot is ignored while a harness drives the writer */
  let held = false;
  const stats = { frames: 0, overFrames: 0, deferFrames: 0, maxWrites: 0, maxPromoted: 0 };

  const invalidate = (): void => {
    if (disposed) return;
    for (const list of [scrubRoots, customRoots]) {
      for (const R of list) {
        R.stale = true;
        if (R.live && MODE === "glyph") measureRoot(R);
        else enqueue(R);
      }
    }
  };
  ENGINES.add(invalidate);
  ScrollTrigger.addEventListener("refresh", invalidate);

  const run = (vh: number, all: boolean): void => {
    const t0 = now();
    budgetForRun();
    E.writes = 0;
    E.deferred = 0;
    const lo = all || Number.isNaN(prevVh) ? vh : Math.min(prevVh, vh);
    const hi = all || Number.isNaN(prevVh) ? vh : Math.max(prevVh, vh);
    let anyLive = false;
    const n = scrubRoots.length;
    const start = n ? rr++ % n : 0;
    for (let i = 0; i < n; i++) {
      const R = scrubRoots[(start + i) % n];
      if (!all && !R.dirty && !touches(R, lo, hi)) continue;
      R.dirty = false;
      evalRoot(R, vh, E);
      if (R.live) anyLive = true;
    }
    glyphBudget.write(E.writes);
    if (E.deferred) glyphBudget.defer(E.deferred);
    prevVh = vh;
    lastVh = vh;
    stats.frames++;
    if (E.writes > stats.maxWrites) stats.maxWrites = E.writes;
    if (E.writes > GLYPH_WRITE_CAP) stats.overFrames++;
    if (E.deferred) stats.deferFrames++;
    if (PROMOTED > stats.maxPromoted) stats.maxPromoted = PROMOTED;
    if (anyLive) sample(now() - t0, E.writes);
    else checkTier();
  };

  const engine: GlyphWriter = {
    get mode() {
      return MODE;
    },
    scrub(spec: GlyphBlockSpec) {
      if (!spec || !spec.root) return;
      const R = rootOf(spec.root);
      syncWords(R);
      if (!R.scrub) {
        R.scrub = true;
        scrubRoots.push(R);
      }
      R.specs.push(makeSpec(spec));
      R.specs.sort((a, b) => a.from - b.from);
      R.prio = Math.min(R.prio, spec.from);
      R.dirty = true;
      if (IS_DEV) {
        const span = spec.to - spec.from;
        const wrm = spec.wordRiseMin ?? WORD_RISE_MIN;
        if (spec.grammar !== "evaporate" && span < wrm)
          console.warn(`[cinema/glyphs] block "${spec.id}": window ${span} vh < word rise floor ${wrm} vh (§5.2)`);
        if (spec.grammar === "evaporate" && span > 16)
          console.info(`[cinema/glyphs] block "${spec.id}": EVAPORATE over ${span} vh (> 16 vh, §5.3)`);
        if (FLAGS.DEV_ASSERT) claimFrameWriter("CORE", R.words.map((W) => W.el), ["transform", "opacity"]);
      }
      enqueue(R);
    },
    play: playGlyphs,
    cells(root: Element): GlyphCells {
      const R = rootOf(root);
      syncWords(R);
      if (!R.custom) {
        R.custom = true;
        R.prio = Math.min(R.prio, 0);
        customRoots.push(R);
        root.setAttribute("data-cx-glyphs", "");
      }
      enqueue(R);
      const words = R.words.map((W) => W.pub);
      return {
        words,
        setWord(k: number, p: number) {
          const W = R.words[k];
          if (!W) return;
          const rest = !(p > 0 && p < 1);
          if (rest) publish(R, W);
          W.lastP = p;
          const state = p <= 0 ? HIDDEN : p >= 1 ? SETTLED : W.pub.glyphs.length ? LIVE : SETTLED;
          budget(setLayer(W, state));
        },
        writeGlyph(k: number, j: number, y: number, op: number, rot = 0, skew = 0, rgb = -1) {
          const W = R.words[k];
          if (!W || j >= W.pub.glyphs.length) return;
          budget(writeCell(W.cells[j], y * W.fs, op, MOBILE ? 0 : skew, MOBILE ? 0 : rot, rgb));
        },
        writeWordBlur(k: number, px: number) {
          const W = R.words[k];
          if (!W) return;
          const v = Math.round(Math.max(0, px) * 20) / 20;
          if (v === W.mBlur) return;
          W.mBlur = v;
          W.el.style.filter = v > 0 ? "blur(" + v + "px)" : "";
          budget(1);
        },
      };
    },
    frame(vh: number) {
      if (held) return;
      if (!scrubRoots.length) {
        prevVh = vh;
        return;
      }
      run(vh, false);
    },
    writeAll(vh: number) {
      for (const R of scrubRoots) R.dirty = true;
      run(vh, true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ENGINES.delete(invalidate);
      ScrollTrigger.removeEventListener("refresh", invalidate);
      for (const R of [...scrubRoots, ...customRoots]) for (const W of R.words) demote(W);
      scrubRoots.length = 0;
      customRoots.length = 0;
    },
  };

  if (IS_DEV && HAS_DOM) {
    (window as unknown as { __cxGlyphs?: unknown }).__cxGlyphs = {
      mode: () => MODE,
      /** QA: ignore the cinema's frame slot (the live master vh) while a harness steps the writer */
      hold: (on: boolean) => {
        held = on;
      },
      /** QA: one writer pass at vh (also while held) */
      step: (vh: number) => run(vh, false),
      /** dev: force the CPU text tier (blocks not started yet switch to word mode) */
      forceWord: () => {
        MODE = "word";
      },
      p95: glyphWriterP95,
      /** QA: raw p95 of the writer's wall time (includes thread suspensions) */
      p95raw: glyphWriterP95Raw,
      /** QA: writes of the scrub writer's last pass (the per-frame write profile) */
      lastWrites: () => E.writes,
      /** QA: writes deferred to the next frame by the last pass */
      lastDeferred: () => E.deferred,
      /** QA: clear the writer-cost samples (p95 over the next 60 live frames) */
      resetSamples: () => {
        sampN = 0;
        sampI = 0;
        sampFresh = false;
      },
      stats: () => {
        let cells = 0;
        let measured = 0;
        for (const R of [...scrubRoots, ...customRoots]) {
          if (R.measured) measured++;
          for (const W of R.words) cells += W.cells.length;
        }
        return {
          mode: MODE,
          scrubRoots: scrubRoots.length,
          customRoots: customRoots.length,
          measured,
          cells,
          queue: QUEUE.length,
          gateOpen,
          promoted: PROMOTED,
          ...stats,
          budgetOverFrames: glyphBudget.overFrames,
          p95: glyphWriterP95(),
        };
      },
      /** per block: progress of every word at the last written vh (readharness) */
      blocks: () =>
        scrubRoots.flatMap((R) =>
          R.specs.map((S) => {
            if (S.ver !== R.geomVer || S.built !== R.mode) buildTiming(R, S);
            return {
              id: S.s.id,
              grammar: S.g,
              from: S.from,
              to: S.to,
              mode: R.mode === GLYPH ? "glyph" : "word",
              vh: lastVh,
              words: R.words.map((_, k) => Math.round(wordP(S, k, lastVh) * 1000) / 1000),
            };
          }),
        ),
      /** measure every registered root now (sync) */
      measureNow: () => [...scrubRoots, ...customRoots].forEach((R) => measureRoot(R)),
      /** QA: measure ANY root (creates its cells) — e.g. every [data-cx-split] block for check() */
      measure: (el: Element) => measureRoot(rootOf(el)),
      measureDom: () => {
        let n = 0;
        document.querySelectorAll("[data-cx-split]").forEach((el) => {
          if (measureRoot(rootOf(el))) n++;
        });
        return n;
      },
      check: checkGlyphCopy,
      /** QA harness access to this engine (scrub test blocks, step frame(vh)) */
      engine,
    };
  }
  return engine;
}

/**
 * Dev / test: for every MaskWords block in the document, `.cx-sr`, the words
 * joined by one space and (per word) the concatenated glyph cells must be
 * byte-identical. Returns the mismatches (empty = pass).
 */
export function checkGlyphCopy(scope: ParentNode = document): string[] {
  const bad: string[] = [];
  scope.querySelectorAll<HTMLElement>("[data-cx-split]").forEach((root) => {
    const sr = childByClass(root, "cx-sr");
    const words = Array.from(root.querySelectorAll<HTMLElement>(".cx-mw__w")).map((w) => w.textContent ?? "");
    // a no-break space that glues a dash to its word (Ch4 sub, C3 lead) reads as copy.ts's plain space
    const joined = words.join(" ").replace(/\u00a0/g, " ");
    if (sr && sr.textContent !== joined) bad.push(`sr ≠ words: "${sr.textContent}" vs "${joined}"`);
    root.querySelectorAll<HTMLElement>(".cx-mw__i").forEach((mi) => {
      const w = childByClass(mi, "cx-mw__w");
      const g = childByClass(mi, "cx-mw__g");
      if (!w || !g || !g.childElementCount) return;
      let s = "";
      g.querySelectorAll(".cx-ch").forEach((c) => (s += c.textContent ?? ""));
      if (s !== w.textContent) bad.push(`glyphs ≠ word: "${s}" vs "${w.textContent}"`);
    });
  });
  return bad;
}
