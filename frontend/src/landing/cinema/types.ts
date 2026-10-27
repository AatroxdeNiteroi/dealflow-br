/* ============================================================
   cinema/types.ts — shared contracts (spec §12.2, §7.9). Owner WP0.
   Packages never redefine these; change requests go to WP0.

   Extensions over the spec text (all additive, marked "ext"):
   - CinemaCtx.labelLayer / onDestroy / vhToPx / pkg
   - settle.register(id, h, scope?) returns an unregister fn; `scope`
     is a CSS selector of the nodes the hook covers (dev coverage)
   - rects.registerList / getList (for `respiro.words`)
   - FieldAdapter.projectToScreen(…, heroPose?)
   - FrameOrder is a frozen object + type (not a `const enum`, which
     does not cross files safely under isolatedModules +
     verbatimModuleSyntax in Vite's per-file transform)
   ============================================================ */

import type Lenis from "lenis";
import type { CinemaFlags } from "./flags";
import type { ScoreChannel } from "./beats";

export type Phase = "gateway" | "entering" | "radar";

/** Viewport px (CSS pixels, relative to the viewport's top-left). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Frame-function slots, run by the clock in ascending order (§4.6). */
export const FrameOrder = Object.freeze({
  /** RIG — brackets, tag, leader, anything pinned to the GL anchor. */
  Anchors: 20,
  /** DOSSIER — live morph writers (charge line, thunk, orbit, collapse). */
  Dossier: 25,
  /** CH1 — cursor labels, HUD, `--sweep-bearing` sink. */
  Labels: 30,
  /** GUIDE — dock state machine. */
  Guide: 40,
  /** GUIDE reducer — `.lp-nav`, `.lp-footer`, `.lp-cta`, dock inner. Runs last. */
  Reducer: 50,
} as const);
export type FrameOrder = (typeof FrameOrder)[keyof typeof FrameOrder];

export type FrameFn = (vh: number, t: number, dt: number) => void;

/** A reversible, time-based act (§4.5). `tl` is paused; the runner plays it
 *  forward when vh ≥ at + 0.5 and reverses it (1.6×) when vh < at − 0.5. */
export interface Act {
  id: string;
  at: number;
  tl: gsap.core.Timeline;
}

export interface SettleHandler {
  /** State at master 0 (pre-reveal, gateway underneath). Idempotent. */
  start(): void;
  /** State at master 1 (Ch5 start): every ch1–4 layer at autoAlpha 0. Idempotent. */
  end(): void;
}

/* ── field (§7.9) ───────────────────────────────────────────── */

export interface CursorLabel {
  /** Screen px (already offset for the label box). */
  x: number;
  y: number;
  /** R$ mi. */
  value: number;
  /** 0..1 proximity to the cursor. */
  strength: number;
  /** Point index — stable fictitious name via COMPANY_NAMES[i % 12]. */
  i: number;
}

/** Time layer — written only by Gateway tweens and by settle (§7.1). */
export interface FieldTime {
  /** Added to the camera z at vh 0 (G1 = 3.5 → 0 on G2). */
  entryZ: number;
  /** Shockwave front radius (world); −1 = off. */
  shockR: number;
  /** Degrees added to the FOV (G2 gate thump). */
  fovGate: number;
  /** Per-ring opacity boost, decaying. */
  ringBoost: [number, number, number, number];
}

/** Score channels evaluated from beats.SCORE (pure function of vh) + derived. */
export type FieldScoreState = { [K in ScoreChannel]: number } & {
  /** Master vh this score was evaluated at. */
  vh: number;
};

export interface AnchorScreen {
  /** Projected SP centre (px, rounded to 0.5). */
  x: number;
  y: number;
  /** Projected sphere radius (px). */
  r: number;
  /** In front of the camera and on screen. */
  visible: boolean;
  /** Camera inside the sphere (|cam − SP| < R). */
  inside: boolean;
}

export interface RippleEvent {
  /** Master vh at which the ripple starts. */
  vh: number;
  /** Centre in screen px, evaluated per frame. */
  at: () => { x: number; y: number };
  amp?: number;
}

export type PauseReason = "hidden" | "page" | "covered";

export interface FieldFrameData {
  cursorLabels: CursorLabel[];
  /** Sweep bearing in degrees 0..360 (HUD, gateway needle). */
  sweepBearing: number;
  /** C4c redacted sweep-flash pick (screen px), or null. */
  sweepFlash: CursorLabel | null;
}

export interface FieldAdapter {
  readonly ok: boolean;
  readonly tier: 0 | 1 | 2 | 3;
  time: FieldTime;
  /** Camera + uniforms for this frame; ends with camera.updateMatrixWorld(). */
  update(vh: number, t: number, dt: number): void;
  render(): void;
  /** 0..1, smoothed once by the clock. */
  setVelocity(v01: number): void;
  /** Former pulse(): sweep boost 3.2 + charge pulse. */
  flare(): void;
  setMouse(nx: number, ny: number): void;
  clearMouse(): void;
  resize(): void;
  dispose(): void;
  /** Valid after update() in the same frame. */
  getAnchorScreen(): AnchorScreen;
  /** ext: `heroPose` projects with the hero camera (vh 0, entryZ 0, no breath). */
  projectToScreen(x: number, y: number, z: number, heroPose?: boolean): { x: number; y: number; visible: boolean };
  /** Screen radius of a ring of world radius `worldR` on the z = −1 plane. */
  ringRadiusPx(worldR: number, heroPose?: boolean): number;
  /** n field points on screen at the camera pose of `atVh`, deterministic per seed. */
  sampleScreenPoints(n: number, seed: number, atVh: number, exclude?: Rect): Array<{ x: number; y: number }>;
  /** inside & dawn<1 & d>frontR  ||  outside & !lit & |p−anchor|<r */
  isDarkAt(x: number, y: number): boolean;
  addRipple(e: RippleEvent): void;
  setPaused(reason: PauseReason, on: boolean): void;
  readonly score: Readonly<FieldScoreState>;
  frameData: FieldFrameData;
}

/* ── cinema context (every package's build receives one) ────── */

export type PackageId = "CORE" | "GL" | "GW" | "GUIDE" | "CH1" | "DOSSIER" | "CH4" | "RIG";

export interface CinemaCtx {
  /** Master; time unit = vh; defaults { ease: "none" }; duration fixed at MASTER_END.
   *  Inside the master use only .to(), or .fromTo() with immediateRender: false. */
  tl: gsap.core.Timeline;
  /** Current master time (valid inside frame fns). */
  vh(): number;
  field: FieldAdapter;
  acts: { register(a: Act): void };
  settle: {
    /** ext: returns an unregister fn; `scope` = selector of covered nodes (dev coverage). */
    register(id: string, h: SettleHandler, scope?: string): () => void;
  };
  rects: {
    /** Measured on ScrollTrigger refreshInit (after document.fonts.ready the first time). */
    register(key: string, measure: () => Rect): void;
    /** Last measured value; a zero rect (and a dev warning) if unknown. */
    get(key: string): Rect;
    /** ext: array-valued keys (e.g. `respiro.words`). */
    registerList(key: string, measure: () => Rect[]): void;
    getList(key: string): Rect[];
  };
  live: {
    provide<T>(key: string, fn: T): void;
    /** Lazy: for function values returns a forwarder that resolves at call time
     *  (so use() may run before the provider's build). */
    use<T>(key: string): T;
    has(key: string): boolean;
  };
  frame: { add(order: FrameOrder, fn: FrameFn): () => void };
  onReveal(fn: (o: { quiet: boolean }) => void): void;
  onPhase(fn: (p: Phase) => void): void;
  flags: Readonly<CinemaFlags>;
  /** Width ≤ 720 px at build time (the cinema is rebuilt only on reload). */
  isMobile: boolean;
  /** Builds never run under reduced motion (no machinery, §9.1); always false here. */
  reduced: boolean;
  /** ext: the `.lp-labels` layer (z 5) for CH1's label pool. */
  labelLayer: HTMLElement;
  /** ext: cleanup on cinema destroy (listeners, appended nodes). */
  onDestroy(fn: () => void): void;
  /** ext: master vh → document scroll px (rest targets, dock button, snap). */
  vhToPx(vh: number): number;
  /** ext: the package this ctx was issued to (dev attribution). */
  pkg: PackageId;
}

/** Every timeline module: `export function build(ctx: CinemaCtx): void`. */
export type BuildFn = (ctx: CinemaCtx) => void;

export type BlockReason = "overlay" | "historia" | "boletim" | "teleport" | "return";

export interface SnapController {
  start(): void;
  stop(): void;
}

export interface CinemaHandle {
  settle(to: 0 | 1): void;
  settleScrubbed(dir: "start" | "end"): void;
  snap: SnapController;
  onReveal(o: { quiet: boolean }): void;
  onPhase(p: Phase): void;
  setBlocked(reason: BlockReason, on: boolean): void;
  destroy(): void;
}

export interface CreateCinemaOptions {
  lenis: Lenis | null;
  field: FieldAdapter;
  labelLayer: HTMLElement;
  reduced: boolean;
  onboardRef: { readonly current: boolean };
}

/** Registry keys (exact strings, §12.2). */
export const RECT_KEYS = {
  dosCardCh2: "dos.card@ch2",
  dosCardCh3: "dos.card@ch3",
  dosTarjaCh2: "dos.tarja@ch2",
  dosTarjaCh3: "dos.tarja@ch3",
  dosSlotEyebrow: "dos.slot.eyebrow",
  dosSlotCnpj: "dos.slot.cnpj",
  ch4Close: "ch4.close",
  ch4Panel: "ch4.panel",
  /** list */
  respiroWords: "respiro.words",
} as const;

export const LIVE_KEYS = {
  /** DOSSIER: () => Rect — current card clip box (C4a). */
  dosLiveBox: "dos.liveBox",
  /** RIG: () => Rect — current bracket box. */
  rigBox: "rig.box",
  /** GUIDE: SnapController — read by CinemaHandle.snap. */
  guideSnap: "guide.snap",
} as const;
