/* ============================================================
   cinema/runtime.ts — page-wide singleton (WP0). The seam for code
   that lives OUTSIDE a CinemaCtx (Gateway, Landing flows) and for
   packages that need the shared Lenis / veil / blocked state.

   - runtime.field    the FieldAdapter (set by Landing in a LAYOUT
                      effect, so it exists before Gateway's boot)
   - runtime.lenis()  current Lenis or null (reduced motion)
   - runtime.veil     `.lp-return-veil` cover/reveal (quiet entry)
   - runtime.blocked()  any of overlay/historia/boletim/teleport/return
   - runtime.settle   persistent settle registry (survives remounts;
                      Gateway registers its `start` hook here)
   - runtime.gateEl() the Gateway emblem `.grl` (scoped
                      `--sweep-bearing` sink), null in radar
   ============================================================ */

import gsap from "gsap";
import type Lenis from "lenis";
import type { BlockReason, FieldAdapter, SettleHandler } from "./types";
import { settleRegistry } from "./settle";

const VEIL = ".lp-return-veil";

let field: FieldAdapter | null = null;
let lenisGetter: () => Lenis | null = () => null;
let gateGetter: () => HTMLElement | null = () => null;
const blockedReasons = new Set<BlockReason>();
const blockedListeners = new Set<(blocked: boolean) => void>();

export const runtime = {
  /** The live field. Throws before Landing created it (programming error). */
  get field(): FieldAdapter {
    if (!field) throw new Error("[cinema/runtime] field not created yet");
    return field;
  },
  /** Field or null (safe probe, e.g. in a Gateway layout effect). */
  fieldOrNull(): FieldAdapter | null {
    return field;
  },
  setField(f: FieldAdapter | null): void {
    field = f;
  },

  lenis(): Lenis | null {
    return lenisGetter();
  },
  setLenis(getter: () => Lenis | null): void {
    lenisGetter = getter;
  },

  gateEl(): HTMLElement | null {
    return gateGetter();
  },
  setGateEl(getter: () => HTMLElement | null): void {
    gateGetter = getter;
  },

  veil: {
    /** Paper veil over everything ("mergulho no papel", quiet entry G2). */
    cover(duration = 0.3): gsap.core.Tween {
      return gsap.to(VEIL, { autoAlpha: 1, duration, ease: "power2.inOut", overwrite: "auto" });
    },
    reveal(duration = 0.6): gsap.core.Tween {
      return gsap.to(VEIL, { autoAlpha: 0, duration, ease: "power2.out", overwrite: "auto" });
    },
    /** `.lp-return-veil` opacity ≥ .99 (pending flush: teleport alreadyCovered). */
    isCovered(): boolean {
      const el = document.querySelector(VEIL);
      return !!el && Number(gsap.getProperty(el, "opacity")) >= 0.99;
    },
  },

  blocked(): boolean {
    return blockedReasons.size > 0;
  },
  setBlocked(reason: BlockReason, on: boolean): void {
    const was = blockedReasons.size > 0;
    if (on) blockedReasons.add(reason);
    else blockedReasons.delete(reason);
    const now = blockedReasons.size > 0;
    if (was !== now) blockedListeners.forEach((fn) => fn(now));
  },
  /** Notified when blocked() flips (dock button disabled state, snap). */
  onBlockedChange(fn: (blocked: boolean) => void): () => void {
    blockedListeners.add(fn);
    return () => blockedListeners.delete(fn);
  },

  settle: {
    /** Persistent hook (not tied to a cinema build). Returns an unregister fn. */
    register(id: string, h: SettleHandler, scope?: string): () => void {
      return settleRegistry.register(id, h, scope);
    },
  },
};
