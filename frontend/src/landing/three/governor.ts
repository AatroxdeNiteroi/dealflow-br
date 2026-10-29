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
   - Afterwards (never inside the boot window), when at least 20 of
     the last 30 frames are over 18 ms, one tier drops (a window, not a
     consecutive run: GPU-bound pacing interleaves short intervals).
   - QA PERF-3: the frame interval cannot tell a slow CPU from a slow
     GPU, and only the GPU is helped by a lower tier. When the GPU time
     of the field's draw is measured (EXT_disjoint_timer_query_webgl2,
     sampleGpu), a drop also needs the median GPU time of the last 30
     draws over 9 ms — a CPU-starved client keeps its dust and its DPR.
     Without GPU timing: after each drop it waits 120 frames, then
     compares the median interval with the one before the drop; under
     15 % better, the governor freezes (the bottleneck is not the GPU).
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

  /* ── v3 (spec rev 3.1 §4.9) — read by WP3 (and WP4: camLean). Tiers keep their
     v2 meaning and thresholds; the sub-step ladder (0–8) degrades within a tier. ── */
  /** hidden-universe prefix cap (dust points in the J1 afterglow; actual = cost-sized, §4.5) */
  sonarDust: number;
  /** DOF circle-of-confusion cap, CSS px */
  cocMax: number;
  /** echo crests uploaded */
  echoes: number;
  /** gold ping threshold on aSize (top 9 % 2.91, top 5 % 3.05; Infinity = ink only) */
  pingGold: number;
  /** current: number of waves (3 or 2) and amplitude scale */
  flowWaves: 2 | 3;
  flowScale: number;
  /** cursor wake chain nodes (0 = off; touch drag keeps the dimple) */
  wake: number;
  /** word-level text blur (T1: words ≤ 220 px only) */
  textBlur: boolean;
  /** camera lean / bank / kicks scale (0 = off) */
  camLean: number;
}

type V3TierFields = Pick<TierSpec, "sonarDust" | "cocMax" | "echoes" | "pingGold" | "flowWaves" | "flowScale" | "wake" | "textBlur" | "camLean">;

/** v3 per-tier fields (§4.9 table). */
export const V3_TIER: Readonly<Record<Tier, V3TierFields>> = {
  0: { sonarDust: 24000, cocMax: 40, echoes: 6, pingGold: 2.91, flowWaves: 3, flowScale: 1, wake: 5, textBlur: true, camLean: 1 },
  1: { sonarDust: 12000, cocMax: 28, echoes: 6, pingGold: 2.91, flowWaves: 3, flowScale: 1, wake: 3, textBlur: true, camLean: 1 },
  2: { sonarDust: 0, cocMax: 16, echoes: 4, pingGold: 3.05, flowWaves: 3, flowScale: 0.8, wake: 0, textBlur: false, camLean: 1 },
  3: { sonarDust: 0, cocMax: 0, echoes: 2, pingGold: Infinity, flowWaves: 2, flowScale: 0.5, wake: 0, textBlur: false, camLean: 0 },
};
/** v3 mobile (coarse pointer or ≤ 720 px; starts at T2). */
export const V3_MOBILE: V3TierFields = {
  sonarDust: 0, cocMax: 16, echoes: 4, pingGold: 3.05, flowWaves: 3, flowScale: 0.8, wake: 0, textBlur: false, camLean: 0.6,
};

/** v3 sub-step ladder (§4.9): uniform-only, applied in this order (WP3). */
export const SUB_STEPS = [
  "hidden-universe prefix → ½ → 0",
  "word blur off",
  "cocMax 40 → 28 → 16 → 0",
  "echoes 6 → 4 → 2",
  "gold pings → ink only",
  "flow × 0.5",
  "cursor wake chain off",
  "camera lean off",
] as const;

const BOOT_FRAMES = 90;
const SKIP_FRAMES = 12;
const SLOW_MS = 18;
const VERY_SLOW_MS = 28;
/** Sustained rule: SLOW_OF of the last WINDOW frames over SLOW_MS. */
const WINDOW = 30;
const SLOW_OF = 20;
const GAP_MS = 250;
/** GPU-bound when the median draw of the last WINDOW draws exceeds this. */
const GPU_BUDGET_MS = 9;
/** Frames to wait after a drop before judging it / dropping again. */
const COOLDOWN = 120;
const MIN_GAIN = 0.15;

const median = (a: readonly number[]): number => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[s.length >> 1];
};

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
  private logged = false;
  /** last WINDOW frame intervals (ring) */
  private win: number[] = [];
  /** last WINDOW GPU draw times; empty = no GPU timing (yet) */
  private gpu: number[] = [];
  private cooldown = 0;
  /** interval median just before the last drop (no-GPU improvement check) */
  private before = 0;
  private judge = false;
  private frozen = false;

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
        ...V3_MOBILE,
      };
    }
    switch (tier) {
      case 0:
        return { dpr: Math.min(dev, 2), dust: "full", embers: 240, warp: true, spriteCap: 64, ...V3_TIER[0] };
      case 1:
        return { dpr: Math.min(dev, 1.5), dust: 15000, embers: 160, warp: true, spriteCap: 64, ...V3_TIER[1] };
      case 2:
        return { dpr: Math.min(dev, 1.25), dust: 0, embers: 120, warp: false, spriteCap: 64, ...V3_TIER[2] };
      default:
        return { dpr: 1, dust: 0, embers: 80, warp: false, spriteCap: 64, ...V3_TIER[3] };
    }
  }

  /** The 90-frame boot verdict has been taken (warm-ups wait for it). */
  get booted(): boolean {
    return this.forced || this.boot.length >= BOOT_FRAMES;
  }

  /** Feed the GPU time (ms) of one field draw (QA PERF-3). */
  sampleGpu(ms: number): void {
    if (!(ms >= 0)) return;
    this.gpu.push(ms);
    if (this.gpu.length > WINDOW) this.gpu.shift();
  }

  /** GPU timing says the GPU is NOT the bottleneck (no drop would help). */
  private gpuFast(): boolean {
    return this.gpu.length >= 10 && median(this.gpu) <= GPU_BUDGET_MS;
  }

  /** Feed one frame interval (ms). Returns true when the tier dropped. */
  sample(ms: number): boolean {
    if (this.forced || !(ms > 0) || ms > GAP_MS) return false;
    this.frames++;
    if (this.frames <= SKIP_FRAMES) return false;

    if (this.boot.length < BOOT_FRAMES) {
      this.boot.push(ms);
      if (this.boot.length < BOOT_FRAMES) return false;
      const med = median(this.boot);
      let steps = med > VERY_SLOW_MS ? 2 : med > SLOW_MS ? 1 : 0;
      if (steps && this.gpuFast()) steps = 0; // slow, but not on the GPU
      let dropped = false;
      for (let i = 0; i < steps; i++) dropped = this.drop(med) || dropped;
      if (!this.logged) {
        this.logged = true;
        const g = this.gpu.length ? `, gpu ${median(this.gpu).toFixed(1)} ms` : "";
        console.info(`[field] quality tier T${this.t} (boot median ${med.toFixed(1)} ms${g}${this.mobile ? ", mobile" : ""})`);
      }
      return dropped;
    }

    this.win.push(ms);
    if (this.win.length > WINDOW) this.win.shift();
    if (this.cooldown > 0) {
      this.cooldown--;
      if (this.cooldown === 0 && this.judge) {
        // no GPU timing: did the last drop help at all?
        this.judge = false;
        if (!this.gpu.length && median(this.win) > this.before * (1 - MIN_GAIN)) {
          this.frozen = true;
          console.info("[field] quality governor frozen (a lower tier did not help: not GPU-bound)");
        }
      }
      return false;
    }
    if (this.frozen || this.win.length < WINDOW) return false;
    let slow = 0;
    for (const v of this.win) if (v > SLOW_MS) slow++;
    if (slow < SLOW_OF) return false;
    if (this.gpuFast()) return false;
    const before = median(this.win);
    if (!this.drop(before)) return false;
    console.info(`[field] quality tier → T${this.t} (sustained frames > ${SLOW_MS} ms)`);
    return true;
  }

  private drop(before: number): boolean {
    if (this.t >= 3) return false;
    this.t = (this.t + 1) as Tier;
    this.win.length = 0;
    this.gpu.length = 0;
    this.cooldown = COOLDOWN;
    this.before = before;
    this.judge = true; // judged on intervals only if no GPU sample arrives meanwhile
    return true;
  }
}
