/* ============================================================
   cinema/type/glyphs.ts — the glyph engine (spec rev 3.1 §5.1–§5.2).
   WP0 STUB (word-level maskRise behaviour) → owned by WP5.

   Contract (types in cinema/types.ts: GlyphEngine, GlyphBlockSpec,
   GlyphCells, Grammar):
   - scrub(spec)  registers a scrubbed block on the glyph writer, which
                  runs at FrameOrder.Glyphs (31). Each frame it evaluates
                  every block whose [from − 1, to + 1] intersects
                  [min(prevVh, vh), max(prevVh, vh)] (a block crossed in one
                  big step still gets its terminal state), and writes only
                  changed values. `writeAll(vh)` writes every block once
                  (playhead.jump / settle).
   - play(root, g, o)  time-based variant (Gateway, dock verb, tag, chips).
   - cells(root)  low-level write-on-change cells (respiro, HUD, chips).
   - mode         "glyph" | "word" (CPU text tier, §4.9).
   Dev: every write is counted by cinema/dev/assert.ts glyphBudget
   (≤ 140 glyph writes and ≤ 8 promoted words per frame).

   The stub works at WORD level only (mode "word"): a scrubbed block
   rises word by word like v2's maskRise inside the existing `.cx-mw`
   masks. Nothing in WP0 registers a block, so it is inert.
   ============================================================ */

import gsap from "gsap";
import type { GlyphBlockSpec, GlyphCells, GlyphEngine, Grammar } from "../types";
import { grammarState, WORD_RISE_MIN, type GlyphState } from "./grammars";
import { glyphBudget } from "../dev/assert";

export interface GlyphWriter extends GlyphEngine {
  /** The frame fn the cinema registers at FrameOrder.Glyphs. */
  frame(vh: number): void;
  /** Write every registered block's state at vh (jump / settle / refresh). */
  writeAll(vh: number): void;
  /** Drop every block (cinema destroy). */
  dispose(): void;
}

interface WordCell {
  el: HTMLElement;
  /** last written yPct / opacity (NaN = never written) */
  y: number;
  op: number;
}

interface Block {
  spec: GlyphBlockSpec;
  words: WordCell[];
  dur: number;
  stagger: number;
}

const q3 = (v: number): number => Math.round(v * 1000) / 1000;

function wordsOf(root: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>(".cx-mw__i").forEach((e) => out.push(e));
  return out;
}

export function createGlyphEngine(): GlyphWriter {
  const blocks: Block[] = [];
  let prevVh = Number.NaN;
  const st: GlyphState = { op: 1, yEm: 0, yPct: 0, skew: 0, rot: 0, blur: 0 };

  const writeBlock = (b: Block, vh: number): void => {
    const n = b.words.length;
    for (let k = 0; k < n; k++) {
      const a = b.spec.from + k * b.stagger;
      const q = (vh - a) / b.dur;
      grammarState(b.spec.grammar, q, st);
      const c = b.words[k];
      const y = q3(st.yPct);
      const op = q3(st.op);
      if (y !== c.y || op !== c.op) {
        c.el.style.transform = y === 0 ? "" : `translate3d(0, ${y}%, 0)`;
        c.el.style.opacity = op === 1 ? "" : String(op);
        c.y = y;
        c.op = op;
        glyphBudget.write(1);
      }
    }
  };

  const engine: GlyphWriter = {
    mode: "word",
    scrub(spec) {
      const words = wordsOf(spec.root).map((el) => ({ el, y: Number.NaN, op: Number.NaN }));
      const span = Math.max(0, spec.to - spec.from);
      const n = words.length;
      const dur = Math.min(span, Math.max(spec.wordRiseMin ?? WORD_RISE_MIN, span / 2));
      const stagger = n > 1 ? Math.max(0, (span - dur) / (n - 1)) : 0;
      blocks.push({ spec, words, dur: Math.max(dur, 1e-6), stagger });
    },
    play(root: Element, g: Grammar, o?: { dur?: number; stagger?: number; delay?: number }) {
      const words = wordsOf(root);
      const tl = gsap.timeline({ delay: o?.delay ?? 0 });
      if (!words.length) return tl;
      const dur = o?.dur ?? 0.6;
      const stagger = o?.stagger ?? 0.03;
      if (g === "evaporate") {
        tl.to(words, { yPercent: -105, opacity: 0, duration: dur, stagger: { each: stagger, from: "end" }, ease: "sine.in" });
      } else {
        tl.fromTo(words, { yPercent: 105, opacity: 0 }, { yPercent: 0, opacity: 1, duration: dur, stagger, ease: "sine.out" });
      }
      return tl;
    },
    cells(root: Element): GlyphCells {
      const els = wordsOf(root);
      const blur = els.map(() => -1);
      return {
        words: els.map((el) => ({ el, glyphs: [], x0: 0, w: 0 })),
        setWord(k: number, p: number) {
          const el = els[k];
          if (!el) return;
          grammarState("ink", p, st);
          el.style.transform = st.yPct === 0 ? "" : `translate3d(0, ${q3(st.yPct)}%, 0)`;
          el.style.opacity = st.op >= 1 ? "" : String(q3(st.op));
          glyphBudget.write(1);
        },
        writeGlyph() {
          /* word mode: no glyph cells */
        },
        writeWordBlur(k: number, px: number) {
          const el = els[k];
          const v = Math.round(px * 20) / 20;
          if (!el || v === blur[k]) return;
          blur[k] = v;
          el.style.filter = v > 0 ? `blur(${v}px)` : "";
        },
      };
    },
    frame(vh: number) {
      if (!blocks.length) {
        prevVh = vh;
        return;
      }
      const lo = Number.isNaN(prevVh) ? vh : Math.min(prevVh, vh);
      const hi = Number.isNaN(prevVh) ? vh : Math.max(prevVh, vh);
      glyphBudget.begin();
      for (const b of blocks) {
        if (b.spec.to + 1 < lo || b.spec.from - 1 > hi) continue;
        writeBlock(b, vh);
      }
      glyphBudget.end();
      prevVh = vh;
    },
    writeAll(vh: number) {
      glyphBudget.begin();
      for (const b of blocks) writeBlock(b, vh);
      glyphBudget.end();
      prevVh = vh;
    },
    dispose() {
      blocks.length = 0;
    },
  };
  return engine;
}
