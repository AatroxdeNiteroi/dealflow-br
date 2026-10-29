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

   v3 (spec rev 3.1 §8.2, WP0 — additive only): FrameOrder.Glyphs,
   FieldTime.lockPulse, FieldFrameData.echoes, RippleEvent inward /
   radiusPx / window, the new FieldAdapter members (ringScreen,
   setPlayhead, resetTimeLayer, setTextMask, setLabelChip, setPinned),
   CinemaCtx.playhead / glyphs / perf, CinemaHandle.pxToVh / vhToPx,
   the glyph-engine contract (§5.2) and the frozen GuideSnapBus.
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
  /** v3 glyph writer (WP5): every scrubbed text block, after the labels. The
   *  clock times this slot (`ctx.perf.glyphMs`, WP1). */
  Glyphs: 31,
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
  /** v3: 0..1, tweened by the RIG `lock` act (GL meniscus ring flash 1.08 → 1,
   *  260 ms; consumed by WP2's ribbons). Reset to 0 by settle. */
  lockPulse: number;
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
  /** v3: radius runs backwards ((1 − d)·R): the J2 implosion (WP3). */
  inward?: boolean;
  /** v3: overrides RIPPLES.radiusPx for this event. */
  radiusPx?: number;
  /** v3: overrides RIPPLES.window (vh) for this event. */
  window?: number;
}

export type PauseReason = "hidden" | "page" | "covered";

/** v3 (§4.9): a named point the sonar wants a DOM chip on (WP3 → WP6). */
export interface EchoMark {
  /** Screen px of the point (CSS px, rounded to 0.5). */
  x: number;
  y: number;
  /** Point index (name: COMPANY_NAMES[i % 12]). */
  i: number;
  kind: "echo" | "decoy";
  /** Seconds since this mark was born (echo: ping; decoy: forward crossing of its flare peak). */
  age: number;
  /** Decoy only: the flare peak has passed (strike it). */
  reject: boolean;
  /** Echo crest strength 0..1 (the value shows only above LABEL_VALUE_MIN_STRENGTH). */
  strength: number;
}

export interface FieldFrameData {
  cursorLabels: CursorLabel[];
  /** Sweep bearing in degrees 0..360 (HUD, gateway needle). v3: the displayed θ (WP2). */
  sweepBearing: number;
  /** C4c redacted sweep-flash pick (screen px), or null. */
  sweepFlash: CursorLabel | null;
  /** v3 (§4.9): echo + decoy chip requests, written by the sonar driver (WP3); [] until then. */
  echoes: EchoMark[];
}

/** v3 (§4.7): a ring's projected circle in CSS px (RIG hand-off, NullField from the anchor). */
export interface RingScreen {
  x: number;
  y: number;
  r: number;
  visible: boolean;
}

/** v3 (§7 E6): the label/chip box the picker keeps apart, measured by WP6 at refresh
 *  (CSS px from the chip's top-left). Replaces the static LABEL_CHIP once every path calls it. */
export interface LabelChipBox {
  wFull: number;
  wRedacted: number;
  h: number;
  gap: number;
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

  /* ── v3 additions (§8.2; WP0 stubs, owners in brackets) ── */
  /** [WP2] Ring i's projected centre + radius (CSS px), from the same CPU projection the
   *  ribbons use. NullField: the anchor (`r = anchor.r + 14`). */
  ringScreen(i: number): RingScreen;
  /** [WP1 → field] Playhead velocity in master vh/s (signed), once per frame before update();
   *  the field derives pvelN / pvelS (damped, §1.2). */
  setPlayhead(v: number): void;
  /** [WP4/WP2] Zero every time-layer spring and the hunt latch (playhead.jump, settle). */
  resetTimeLayer(): void;
  /** [WP5/WP6 → WP3/WP2] GL text mask rect i (0 Gateway text, 1 Gateway CTA + cue, 2 HUD,
   *  3 spare), CSS px; null clears it. Written at refresh, never per frame. */
  setTextMask(i: number, rect: Rect | null): void;
  /** [WP6 → WP3] The runtime-measured chip box the label picker keeps apart. */
  setLabelChip(box: LabelChipBox): void;
  /** [WP6 → WP3] ≤ 8 point indices carrying DOM chips (−1/absent = none). Merged with the
   *  driver's own cursor picks into `uPinned`; written only on change. */
  setPinned(indices: readonly number[]): void;
}

/* ── v3 playhead (§6.2, WP1) ────────────────────────────────── */

/** The followed master vh every consumer renders (one value per frame). */
export interface PlayheadApi {
  /** Followed master vh (what DOM tweens, acts, GL and the guide render). */
  vh(): number;
  /** W(s): the master vh the scroll position maps to (the follower's target). */
  target(): number;
  /** Scroll position in s-vh (0 … S_END(profile)). */
  s(): number;
  /** Followed velocity, master vh per second (signed). */
  velocity(): number;
  /** Teleport: x = target = vh, v = 0, springs + hunt latch reset, master written,
   *  listeners run, the glyph writer writes every block once. */
  jump(vh: number): void;
  /** The dilation window containing vh (cinema/dilation.ts), or null. */
  readWindow(vh: number): import("./dilation").Dwell | null;
}

/* ── v3 glyph engine contract (§5.2, WP5) ───────────────────── */

export type Grammar = "ink" | "light" | "evaporate";

export interface GlyphBlockSpec {
  id: string;
  /** A MaskWords root (split="chars"). */
  root: Element;
  grammar: Grammar;
  /** Master vh window (scrubbed, pure f(vh)). */
  from: number;
  to: number;
  /** Default: ink "bleed", light "ltr", evaporate "rtl". */
  order?: "bleed" | "ltr" | "rtl";
  /** vh per glyph (ink 8, light 18, evaporate 8). */
  glyphDur?: number;
  /** vh, default 10 (floor; asserted). */
  wordRiseMin?: number;
  /** Word-level blur (desktop T0/T1, words ≤ 220 px). */
  blur?: boolean;
}

/** Write-on-change cells (respiro.ts:84-112 pattern) for custom writers. */
export interface GlyphCells {
  words: Array<{ el: HTMLElement; glyphs: HTMLElement[]; x0: number; w: number }>;
  /** Layer swap at 0/1 (visibility only, never display). */
  setWord(k: number, p: number): void;
  writeGlyph(k: number, j: number, y: number, op: number, rot?: number, skew?: number, rgb?: number): void;
  writeWordBlur(k: number, px: number): void;
}

export interface GlyphEngine {
  /** Registers a scrubbed block on the glyph writer (FrameOrder.Glyphs). */
  scrub(spec: GlyphBlockSpec): void;
  /** Time-based variant (Gateway, dock verb, tag, chips, HUD count). */
  play(root: Element, g: Grammar, o?: { dur?: number; stagger?: number; delay?: number }): gsap.core.Timeline;
  /** Low-level cells for custom writers (respiro, HUD, chips). */
  cells(root: Element): GlyphCells;
  /** CPU text tier (§4.9). */
  readonly mode: "glyph" | "word";
}

/** v3 (§4.9): rolling cost of the glyph writer, timed by the clock (WP1). */
export interface CinemaPerf {
  glyphMs: { p95(): number };
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

  /* ── v3 (§8.2) ── */
  /** The followed playhead (WP1; WP0 ships an identity follower). */
  playhead: PlayheadApi;
  /** The glyph engine (WP5; WP0 ships a word-level stub). */
  glyphs: GlyphEngine;
  /** Frame-cost probes (WP1 times FrameOrder.Glyphs). */
  perf: CinemaPerf;
}

/** Every timeline module: `export function build(ctx: CinemaCtx): void`. */
export type BuildFn = (ctx: CinemaCtx) => void;

export type BlockReason = "overlay" | "historia" | "boletim" | "teleport" | "return";

export interface SnapController {
  start(): void;
  stop(): void;
}

export interface CinemaHandle {
  /** v3 (§6.4): document scroll px → master vh (through W). */
  pxToVh(px: number): number;
  /** v3 (§6.4): master vh → document scroll px (through Winv). */
  vhToPx(vh: number): number;
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

/** v3 (§6.4): the GuideBus fields the snap (WP1) reads, frozen by WP0 so WP1
 *  (snap.ts) and WP8 (machine.ts) never edit each other's files. machine.ts's
 *  GuideBus extends it. */
export interface GuideSnapBus {
  phase: Phase;
  /** A dock-button scroll is in flight (snap stands down). */
  flying: boolean;
  /** performance.now() of the last wheel / touch / scroll-key input. */
  lastInputAt: number;
  /** Last direction of travel (snap's "ahead"). */
  lastDir: 1 | -1;
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
