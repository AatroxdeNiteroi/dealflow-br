/* ============================================================
   three/governor.ts — quality governor (§7.10). Owner: WP-GL.

   Tiers                 DPR            dust          embers  warp
   T0                    min(dpr, 2)    to 117.965    240     on
   T1                    min(dpr, 1.5)  15,000        160     on
   T2                    min(dpr, 1.25) 0             120     off
   T3                    1              0              80     off
   Mobile (coarse pointer or width ≤ 720) starts at T2 with DPR ≤ 1.5,
   80 embers, no dust, no warp, sprite cap 40 px.

   - The first 90 rendered frames (the gateway boot) are sampled; a
     median over 18 ms drops one tier (two if over 28 ms).
   - Afterwards, 30 consecutive frames over 18 ms drop one tier.
   - Tiers never rise within a session. Frame gaps over 250 ms (tab
     switch, pause, a GC hitch) are ignored, as are the first frames.
   - `antialias` is decided at construction only: on iff DPR < 1.5.
   - Dev: `?cx-tier=0…3` pins a tier and disables the governor (the
     headless capture rig renders with SwiftShader, which would
     otherwise drop straight to T3).
   ============================================================ */

import { IS_DEV } from "../cinema/env";

export type Tier = 0 | 1 | 2 | 3;

export interface TierSpec {
  dpr: number;
  /** "full" = fill the field to 117.965 points. */
  dust: number | "full";
  embers: number;
  warp: boolean;
  /** Sprite cap in CSS px (× DPR in the shader). */
  spriteCap: number;
}

const BOOT_FRAMES = 90;
const SKIP_FRAMES = 12;
const SLOW_MS = 18;
const VERY_SLOW_MS = 28;
const SLOW_RUN = 30;
const GAP_MS = 250;

function devTier(): Tier | null {
  if (!IS_DEV || typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("cx-tier");
  if (raw === null) return null;
  const n = Number(raw);
  return n === 0 || n === 1 || n === 2 || n === 3 ? n : null;
}

export class Governor {
  readonly mobile: boolean;
  readonly forced: boolean;
  private t: Tier;
  private frames = 0;
  private boot: number[] = [];
  private slowRun = 0;
  private logged = false;

  constructor(mobile: boolean) {
    this.mobile = mobile;
    const forced = devTier();
    this.forced = forced !== null;
    this.t = forced ?? (mobile ? 2 : 0);
  }

  get tier(): Tier {
    return this.t;
  }

  spec(tier: Tier = this.t): TierSpec {
    const dev = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    if (this.mobile) {
      return {
        dpr: tier >= 3 ? 1 : Math.min(dev, 1.5),
        dust: 0,
        embers: 80,
        warp: false,
        spriteCap: 40,
      };
    }
    switch (tier) {
      case 0:
        return { dpr: Math.min(dev, 2), dust: "full", embers: 240, warp: true, spriteCap: 64 };
      case 1:
        return { dpr: Math.min(dev, 1.5), dust: 15000, embers: 160, warp: true, spriteCap: 64 };
      case 2:
        return { dpr: Math.min(dev, 1.25), dust: 0, embers: 120, warp: false, spriteCap: 64 };
      default:
        return { dpr: 1, dust: 0, embers: 80, warp: false, spriteCap: 64 };
    }
  }

  /** Feed one frame interval (ms). Returns true when the tier dropped. */
  sample(ms: number): boolean {
    if (this.forced || !(ms > 0) || ms > GAP_MS) return false;
    this.frames++;
    if (this.frames <= SKIP_FRAMES) return false;

    let dropped = false;
    if (this.boot.length < BOOT_FRAMES) {
      this.boot.push(ms);
      if (this.boot.length === BOOT_FRAMES) {
        const sorted = this.boot.slice().sort((a, b) => a - b);
        const median = sorted[BOOT_FRAMES >> 1];
        const steps = median > VERY_SLOW_MS ? 2 : median > SLOW_MS ? 1 : 0;
        for (let i = 0; i < steps; i++) dropped = this.drop() || dropped;
        if (!this.logged) {
          this.logged = true;
          console.info(`[field] quality tier T${this.t} (boot median ${median.toFixed(1)} ms${this.mobile ? ", mobile" : ""})`);
        }
      }
    }

    if (ms > SLOW_MS) {
      if (++this.slowRun >= SLOW_RUN) {
        this.slowRun = 0;
        if (this.drop()) {
          dropped = true;
          console.info(`[field] quality tier → T${this.t} (sustained frames > ${SLOW_MS} ms)`);
        }
      }
    } else {
      this.slowRun = 0;
    }
    return dropped;
  }

  private drop(): boolean {
    if (this.t >= 3) return false;
    this.t = (this.t + 1) as Tier;
    return true;
  }
}
