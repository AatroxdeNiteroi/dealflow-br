/* ============================================================
   cinema/acts.ts — act runner (WP0, §4.5).

   An act is a PAUSED, time-based timeline owned by a package. On
   every master update: vh ≥ at + 0.5 and not forward → play();
   vh < at − 0.5 and forward → reverse() at 1.6× (exits are faster
   than entrances). Never a fire-once .call(): scrolling back always
   undoes the act.
   ============================================================ */

import { ACT_HYSTERESIS } from "./beats";
import type { Act } from "./types";

const REVERSE_SCALE = 1.6;

interface Slot {
  act: Act;
  forward: boolean;
}

export interface ActRunner {
  register(a: Act): void;
  update(vh: number): void;
  /** progress(1|0) directly; marks every act forward/back accordingly. */
  settle(dir: "start" | "end"): void;
  ids(): string[];
  kill(): void;
}

export function createActs(): ActRunner {
  const slots: Slot[] = [];
  return {
    register(a: Act) {
      if (slots.some((s) => s.act.id === a.id)) {
        console.warn(`[cinema/acts] duplicate act id "${a.id}" ignored`);
        return;
      }
      a.tl.pause(0);
      slots.push({ act: a, forward: false });
    },
    update(vh: number) {
      for (const s of slots) {
        const { at, tl } = s.act;
        if (!s.forward && vh >= at + ACT_HYSTERESIS) {
          s.forward = true;
          tl.timeScale(1).play();
        } else if (s.forward && vh < at - ACT_HYSTERESIS) {
          s.forward = false;
          tl.timeScale(REVERSE_SCALE).reverse();
        }
      }
    },
    settle(dir) {
      const end = dir === "end";
      for (const s of slots) {
        s.act.tl.pause().reversed(false).timeScale(1).progress(end ? 1 : 0);
        s.forward = end;
      }
    },
    ids() {
      return slots.map((s) => s.act.id);
    },
    kill() {
      for (const s of slots) s.act.tl.kill();
      slots.length = 0;
    },
  };
}
