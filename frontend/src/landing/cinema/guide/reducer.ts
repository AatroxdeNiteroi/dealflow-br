/* ============================================================
   cinema/guide/reducer.ts — the globals reducer (§3.3 lifted, §5 J5 /
   C4d, §11.2, §11.8). Owner: WP-GUIDE.

   The ONLY writer of `.lp-nav`, `.lp-footer`, `.lp-cta` and the dock
   lift (`.cx-guide__lift`) while vh < 1900. It runs LAST among the DOM
   writers (FrameOrder.Reducer), so it wins over any late Ch5 catch-up
   write while the master is below Ch5.

     gateway   chrome autoAlpha 1 / yPercent 0 (0.8 s power2.out);
               CTA 0 re-asserted EVERY frame (guard against Ch5 late
               writes showing "Ver planos" over the Gateway)
     entering  chrome off: nav yPercent −100, footer +100, autoAlpha 0
               (320 ms rk-settle)
     radar     pure function of vh:
               - CTA y 16 → 0 + autoAlpha over 755–775 (sine.out)
               - chrome back over 1840–1880 (sine.inOut)
               - dock lift (y, transform only):
                   mobile  rises above the CTA row over 735–755, so the
                           CTA rises into the row the dock just vacated
                           (§3.11: never in the CTA's row);
                   both    −(footerH + 10) over 1840–1880 when the footer
                           returns (mobile: only what the CTA stack does
                           not already clear)
               At ≥ 1900 it writes the exact 1900 state once and stops:
               Ch5's own `.to()` calls then behave exactly as written
               (CTA hidden by Ch5 at 0.18). Back below 1900 it resumes.
   ============================================================ */

import gsap from "gsap";
import { FrameOrder, type CinemaCtx, type Phase } from "../types";
import { MARKS, MASTER_END } from "../beats";
import { progress, roundDevice, sineInOut, sineOut } from "../geometry";
import type { GuideBus, GuideMetrics } from "./machine";

/** Mobile: the dock clears the CTA row just before the CTA rises (755–775). */
export const CTA_STACK: readonly [number, number] = [MARKS.ctaIn[0] - 20, MARKS.ctaIn[0]];

/** Dock lift (px, ≤ 0) at master time vh — shared by the reducer (writer)
 *  and the machine (on-dark probe at the lifted position). */
export function dockLiftAt(vh: number, m: GuideMetrics): number {
  let y = 0;
  if (m.ctaLift > 0) y -= m.ctaLift * sineInOut(progress(CTA_STACK[0], CTA_STACK[1], vh));
  if (m.footLift > 0) y -= m.footLift * sineInOut(progress(MARKS.dockLift[0], MARKS.dockLift[1], vh));
  return roundDevice(y);
}

interface Channel {
  el: HTMLElement;
  setO: (v: number) => void;
  setY: (v: number) => void;
  o: number;
  y: number;
  vis: boolean | null;
}

function channel(sel: string, yProp: "yPercent" | "y"): Channel | null {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return null;
  return {
    el,
    setO: gsap.quickSetter(el, "opacity") as (v: number) => void,
    setY: (yProp === "y" ? gsap.quickSetter(el, "y", "px") : gsap.quickSetter(el, "yPercent")) as (v: number) => void,
    o: NaN,
    y: NaN,
    vis: null,
  };
}

function write(c: Channel | null, o: number, y: number, force = false): void {
  if (!c) return;
  if (force || !(Math.abs(o - c.o) < 1e-4)) {
    c.setO(o);
    c.o = o;
  }
  const vis = o > 0.001;
  if (force || vis !== c.vis) {
    c.el.style.visibility = vis ? "inherit" : "hidden";
    c.vis = vis;
  }
  if (force || !(Math.abs(y - c.y) < 1e-3)) {
    c.setY(y);
    c.y = y;
  }
}

const invalidate = (...cs: Array<Channel | null>) => {
  for (const c of cs) if (c) (c.o = NaN), (c.y = NaN), (c.vis = null);
};

export function build(ctx: CinemaCtx, bus: GuideBus): void {
  const nav = channel(".lp-nav", "yPercent");
  const footer = channel(".lp-footer", "yPercent");
  const cta = channel(".lp-cta", "y");
  const liftEl = document.querySelector<HTMLElement>(".lp-scrollcue .cx-guide__lift");
  const setLift = liftEl ? (gsap.quickSetter(liftEl, "y", "px") as (v: number) => void) : null;
  let liftY = NaN;

  let phase: Phase = "gateway";
  // time-based chrome level for gateway/entering (1 = visible, yPercent 0)
  const gate = { a: 0 };
  let gateTween: gsap.core.Tween | null = null;
  let belowEnd = true;

  ctx.onPhase((p) => {
    phase = p;
    invalidate(nav, footer, cta);
    liftY = NaN;
    gateTween?.kill();
    if (p === "gateway") {
      gate.a = Number.isFinite(nav?.o) ? Math.max(0, Math.min(1, nav!.o)) : 0;
      gateTween = gsap.to(gate, { a: 1, duration: 0.8, ease: "power2.out" });
    } else if (p === "entering") {
      gateTween = gsap.to(gate, { a: 0, duration: 0.32, ease: "rk-settle" });
    }
  });

  const writeLift = (y: number) => {
    if (!setLift || y === liftY) return;
    setLift(y);
    liftY = y;
  };
  const writeChrome = (a: number) => {
    write(nav, a, -100 * (1 - a));
    write(footer, a, 100 * (1 - a));
  };
  const writeRadar = (vh: number) => {
    const c = sineInOut(progress(MARKS.chromeIn[0], MARKS.chromeIn[1], vh));
    writeChrome(c);
    const t = sineOut(progress(MARKS.ctaIn[0], MARKS.ctaIn[1], vh));
    write(cta, t, 16 * (1 - t));
    writeLift(dockLiftAt(vh, bus.metrics));
  };

  ctx.frame.add(FrameOrder.Reducer, (vh) => {
    if (phase !== "radar") {
      writeChrome(gate.a);
      write(cta, 0, 16, true); // re-asserted every frame over the Gateway
      writeLift(0);
      belowEnd = true;
      return;
    }
    if (vh < MASTER_END) {
      if (!belowEnd) invalidate(nav, footer, cta); // coming back from Ch5: Ch5 wrote in between
      belowEnd = true;
      writeRadar(vh);
      return;
    }
    if (belowEnd) {
      // crossing into Ch5: leave exactly the 1900 state, then hand off
      writeRadar(MASTER_END);
      belowEnd = false;
    }
  });

  // metrics change on refresh (resize, fonts): re-derive the lift
  bus.onMeasured.push(() => {
    liftY = NaN;
  });

  ctx.settle.register("guide.reducer", {
    start() {
      invalidate(nav, footer, cta);
      write(cta, 0, 16, true);
      liftY = NaN;
      writeLift(0);
    },
    end() {
      invalidate(nav, footer, cta);
      liftY = NaN;
      writeRadar(MASTER_END);
      belowEnd = false;
    },
  });
  ctx.onDestroy(() => gateTween?.kill());
}
