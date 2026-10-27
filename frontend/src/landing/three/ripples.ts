/* ============================================================
   three/ripples.ts — deterministic ink ripples (§7.8). Owner: WP-GL.

   An event table {vh, at(), amp}. Each frame, for master vh, the
   events with 0 ≤ vh − vh_e ≤ window are active: radius = Δ/window ·
   260 px, weight × (1 − Δ/window). The 6 most recent fill
   uRings[6] = (x px, y px, radius px, weight). A pure function of vh:
   ripples run backwards when the user scrolls back.
   Calibration: the weight is amp / 0.18 (the default amp = 1), so a
   default ripple crest pushes points 6 px outward and swells them
   45 %. Read literally (w ≤ .18) the push was ~1 px — invisible; the
   ripple must be legible as the "lock" / "impact" feedback it is.
   ============================================================ */

import { RIPPLES } from "../cinema/beats";
import type { RippleEvent } from "../cinema/types";

export const MAX_RINGS = 6;

export class RippleTable {
  private events: RippleEvent[] = [];
  private active: RippleEvent[] = [];

  add(e: RippleEvent): void {
    // the same event registered twice (e.g. a rebuild) must not double the ink
    if (this.events.some((x) => x.vh === e.vh && x.at === e.at)) return;
    this.events.push(e);
    this.events.sort((a, b) => a.vh - b.vh);
  }

  clear(): void {
    this.events.length = 0;
  }

  /** Writes uRings (length 24) for master vh; returns the number of active rings. */
  evaluate(vh: number, out: Float32Array): number {
    out.fill(0);
    const win = RIPPLES.window;
    this.active.length = 0;
    // events are sorted by vh: walk back from the newest that has started
    for (let i = this.events.length - 1; i >= 0 && this.active.length < MAX_RINGS; i--) {
      const e = this.events[i];
      const d = vh - e.vh;
      if (d < 0) continue;
      if (d > win) {
        // older events can only be further past their window… unless they
        // started later; the list is sorted, so everything below is older
        break;
      }
      this.active.push(e);
    }
    let n = 0;
    for (const e of this.active) {
      const d = (vh - e.vh) / win;
      let c: { x: number; y: number };
      try {
        c = e.at();
      } catch {
        continue;
      }
      if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
      // crest weight normalised to the default amplitude: a default event pushes
      // points 6 px outwards at its crest (the spec's 6px·w), fading with age
      const amp = ((e.amp ?? RIPPLES.amp) / RIPPLES.amp) * (1 - d);
      if (amp <= 0) continue;
      out[n * 4] = c.x;
      out[n * 4 + 1] = c.y;
      out[n * 4 + 2] = d * RIPPLES.radiusPx;
      out[n * 4 + 3] = amp;
      n++;
    }
    return n;
  }
}
