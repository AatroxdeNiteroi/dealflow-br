/* ============================================================
   cinema/ch1/ch1.timeline.ts — WP-CH1 entry build.

   Cap. 1 DOM, all of it a pure function of master vh (or a reversible,
   time-based ambient effect):
   - hud.ts      G3 readout count, live bearing (write on change),
                 J1 exit 30–70 (master tween)
   - respiro.ts  J4 words in light · J5 ink twin dawn clip + per-word
                 light hide · J6 white-word dolly, em redaction bars +
                 nibs, fusion into `dos.tarja@ch2`, swap at 850
   - labels.ts   cursor pool (target suppression, labelsGate), C4c
                 sweep-flash mode, `--sweep-bearing` sink on `.grl`
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
  // the HUD's own tween follows the master, the frame writers are re-applied
  // synchronously so no stale frame survives under the veil.
  ctx.settle.register(
    "ch1.stage",
    {
      start() {
        hud?.reset();
      },
      end() {
        hud?.reset();
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
  ctx.settle.register("ch1.labels", { start: labels.hideAll, end: labels.hideAll }, ".lp-labels");
}
