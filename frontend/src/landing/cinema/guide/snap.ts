/* ============================================================
   cinema/guide/snap.ts — directional snap controller (§4.7). Owner:
   WP-GUIDE. Must `ctx.live.provide(LIVE_KEYS.guideSnap, controller)`:
   CinemaHandle.snap.start/stop delegate to it (teleport, return home,
   overlay, Historia/Boletim, floor clamp, Lenis stopped).
   WP0 stub: a no-op controller.
   ============================================================ */

import { LIVE_KEYS, type CinemaCtx, type SnapController } from "../types";

export function build(ctx: CinemaCtx): void {
  const controller: SnapController = { start() {}, stop() {} };
  ctx.live.provide<SnapController>(LIVE_KEYS.guideSnap, controller);
}
