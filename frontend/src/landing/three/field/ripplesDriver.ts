/* ============================================================
   three/field/ripplesDriver.ts — fixed ink ripples (spec rev 3.1 §4.8).
   Owner: WP3.

   The fixed events GL can place itself, registered from the v3 table
   beats.RIPPLES_V3 ({ id, vh, at, amp, inward, radiusPx, window }):
   the J2 implosion (inward, 330 → 345, 420 px → 0, at the anchor), the
   `lock` act at amp 0.30 (≈ 10 px push), the C4a membrane and the
   ring-lock. The seal and the 18 C2a impacts are DOSSIER's, added
   through field.addRipple. Each frame the table writes the shared
   `uRings` uniform (pure f(vh): ripples run backwards on reverse).
   Plateaus stay static (§8.1 item 4): an event that would run into a
   rest plateau has its window shortened to end at the plateau's start
   (the lock at 345 rings out over 345 → 352 instead of 345 → 359, which
   moved beads inside R1).
   ============================================================ */

import { RESTS, RIPPLES, RIPPLES_V3 } from "../../cinema/beats";
import { FLAGS } from "../../cinema/flags";
import type { RippleEvent } from "../../cinema/types";
import { RippleTable } from "../ripples";
import type { DriverInit, FieldDriver, FieldFrame } from "./frame";

/** The event's window, shortened so it ends at the start of any plateau it would run into. */
export function plateauSafeWindow(vh: number, window: number): number {
  let w = window;
  for (const r of RESTS) {
    const p = r.plateau;
    if (p && vh < p[0] && vh + w > p[0]) w = p[0] - vh;
  }
  return w;
}

export class RipplesDriver implements FieldDriver {
  private readonly ripples = new RippleTable();
  private rings!: Float32Array;

  init(k: DriverInit): void {
    this.rings = k.pu.uRings.value as Float32Array;
    const f = k.frame;
    const host = k.host;
    const atAnchor = () => ({ x: f.anchor.x, y: f.anchor.y });
    const atCentre = () => ({ x: host.w / 2, y: host.h / 2 });
    for (const r of RIPPLES_V3) {
      const e: RippleEvent = { vh: r.vh, at: r.at === "anchor" ? atAnchor : atCentre };
      if (r.amp !== undefined) e.amp = r.amp;
      if (r.inward) e.inward = true;
      if (r.radiusPx !== undefined) e.radiusPx = r.radiusPx;
      if (r.window !== undefined) e.window = r.window;
      this.add(e);
    }
  }

  update(f: FieldFrame): void {
    if (FLAGS.RIPPLES) this.ripples.evaluate(f.vh, this.rings);
    else this.rings.fill(0);
  }

  add(e: RippleEvent): void {
    const win = e.window ?? RIPPLES.window;
    const safe = plateauSafeWindow(e.vh, win);
    this.ripples.add(safe < win ? { ...e, window: safe } : e);
  }

  dispose(): void {
    this.ripples.clear();
  }
}
