/* ============================================================
   cinema/dossier/dossier.timeline.ts — WP-DOSSIER entry build
   (J6 card build, C2a–C3e, C4a collapse, needle + seal acts, ripples).
   WP0 stub: PLACEHOLDER geometry for every `dos.*` key (centred boxes
   sized like the spec's 1440 reference) and the `dos.liveBox` getter,
   so RIG/CH1 can develop before the real layout lands. WP-DOSSIER
   replaces each with a measure of its untransformed slot wrappers.
   ============================================================ */

import { LIVE_KEYS, RECT_KEYS, type CinemaCtx, type Rect } from "../types";

const centred = (w: number, h: number, cy: number): Rect => {
  const vw = window.innerWidth;
  const ww = Math.min(w, vw - 32);
  return { x: (vw - ww) / 2, y: cy - h / 2, w: ww, h };
};

export function build(ctx: CinemaCtx): void {
  const cy = () => window.innerHeight * 0.5;
  ctx.rects.register(RECT_KEYS.dosCardCh2, () => centred(440, 300, cy()));
  ctx.rects.register(RECT_KEYS.dosCardCh3, () => centred(520, 420, cy()));
  ctx.rects.register(RECT_KEYS.dosTarjaCh2, () => centred(318, 40, cy() + 60));
  ctx.rects.register(RECT_KEYS.dosTarjaCh3, () => centred(400, 92, cy() + 20));
  ctx.rects.register(RECT_KEYS.dosSlotEyebrow, () => {
    const c = centred(440, 300, cy());
    return { x: c.x + 28, y: c.y + 26, w: 150, h: 14 };
  });
  ctx.rects.register(RECT_KEYS.dosSlotCnpj, () => {
    const c = centred(440, 300, cy());
    return { x: c.x + 28, y: c.y + 46, w: 200, h: 14 };
  });
  ctx.live.provide<() => Rect>(LIVE_KEYS.dosLiveBox, () => ctx.rects.get(RECT_KEYS.dosCardCh2));
  ctx.settle.register("dossier.stage", { start() {}, end() {} }, ".cx-dos-stage");
}
