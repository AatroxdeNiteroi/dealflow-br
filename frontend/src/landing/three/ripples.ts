/* ============================================================
   three/ripples.ts — deterministic ink ripples (§7.8; v3 §4.8). Owner: WP3.

   An event table {vh, at(), amp, inward?, radiusPx?, window?}. Each
   frame, for master vh, the events with 0 ≤ vh − vh_e ≤ window_e are
   active: radius = Δ/window · radiusPx, weight × (1 − Δ/window). The 6
   most recent fill uRings[6] = (x px, y px, radius px, weight). A pure
   function of vh: ripples run backwards when the user scrolls back.
   Calibration: the weight is amp / 0.18 (the default amp = 1), so a
   default ripple crest pushes points 6 px outward and swells them
   45 %. Read literally (w ≤ .18) the push was ~1 px — invisible; the
   ripple must be legible as the "lock" / "impact" feedback it is.
   v3: per-event `window` / `radiusPx` overrides, and INWARD events (the
   J2 implosion 330 → 345, 420 px → 0): the radius runs backwards
   ((1 − d)·R), the weight eases in (no ring popping up at 420 px) and
   is negative, so the crest PULLS the beads toward the target as it
   converges (the shader's size swell uses |w|). Outward events are
   exactly v2.
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
    this.active.length = 0;
    // newest first; per-event windows, so every event is checked (≤ ~25 events)
    for (let i = this.events.length - 1; i >= 0 && this.active.length < MAX_RINGS; i--) {
      const e = this.events[i];
      const d = vh - e.vh;
      if (d < 0 || d > (e.window ?? RIPPLES.window)) continue;
      this.active.push(e);
    }
    let n = 0;
    for (const e of this.active) {
      const win = e.window ?? RIPPLES.window;
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
      let amp = ((e.amp ?? RIPPLES.amp) / RIPPLES.amp) * (1 - d);
      if (amp <= 0) continue;
      const R = e.radiusPx ?? RIPPLES.radiusPx;
      let radius = d * R;
      if (e.inward) {
        // converging ring: eases in over the first 20 % (no pop at R), pulls inward
        const t = Math.min(1, d / 0.2);
        amp *= -(t * t * (3 - 2 * t));
        radius = (1 - d) * R;
      }
      out[n * 4] = c.x;
      out[n * 4 + 1] = c.y;
      out[n * 4 + 2] = radius;
      out[n * 4 + 3] = amp;
      n++;
    }
    return n;
  }
}
