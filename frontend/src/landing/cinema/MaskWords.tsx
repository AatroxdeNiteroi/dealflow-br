/* ============================================================
   cinema/MaskWords.tsx — in-house word splitter (WP0; no SplitText).

   <MaskWords text="…" />  →  <span aria-label="…">
                                <span class="cx-mw" aria-hidden><span class="cx-mw__i">word</span></span> …
   The outer `.cx-mw` is the overflow:hidden mask (untransformed —
   measure it), the inner `.cx-mw__i` is the mover. Readable final
   state is the CSS default (reduced motion needs no JS); the hidden
   pre-state comes from gsap.set at build time (maskRise()).
   `Words` / `.rk-word` (Ch6+) stay untouched.
   ============================================================ */

import { Fragment, createElement, type ReactNode } from "react";
import gsap from "gsap";

export interface MaskWord {
  t: string;
  em?: boolean;
  /** A forced line break after this word (`<br class="cx-mw-br">`, outside
   *  the mask; hide it per breakpoint in CSS where it must not apply). */
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
  /** Rendered inside each word mask after the text (e.g. a redaction bar). */
  renderExtra?: (w: MaskWord, i: number) => ReactNode;
}

export function splitWords(text: string): MaskWord[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({ t }));
}

export function MaskWords({
  text,
  words,
  as = "span",
  className,
  wordClassName,
  emClassName,
  renderExtra,
}: MaskWordsProps) {
  const list = words ?? splitWords(text ?? "");
  const label = text ?? list.map((w) => w.t).join(" ");
  return createElement(
    as,
    { className, "aria-label": label },
    list.map((w, i) => {
      const cls = ["cx-mw", wordClassName, w.em ? emClassName : null].filter(Boolean).join(" ");
      const word = (
        <span className={cls} key={i} data-i={i} aria-hidden="true">
          <span className="cx-mw__i">{w.t}</span>
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
    }),
  );
}

/* ── scrubbed helpers for the master (time unit = vh) ───────── */

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
  return out;
};

/**
 * MaskWords rise over [from, to] vh: each word yPercent 105 → 0, opacity 0 → 1,
 * staggered `stagger` vh; per-word duration = (to − from) − stagger·(n − 1).
 * Sets the pre-state with gsap.set at build (never CSS), so reduced motion
 * (no build) reads the final state.
 */
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

/** MaskWords out over [from, to]: yPercent 0 → −105, opacity → 0 (text-slot rule: completes before the next in). */
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
