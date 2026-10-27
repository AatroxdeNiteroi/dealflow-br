/* ============================================================
   cinema/ch1/Ch1Stage.tsx — Cap. 1 DOM. Owner: WP-CH1.

   Motion (the normal path):
   - `.lp-stage` child: the hero HUD `.cx-hud` (AZ ###° · varredura
     ativa), its only direct child, so settle(1) leaves `.lp-stage > *`
     at autoAlpha 0.
   - The respiro `.cx-respiro` (light copy, ink twin, the six redaction
     bars + gold nibs) is a fixed full-viewport layer PORTALED to the end
     of <body>. Reason: in J6 (800–850) the dossier's card paper
     (`.cx-dos-stage`, z 6) is drawn under the brackets, and the ink
     words, the redaction bars and their fusion into the tarja must stay
     visible ABOVE that paper (§5 J6, §6 "em phrase → tarja"). A child of
     `.lp-stage` (z 4) cannot paint over z 6; a z-6 layer last in the
     document does, while staying under ch6+ (20), the chrome (65), the
     dock (68), the CTA (70) and the return veil (72).
   Reduced motion (§9.1): no portal, no machinery. `.lp-stage` is static,
   so its children become two sections in narrative order: the hero
   (static HUD line + "Role para baixo") and the respiro in INK on paper,
   followed by the static caption of the rest that comes next.
   ============================================================ */

import "./ch1.css";
import { useState } from "react";
import { createPortal } from "react-dom";
import { MaskWords } from "../MaskWords";
import { restById } from "../beats";
import { GUIDE_COPY, HUD_COPY, RESPIRO_TEXT, RESPIRO_WORDS } from "../copy";

/** Six em words ("—", "e", "dados", "que", "ninguém", "publicou.") → six bars. */
const EM_COUNT = RESPIRO_WORDS.filter((w) => w.em).length;

const prefersReduced = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Hud({ withSep }: { withSep: boolean }) {
  return (
    <div className="cx-hud" aria-hidden="true">
      <span className="cx-hud__dot" />
      <span className="cx-hud__read">{HUD_COPY.azimuth(247)}</span>
      {withSep ? <span className="cx-hud__sep">·</span> : null}
      <span className="cx-hud__label">{HUD_COPY.label}</span>
    </div>
  );
}

function RespiroCopy({ tone }: { tone: "light" | "ink" }) {
  return (
    <div className={`cx-respiro__layer cx-respiro--${tone}`} aria-hidden="true">
      <MaskWords
        as="p"
        className="cx-respiro__copy"
        words={RESPIRO_WORDS}
        wordClassName="cx-respiro__w"
        emClassName="is-em"
      />
    </div>
  );
}

function Respiro({ reduced }: { reduced: boolean }) {
  return (
    <div className={reduced ? "cx-respiro is-static" : "cx-respiro"}>
      {/* one readable copy for assistive tech; both visual copies are aria-hidden */}
      <p className="cx-sr-only">{RESPIRO_TEXT}</p>
      {reduced ? null : <RespiroCopy tone="light" />}
      <RespiroCopy tone="ink" />
      {reduced ? (
        <p className="cx-static-cap" aria-hidden="true">
          {restById("R3").verb}
        </p>
      ) : (
        <div className="cx-respiro__bars" aria-hidden="true">
          {Array.from({ length: EM_COUNT }, (_, i) => (
            <span className="cx-respiro__bar" key={`b${i}`} />
          ))}
          {Array.from({ length: EM_COUNT }, (_, i) => (
            <span className="cx-respiro__nib" key={`n${i}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Ch1Stage() {
  // read once: the cinema is built once per page load (as everywhere else)
  const [reduced] = useState(prefersReduced);

  if (reduced) {
    return (
      <>
        <section className="cx-ch1-hero" aria-label="Radar">
          <Hud withSep />
          <div className="cx-ch1-hint">
            <span className="cx-ch1-hint__title">{GUIDE_COPY.onboardTitle}</span>
            <span className="cx-ch1-hint__sub">{GUIDE_COPY.onboardSub}</span>
          </div>
        </section>
        <Respiro reduced />
      </>
    );
  }

  return (
    <>
      <Hud withSep={false} />
      {typeof document !== "undefined" ? createPortal(<Respiro reduced={false} />, document.body) : null}
    </>
  );
}
