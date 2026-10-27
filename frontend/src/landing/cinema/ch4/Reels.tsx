/* ============================================================
   cinema/ch4/Reels.tsx — odometer reels lifting out of redaction (§5 C4b).
   Owner: WP-CH4. Moved out of Landing by WP0 and re-based on the new
   strip [█, 0, 1, …, 9]: cell 0 is the redaction, cell (digit + 1) the
   digit (exposed as `--cell`), so the pre-state reads "██.███" and
   "00.000" can never appear. The real value lives in the container's
   aria-label; reels are aria-hidden; separators ("." / ",") are static.
   ============================================================ */

import type { CSSProperties } from "react";

const STRIP = ["█", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((c, n) => <b key={n}>{c}</b>);

export function Reels({ value, className = "cx-ch4__count" }: { value: string; className?: string }) {
  return (
    <span className={className} aria-label={value}>
      {value.split("").map((ch, i) =>
        ch === "." || ch === "," ? (
          <span className="cx-ch4__sep" key={i} aria-hidden="true">
            {ch}
          </span>
        ) : (
          <span className="cx-ch4__reel" key={i} aria-hidden="true">
            <span className="cx-ch4__strip" style={{ "--cell": Number(ch) + 1 } as CSSProperties}>
              {STRIP}
            </span>
          </span>
        ),
      )}
    </span>
  );
}
