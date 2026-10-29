/* ============================================================
   cinema/MaskWords.tsx — the cinema's word/glyph markup (spec rev 3.1 §5.1). WP5.

   <MaskWords text="Nenhuma base…" />  (split="chars", the cinema default) →

     <p class="…">
       <span class="cx-sr">Nenhuma base pública declara esse faturamento.</span>
       <span class="cx-mwv" aria-hidden="true">
         <span class="cx-mw" data-i="0">        untransformed word box (measure it)
           <span class="cx-mw__i">              word mover: word-level blur / colour / layer
             <span class="cx-mw__w">Nenhuma</span>      whole kerned word, IN FLOW: sizes the box
             <span class="cx-mw__g" aria-hidden="true"> absolute, inset 0, takes no width;
               <span class="cx-ch" style="left: x_j">N</span> …   ← filled by the glyph engine
             </span>
           </span>
         </span> …
       </span>
     </p>

   - `.cx-sr` carries the real text for assistive tech (an aria-label on a
     generic span is not reliably announced). It is generated from the same
     string as the visible words, so `.cx-sr`, the joined words and the
     concatenated glyphs are byte-identical to copy.ts (unit-tested).
   - The glyph cells are NOT rendered by React: the engine
     (cinema/type/glyphs.ts) creates them lazily, after the Gateway's boot,
     at the kerned x it measures with Range rects (ligature clusters merged).
     React renders `.cx-mw__g` empty and never reconciles its children.
   - The CSS default is the readable state: the word layer shows and the
     glyph layer is hidden, so reduced motion (no engine at all) and word
     mode need no JS. `.cx-mw` no longer clips (`overflow: visible`, A1).
   - split="words" renders the word layer only (no glyph layer): the engine
     drives such a block at word level.
   - `Words` / `.rk-word` (Ch6+) stay untouched.
   ============================================================ */

import { Fragment, createElement, type ReactNode } from "react";
import gsap from "gsap";

export interface MaskWord {
  t: string;
  em?: boolean;
  /** A forced line break after this word (`<br class="cx-mw-br">`, outside
   *  the word box; hide it per breakpoint in CSS where it must not apply). */
  br?: boolean;
}

export interface MaskWordsProps {
  /** Plain text, split on spaces… */
  text?: string;
  /** …or explicit words (e.g. RESPIRO_WORDS with em flags). */
  words?: readonly MaskWord[];
  as?: "span" | "p" | "h2" | "h3" | "div";
  className?: string;
  /** Extra class on each `.cx-mw` (e.g. "cx-respiro__w"). */
  wordClassName?: string;
  /** Extra class on em words' `.cx-mw`. */
  emClassName?: string;
  /** Rendered inside each word box after the mover (e.g. a redaction bar). */
  renderExtra?: (w: MaskWord, i: number) => ReactNode;
  /** v3: "chars" (default) adds the glyph layer the engine fills; "words" = word layer only. */
  split?: "words" | "chars";
  /** v3: render the visually hidden `.cx-sr` copy (default true). Pass false when the
   *  block already carries its own screen-reader copy (e.g. the respiro's `.cx-sr-only`). */
  sr?: boolean;
}

export function splitWords(text: string): MaskWord[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({ t }));
}

/**
 * The exact string the block reads as (`.cx-sr`): the given text, or the words
 * joined by one space. A no-break space that a stage put inside a word only to
 * glue a dash to it ("elite —", a layout device) reads as the plain space
 * copy.ts has, so `.cx-sr` stays byte-identical to copy.ts.
 */
export function maskWordsLabel(text: string | undefined, words: readonly MaskWord[]): string {
  return (text ?? words.map((w) => w.t).join(" ")).replace(/ /g, " ");
}

export function MaskWords({
  text,
  words,
  as = "span",
  className,
  wordClassName,
  emClassName,
  renderExtra,
  split = "chars",
  sr = true,
}: MaskWordsProps) {
  const list = words ?? splitWords(text ?? "");
  const label = maskWordsLabel(text, list);
  const chars = split === "chars";
  const visual = (
    <span className="cx-mwv" aria-hidden="true" key="v">
      {list.map((w, i) => {
        const cls = ["cx-mw", wordClassName, w.em ? emClassName : null].filter(Boolean).join(" ");
        const word = (
          <span className={cls} key={i} data-i={i}>
            <span className="cx-mw__i">
              <span className="cx-mw__w">{w.t}</span>
              {chars ? <span className="cx-mw__g" aria-hidden="true" /> : null}
            </span>
            {renderExtra?.(w, i)}
          </span>
        );
        if (!w.br) return word;
        return (
          <Fragment key={i}>
            {word}
            <br className="cx-mw-br" aria-hidden="true" />
          </Fragment>
        );
      })}
    </span>
  );
  return createElement(
    as,
    { className, "data-cx-split": split },
    sr ? (
      <span className="cx-sr" key="sr">
        {label}
      </span>
    ) : null,
    visual,
  );
}

/**
 * Imperative twin of <MaskWords> for pooled, non-React nodes (chips, dock
 * verbs): replaces `host`'s children with the same markup. Returns `host`.
 * Call `glyphs.play(host, …)` afterwards; the engine re-measures a root
 * whose text changed.
 */
export function renderMaskWordsDOM(
  host: HTMLElement,
  content: string | readonly MaskWord[],
  opts: { split?: "words" | "chars"; sr?: boolean; wordClassName?: string; emClassName?: string } = {},
): HTMLElement {
  const list = typeof content === "string" ? splitWords(content) : content;
  const label = maskWordsLabel(typeof content === "string" ? content : undefined, list);
  const chars = (opts.split ?? "chars") === "chars";
  const frag = document.createDocumentFragment();
  if (opts.sr ?? true) {
    const s = document.createElement("span");
    s.className = "cx-sr";
    s.textContent = label;
    frag.appendChild(s);
  }
  const v = document.createElement("span");
  v.className = "cx-mwv";
  v.setAttribute("aria-hidden", "true");
  list.forEach((w, i) => {
    const mw = document.createElement("span");
    mw.className = ["cx-mw", opts.wordClassName, w.em ? opts.emClassName : null].filter(Boolean).join(" ");
    mw.dataset.i = String(i);
    const mi = document.createElement("span");
    mi.className = "cx-mw__i";
    const ww = document.createElement("span");
    ww.className = "cx-mw__w";
    ww.textContent = w.t;
    mi.appendChild(ww);
    if (chars) {
      const g = document.createElement("span");
      g.className = "cx-mw__g";
      g.setAttribute("aria-hidden", "true");
      mi.appendChild(g);
    }
    mw.appendChild(mi);
    v.appendChild(mw);
    if (w.br) {
      const br = document.createElement("br");
      br.className = "cx-mw-br";
      br.setAttribute("aria-hidden", "true");
      v.appendChild(br);
    }
  });
  frag.appendChild(v);
  host.replaceChildren(frag);
  host.dataset.cxSplit = chars ? "chars" : "words";
  return host;
}

/* ── LEGACY v2 scrubbed helpers (time unit = vh) ──────────────────
   Kept, behaviour-identical, ONLY for call sites that have not moved to
   `ctx.glyphs.scrub()` yet (WP7 migrates every one of them). Because
   `.cx-mw` no longer clips in v3, each targeted word box gets the legacy
   class `cx-mw--clip` (base.css) so the v2 rise stays masked exactly as
   before. Delete these two helpers and the LEGACY block of base.css once
   nothing imports them (§11 item 34 grep). */

export interface MaskOpts {
  /** vh between word starts (default 1). */
  stagger?: number;
  /** Default "sine.out" (a positional settle, §5). */
  ease?: string;
  /** Rise distance in yPercent (default 105). */
  yPercent?: number;
}

const inner = (target: string | Element | ArrayLike<Element>): Element[] => {
  const roots = gsap.utils.toArray<Element>(target);
  const out: Element[] = [];
  for (const r of roots) {
    if (r.classList.contains("cx-mw__i")) out.push(r);
    else r.querySelectorAll(".cx-mw__i").forEach((e) => out.push(e));
  }
  for (const e of out) e.parentElement?.classList.add("cx-mw--clip");
  return out;
};

/** @deprecated v2 — use `ctx.glyphs.scrub({ grammar: "ink", … })`. Words yPercent 105 → 0 in a clip. */
export function maskRise(
  tl: gsap.core.Timeline,
  target: string | Element | ArrayLike<Element>,
  from: number,
  to: number,
  opts: MaskOpts = {},
): Element[] {
  const els = inner(target);
  if (!els.length) return els;
  const stagger = opts.stagger ?? 1;
  const y = opts.yPercent ?? 105;
  const dur = Math.max(0.5, to - from - stagger * (els.length - 1));
  gsap.set(els, { yPercent: y, opacity: 0 });
  tl.to(els, { yPercent: 0, opacity: 1, duration: dur, ease: opts.ease ?? "sine.out", stagger }, from);
  return els;
}

/** @deprecated v2 — use `ctx.glyphs.scrub({ grammar: "evaporate", … })`. */
export function maskOut(
  tl: gsap.core.Timeline,
  target: string | Element | ArrayLike<Element>,
  from: number,
  to: number,
  opts: MaskOpts = {},
): Element[] {
  const els = inner(target);
  if (!els.length) return els;
  const stagger = opts.stagger ?? 0;
  const dur = Math.max(0.5, to - from - stagger * (els.length - 1));
  tl.to(
    els,
    { yPercent: -(opts.yPercent ?? 105), opacity: 0, duration: dur, ease: opts.ease ?? "sine.inOut", stagger },
    from,
  );
  return els;
}
