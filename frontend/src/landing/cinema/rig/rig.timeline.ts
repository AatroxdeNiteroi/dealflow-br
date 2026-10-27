/* ============================================================
   cinema/rig/rig.timeline.ts — WP-RIG entry build (bracket modes frame → lock →
   silhouette → card build → card ride → ring → release; tag; leader;
   `lock` + `ringLock` acts; on-dark inversion).
   WP0 stub: `rig.box` = the frame-mode box (viewport corners, inset
   26 px desktop / 18 px mobile).
   ============================================================ */

import { LIVE_KEYS, type CinemaCtx, type Rect } from "../types";
import { viewportInset } from "../geometry";

export function build(ctx: CinemaCtx): void {
  ctx.live.provide<() => Rect>(LIVE_KEYS.rigBox, () => viewportInset(ctx.isMobile ? 18 : 26));
  ctx.settle.register("rig", { start() {}, end() {} }, ".cx-rig");
}
