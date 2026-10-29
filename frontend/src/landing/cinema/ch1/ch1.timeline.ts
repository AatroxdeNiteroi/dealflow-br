/* ============================================================
   cinema/ch1/ch1.timeline.ts — WP6 entry build (Cap. 1 DOM).

   Every Cap. 1 DOM layer is a pure function of master vh (or a
   reversible, time-based ambient effect). v3 (spec rev 3.1):
   - hud.ts      G3 readout count + INK pour on reveal, fixed-width AZ
                 cells (write on change), J1 EVAPORATE 30–62 glyph by
                 glyph (frame writer, no master tween), GL text mask rect 2
   - respiro.ts  J4 LIGHT condensation (no mask line) · J5 ink twin dawn
                 clip · J6 dolly + EVAPORATE 778–800, ink capsules with
                 gold droplets fusing into the tarja (pixel swap at 850)
   - labels.ts   cursor labels, echo / decoy chips (CHIP_POOL), C4c
                 sweep-flash; pills with leaders; pinned points;
                 setLabelChip; `--sweep-bearing` sink on `.grl`
   Outputs: `respiro.words` (rect list), settle hooks for `.lp-stage`,
   `.cx-respiro` and `.lp-labels`.
   ============================================================ */

import { MASTER_END } from "../beats";
import { RECT_KEYS, type CinemaCtx } from "../types";
import { buildHud } from "./hud";
import { buildLabels } from "./labels";
import { buildRespiro } from "./respiro";

export function build(ctx: CinemaCtx): void {
  const labels = buildLabels(ctx);
  const hud = buildHud(ctx);
  const respiro = buildRespiro(ctx);
  // keep the contract even if the respiro DOM is missing (dependants read the key)
  if (!respiro) ctx.rects.registerList(RECT_KEYS.respiroWords, () => []);

  // settle: the master is already at 0 / 1 when these run (director first);
  // the frame writers are re-applied synchronously so no stale frame
  // survives under the veil.
  ctx.settle.register(
    "ch1.stage",
    {
      start() {
        hud?.reset();
        hud?.apply(0);
      },
      end() {
        hud?.reset();
        hud?.apply(MASTER_END);
      },
    },
    ".lp-stage",
  );
  ctx.settle.register(
    "ch1.respiro",
    {
      start() {
        respiro?.apply(0);
      },
      end() {
        respiro?.apply(MASTER_END);
      },
    },
    ".cx-respiro",
  );
  // start (return home) latches the pools off until the next radar phase;
  // never latch on end(): the teleport keeps the phase "radar"
  ctx.settle.register("ch1.labels", { start: labels.hideAndLatch, end: labels.hideAll }, ".lp-labels");
}
