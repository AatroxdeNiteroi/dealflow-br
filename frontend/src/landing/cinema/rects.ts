/* ============================================================
   cinema/rects.ts — refresh-time measurement registry (WP0, §4.9).

   Nothing reads layout per frame. Packages register a measure fn
   per key; all are measured:
     1. once synchronously right after the builds,
     2. after document.fonts.ready (then a ScrollTrigger.refresh()),
     3. on every ScrollTrigger "refreshInit" — i.e. BEFORE triggers
        recalculate and invalidateOnRefresh re-evaluates function-based
        tween values, so those functions read fresh rects.
   Measure UNTRANSFORMED slot wrappers (movers sit inside them), so a
   measurement never depends on the current animation state.
   ============================================================ */

import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Rect } from "./types";
import { ZERO_RECT, refreshViewport } from "./geometry";
import { IS_DEV } from "./env";

export interface RectRegistry {
  register(key: string, measure: () => Rect): void;
  registerList(key: string, measure: () => Rect[]): void;
  get(key: string): Rect;
  getList(key: string): Rect[];
  measureAll(): void;
  /** Fires after every measureAll (e.g. to recompute cached geometry). */
  onMeasured(fn: () => void): () => void;
  dispose(): void;
}

export function createRects(): RectRegistry {
  const single = new Map<string, { measure: () => Rect; value: Rect }>();
  const lists = new Map<string, { measure: () => Rect[]; value: Rect[] }>();
  const listeners = new Set<() => void>();
  const warned = new Set<string>();

  const measureAll = () => {
    refreshViewport();
    for (const [key, e] of single) {
      try {
        e.value = e.measure();
      } catch (err) {
        console.error(`[cinema/rects] measure "${key}" threw`, err);
      }
    }
    for (const [key, e] of lists) {
      try {
        e.value = e.measure();
      } catch (err) {
        console.error(`[cinema/rects] measure "${key}" threw`, err);
      }
    }
    listeners.forEach((fn) => fn());
  };

  const onRefreshInit = () => measureAll();
  ScrollTrigger.addEventListener("refreshInit", onRefreshInit);

  // The classic scrollbar (6 px, tokens.css) appears on lenis.start() and
  // disappears under `.lenis-stopped { overflow: hidden }` WITHOUT a window
  // resize: every centred rect measured in the Gateway would be 3 px off in
  // the radar (the 850 / 860 swaps, cardBuildBox). Re-measure on a client-
  // width change of <html> (height changes — content growth — are ignored).
  let lastCW = typeof document !== "undefined" ? document.documentElement.clientWidth : 0;
  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          const cw = document.documentElement.clientWidth;
          if (cw === lastCW) return;
          lastCW = cw;
          refreshViewport();
          ScrollTrigger.refresh();
        })
      : null;
  ro?.observe(document.documentElement);

  let disposed = false;
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (disposed) return;
      measureAll();
      ScrollTrigger.refresh();
    });
  }

  const miss = (key: string) => {
    if (IS_DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`[cinema/rects] unknown key "${key}" (returning a zero rect)`);
    }
  };

  return {
    register(key, measure) {
      single.set(key, { measure, value: { ...ZERO_RECT } });
    },
    registerList(key, measure) {
      lists.set(key, { measure, value: [] });
    },
    get(key) {
      const e = single.get(key);
      if (!e) {
        miss(key);
        return ZERO_RECT;
      }
      return e.value;
    },
    getList(key) {
      const e = lists.get(key);
      if (!e) {
        miss(key);
        return [];
      }
      return e.value;
    },
    measureAll,
    onMeasured(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispose() {
      disposed = true;
      ro?.disconnect();
      ScrollTrigger.removeEventListener("refreshInit", onRefreshInit);
      single.clear();
      lists.clear();
      listeners.clear();
    },
  };
}
