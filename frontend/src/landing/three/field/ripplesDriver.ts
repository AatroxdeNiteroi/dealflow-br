/* ============================================================
   three/field/ripplesDriver.ts — fixed ink ripples (spec rev 3.1 §4.8).
   Moved verbatim from PointField by WP0 → owned by WP3.

   The fixed events GL can place itself (the J2 lock, the C4a membrane,
   the ring-lock; the seal and the 18 C2a impacts are DOSSIER's, added
   through field.addRipple). Each frame the table writes the shared
   `uRings` uniform (pure f(vh): ripples run backwards on reverse).
   v3 (WP3): register from beats.RIPPLES_V3 ({ vh, at, amp, inward }):
   the inward implosion 330 → 345 (420 px) and the lock at amp 0.30.
   ============================================================ */

import { RIPPLES } from "../../cinema/beats";
import { FLAGS } from "../../cinema/flags";
import type { RippleEvent } from "../../cinema/types";
import { RippleTable } from "../ripples";
import type { DriverInit, FieldDriver, FieldFrame } from "./frame";

export class RipplesDriver implements FieldDriver {
  private readonly ripples = new RippleTable();
  private rings!: Float32Array;

  init(k: DriverInit): void {
    this.rings = k.pu.uRings.value as Float32Array;
    const f = k.frame;
    const host = k.host;
    /* ── fixed ink ripples GL can place itself (§5 J2 lock, C4a membrane,
          ring-lock). The seal and the 18 C2a impacts are DOSSIER's. ── */
    const atAnchor = () => ({ x: f.anchor.x, y: f.anchor.y });
    this.ripples.add({ vh: RIPPLES.at.lock, at: atAnchor });
    this.ripples.add({ vh: RIPPLES.at.membrane, at: () => ({ x: host.w / 2, y: host.h / 2 }) });
    this.ripples.add({ vh: RIPPLES.at.ringLock, at: atAnchor });
  }

  update(f: FieldFrame): void {
    if (FLAGS.RIPPLES) this.ripples.evaluate(f.vh, this.rings);
    else this.rings.fill(0);
  }

  add(e: RippleEvent): void {
    this.ripples.add(e);
  }

  dispose(): void {
    this.ripples.clear();
  }
}
