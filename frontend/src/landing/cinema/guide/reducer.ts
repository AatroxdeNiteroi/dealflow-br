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
               - chrome back over 1840–1880 (sine.inOut); on desktop the
                 corner CTA rises with the footer to footerH + 10 (QA D5),
                 like the dock — Ch5 only tweens its autoAlpha at 0.18,
                 so the lift holds until Ch5 hides it
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

   v3 (spec rev 3.1 §3 C4d, §7 E7, §8.1 item 7): it also owns the dock
   root's `.is-cinema` class (the liquid pill / rail restyle). On while
   the cinema owns the dock (phase radar, vh < 1900); at vh ≥ 1900 (or
   outside the radar) it is removed only once the dock reads fully faded
   — Ch5's cue-off fade (Landing ≈ 611–630) brings it to autoAlpha 0 —
   so the pill never snaps square while visible; re-added in the first
   frame back below 1900, before the cue-off fade-in renders. The check
   reads GSAP's inline opacity / visibility only (no style, no layout).
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
  // QA PERF-2 / M4: html.is-cinema-live while the cinema owns the screen
  const docEl = document.documentElement;
  let live: boolean | null = null;
  const writeLive = (on: boolean) => {
    if (on === live) return;
    live = on;
    docEl.classList.toggle("is-cinema-live", on);
  };
  // the corner CTA's armed ring loops only while the CTA is shown
  let ctaOff: boolean | null = null;
  const writeCtaOff = () => {
    if (!cta) return;
    const off = !cta.vis;
    if (off === ctaOff) return;
    ctaOff = off;
    cta.el.classList.toggle("is-ring-rest", off);
  };
  // time-based chrome level for gateway/entering (1 = visible, yPercent 0)
  const gate = { a: 0 };
  let gateTween: gsap.core.Tween | null = null;
  let belowEnd = true;

  // v3: the dock's liquid scope (§7 E7)
  const dock = document.querySelector<HTMLElement>(".lp-scrollcue");
  let cinema: boolean | null = null;
  const dockFaded = (): boolean => {
    if (!dock) return true;
    const vis = dock.style.visibility;
    const op = dock.style.opacity;
    // no inline state yet = the CSS default (opacity 0, hidden)
    if (vis === "" && op === "") return true;
    return vis === "hidden" || (op !== "" && Number(op) <= 0);
  };
  const writeCinema = (vh: number) => {
    if (!dock) return;
    const want = phase === "radar" && vh < MASTER_END;
    if (want === cinema) return;
    if (!want && !dockFaded()) return; // still visible: keep the pill until the fade ends
    cinema = want;
    dock.classList.toggle("is-cinema", want);
  };

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
    // the radar phase starts in the same task as the reveal (Landing's effects):
    // scope the dock at once, so a quiet (instant) reveal never paints a square
    if (p === "radar") writeCinema(ctx.vh());
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
    const m = bus.metrics;
    const foot = m.ctaFootLift > 0 ? roundDevice(m.ctaFootLift * c) : 0;
    write(cta, t, 16 * (1 - t) - foot);
    writeLift(dockLiftAt(vh, bus.metrics));
  };

  ctx.frame.add(FrameOrder.Reducer, (vh) => {
    writeCinema(vh);
    writeLive(phase !== "radar" || vh < MARKS.layersOff);
    if (phase !== "radar") {
      writeChrome(gate.a);
      write(cta, 0, 16, true); // re-asserted every frame over the Gateway
      writeCtaOff();
      writeLift(0);
      belowEnd = true;
      return;
    }
    if (vh < MASTER_END) {
      if (!belowEnd) invalidate(nav, footer, cta); // coming back from Ch5: Ch5 wrote in between
      belowEnd = true;
      writeRadar(vh);
      writeCtaOff();
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

  // the landscape-phone card (M4) is pure CSS state: nothing to settle
  ctx.settle.register("guide.rotate", { start() {}, end() {} }, ".cx-rotate");
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
  ctx.onDestroy(() => {
    gateTween?.kill();
    docEl.classList.remove("is-cinema-live");
    dock?.classList.remove("is-cinema");
    cta?.el.classList.remove("is-ring-rest");
  });
}
