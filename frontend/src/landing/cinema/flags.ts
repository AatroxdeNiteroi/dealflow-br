/* ============================================================
   cinema/flags.ts — kill switches and decided defaults (WP0).

   v2 defaults follow the lead's sign-off (v2 spec §14):
   - items 1–5 APPROVED: new microcopy, hero verb (HERO_VERB_LEGACY
     false), target tag, ch3 line folded, SNAP on;
   - item 6 stays OFF: every Ch5-zone option. PLANS_BACKDROP_PARITY
     stays TRUE (= today's plans backdrop: the charge wedge keeps its
     gold behind the plans), KEEP_DUST_IN_PLANS false,
     LENIS_CINEMA_LERP false;
   - item 7 deferred: HUD_ZOOM_READOUT false.

   v3 "Sonar Líquido" (spec rev 3.1 §8.2, decided defaults §10.3).
   Every v3 feature has its own switch; a QA failure may only move a
   flag toward its conservative value (§10.2 step 3).

   Dev only: `?cx-flags=SNAP=0,RIPPLES=0` overrides any flag (numeric
   flags take a number: `?cx-flags=DEBUG_PVEL=-1`), `?nowebgl` forces
   the NullField fallback (§9.3), `?cx-still` freezes the field's time
   terms at t = 0 (cinema/env.ts CX_STILL), `?cx-perf` turns on the
   per-beat GPU timer log (WP8).
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

  /* ── v3 (spec rev 3.1 §8.2) ─────────────────────────────── */
  /** §6.2 critically damped playhead follower (false = identity: vh = W(s)). WP1. */
  PLAYHEAD_FOLLOW: boolean;
  /** §2.2 scroll-space dilation on fine pointers (false = 1:1, v2 tracks). WP1. */
  DILATION: boolean;
  /** §2.2 dilation on coarse pointers (explicit Ktouch table). WP1. */
  TOUCH_DILATION: boolean;
  /** §2.4 Lenis virtualScroll viscosity inside read windows (feasibility veto: off). WP1. */
  WHEEL_VISCOSITY: boolean;
  /** §4 the v3 sonar (false = v2 shader path and v2 wedge look). WP2/WP3. */
  SONAR: boolean;
  /** §4.5 hidden universe (dust prefix in the afterglow, T0/T1). WP3. */
  HIDDEN_UNIVERSE: boolean;
  /** §3 J1 echo chips (DOM). WP6. */
  ECHO_CHIPS: boolean;
  /** §3 J2 decoy chips with the strike (DOM). WP6. */
  DECOY_CHIPS: boolean;
  /** §5 glyph engine (false = word mode). WP5. */
  GLYPHS: boolean;
  /** §6.1 L3–L5 camera time layer (lean, bank, kicks, parallax). WP4. */
  CAM_LIFE: boolean;
  /** §6.1 L6 Ch2–Ch3 backdrop drift + sway. WP4. */
  CARD_DRIFT: boolean;
  /** §4.8 radial rimIn (protected interior: off). WP3. */
  RIMIN_RADIAL: boolean;
  /** §5.3 per-glyph HOT→COOL cooling in the respiro (protected interior: off). WP6. */
  RESPIRO_GLYPH_COOL: boolean;
  /** §1.4 item 3 the target tag on an ink capsule plate. WP6. */
  TAG_PLATE: boolean;
  /** §5.7 lead imperatives inside reading holds. WP8. */
  DOCK_LEAD: boolean;
  /** §5.7 rule 6 the dock reading meter. WP8. */
  DOCK_METER: boolean;
  /** §6.1 L5 cursor parallax inside J4 (protected interior: off). WP4. */
  INTERIOR_PARALLAX: boolean;
  /** Reserved, not built (vetoed: J3 roll). */
  J3_ROLL: boolean;
  /** §5.4 odometer weight settle 640 → 500 in countSettle (T0/T1). WP7. */
  ODO_WGHT: boolean;
  /** Dev-only (WP2 acceptance): force the playhead velocity terms.
   *  0 = off; 1 → pvelN = 1, pvelS = +1; −1 → pvelN = 1, pvelS = −1. */
  DEBUG_PVEL: number;
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

  PLAYHEAD_FOLLOW: true,
  DILATION: true,
  TOUCH_DILATION: true,
  WHEEL_VISCOSITY: false,
  SONAR: true,
  HIDDEN_UNIVERSE: true,
  ECHO_CHIPS: true,
  DECOY_CHIPS: true,
  GLYPHS: true,
  CAM_LIFE: true,
  CARD_DRIFT: true,
  RIMIN_RADIAL: false,
  RESPIRO_GLYPH_COOL: false,
  TAG_PLATE: true,
  DOCK_LEAD: true,
  DOCK_METER: true,
  INTERIOR_PARALLAX: false,
  J3_ROLL: false,
  ODO_WGHT: true,
  DEBUG_PVEL: 0,
};

function resolveFlags(): CinemaFlags {
  const flags: CinemaFlags = { ...DEFAULTS };
  if (!IS_DEV || typeof window === "undefined") return flags;
  flags.DEV_ASSERT = true;
  const qs = new URLSearchParams(window.location.search);
  if (qs.has("nowebgl")) flags.DEV_NO_WEBGL = true;
  const raw = qs.get("cx-flags");
  if (raw) {
    const rec = flags as unknown as Record<string, boolean | number>;
    for (const pair of raw.split(",")) {
      const [k, v] = pair.split("=");
      if (!k || !(k in flags)) continue;
      if (typeof DEFAULTS[k as keyof CinemaFlags] === "number") {
        const n = Number(v);
        rec[k] = Number.isFinite(n) ? n : 0;
      } else {
        rec[k] = v !== "0" && v !== "false";
      }
    }
  }
  return flags;
}

/** Resolved once at module load (before any deep-link replaceState). */
export const FLAGS: Readonly<CinemaFlags> = Object.freeze(resolveFlags());
