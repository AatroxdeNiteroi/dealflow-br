/* ============================================================
   cinema/flags.ts — kill switches and sign-off options (WP0).

   Defaults follow the lead's sign-off (spec §14):
   - items 1–5 APPROVED: new microcopy, hero verb (HERO_VERB_LEGACY
     false), target tag, ch3 line folded, SNAP on;
   - item 6 stays OFF: every Ch5-zone option. PLANS_BACKDROP_PARITY
     stays TRUE (= today's plans backdrop: the charge wedge keeps its
     gold behind the plans), KEEP_DUST_IN_PLANS false,
     LENIS_CINEMA_LERP false;
   - item 7 deferred: HUD_ZOOM_READOUT false.

   Dev only: `?cx-flags=SNAP=0,RIPPLES=0` overrides any flag, and
   `?nowebgl` forces the NullField fallback (§9.3).
   ============================================================ */

import { IS_DEV } from "./env";

export interface CinemaFlags {
  /** §4.7 directional snap (desktop, fine pointer, motion allowed). */
  SNAP: boolean;
  /** §3.4 R0 verb: true restores "role para varrer o campo". */
  HERO_VERB_LEGACY: boolean;
  /** §3.1 optional HUD zoom readout (deferred). */
  HUD_ZOOM_READOUT: boolean;
  /** §7.8 deterministic ink ripples (first to cut if perf is short). */
  RIPPLES: boolean;
  /** §7.3 chargeGain holds 1 from 1850 on (today's plans backdrop). */
  PLANS_BACKDROP_PARITY: boolean;
  /** §7.3 dustGain holds 1 into the plans (vetoed, off). */
  KEEP_DUST_IN_PLANS: boolean;
  /** §4.6 Lenis lerp mode inside the cinema (needs sign-off, off). */
  LENIS_CINEMA_LERP: boolean;
  /** §7.10 pause the GL when ch6+ fully covers the canvas. */
  PAUSE_UNDER_CH6: boolean;
  /** §9.3 dev-only: force the NullField + CSS fallback. */
  DEV_NO_WEBGL: boolean;
  /** §12.4 dev-only: single-writer + settle-coverage assertions. */
  DEV_ASSERT: boolean;
}

const DEFAULTS: CinemaFlags = {
  SNAP: true,
  HERO_VERB_LEGACY: false,
  HUD_ZOOM_READOUT: false,
  RIPPLES: true,
  PLANS_BACKDROP_PARITY: true,
  KEEP_DUST_IN_PLANS: false,
  LENIS_CINEMA_LERP: false,
  PAUSE_UNDER_CH6: true,
  DEV_NO_WEBGL: false,
  DEV_ASSERT: false,
};

function resolveFlags(): CinemaFlags {
  const flags: CinemaFlags = { ...DEFAULTS };
  if (!IS_DEV || typeof window === "undefined") return flags;
  flags.DEV_ASSERT = true;
  const qs = new URLSearchParams(window.location.search);
  if (qs.has("nowebgl")) flags.DEV_NO_WEBGL = true;
  const raw = qs.get("cx-flags");
  if (raw) {
    for (const pair of raw.split(",")) {
      const [k, v] = pair.split("=");
      if (k && k in flags) {
        (flags as unknown as Record<string, boolean>)[k] = v !== "0" && v !== "false";
      }
    }
  }
  return flags;
}

/** Resolved once at module load (before any deep-link replaceState). */
export const FLAGS: Readonly<CinemaFlags> = Object.freeze(resolveFlags());
