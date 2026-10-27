/* ============================================================
   cinema/rig/Rig.tsx — `.cx-rig` (z 6): the instrument's anchored
   overlays. Owner: WP-RIG. Behaviour lives in rig.timeline.ts.

   - 4 registration brackets. Each is a 0×0 VERTEX node (positioned by
     transform at a corner of the bracket box) holding two arms that
     grow out of the vertex (scaleX / scaleY). One box drives all four
     in every mode: frame → search/lock → silhouette → frame → card
     build → card ride → disc ring → release (§5).
   - the target tag "Empresa em análise · CNPJ ██.███.███/0001-██"
     (§3.7): two halves + separator, so it can split into the dossier
     header slots at 860 (§5 J6). A gold nib leads its lock wipe.
   - the C4c leader hairline (close → ring).

   The whole layer is decorative (aria-hidden): the dossier and the
   Ch4 close carry the readable text. Under reduced motion base.css
   hides `.cx-rig` entirely (no machinery, §9.1).
   ============================================================ */

import "./rig.css";
import { DOSSIER_COPY } from "../copy";

/** Clockwise from the top-left: the G3 draw stagger order. */
const CORNERS = ["tl", "tr", "br", "bl"] as const;

export function Rig() {
  return (
    <div className="cx-rig" aria-hidden="true">
      {CORNERS.map((c) => (
        <div key={c} className={`cx-rig__bracket cx-rig__bracket--${c}`}>
          <i className="cx-rig__arm cx-rig__arm--h" />
          <i className="cx-rig__arm cx-rig__arm--v" />
        </div>
      ))}
      <i className="cx-rig__leader" />
      <div className="cx-rig__tag">
        <span className="cx-rig__half cx-rig__half--a">{DOSSIER_COPY.eyebrow}</span>
        <span className="cx-rig__sep">{" · "}</span>
        <span className="cx-rig__half cx-rig__half--b">{DOSSIER_COPY.cnpj}</span>
      </div>
      <i className="cx-rig__nib" />
    </div>
  );
}
