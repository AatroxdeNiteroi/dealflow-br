/* ============================================================
   cinema/dossier/DossierStage.tsx — `.cx-dos-stage` (z 6). Owner WP-DOSSIER.

   ONE stage for Cap. 2 + Cap. 3 (+ the C4a collapse): the card is laid
   out at its FINAL Ch3 size (`.cx-dos__frame`); every earlier state is
   a clip of the viewport-sized paper layers, never a second card.

   Layers, back → front (all transform / opacity / clip-path only):
     shade · rim · gold rim · paper     viewport-sized, clipped per frame
     sparks                             C2a chip sources on the field
     top    eyebrow reel + caption      fixed top slot
     main   frame (card content) + the two closes
     inst   ticks · scan line · chips   viewport px, per-frame
     pinned "R$ 24,3 mi" beside the lit point (C4a → C4d)

   Readable FINAL state = CSS default (reduced motion runs no JS): the
   Ch3 card with the number sharp, ruler, needle and seal, Ch3 close.
   The motion pre-states come from gsap.set in dossier.timeline.ts.
   ============================================================ */

import "./dossier.css";
import { MaskWords, type MaskWord } from "../MaskWords";
import { CH2_COPY, CH3_COPY, DOSSIER_COPY, EYEBROW_REEL } from "../copy";
import { restById } from "../beats";
import { CHIPS_DESKTOP } from "./chips";

/** "Fabricação de esquadrias de metal · São Paulo / SP" — the place stays one unit (no orphan). */
const DESC_WORDS: readonly MaskWord[] = [
  { t: "Fabricação" },
  { t: "de" },
  { t: "esquadrias" },
  { t: "de" },
  { t: "metal" },
  { t: "·" },
  { t: "São Paulo / SP" },
];

/** Split for MaskWords, binding a lone "—" to the word before it (a line never starts with a dash). */
function bindDash(text: string): MaskWord[] {
  const out: MaskWord[] = [];
  for (const t of text.split(/\s+/).filter(Boolean)) {
    if (t === "—" && out.length) out[out.length - 1] = { t: out[out.length - 1].t + " —" };
    else out.push({ t });
  }
  return out;
}

const C3_LEAD = bindDash(CH3_COPY.closeLead);

const N = CHIPS_DESKTOP;
const idx = Array.from({ length: N }, (_, i) => i);

export function DossierStage() {
  return (
    <section className="cx-dos-stage" aria-label="Convergência e A estimativa">
      {/* ── the card's paper: viewport-sized layers, clipped every frame ── */}
      <div className="cx-dos__shade" aria-hidden="true" />
      <div className="cx-dos__rim" aria-hidden="true" />
      <div className="cx-dos__rim cx-dos__rim--gold" aria-hidden="true" />
      <div className="cx-dos__paper" aria-hidden="true" />

      {/* C2a sources: a gold spark where each chip leaves the field */}
      <div className="cx-dos__sparks" aria-hidden="true">
        {idx.map((i) => (
          <span className="cx-dos__spark" key={i} />
        ))}
      </div>

      {/* ── fixed top slot: ONE masked eyebrow reel + the Ch2 caption ── */}
      <div className="cx-dos__top">
        <div className="cx-dos__eyebrow">
          <span className="cx-dos__reel" aria-hidden="true">
            <span className="cx-dos__strip">
              {EYEBROW_REEL.map((t) => (
                <span className="cx-dos__cell" key={t}>
                  {t}
                </span>
              ))}
            </span>
          </span>
        </div>
        <p className="cx-dos__caption">
          <span className="cx-dos__hair cx-dos__hair--l" aria-hidden="true" />
          <span className="cx-dos__capmask">
            <span className="cx-dos__cap-i">{CH2_COPY.caption}</span>
          </span>
          <span className="cx-dos__hair cx-dos__hair--r" aria-hidden="true" />
        </p>
      </div>

      <div className="cx-dos__main">
        {/* the card, laid out at its final Ch3 size (measured: dos.card@ch3) */}
        <div className="cx-dos__frame">
          <div className="cx-dos__head">
            {/* data-cx-slot: RIG copies these nodes' type so its tag lands on them at scale(1) (860 swap) */}
            <span className="cx-dos__slot cx-dos__slot--eyebrow" data-cx-slot="eyebrow">
              {DOSSIER_COPY.eyebrow}
            </span>
            <span className="cx-dos__slot cx-dos__slot--cnpj" data-cx-slot="cnpj">
              {DOSSIER_COPY.cnpj}
            </span>
            <MaskWords as="p" className="cx-dos__desc" words={DESC_WORDS} />
          </div>

          <span className="cx-dos__rule" aria-hidden="true" />

          <p className="cx-dos__labelRow" aria-label={CH3_COPY.label}>
            {/* "Faturamento anual" + clipped "estimado" (revealed in C3a) */}
            <span className="cx-dos__label" aria-hidden="true">
              <span className="cx-mw">
                <span className="cx-mw__i">Faturamento</span>
              </span>
              <span className="cx-mw">
                <span className="cx-mw__i">anual</span>
              </span>
              <span className="cx-mw cx-dos__est">
                <span className="cx-mw__i">{DOSSIER_COPY.revLabelEst}</span>
              </span>
            </span>
          </p>

          <div className="cx-dos__amountSlot">
            <span className="cx-dos__amountBox">
              {/* the number is ALWAYS there, under the tarja; it is uncovered, never created */}
              <span className="cx-dos__amount">
                <span className="cx-dos__value">{DOSSIER_COPY.amount}</span>
                <span className="cx-dos__value cx-dos__value--soft" aria-hidden="true">
                  {DOSSIER_COPY.amount}
                </span>
              </span>
              <span className="cx-dos__tarjaBox" aria-hidden="true">
                <span className="cx-dos__tarjaMove">
                  <span className="cx-dos__halo" />
                  <span className="cx-dos__tarja">
                    <span className="cx-dos__hatch" />
                  </span>
                  <span className="cx-dos__charge" />
                </span>
              </span>
            </span>
          </div>

          {/* one region: the rev-note (Ch2) leaves before the range (Ch3) arrives */}
          <div className="cx-dos__region">
            <p className="cx-dos__revnote">
              <span className="cx-dos__revnote-i">{DOSSIER_COPY.revNote}</span>
            </p>
            <div className="cx-range">
              <span className="cx-range__end cx-range__end--min">
                <MaskWords className="cx-range__tag" text={DOSSIER_COPY.minTag} />
                <MaskWords className="cx-range__num" text={DOSSIER_COPY.min} />
              </span>
              <span className="cx-range__bar" aria-hidden="true">
                <span className="cx-range__scale" />
                <span className="cx-range__track" />
                <span className="cx-range__mark" />
              </span>
              <span className="cx-range__end cx-range__end--max">
                <MaskWords className="cx-range__tag" text={DOSSIER_COPY.maxTag} />
                <MaskWords className="cx-range__num" text={DOSSIER_COPY.max} />
              </span>
            </div>
          </div>

          <div className="cx-dos__sealSlot">
            <span className="cx-dos__seal">
              <svg className="cx-dos__seal-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path className="cx-dos__check" d="M5 12.5l4.5 4.5L19 7" />
              </svg>
              {DOSSIER_COPY.seal}
            </span>
          </div>
        </div>

        {/* both closes share one slot under the card (never on screen together) */}
        <div className="cx-dos__closes">
          <p className="cx-dos__close cx-dos__close--c2">
            <MaskWords className="cx-dos__close-lead" text={CH2_COPY.closeLead} />
            <MaskWords className="cx-dos__close-sub" text={CH2_COPY.closeSub} />
          </p>
          <p className="cx-dos__close cx-dos__close--c3">
            <MaskWords className="cx-dos__close-lead" words={C3_LEAD} />
            <MaskWords className="cx-dos__close-sub" text={CH3_COPY.closeSub} />
          </p>
        </div>

        {/* reduced motion only: the rest's imperative closes the section */}
        <span className="cx-static-cap" aria-hidden="true">
          {restById("R6").verb}
        </span>
      </div>

      {/* ── instrument overlay (viewport px): tick dial, scan line, chips ── */}
      <div className="cx-dos__inst" aria-hidden="true">
        {idx.map((i) => (
          <span className="cx-dos__tick" key={"t" + i} />
        ))}
        <span className="cx-dos__scan">
          <span className="cx-dos__scan-glow" />
        </span>
        {idx.map((i) => (
          <span className={`cx-dos__chip cx-dos__chip--d${i % 3}`} key={"c" + i}>
            <span className="cx-dos__trail" />
          </span>
        ))}
      </div>

      {/* C4a → C4d: the amount pinned beside the lit company point */}
      <span className="cx-dos__pinned" aria-hidden="true">
        <span className="cx-dos__pinned-bg" />
        <span className="cx-dos__pinned-t">{DOSSIER_COPY.amount}</span>
      </span>
    </section>
  );
}
