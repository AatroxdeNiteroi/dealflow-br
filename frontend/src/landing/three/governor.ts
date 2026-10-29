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

   v3 (spec rev 3.1 §4.9, WP3) — two mechanisms, kept apart:
   1. TIERS keep their v2 meaning and thresholds (18 ms / 9 ms GPU). A
      drop that changes the DPR (a canvas resize) is applied by the dust
      driver only on a rest plateau, in the Gateway, at the plans or
      while hidden (`tierPending`); the "hold while the dust is visible"
      rule means the C4b universe only. TierSpec gains the v3 fields
      (V3_TIER / V3_MOBILE).
   2. SUB-STEPS (0–8, uniform-only, no rebuild, each ramped over 0.3 s
      by its consumer): prefix ½ → 0, word blur off, cocMax 40 → 28 →
      16 → 0, echoes 6 → 4 → 2, gold pings → ink, flow × 0.5, wake off,
      camera lean off (SUB_TICKS: 12 ticks, ≤ 1 per 0.5 s). Driven by
      the refresh-relative judder rule (SubSteps): I = median vsync
      interval of the first 120 frames; ≥ 25 % of the last 30 frames
      over 1.5·I → one tick up; 10 s under 5 % → one tick back. Never
      degraded: beam, afterglow, follower, dilation, dock, glyphs.
      effectiveV3(spec, ticks) gives the values a driver must use;
      `?cx-substep=N` (dev) forces sub-step N.
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

/**
 * The ladder in single TICKS (one per 0.5 s at most). `item` is the SUB_STEPS entry (1–8) a tick
 * belongs to: FieldFrame.subStep = the item of the last applied tick, so a consumer that tests
 * `subStep ≥ k` sees item k applied (multi-level items reach their item number at their first
 * level and keep stepping within it).
 */
export const SUB_TICKS: ReadonlyArray<{ item: number; what: string }> = [
  { item: 1, what: "prefix ½" },
  { item: 1, what: "prefix 0" },
  { item: 2, what: "word blur off" },
  { item: 3, what: "cocMax → 28" },
  { item: 3, what: "cocMax → 16" },
  { item: 3, what: "cocMax → 0" },
  { item: 4, what: "echoes → 4" },
  { item: 4, what: "echoes → 2" },
  { item: 5, what: "gold pings → ink" },
  { item: 6, what: "flow × 0.5" },
  { item: 7, what: "wake off" },
  { item: 8, what: "camera lean off" },
];
const COC_LADDER = [40, 28, 16, 0];
const ECHO_LADDER = [6, 4, 2];

/** The v3 per-frame values after the sub-step ladder (WP3 drivers read these, not the raw spec). */
export interface V3Effective {
  /** hidden-universe prefix scale 1 / ½ / 0 */
  prefixScale: number;
  textBlur: boolean;
  cocMax: number;
  echoes: number;
  /** gold pings allowed (1) or ink only (0) */
  pingGold: number;
  flowScale: number;
  wake: number;
  camLean: number;
}

/** Item index (0–8) reached after `ticks` ticks. */
export const subStepOfTicks = (ticks: number): number => (ticks <= 0 ? 0 : SUB_TICKS[Math.min(ticks, SUB_TICKS.length) - 1].item);

/** Applies `ticks` ladder ticks to a tier spec. */
export function effectiveV3(spec: TierSpec, ticks: number, out: V3Effective): V3Effective {
  const t = Math.max(0, Math.min(SUB_TICKS.length, ticks | 0));
  out.prefixScale = t >= 2 ? 0 : t >= 1 ? 0.5 : 1;
  out.textBlur = spec.textBlur && t < 3;
  // cocMax steps down the 40/28/16/0 ladder from the tier's own value
  let cocIdx = COC_LADDER.findIndex((v) => v <= spec.cocMax);
  if (cocIdx < 0) cocIdx = COC_LADDER.length - 1;
  const cocSteps = Math.max(0, Math.min(3, t - 3));
  out.cocMax = Math.min(spec.cocMax, COC_LADDER[Math.min(COC_LADDER.length - 1, cocIdx + cocSteps)]);
  let eIdx = ECHO_LADDER.findIndex((v) => v <= spec.echoes);
  if (eIdx < 0) eIdx = ECHO_LADDER.length - 1;
  const eSteps = Math.max(0, Math.min(2, t - 6));
  out.echoes = Math.min(spec.echoes, ECHO_LADDER[Math.min(ECHO_LADDER.length - 1, eIdx + eSteps)]);
  out.pingGold = Number.isFinite(spec.pingGold) && t < 9 ? 1 : 0;
  out.flowScale = spec.flowScale * (t >= 10 ? 0.5 : 1);
  out.wake = t >= 11 ? 0 : spec.wake;
  out.camLean = t >= 12 ? 0 : spec.camLean;
  return out;
}

/**
 * Refresh-relative judder rule (§4.9): the median vsync interval I over the first 120 sampled
 * frames (lowered later if a calmer 120-frame median shows up: the boot can be janky); if ≥ 25 %
 * of the last 30 frames exceed 1.5·I, advance one tick (≤ 1 per 0.5 s); after 10 s with < 5 %
 * such frames, step back one tick. Per session, never persisted.
 */
export class SubSteps {
  ticks = 0;
  /** forced from the URL (dev: ?cx-substep=N ticks) — the rule then never moves */
  private forced: boolean;
  private calib: number[] = [];
  private interval = 0;
  private readonly win: number[] = [];
  private sinceChange = 0;
  private slowSince = 0;
  private framesSince = 0;
  private readonly onChange: ((ticks: number) => void) | null;

  constructor(forcedTicks: number | null, onChange: ((ticks: number) => void) | null = null) {
    this.forced = forcedTicks !== null;
    this.ticks = forcedTicks ?? 0;
    this.onChange = onChange;
  }

  get subStep(): number {
    return subStepOfTicks(this.ticks);
  }

  /** The measured vsync interval (ms), 0 until calibrated. */
  get vsync(): number {
    return this.interval;
  }

  /** Dev: force a tick count (null = back to the automatic rule). */
  force(ticks: number | null): void {
    this.forced = ticks !== null;
    if (ticks !== null) this.set(Math.max(0, Math.min(SUB_TICKS.length, ticks | 0)));
  }

  private set(t: number): void {
    if (t === this.ticks) return;
    this.ticks = t;
    this.win.length = 0;
    this.sinceChange = 0;
    this.slowSince = 0;
    this.framesSince = 0;
    this.onChange?.(t);
  }

  /** Feed one frame interval (ms). Returns true when the tick count changed. */
  sample(ms: number): boolean {
    if (this.forced || !(ms > 0) || ms > GAP_MS) return false;
    this.calib.push(ms);
    if (this.calib.length >= 120) {
      const med = median(this.calib);
      this.interval = this.interval > 0 ? Math.min(this.interval, med) : med;
      this.calib.length = 0;
    }
    if (this.interval <= 0) return false;
    const slow = ms > 1.5 * this.interval;
    this.win.push(slow ? 1 : 0);
    if (this.win.length > WINDOW) this.win.shift();
    this.sinceChange += ms;
    this.framesSince++;
    if (slow) this.slowSince++;
    const before = this.ticks;
    if (this.win.length >= WINDOW && this.sinceChange >= 500 && this.ticks < SUB_TICKS.length) {
      let n = 0;
      for (const v of this.win) n += v;
      if (n >= WINDOW * 0.25) this.set(this.ticks + 1);
    }
    if (this.ticks === before && this.ticks > 0 && this.sinceChange >= 10000) {
      if (this.slowSince < 0.05 * this.framesSince) this.set(this.ticks - 1);
      else {
        // still judders now and then: restart the 10 s observation window
        this.sinceChange = 500;
        this.slowSince = 0;
        this.framesSince = 0;
      }
    }
    return this.ticks !== before;
  }
}

/**
 * Read-only mirror of the live ladder for consumers outside the field (PointField is frozen, so
 * the FieldAdapter cannot grow a getter): WP5's text tier reads `SUBSTEP_SIGNAL.subStep ≥ 2` (word
 * blur off). Written by the field's dust driver after every frame; 0 with no WebGL.
 */
export const SUBSTEP_SIGNAL: { subStep: number; ticks: number } = { subStep: 0, ticks: 0 };

/** Ticks that fully apply SUB_STEPS items 1..n (n = 0 → 0 ticks). */
export function ticksForSubStep(n: number): number {
  let t = 0;
  for (let i = 0; i < SUB_TICKS.length; i++) if (SUB_TICKS[i].item <= n) t = i + 1;
  return t;
}

/** Dev: `?cx-substep=N` forces sub-step N (items 1..N fully applied) and pins the rule. */
function devSubTicks(): number | null {
  if (!IS_DEV || typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("cx-substep");
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? ticksForSubStep(Math.max(0, Math.min(8, Math.round(n)))) : null;
}

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
  /** v3 (§4.9): the sub-step ladder (uniform-only degradation inside a tier). A pinned
   *  tier (?cx-tier) also pins the ladder at 0 unless ?cx-substep forces it. */
  readonly sub: SubSteps;
  /** dev: the last 240 field-draw GPU times (ms), for the per-beat budget checks */
  readonly gpuLog: number[] = [];

  constructor(mobile: boolean) {
    this.mobile = mobile;
    const forced = devTier();
    this.forced = forced !== null;
    this.t = forced ?? (mobile ? 2 : 0);
    const subForced = devSubTicks();
    this.sub = new SubSteps(subForced ?? (this.forced ? 0 : null), (t) => {
      if (IS_DEV) console.info(`[field] sub-step → ${subStepOfTicks(t)} (tick ${t}${t ? ": " + SUB_TICKS[t - 1].what : ""})`);
    });
  }

  /** Feed one frame interval to the sub-step rule. Returns true when the ladder moved. */
  sampleJudder(ms: number): boolean {
    return this.sub.sample(ms);
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
    if (IS_DEV) {
      this.gpuLog.push(ms);
      if (this.gpuLog.length > 240) this.gpuLog.shift();
    }
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
