/* ============================================================
   cinema/ch1/ink.ts — WP6 glyph grammar for hand-built cells
   (spec rev 3.1 §5.3 time variants). Owner: WP6.

   The scrubbed paper/dark text blocks belong to WP5's glyph writer.
   WP6's own small texts are built here, as plain glyph cells, because
   their content is runtime data or a fixed mono readout:
     - the HUD "AZ ###° · varredura ativa" (EVAPORATE 30–62 + INK pour on reveal)
     - echo / decoy / cursor / sweep-flash chips (INK 240/160 ms in, EVAPORATE 160 ms out)
     - the target tag at the lock (INK 300 ms)
   Mono texts are split one cell per character: Plex Mono has no kerning,
   so per-glyph inline-blocks advance exactly like the text run. Display
   text (Playfair chip values) is split per WORD, which keeps its kerning.

   Grammars (q = local progress 0..1, `em` = the cell's font size, px):
     INK        opacity cx-ink-bloom(min(1, 1.6q)); y 0.32em·(1 − s);
                skewX −7°·(1 − s); rotate ρ·(1 − s), s = cx-ink-settle(q)
     LIGHT      opacity cx-ink-bloom(min(1, 1.4q)); y 0.32em·(1 − s)
     EVAPORATE  opacity 1 − cx-evap(q); y −0.22em·cx-evap(q)
   Text never overshoots (every text ease peaks at exactly 1). Mobile:
   opacity and y only.
   ============================================================ */

import { cxEase } from "../eases";

export interface GState {
  /** translateY, px (positive = below the rest line) */
  y: number;
  op: number;
  /** skewX, deg */
  skew: number;
  /** rotate, deg */
  rot: number;
}

export const newState = (): GState => ({ y: 0, op: 1, skew: 0, rot: 0 });

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The v3 ease family as plain functions, resolved once (never per frame). */
export interface Eases {
  bloom: (t: number) => number;
  settle: (t: number) => number;
  dry: (t: number) => number;
  evap: (t: number) => number;
  flow: (t: number) => number;
  pour: (t: number) => number;
  meniscus: (t: number) => number;
}
let cached: Eases | null = null;
/** Call from a build() (after cinema/eases.ts has registered the curves). */
export function eases(): Eases {
  if (cached) return cached;
  cached = {
    bloom: cxEase("cx-ink-bloom"),
    settle: cxEase("cx-ink-settle"),
    dry: cxEase("cx-ink-dry"),
    evap: cxEase("cx-evap"),
    flow: cxEase("cx-flow"),
    pour: cxEase("cx-pour"),
    meniscus: cxEase("cx-meniscus"),
  };
  return cached;
}

/** INK (paper) at local progress q. `rho` = the glyph's seeded rotation (deg). */
export function inkAt(E: Eases, q: number, em: number, rho: number, lite: boolean, out: GState): GState {
  if (q <= 0) {
    out.op = 0;
    out.y = 0.32 * em;
    out.skew = lite ? 0 : -7;
    out.rot = lite ? 0 : rho;
    return out;
  }
  if (q >= 1) {
    out.op = 1;
    out.y = 0;
    out.skew = 0;
    out.rot = 0;
    return out;
  }
  const s = E.settle(q);
  out.op = E.bloom(Math.min(1, q * 1.6));
  out.y = 0.32 * em * (1 - s);
  out.skew = lite ? 0 : -7 * (1 - s);
  out.rot = lite ? 0 : rho * (1 - s);
  return out;
}

/** LIGHT (dark) at local progress q — y and opacity only. */
export function lightAt(E: Eases, q: number, em: number, out: GState): GState {
  out.skew = 0;
  out.rot = 0;
  if (q <= 0) {
    out.op = 0;
    out.y = 0.32 * em;
    return out;
  }
  if (q >= 1) {
    out.op = 1;
    out.y = 0;
    return out;
  }
  out.op = E.bloom(Math.min(1, q * 1.4));
  out.y = 0.32 * em * (1 - E.settle(q));
  return out;
}

/** EVAPORATE at local progress q (0 = settled, 1 = gone). */
export function evapAt(E: Eases, q: number, em: number, out: GState): GState {
  const e = E.evap(clamp01(q));
  out.op = 1 - e;
  out.y = -0.22 * em * e;
  out.skew = 0;
  out.rot = 0;
  return out;
}

/** ±3° seeded per glyph (stable across loads). */
export function seededRot(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return ((s - Math.floor(s)) * 2 - 1) * 3;
}

/* ── write-on-change glyph cell ─────────────────────────────── */

const qy = (v: number): number => Math.round(v * 20) / 20; // 0.05 px
const qo = (v: number): number => Math.round(v * 250) / 250; // 0.004
const qa = (v: number): number => Math.round(v * 10) / 10; // 0.1°

export class GCell {
  private y = Number.NaN;
  private op = Number.NaN;
  private sk = Number.NaN;
  private ro = Number.NaN;
  constructor(readonly el: HTMLElement) {}
  /** Returns true when something was written. */
  write(s: GState): boolean {
    const y = qy(s.y);
    const op = qo(s.op);
    const sk = qa(s.skew);
    const ro = qa(s.rot);
    let wrote = false;
    if (y !== this.y || sk !== this.sk || ro !== this.ro) {
      this.y = y;
      this.sk = sk;
      this.ro = ro;
      this.el.style.transform =
        y === 0 && sk === 0 && ro === 0
          ? ""
          : `translate3d(0, ${y}px, 0)${sk !== 0 ? ` skewX(${sk}deg)` : ""}${ro !== 0 ? ` rotate(${ro}deg)` : ""}`;
      wrote = true;
    }
    if (op !== this.op) {
      this.op = op;
      this.el.style.opacity = op >= 1 ? "" : String(op);
      wrote = true;
    }
    return wrote;
  }
  /** Forget the cache (after an external reset of the element). */
  reset(): void {
    this.y = this.op = this.sk = this.ro = Number.NaN;
  }
}

/* ── building cells ─────────────────────────────────────────── */

/** "███" runs (copy.ts redactions) become one capsule cell each (§7 C5). */
const RUN = /(█+)/;

export interface BuiltCells {
  cells: GCell[];
  /** reading-order index of every cell's first character (for the stagger) */
  count: number;
}

/**
 * Fill `host` with one inline-block cell per character of `text` (mono
 * text: exact advances), every "███" run as ONE capsule cell
 * (`.cx-redact`: transparent glyphs over a currentColor capsule, so its
 * width is the run's own advance). `cls` is the cell class.
 */
export function buildCharCells(host: HTMLElement, text: string, cls: string): GCell[] {
  host.textContent = "";
  const out: GCell[] = [];
  for (const part of text.split(RUN)) {
    if (!part) continue;
    if (part.startsWith("█")) {
      const i = document.createElement("i");
      i.className = `${cls} cx-redact`;
      i.textContent = part;
      host.append(i);
      out.push(new GCell(i));
      continue;
    }
    for (const ch of part) {
      const s = document.createElement("span");
      s.className = cls;
      s.textContent = ch;
      host.append(s);
      out.push(new GCell(s));
    }
  }
  return out;
}

/** One cell per WORD (display text keeps its kerning); spaces are their own cells. */
export function buildWordCells(host: HTMLElement, text: string, cls: string): GCell[] {
  host.textContent = "";
  const out: GCell[] = [];
  const parts = text.split(/(\s+)/);
  for (const p of parts) {
    if (!p) continue;
    for (const piece of p.split(RUN)) {
      if (!piece) continue;
      const el = piece.startsWith("█") ? document.createElement("i") : document.createElement("span");
      el.className = piece.startsWith("█") ? `${cls} cx-redact` : cls;
      el.textContent = piece;
      host.append(el);
      out.push(new GCell(el));
    }
  }
  return out;
}

/** Time-based INK pour of n cells, ltr: cell j over [delay + j·stagger, + dur] (seconds). */
export function pourQ(t: number, j: number, n: number, total: number, glyphDur: number): number {
  const stagger = n > 1 ? Math.max(0, total - glyphDur) / (n - 1) : 0;
  return (t - j * stagger) / glyphDur;
}
