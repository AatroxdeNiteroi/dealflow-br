/* ============================================================
   cinema/settle.ts — deterministic settle states (WP0, §11.3/§11.5).

   settle(1)  master = 1 (Ch5 start), acts at their end, every hook's
              end(): every ch1–4 layer at autoAlpha 0 (teleport).
   settle(0)  master = 0, acts at their start, every hook's start():
              pre-reveal state under the Gateway (return home).
   Both are idempotent and safe to call twice in a row.

   settleScrubbed(dir)  jumps every scrub:<number> trigger's catch-up
              tween to its end, in creation order for "end" and REVERSE
              creation order for "start" (Ch5 first, then earlier). The
              master is scrub:true (no tween) and is skipped naturally.

   The field time layer is reset to neutral here (entryZ 0, shockR −1,
   fovGate 0, ringBoost 0). The Gateway's own settle hook (WP-GW,
   registered through runtime.settle) puts entryZ back to 3.5 for its
   boot — the core never assumes a particular Gateway.
   ============================================================ */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { FieldAdapter, SettleHandler } from "./types";

interface Entry {
  h: SettleHandler;
  scope?: string;
}

/** Module singleton: one cinema per page; persistent hooks survive rebuilds. */
class SettleRegistry {
  private map = new Map<string, Entry>();

  register(id: string, h: SettleHandler, scope?: string): () => void {
    const entry: Entry = { h, scope };
    this.map.set(id, entry);
    return () => {
      if (this.map.get(id) === entry) this.map.delete(id);
    };
  }

  run(to: 0 | 1): void {
    for (const [id, { h }] of this.map) {
      try {
        if (to === 1) h.end();
        else h.start();
      } catch (err) {
        console.error(`[cinema/settle] hook "${id}" threw`, err);
      }
    }
  }

  /** Selectors registered as settle scopes (dev coverage assertion). */
  scopes(): string[] {
    const out: string[] = [];
    for (const { scope } of this.map.values()) if (scope) out.push(scope);
    return out;
  }

  ids(): string[] {
    return [...this.map.keys()];
  }
}

export const settleRegistry = new SettleRegistry();

export function resetFieldTime(field: FieldAdapter): void {
  const t = field.time;
  t.entryZ = 0;
  t.shockR = -1;
  t.fovGate = 0;
  t.ringBoost[0] = t.ringBoost[1] = t.ringBoost[2] = t.ringBoost[3] = 0;
  t.lockPulse = 0;
}

/** getTween()?.progress(1) on every scrubbed trigger (see header). */
export function settleScrubbed(dir: "start" | "end"): void {
  const all = ScrollTrigger.getAll();
  const list = dir === "start" ? all.slice().reverse() : all;
  for (const st of list) {
    if (!st.vars.scrub) continue;
    const tw = st.getTween();
    if (tw && typeof tw.progress === "function") tw.progress(1);
  }
}

/**
 * Kill free-standing (root-level) tweens of `targets` only.
 * `gsap.killTweensOf` recurses into timelines and would delete Ch5's own
 * `.lp-cta` / chrome tweens (breaking Ch5 on the next journey); this kills
 * only stray time-based tweens (cue-off toggles, phase fades, reveals).
 */
export function killLooseTweensOf(targets: gsap.TweenTarget): void {
  const root = gsap.globalTimeline;
  for (const tw of gsap.getTweensOf(targets)) {
    if (tw.parent === root) tw.kill();
  }
}
