/* ============================================================
   cinema/index.ts — createCinema(): the integration seam (WP0).

   Landing calls it ONCE, inside its mount gsap.context and BEFORE the
   Ch5 block (creation order matters for teleport's settle loop):

     const cinema = createCinema({ lenis, field, labelLayer, reduced, onboardRef });

   It creates the master (director), the act runner, the rect and live
   registries, runs every package's entry build with its own ctx, and
   starts the single ticker clock. Under reduced motion it returns a
   no-op handle and builds nothing (§9.1: no machinery).

   Package entry builds (one per package, run in this order):
     CH1 ch1/ch1.timeline · DOSSIER dossier/dossier.timeline ·
     CH4 ch4/ch4.timeline · RIG rig/rig.timeline · GUIDE guide/machine
   (GL and GW are not builds: the field is passed in; the Gateway
    talks to `runtime`.)

   v3 (spec rev 3.1, WP0 one-time edit, then WP1): the eases are
   registered at module scope (./eases); every ctx carries
   `playhead` (WP0 identity follower → WP1), `glyphs` (WP0 word-level
   stub → WP5, writer at FrameOrder.Glyphs) and `perf`; the handle
   exposes pxToVh / vhToPx; dev asserts run the §4.2 score rules and the
   §2.3 pour-before-plateau check at build and the §2.2 track span on
   every ScrollTrigger refresh.
   ============================================================ */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { Flip } from "gsap/Flip";

import "./eases";
import { FLAGS } from "./flags";
import { MASTER_END } from "./beats";
import { currentProfile } from "./dilation";
import { createPlayhead } from "./playhead";
import { createGlyphEngine } from "./type/glyphs";
import { RESPIRO_WORDS } from "./copy";
import { checkScore, pourItemsFromTables, scoreDump } from "./dev/checks";
import { DOSSIER_T } from "./dossier/dossier.timeline";
import { CH4_T } from "./ch4/ch4.timeline";
import { RESPIRO_T } from "./ch1/respiro";
import { createDirector } from "./director";
import { createActs } from "./acts";
import { createFrames, createClock, setGatewayLag } from "./clock";
import { createRects } from "./rects";
import { resetFieldTime, settleRegistry, settleScrubbed } from "./settle";
import { runtime } from "./runtime";
import {
  assertPours,
  assertScore,
  assertTracks,
  attribute,
  checkLayersOff,
  checkMasterDuration,
  checkSettleCoverage,
} from "./dev/assert";
import {
  LIVE_KEYS,
  type BlockReason,
  type BuildFn,
  FrameOrder,
  type CinemaCtx,
  type CinemaHandle,
  type CinemaPerf,
  type CreateCinemaOptions,
  type PackageId,
  type Phase,
  type SnapController,
} from "./types";

import { build as buildCh1 } from "./ch1/ch1.timeline";
import { build as buildDossier } from "./dossier/dossier.timeline";
import { build as buildCh4 } from "./ch4/ch4.timeline";
import { build as buildRig } from "./rig/rig.timeline";
import { build as buildGuide } from "./guide/machine";

// module scope (§10.7): only these three bonus plugins, all in gsap 3.15
gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MorphSVGPlugin, Flip);

const BUILDS: ReadonlyArray<readonly [PackageId, BuildFn]> = [
  ["CH1", buildCh1],
  ["DOSSIER", buildDossier],
  ["CH4", buildCh4],
  ["RIG", buildRig],
  ["GUIDE", buildGuide],
];

const NOOP_HANDLE: CinemaHandle = {
  // reduced motion: no tracks — the document scrolls 1:1 (no master, no dilation)
  pxToVh: (px) => (px / Math.max(1, window.innerHeight)) * 100,
  vhToPx: (vh) => (vh / 100) * window.innerHeight,
  settle() {},
  settleScrubbed() {},
  snap: { start() {}, stop() {} },
  onReveal() {},
  onPhase() {},
  setBlocked(reason: BlockReason, on: boolean) {
    runtime.setBlocked(reason, on);
  },
  destroy() {},
};

export function createCinema(opts: CreateCinemaOptions): CinemaHandle {
  if (opts.reduced) return NOOP_HANDLE;
  const { lenis, field, labelLayer } = opts;

  const director = createDirector();
  const acts = createActs();
  const frames = createFrames();
  const rects = createRects();
  const liveMap = new Map<string, unknown>();
  const revealFns: Array<(o: { quiet: boolean }) => void> = [];
  const phaseFns: Array<(p: Phase) => void> = [];
  const destroyFns: Array<() => void> = [];
  const unregs: Array<() => void> = [];
  const isMobile = window.matchMedia("(max-width: 720px)").matches;

  // acts + guide bookkeeping are the only onUpdate consumers
  director.listen((vh) => acts.update(vh));

  // v3: glyph writer (WP5) and playhead (WP1) — behaviour-neutral stubs in WP0
  const glyphs = createGlyphEngine();
  const playhead = createPlayhead({
    targetVh: director.vh,
    writeMaster(vh) {
      director.tl.time(vh);
      acts.update(vh);
    },
    onJump(vh) {
      field.resetTimeLayer();
      glyphs.writeAll(vh);
    },
  });
  const perf: CinemaPerf = { glyphMs: { p95: () => 0 } };

  const live: CinemaCtx["live"] = {
    provide<T>(key: string, fn: T) {
      if (IS_DUP(liveMap, key)) console.warn(`[cinema] live key "${key}" provided twice (last wins)`);
      liveMap.set(key, fn);
    },
    use<T>(key: string): T {
      const v = liveMap.get(key);
      if (v !== undefined && typeof v !== "function") return v as T;
      // lazy forwarder: resolves at call time (use() may precede provide())
      return ((...args: unknown[]) => {
        const f = liveMap.get(key);
        return typeof f === "function" ? (f as (...a: unknown[]) => unknown)(...args) : undefined;
      }) as unknown as T;
    },
    has: (key: string) => liveMap.has(key),
  };

  const makeCtx = (pkg: PackageId): CinemaCtx => ({
    tl: director.tl,
    vh: director.vh,
    field,
    acts: { register: (a) => acts.register(a) },
    settle: {
      register(id, h, scope) {
        const un = settleRegistry.register(id, h, scope);
        unregs.push(un);
        return un;
      },
    },
    rects: {
      register: (k, m) => rects.register(k, m),
      get: (k) => rects.get(k),
      registerList: (k, m) => rects.registerList(k, m),
      getList: (k) => rects.getList(k),
    },
    live,
    frame: { add: (order, fn) => frames.add(order, fn) },
    onReveal: (fn) => void revealFns.push(fn),
    onPhase: (fn) => void phaseFns.push(fn),
    flags: FLAGS,
    isMobile,
    reduced: false,
    labelLayer,
    onDestroy: (fn) => void destroyFns.push(fn),
    vhToPx: director.vhToPx,
    pkg,
    playhead,
    glyphs,
    perf,
  });

  for (const [pkg, build] of BUILDS) {
    const ctx = makeCtx(pkg);
    try {
      if (FLAGS.DEV_ASSERT) attribute(pkg, () => build(ctx));
      else build(ctx);
    } catch (err) {
      // a broken package must not take the page (or Ch5) down with it
      console.error(`[cinema] build ${pkg} failed`, err);
    }
  }
  // core-owned node scopes
  unregs.push(settleRegistry.register("core.dome", { start() {}, end() {} }, ".cx-dome"));
  // v3: the no-WebGL CSS beam host (styled and driven by WP2)
  unregs.push(settleRegistry.register("core.nullBeam", { start() {}, end() {} }, ".cx-null__beam"));
  // v3: the glyph writer runs after the labels (WP1's clock times this slot)
  frames.add(FrameOrder.Glyphs, (vh) => glyphs.frame(vh));

  rects.measureAll();
  const clock = createClock({ lenis, field, frames, getVh: director.vh });

  let offTrackAssert: (() => void) | null = null;
  if (FLAGS.DEV_ASSERT) {
    checkMasterDuration(director.tl, MASTER_END);
    requestAnimationFrame(() => checkSettleCoverage(settleRegistry.scopes()));
    assertScore();
    assertPours(pourItemsFromTables(DOSSIER_T, CH4_T, RESPIRO_T, RESPIRO_WORDS.length));
    // dev hook (QA, §10 WP0): window.__cxScore.dump([vh…]) / .check()
    (window as unknown as { __cxScore?: unknown }).__cxScore = {
      dump: (vhs: number[] = [0, 120, 226, 262, 300, 336, 345, 352, 360, 368, 380, 398, 400, 1112, 1160, 1200, 1400, 1560, 1720, 1790, 1889, 1890, 1900]) =>
        scoreDump(vhs),
      check: () => checkScore(),
    };
    // §2.2 track span vs S_END(profile), warn-only until WP1 lands the v3 track CSS
    const onRefresh = () => assertTracks(director.st.end - director.st.start, currentProfile(), false);
    ScrollTrigger.addEventListener("refresh", onRefresh);
    offTrackAssert = () => ScrollTrigger.removeEventListener("refresh", onRefresh);
  }

  const getSnap = (): SnapController | null => {
    const s = liveMap.get(LIVE_KEYS.guideSnap) as SnapController | undefined;
    return s && typeof s.stop === "function" ? s : null;
  };
  const snap: SnapController = {
    start: () => getSnap()?.start(),
    stop: () => getSnap()?.stop(),
  };

  let destroyed = false;
  return {
    pxToVh: director.pxToVh,
    vhToPx: director.vhToPx,
    settle(to) {
      if (destroyed) return;
      director.setProgress(to);
      acts.settle(to === 1 ? "end" : "start");
      resetFieldTime(field);
      settleRegistry.run(to);
      // after CSS transitions (labels fade 220 ms) and under the still-closed veil
      if (FLAGS.DEV_ASSERT && to === 1) window.setTimeout(checkLayersOff, 350);
    },
    settleScrubbed,
    snap,
    onReveal(o) {
      revealFns.forEach((fn) => fn(o));
    },
    onPhase(p) {
      setGatewayLag(p === "gateway");
      if (p !== "radar") snap.stop();
      phaseFns.forEach((fn) => fn(p));
    },
    setBlocked(reason, on) {
      runtime.setBlocked(reason, on);
      if (on) snap.stop();
      else if (!runtime.blocked()) snap.start();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clock.dispose();
      offTrackAssert?.();
      glyphs.dispose();
      destroyFns.forEach((fn) => {
        try {
          fn();
        } catch (err) {
          console.error("[cinema] onDestroy threw", err);
        }
      });
      frames.clear();
      acts.kill();
      rects.dispose();
      unregs.forEach((un) => un());
      liveMap.clear();
      director.tl.scrollTrigger?.kill();
      director.tl.kill();
    },
  };
}

const IS_DUP = (m: Map<string, unknown>, k: string) => m.has(k);

export { runtime } from "./runtime";
export { FLAGS } from "./flags";
export { Cinema } from "./Cinema";
export { GuideDock } from "./guide/GuideDock";
export { killLooseTweensOf, settleScrubbed } from "./settle";
export type { CinemaHandle, FieldAdapter, Phase } from "./types";
