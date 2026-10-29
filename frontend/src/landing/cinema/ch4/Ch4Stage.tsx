/* ============================================================
   cinema/ch4/Ch4Stage.tsx — `.cx-ch4-stage` (z 6), Cap. 4 "O universo".
   Owner: WP-CH4.

   Motion layout (fixed stage, three bands around the referent):
     top band     the PANEL — odometer (Reels) + gold hairline + label
     centre band  kept EMPTY: the lit company point, its brackets
                  (RIG), the pinned "R$ 24,3 mi" (DOSSIER) live there
     lower band   the CLOSE — "Você esteve dentro de uma delas." /
                  "As outras 117.964…", which RIG's leader points from
   Each band is a full-width row holding an UNTRANSFORMED slot (the
   measured rect: `ch4.panel`, `ch4.close`) holding the mover.

   Reduced motion: the stage is a static section in normal flow
   (eyebrow → panel → static referent SVG → close → caption). Every
   element's CSS default IS its readable final state; the eyebrow,
   the referent and the caption render only under reduced motion
   (in motion the eyebrow is DOSSIER's reel, the referent is the GL
   point + RIG + DOSSIER, and the guidance is the dock).
   ============================================================ */

import "./ch4.css";
import { MaskWords, splitWords, type MaskWord } from "../MaskWords";
import { CH4_COPY, DOSSIER_COPY } from "../copy";
import { restById } from "../beats";
import { Reels } from "./Reels";

/** Same words, but a parenthetical "—" rides with the word before it
 *  (no-break space), so no line ever starts with the dash. */
function glueDash(text: string): MaskWord[] {
  const out: MaskWord[] = [];
  for (const w of splitWords(text)) {
    if (w.t === "—" && out.length) out[out.length - 1] = { t: out[out.length - 1].t + " —" };
    else out.push(w);
  }
  return out;
}
/* QA D6: on desktop the sub breaks after the dash ("…já estão no radar — /
   cada uma com seu número."), never "…já estão no / radar —". The break is
   hidden on phones (ch4.css), where it would make the sub three lines. */
const CLOSE_SUB_WORDS = glueDash(CH4_COPY.closeSub).map((w) => (/—$/.test(w.t) ? { ...w, br: true } : w));

/** Reduced-motion referent: the lit company point (paper body, saturated
 *  gold rim, small gold core) inside its four registration brackets
 *  (v3 §7 D3: round caps and round 3 px corners, like the RIG reticle). */
function ReferentMark() {
  return (
    <svg className="cx-ch4__ref-mark" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="cx-ch4-lit" cx="42%" cy="38%" r="64%">
          <stop offset="0" stopColor="#fbf9f4" />
          <stop offset="1" stopColor="#e9e1cf" />
        </radialGradient>
      </defs>
      <path
        className="cx-ch4__ref-brackets"
        d="M9 17v-5a3 3 0 0 1 3-3h5M39 9h5a3 3 0 0 1 3 3v5M47 39v5a3 3 0 0 1-3 3h-5M17 47h-5a3 3 0 0 1-3-3v-5"
        fill="none"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="28" cy="28" r="9" fill="url(#cx-ch4-lit)" stroke="#cf9b1e" strokeWidth="1.5" />
      <circle cx="28" cy="28" r="1.7" fill="#cf9b1e" opacity="0.8" />
    </svg>
  );
}

export function Ch4Stage() {
  return (
    <section className="cx-ch4-stage" aria-label="Capítulo 4 — O universo">
      {/* reduced only — in motion the eyebrow is DOSSIER's masked reel (cell 2) */}
      <span className="cx-ch4__eyebrow">{CH4_COPY.eyebrow}</span>

      <div className="cx-ch4__row cx-ch4__row--panel">
        <div className="cx-ch4__slot cx-ch4__slot--panel">
          <div className="cx-ch4__panel">
            <Reels value={CH4_COPY.count} />
            <MaskWords as="span" className="cx-ch4__label" text={CH4_COPY.countLabel} />
          </div>
        </div>
      </div>

      {/* reduced only — the static referent of "Você esteve dentro de uma delas." */}
      <div className="cx-ch4__ref" aria-hidden="true">
        <ReferentMark />
        <span className="cx-ch4__ref-amount">{DOSSIER_COPY.amount}</span>
      </div>

      <div className="cx-ch4__row cx-ch4__row--close">
        <div className="cx-ch4__slot cx-ch4__slot--close">
          <div className="cx-ch4__close">
            <MaskWords as="p" className="cx-ch4__lead" text={CH4_COPY.closeLead} />
            <MaskWords as="p" className="cx-ch4__sub" text={CH4_COPY.closeSub} words={CLOSE_SUB_WORDS} />
          </div>
        </div>
      </div>

      {/* reduced only (§9.1): the section's static caption repeats R7's imperative */}
      <p className="cx-static-cap" aria-hidden="true">
        {restById("R7").verb}
      </p>
    </section>
  );
}
