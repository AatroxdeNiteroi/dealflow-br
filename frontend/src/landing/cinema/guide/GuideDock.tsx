/* ============================================================
   cinema/guide/GuideDock.tsx — the dock: `.lp-scrollcue` root <button>
   (z 68) with progress ring, chevron, verb line, chapter rail, the
   onboarding card and the aria-live region (§3). Owner: WP-GUIDE.

   WP0 stub: the root keeps the class `.lp-scrollcue` (the Ch5 cue-off
   trigger, the teleport safety set and the return hide list target it)
   and shows the current verb from beats.VERB_SEGMENTS. Not interactive
   yet (tabIndex −1, aria-hidden) — WP-GUIDE wires the button.
   ============================================================ */

import "./guide.css";
import { VERB_SEGMENTS } from "../beats";
import { GUIDE_COPY } from "../copy";

export function GuideDock() {
  return (
    <button
      type="button"
      className="lp-scrollcue"
      aria-label={GUIDE_COPY.dockAria}
      aria-hidden="true"
      tabIndex={-1}
    >
      <span className="cx-guide__verb">{VERB_SEGMENTS[0].verb}</span>
      <svg className="cx-guide__chev" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9l7 7 7-7" />
      </svg>
    </button>
  );
}
