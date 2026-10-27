/* ============================================================
   cinema/ch1/ch1.timeline.ts — WP-CH1 entry build (J1–J6 DOM tweens:
   HUD exit, words in light, dawn clip from field.score.dawn, light-word
   hide, white-word dolly, bar sweep + fusion into dos.tarja@ch2).
   WP0 stub: wires the label pool (labels.ts) and a placeholder
   `respiro.words` list so dependants can read the key.
   ============================================================ */

import { RECT_KEYS, type CinemaCtx } from "../types";
import { build as buildLabels } from "./labels";

export function build(ctx: CinemaCtx): void {
  buildLabels(ctx);
  ctx.rects.registerList(RECT_KEYS.respiroWords, () => []);
  ctx.settle.register("ch1.stage", { start() {}, end() {} }, ".lp-stage");
}
