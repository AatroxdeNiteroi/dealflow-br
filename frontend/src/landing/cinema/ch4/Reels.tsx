/* ============================================================
   cinema/ch4/Reels.tsx — the odometer that lifts out of redaction
   (§5 C4b, §3.7 "Ch4 odometer"). Owner: WP-CH4.

   One reel per digit. Each reel is a masked WINDOW (.cx-ch4__reel,
   1.14em, overflow hidden + vertical mask) holding a DETENT layer
   (.cx-ch4__detent — the `countSettle` act's kick, yPercent of one
   cell) holding the STRIP (.cx-ch4__strip — scrubbed per frame by
   ch4.timeline). The strip is [█, 0, 1, …, 9]: cell 0 is a flat-ink
   redaction block sized to the figure box, cell (digit + 1) is the
   digit, so the pre-state reads "██.███" and "00.000" can never
   appear. `--cell` on the strip is the FINAL cell: the CSS default
   transform shows the final number (reduced motion needs no JS).

   Spacing is tabular by construction (fixed 0.6em advance per reel):
   this Playfair subset ignores `tnum`, so the windows — not the
   font — keep the count from shifting while it rolls. Separators
   ("." / ",") are static cells on the same baseline.

   The accessible value is plain text in a visually-hidden span; the
   reels are aria-hidden.
   ============================================================ */

import type { CSSProperties } from "react";

/** Cell order on every strip: 0 = redaction, 1..10 = digits 0..9. */
export const STRIP_CELLS = 11;

const STRIP = [
  <span className="cx-ch4__cell cx-ch4__cell--redacted" key="r" />,
  ...["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((c) => (
    <span className="cx-ch4__cell" key={c}>
      {c}
    </span>
  )),
];

/** Final strip cell of each digit in `value` (separators skipped), most significant first. */
export function reelTargets(value: string): number[] {
  return value
    .split("")
    .filter((ch) => ch >= "0" && ch <= "9")
    .map((ch) => Number(ch) + 1);
}

export function Reels({ value, className = "cx-ch4__count" }: { value: string; className?: string }) {
  return (
    <span className={className}>
      <span className="cx-sr-only">{value}</span>
      <span className="cx-ch4__reels" aria-hidden="true">
        {value.split("").map((ch, i) =>
          ch >= "0" && ch <= "9" ? (
            <span className="cx-ch4__reel" key={i}>
              <span className="cx-ch4__detent">
                <span className="cx-ch4__strip" style={{ "--cell": Number(ch) + 1 } as CSSProperties}>
                  {STRIP}
                </span>
              </span>
            </span>
          ) : (
            <span className="cx-ch4__sep" key={i}>
              {ch}
            </span>
          ),
        )}
      </span>
      {/* the `countSettle` hairline: drawn from the centre when the last reel locks */}
      <span className="cx-ch4__rule" aria-hidden="true" />
    </span>
  );
}
