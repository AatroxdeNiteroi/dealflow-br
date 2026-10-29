/* ============================================================
   cinema/rig/Rig.tsx — `.cx-rig` (z 6): the instrument's anchored
   overlays. Owner: WP6. Behaviour lives in rig.timeline.ts.

   v3 (spec rev 3.1 §7 D1, §1.4 items 3 and 7, §3 J2–J6, C4):
   - 4 registration corners, each a 0×0 VERTEX node placed by transform
     holding ONE small inline SVG: a single corner path drawn in units of
     the arm length (`M0,1 L0,ρ A ρ ρ 0 0 1 ρ,0 L1,0`, ρ = rr/arm) and
     scaled by a CSS transform on its <g> with a non-scaling stroke
     (round caps and joins). Moving or resizing the reticle never touches
     an attribute: `d` is rewritten only when ρ changes (the J2 bend, the
     J3 opening, card mode, the C4a closure, the C4d release). Three
     strokes share the path: ink, paper (on-dark cross-fade, 220 ms
     cx-flow) and the gold act flash.
   - the target tag "Empresa em análise · CNPJ ██.███.███/0001-██": two
     halves + separator (they split into the dossier header slots at
     860) on an INK CAPSULE plate (paper text, ≥ 12:1; nearly invisible
     on the dark). Each half carries a glyph layer for the lock's glyph
     pour (shown only while pouring; the plain text run is the rest
     state, so the 860 swap stays the dossier's own text). "███" runs are
     capsules (§7 C5). A gold droplet leads the plate as it opens.
   - the C4c leader hairline (close → ring), round caps.

   The whole layer is decorative (aria-hidden): the dossier and the Ch4
   close carry the readable text. Under reduced motion base.css hides
   `.cx-rig` entirely (no machinery, §9.1).
   ============================================================ */

import "./rig.css";
import { Fragment } from "react";
import { DOSSIER_COPY } from "../copy";

/** Clockwise from the top-left: the G3 draw stagger order. */
const CORNERS = ["tl", "tr", "br", "bl"] as const;
/** Frame-mode corner (rr 4 on a 30 px arm) — rewritten at the first frame. */
const D0 = "M0,1 L0,0.1333 A0.1333,0.1333 0 0 1 0.1333,0 L1,0";

/** Text with every "███" run wrapped as a capsule (inline: the run keeps its advance). */
function Redacted({ text }: { text: string }) {
  return (
    <>
      {text.split(/(█+)/).map((p, i) =>
        p.startsWith("█") ? (
          <i key={i} className="cx-redact">
            {p}
          </i>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function Rig() {
  return (
    <div className="cx-rig" aria-hidden="true">
      {CORNERS.map((c) => (
        <div key={c} className={`cx-rig__bracket cx-rig__bracket--${c}`}>
          <svg className="cx-rig__svg" width="1" height="1" focusable="false">
            <g className="cx-rig__g">
              <path className="cx-rig__p cx-rig__p--ink" d={D0} vectorEffect="non-scaling-stroke" />
              <path className="cx-rig__p cx-rig__p--light" d={D0} vectorEffect="non-scaling-stroke" />
              <path className="cx-rig__p cx-rig__p--flash" d={D0} vectorEffect="non-scaling-stroke" />
            </g>
          </svg>
        </div>
      ))}
      <i className="cx-rig__leader" />
      <div className="cx-rig__tag">
        <i className="cx-rig__plate" />
        <span className="cx-rig__half cx-rig__half--a">
          <span className="cx-rig__txt">{DOSSIER_COPY.eyebrow}</span>
          <span className="cx-rig__gl" />
        </span>
        {/* no-break spaces: a block's edge spaces would collapse */}
        <span className="cx-rig__sep">{" · "}</span>
        <span className="cx-rig__half cx-rig__half--b">
          <span className="cx-rig__txt">
            <Redacted text={DOSSIER_COPY.cnpj} />
          </span>
          <span className="cx-rig__gl" />
        </span>
      </div>
      <i className="cx-rig__nib" />
    </div>
  );
}
