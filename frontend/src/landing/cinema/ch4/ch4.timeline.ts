/* ============================================================
   cinema/ch4/ch4.timeline.ts — WP-CH4 entry build (C4b–C4d DOM tweens,
   the `countSettle` act at ACTS_AT.countSettle).
   WP0 stub: placeholder `ch4.panel` (top third) and `ch4.close` (lower
   third) rects so RIG's leader can develop; settle scope.
   ============================================================ */

import { RECT_KEYS, type CinemaCtx, type Rect } from "../types";

const box = (w: number, h: number, cy: number): Rect => {
  const vw = window.innerWidth;
  const ww = Math.min(w, vw - 32);
  return { x: (vw - ww) / 2, y: cy - h / 2, w: ww, h };
};

export function build(ctx: CinemaCtx): void {
  ctx.rects.register(RECT_KEYS.ch4Panel, () => box(420, 170, window.innerHeight * 0.22));
  ctx.rects.register(RECT_KEYS.ch4Close, () => box(640, 120, window.innerHeight * 0.72));
  ctx.settle.register("ch4.stage", { start() {}, end() {} }, ".cx-ch4-stage");
}
