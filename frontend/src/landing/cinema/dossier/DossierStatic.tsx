/* ============================================================
   cinema/dossier/DossierStatic.tsx — the reduced-motion Cap. 2
   (§9.1). `display: none` unless `prefers-reduced-motion: reduce`;
   no JS, no machinery: every state below is its CSS default.

   Shows: eyebrow "Convergência", the caption, the dossier with the
   flat-ink tarja + hatch, all 26 ticks lit, a static halo, the
   rev-note, the Ch2 close, and the rest's imperative. No chips.
   The final Ch3 card follows it (DossierStage under reduced motion).
   Owner: WP-DOSSIER.
   ============================================================ */

import "./dossier.css";
import { CH2_COPY, DOSSIER_COPY } from "../copy";
import { restById } from "../beats";
import { CHIPS_DESKTOP, staticRing } from "./chips";

const RING = staticRing(CHIPS_DESKTOP);
// the place never splits ("SP" alone on a line): non-breaking spaces inside it
const DESC = "Fabricação de esquadrias de metal · São Paulo / SP";

export function DossierStatic({ variant }: { variant: "ch2" }) {
  return (
    <section className="cx-dos-static" data-variant={variant} aria-label={CH2_COPY.eyebrow}>
      <span className="cx-dos-static__eyebrow">{CH2_COPY.eyebrow}</span>
      <p className="cx-dos__caption cx-dos-static__caption">
        <span className="cx-dos__hair cx-dos__hair--l" aria-hidden="true" />
        <span>{CH2_COPY.caption}</span>
        <span className="cx-dos__hair cx-dos__hair--r" aria-hidden="true" />
      </p>

      <article className="cx-dos-static__card">
        <span className="cx-dos__slot cx-dos__slot--eyebrow">{DOSSIER_COPY.eyebrow}</span>
        <span className="cx-dos__slot cx-dos__slot--cnpj">{DOSSIER_COPY.cnpj}</span>
        <p className="cx-dos__desc">{DESC}</p>
        <span className="cx-dos__rule" aria-hidden="true" />
        <p className="cx-dos__labelRow">{DOSSIER_COPY.revLabel}</p>
        <span className="cx-dos-static__tarjaWrap" aria-hidden="true">
          <span className="cx-dos-static__ring">
            {RING.map((p, i) => (
              <span
                className="cx-dos-static__tick"
                key={i}
                style={{
                  left: `${(p.x * 100).toFixed(3)}%`,
                  top: `${(p.y * 100).toFixed(3)}%`,
                  transform: `translate(-50%, -50%) rotate(${p.a.toFixed(1)}deg)`,
                }}
              />
            ))}
          </span>
          <span className="cx-dos-static__tarja">
            <span className="cx-dos__hatch" />
          </span>
        </span>
        <p className="cx-dos__revnote cx-dos-static__revnote">{DOSSIER_COPY.revNote}</p>
      </article>

      <p className="cx-dos__close cx-dos-static__close">
        <span className="cx-dos__close-lead">{CH2_COPY.closeLead}</span>
        <span className="cx-dos__close-sub">{CH2_COPY.closeSub}</span>
      </p>

      <span className="cx-static-cap" aria-hidden="true">
        {restById("R4").verb}
      </span>
    </section>
  );
}
