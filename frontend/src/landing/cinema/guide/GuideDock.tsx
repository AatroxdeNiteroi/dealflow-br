/* ============================================================
   cinema/guide/GuideDock.tsx — the guidance dock (§3). Owner: WP-GUIDE.

   Static markup only; every state is driven by guide/machine.ts
   (dock state machine, onboarding morph, rail) and guide/reducer.ts
   (the dock lift). Three siblings, in this DOM order:

   1. `.cx-guide__card` — the onboarding card (§3.5), role="status".
      It sits OUTSIDE the button (a live region inside a button is
      presentational and never announced) and BEFORE it, so the dock
      paints over the collapsing card during the Flip morph.
   2. `.lp-scrollcue` — THE dock root, a <button> (z 68). The root
      class is kept: Ch5's cue-off trigger, the teleport safety set and
      the return hide list all target it, so it is unique on the page.
        lift   (reducer: y — mobile stack above the CTA, footer lift)
        stack  (machine: opacity — transit .78, back .78, fling .45)
          pill — bg (colour) · edge (border + shadow) · content:
                 22 px progress ring around the chevron + verb line
          rail — desktop: 5-station hairline ruler + gold needle
          mrail — mobile: 5 dots + the active station label
   3. `.cx-guide__live` — visually hidden aria-live (rest arrivals).
   ============================================================ */

import "./guide.css";
import { STATIONS, VERB_SEGMENTS } from "../beats";
import { GUIDE_COPY } from "../copy";

/** Rail anchors: first label left-aligned, last right-aligned, others centred. */
const anchorOf = (i: number, n: number) => (i === 0 ? "start" : i === n - 1 ? "end" : "mid");

export function GuideDock() {
  const n = STATIONS.length;
  return (
    <>
      {/* ── 1 · onboarding card (expanded state of the dock) ───────── */}
      <div className="cx-guide__card" role="status">
        <span className="cx-guide__card-bg" aria-hidden="true" />
        <span className="cx-guide__card-body">
          <span className="cx-guide__corner cx-guide__corner--tl" aria-hidden="true" />
          <span className="cx-guide__corner cx-guide__corner--tr" aria-hidden="true" />
          <span className="cx-guide__corner cx-guide__corner--bl" aria-hidden="true" />
          <span className="cx-guide__corner cx-guide__corner--br" aria-hidden="true" />
          <span className="cx-guide__glyph" aria-hidden="true">
            {/* fine pointer: mouse outline, the wheel dot rolls down */}
            {/* QA PERF-2: the moving parts are HTML boxes (their own <svg> /
                span), never SVG children — Chrome composites their transform /
                opacity keyframes, so the loop costs no style or layout per frame */}
            <svg className="cx-guide__mouse" viewBox="0 0 16 26">
              <rect x="0.75" y="0.75" width="14.5" height="24.5" rx="7.25" />
            </svg>
            <span className="cx-guide__mouse-dot" />
            {/* coarse pointer: two chevrons rising (swipe up) */}
            <span className="cx-guide__swipe">
              <svg className="cx-guide__swipe-a" viewBox="0 0 16 26">
                <path d="M3 13.5l5-5 5 5" />
              </svg>
              <svg className="cx-guide__swipe-b" viewBox="0 0 16 26">
                <path d="M3 20.5l5-5 5 5" />
              </svg>
            </span>
          </span>
          <span className="cx-guide__card-text">
            <span className="cx-guide__card-title">{GUIDE_COPY.onboardTitle}</span>
            <span className="cx-guide__card-sub">{GUIDE_COPY.onboardSub}</span>
          </span>
        </span>
      </div>

      {/* ── 2 · the dock (root button) ─────────────────────────────── */}
      <button type="button" className="lp-scrollcue" aria-label={GUIDE_COPY.dockAria}>
        <span className="cx-guide__lift">
          <span className="cx-guide__stack">
            <span className="cx-guide__pill">
              <span className="cx-guide__pill-bg" aria-hidden="true" />
              <span className="cx-guide__pill-edge" aria-hidden="true" />
              <span className="cx-guide__pill-in" aria-hidden="true">
                <span className="cx-guide__ring">
                  <svg className="cx-guide__ring-svg" viewBox="0 0 22 22">
                    <circle className="cx-guide__ring-track" cx="11" cy="11" r="10" />
                    <circle
                      className="cx-guide__ring-arc"
                      cx="11"
                      cy="11"
                      r="10"
                      pathLength={1}
                      transform="rotate(-90 11 11)"
                    />
                    <circle
                      className="cx-guide__ring-flash"
                      cx="11"
                      cy="11"
                      r="10"
                      transform="rotate(-90 11 11)"
                    />
                  </svg>
                  <span className="cx-guide__chev-bob">
                    <span className="cx-guide__chev-rot">
                      <svg className="cx-guide__chev" viewBox="0 0 10 10">
                        <path d="M2.2 3.8 5 6.6l2.8-2.8" />
                      </svg>
                    </span>
                  </span>
                </span>
                <span className="cx-guide__verb">
                  <span className="cx-guide__verb-t">{VERB_SEGMENTS[0].verb}</span>
                </span>
              </span>
            </span>

            {/* desktop rail: hairline ruler, 5 stations, gold needle */}
            <span className="cx-guide__rail" aria-hidden="true">
              <span className="cx-guide__rail-line" />
              <span className="cx-guide__rail-fill" />
              {STATIONS.map((s, i) => (
                <span
                  key={s.id}
                  className={`cx-guide__rail-tick cx-guide__rail-tick--${anchorOf(i, n)}`}
                  style={{ left: `${(i / (n - 1)) * 100}%` }}
                />
              ))}
              <span className="cx-guide__rail-needle" />
              {STATIONS.map((s, i) => (
                <span
                  key={s.id}
                  className={`cx-guide__rail-label cx-guide__rail-label--${anchorOf(i, n)}`}
                  style={{ left: `${(i / (n - 1)) * 100}%` }}
                >
                  {/* odometer reel: off · ON · off — rolls in the travel direction */}
                  <span className="cx-guide__rail-reel">
                    <span className="cx-guide__rail-name">{s.name}</span>
                    <span className="cx-guide__rail-name cx-guide__rail-name--on">{s.name}</span>
                    <span className="cx-guide__rail-name">{s.name}</span>
                  </span>
                </span>
              ))}
            </span>

            {/* mobile rail: 5 dots + the active station label (one reel) */}
            <span className="cx-guide__mrail" aria-hidden="true">
              <span className="cx-guide__mlabel">
                <span className="cx-guide__mname">{STATIONS[0].name}</span>
                <span className="cx-guide__mname">{STATIONS[0].name}</span>
              </span>
              <span className="cx-guide__mdots">
                {STATIONS.map((s) => (
                  <span key={s.id} className="cx-guide__mdot" />
                ))}
              </span>
            </span>
          </span>
        </span>
      </button>

      {/* ── 3 · rest arrivals, for screen readers ──────────────────── */}
      <div className="cx-guide__live cx-sr-only" aria-live="polite" aria-atomic="true" />
    </>
  );
}
