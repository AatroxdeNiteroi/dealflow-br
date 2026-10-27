/* ============================================================
   cinema/guide/reducer.ts — the globals reducer (§3.3 lifted, §5 J5/C4d,
   §11.8): the ONLY writer of `.lp-nav`, `.lp-footer` and `.lp-cta`
   while vh < 1900, running LAST among DOM writers (FrameOrder.Reducer)
   so it wins over any late Ch5 catch-up write. Owner: WP-GUIDE.

   WP0 seed (functional, so the interim page keeps today's contract):
     gateway   chrome autoAlpha 1 / yPercent 0 (0.8 s power2.out);
               CTA 0 re-asserted EVERY frame (guard against Ch5 late
               writes over the Gateway)
     entering  chrome off: nav yPercent −100, footer +100, autoAlpha 0
               (320 ms rk-settle)
     radar     pure function of vh: CTA y 16 → 0 + autoAlpha over
               755–775 (sine.out); chrome back over 1840–1880
               (sine.inOut); at ≥ 1900 it writes the 1900 state once
               and stops — Ch5's own `.to()` calls then behave exactly
               as written (CTA hidden by Ch5 at 0.18).
   WP-GUIDE adds the dock-inner lift (1840–1880) here.
   ============================================================ */

import gsap from "gsap";
import { FrameOrder, type CinemaCtx, type Phase } from "../types";
import { MARKS, MASTER_END } from "../beats";
import { progress, sineInOut, sineOut } from "../geometry";

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

export function build(ctx: CinemaCtx): void {
  const nav = channel(".lp-nav", "yPercent");
  const footer = channel(".lp-footer", "yPercent");
  const cta = channel(".lp-cta", "y");

  let phase: Phase = "gateway";
  // time-based chrome level for gateway/entering (1 = visible, yPercent 0)
  const gate = { a: 0 };
  let gateTween: gsap.core.Tween | null = null;
  let belowEnd = true;

  ctx.onPhase((p) => {
    phase = p;
    invalidate(nav, footer, cta);
    gateTween?.kill();
    if (p === "gateway") {
      gate.a = Number.isFinite(nav?.o) ? Math.max(0, Math.min(1, nav!.o)) : 0;
      gateTween = gsap.to(gate, { a: 1, duration: 0.8, ease: "power2.out" });
    } else if (p === "entering") {
      gateTween = gsap.to(gate, { a: 0, duration: 0.32, ease: "rk-settle" });
    }
  });

  const writeChrome = (a: number) => {
    write(nav, a, -100 * (1 - a));
    write(footer, a, 100 * (1 - a));
  };
  const writeRadar = (vh: number) => {
    const c = sineInOut(progress(MARKS.chromeIn[0], MARKS.chromeIn[1], vh));
    writeChrome(c);
    const t = sineOut(progress(MARKS.ctaIn[0], MARKS.ctaIn[1], vh));
    write(cta, t, 16 * (1 - t));
  };

  ctx.frame.add(FrameOrder.Reducer, (vh) => {
    if (phase !== "radar") {
      writeChrome(gate.a);
      write(cta, 0, 16, true); // re-asserted every frame over the Gateway
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
      // crossing into Ch5: leave exactly the 1900 state, then hands off
      writeRadar(MASTER_END);
      belowEnd = false;
    }
  });

  ctx.settle.register("guide.reducer", {
    start() {
      invalidate(nav, footer, cta);
      write(cta, 0, 16, true);
    },
    end() {
      invalidate(nav, footer, cta);
      writeRadar(MASTER_END);
      belowEnd = false;
    },
  });
  ctx.onDestroy(() => gateTween?.kill());
}
