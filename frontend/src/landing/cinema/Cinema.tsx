/* ============================================================
   cinema/Cinema.tsx — composes the cinema's DOM in order (WP0).

   Rendered by Landing exactly where the old ch1–4 markup was, so the
   document order stays: .lp-stage → .lp-scroll → (dossier) →
   .ch2-track → .ch3-track → (ch4) → .ch4-track → .cx-rig → then
   Landing's untouched .ch5-stage → .ch5-track → .ch6 …
   Fixed layers don't affect flow; under reduced motion the tracks are
   display:none and the stages become static sections in this order:
   hero/respiro (.lp-stage) → Ch2 static → Ch3 final card → Ch4.

   Roots owned here: `.lp-stage` (kept root, z 4, revealed by Landing),
   the scroll tracks, `.cx-dome` (no-WebGL only). Every other root
   belongs to its package component.
   ============================================================ */

import "./base.css";
import { Ch1Stage } from "./ch1/Ch1Stage";
import { DossierStatic } from "./dossier/DossierStatic";
import { DossierStage } from "./dossier/DossierStage";
import { Ch4Stage } from "./ch4/Ch4Stage";
import { Rig } from "./rig/Rig";

export function Cinema() {
  return (
    <>
      {/* no-WebGL dome (z 1): darkens 420–465, dawns with the score */}
      <div className="cx-dome" aria-hidden="true" />

      {/* Cap. 1 — hero HUD + respiro (z 4) */}
      <div className="lp-stage">
        <Ch1Stage />
      </div>
      <div className="lp-scroll" aria-hidden="true" />

      {/* Cap. 2–3 — one dossier stage (z 6); static Ch2 only under reduced motion */}
      <DossierStatic variant="ch2" />
      <DossierStage />
      <div className="ch2-track" aria-hidden="true" />
      <div className="ch3-track" aria-hidden="true" />

      {/* Cap. 4 — o universo (z 6) */}
      <Ch4Stage />
      <div className="ch4-track" aria-hidden="true" />

      {/* anchored overlays (z 6) — after the scene stages, before .ch5-stage */}
      <Rig />
    </>
  );
}
