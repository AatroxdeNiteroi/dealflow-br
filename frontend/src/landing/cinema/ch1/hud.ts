/* ============================================================
   cinema/ch1/hud.ts — the hero HUD "AZ ###° · varredura ativa" (§3.1).
   Owner: WP-CH1.

   - G3 (time-based, on a normal reveal): 0.15 s after phase radar the
     readout counts 000 → the live bearing over 220 ms (rk-settle, a
     needle settling), then goes live. A quiet entry is live at once.
   - Live: written in the Labels slot, ONLY when the integer changes,
     and never while the HUD is hidden (vh ≥ 70).
   - J1 30–70 (scrubbed, master): `.cx-hud` y 0 → −8, autoAlpha 1 → 0.
   No telemetry, no percentages; HUD_ZOOM_READOUT is deferred (off).
   ============================================================ */

import gsap from "gsap";
import { FrameOrder, type CinemaCtx } from "../types";
import { PACE } from "../beats";
import { FLAGS } from "../flags";
import { claim } from "../dev/assert";
import { HUD_COPY } from "../copy";

/** J1 HUD exit window (master vh × PACE). */
export const HUD_OUT: readonly [number, number] = [30 * PACE, 70 * PACE];
const COUNT_DELAY = 0.15;
const COUNT_DUR = 0.22;

export interface HudApi {
  reset(): void;
}

export function buildHud(ctx: CinemaCtx): HudApi | null {
  const hud = document.querySelector<HTMLElement>(".lp-stage > .cx-hud");
  const read = hud?.querySelector<HTMLElement>(".cx-hud__read") ?? null;
  if (!hud || !read) {
    console.warn("[cinema/ch1] HUD DOM not found");
    return null;
  }

  // J1 — the instrument readout steps back as the dive begins
  ctx.tl.to(hud, { y: -8, autoAlpha: 0, duration: HUD_OUT[1] - HUD_OUT[0] }, HUD_OUT[0]);
  if (FLAGS.DEV_ASSERT) claim("CH1", read, ["textContent"]);

  const settleEase = gsap.parseEase("rk-settle") ?? gsap.parseEase("power3.out");
  let radar = false;
  let countFrom = -1;
  let shown = -1;

  const write = (deg: number) => {
    const v = ((Math.round(deg) % 360) + 360) % 360;
    if (v === shown) return;
    shown = v;
    read.textContent = HUD_COPY.azimuth(v);
  };

  ctx.onReveal(({ quiet }) => {
    if (quiet) {
      countFrom = -1;
      return;
    }
    countFrom = gsap.ticker.time + COUNT_DELAY;
    write(0);
  });
  ctx.onPhase((p) => {
    radar = p === "radar";
    if (!radar) countFrom = -1;
  });

  // QA PERF-2: the live dot's ping loops only while the HUD can be seen
  let idle: boolean | null = null;
  ctx.frame.add(FrameOrder.Labels, (vh, t) => {
    const off = !radar || vh >= HUD_OUT[1];
    if (hud && off !== idle) {
      idle = off;
      hud.classList.toggle("is-idle", off);
    }
    // the stage is hidden outside the radar phase and past the J1 exit: no text writes
    if (off) return;
    const live = ctx.field.frameData.sweepBearing;
    if (countFrom < 0) {
      write(live);
      return;
    }
    const k = (t - countFrom) / COUNT_DUR;
    if (k < 0) write(0);
    else if (k < 1) write(live * settleEase(k));
    else {
      countFrom = -1;
      write(live);
    }
  });

  return {
    reset() {
      countFrom = -1;
      shown = -1;
    },
  };
}
