/* ============================================================
   cinema/dev/assert.ts — dev-only contract assertions (WP0, §12.4).

   1. Single writer: while a package's build() runs, every GSAP
      write it creates (gsap.to/from/fromTo/set/quickSetter/quickTo
      and Timeline#to/from/fromTo/set — this covers ctx.tl and the
      acts) is recorded as (element, property) → package. A second
      package writing the same pair warns. Per-frame writers that
      touch `el.style` directly should call `claim()` once at build.
   2. Master duration stays exactly MASTER_END (a tween past 1900
      would silently re-map every vh).
   3. Settle coverage: every `.cx-*` node must sit inside a scope
      registered with settle.register(id, h, scope).
   4. After settle(1): no ch1–4 layer may still be visible.
   Production builds never call any of this (FLAGS.DEV_ASSERT).

   v3 (spec rev 3.1, WP0):
   5. §4.2 score rules (neutral at park, flat plateaus, J2 reset) — at
      build, through the pure checks of cinema/dev/checks.ts.
   6. §2.3 pour before plateau over T, CH4_T and RESPIRO_T — at build.
   7. §2.2 track span vs S_END(profile) against a hidden 100vh probe — on
      every ScrollTrigger refresh (warn-only while the v2 tracks are in
      place, i.e. until WP1 lands the track CSS).
   8. glyph writer budget: ≤ 140 glyph writes and ≤ 8 promoted words per
      frame (`glyphBudget`, called by the writer).
   9. single writer extended to the per-frame v3 writers: glyph spans
      (transform/opacity/visibility), the reticle `d` attributes, the dock
      `clip-path` and the shade `border-radius` — each owner calls
      `claimFrameWriter(pkg, targets, props)` once at build.
   ============================================================ */

import gsap from "gsap";
import type { PackageId } from "../types";
import { IS_DEV } from "../env";
import { checkScore, checkPours, checkTrackSpan, type PourItem, type Violation } from "./checks";
import type { DilationProfile } from "../dilation";

const SKIP = new Set([
  "duration", "ease", "delay", "stagger", "repeat", "repeatDelay", "repeatRefresh", "yoyo", "yoyoEase",
  "onStart", "onUpdate", "onComplete", "onRepeat", "onReverseComplete", "onInterrupt",
  "onStartParams", "onUpdateParams", "onCompleteParams", "onRepeatParams", "onReverseCompleteParams",
  "callbackScope", "immediateRender", "overwrite", "paused", "id", "data", "lazy", "inherit",
  "runBackwards", "startAt", "keyframes", "scrollTrigger", "clearProps", "autoRound", "snap",
  "reversed", "defaults", "smoothChildTiming", "autoRemoveChildren", "modifiers",
]);

type Writes = Map<Element, Map<string, PackageId>>;

const writes: Writes = new Map();
let current: PackageId | null = null;
const reported = new Set<string>();

function describe(el: Element): string {
  const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
  return el.tagName.toLowerCase() + (cls ? "." + cls : "");
}

function propsOf(vars: unknown): string[] {
  if (!vars || typeof vars !== "object") return [];
  const out: string[] = [];
  for (const k of Object.keys(vars as object)) {
    if (SKIP.has(k)) continue;
    if (k === "autoAlpha") out.push("opacity", "visibility");
    else out.push(k);
  }
  return out;
}

/** Record that `pkg` writes `props` on `targets` (call once per writer). */
export function claim(pkg: PackageId, targets: gsap.TweenTarget, props: string[]): void {
  let els: unknown[] = [];
  try {
    els = gsap.utils.toArray(targets as gsap.DOMTarget);
  } catch {
    return;
  }
  for (const t of els) {
    if (!(t instanceof Element)) continue;
    let m = writes.get(t);
    if (!m) writes.set(t, (m = new Map()));
    for (const p of props) {
      const prev = m.get(p);
      if (prev && prev !== pkg) {
        const key = `${describe(t)}|${p}|${prev}|${pkg}`;
        if (!reported.has(key)) {
          reported.add(key);
          console.warn(`[cinema/assert] single-writer: ${describe(t)} "${p}" is written by ${prev} AND ${pkg}`);
        }
      } else if (!prev) {
        m.set(p, pkg);
      }
    }
  }
}

type AnyFn = (...args: unknown[]) => unknown;

/** Run `fn` with GSAP writes attributed to `pkg`. */
export function attribute(pkg: PackageId, fn: () => void): void {
  const g = gsap as unknown as Record<string, AnyFn>;
  const proto = gsap.core.Timeline.prototype as unknown as Record<string, AnyFn>;
  const saved: Array<[Record<string, AnyFn>, string, AnyFn]> = [];
  const wrap = (obj: Record<string, AnyFn>, name: string, varsIndex: (args: unknown[]) => unknown[]) => {
    const orig = obj[name];
    if (typeof orig !== "function") return;
    saved.push([obj, name, orig]);
    obj[name] = function (this: unknown, ...args: unknown[]) {
      if (current) for (const v of varsIndex(args)) claim(current, args[0] as gsap.TweenTarget, propsOf(v));
      return orig.apply(this, args);
    };
  };
  const first = (a: unknown[]) => [a[1]];
  const both = (a: unknown[]) => [a[1], a[2]];
  wrap(g, "to", first);
  wrap(g, "from", first);
  wrap(g, "set", first);
  wrap(g, "fromTo", both);
  wrap(proto, "to", first);
  wrap(proto, "from", first);
  wrap(proto, "set", first);
  wrap(proto, "fromTo", both);
  // quickSetter(target, prop) / quickTo(target, prop)
  for (const name of ["quickSetter", "quickTo"]) {
    const orig = g[name];
    if (typeof orig !== "function") continue;
    saved.push([g, name, orig]);
    g[name] = function (this: unknown, ...args: unknown[]) {
      if (current && typeof args[1] === "string") claim(current, args[0] as gsap.TweenTarget, [args[1] as string]);
      return orig.apply(this, args);
    };
  }
  const prev = current;
  current = pkg;
  try {
    fn();
  } finally {
    current = prev;
    for (const [obj, name, orig] of saved.reverse()) obj[name] = orig;
  }
}

/** `.cx-*` nodes outside every registered settle scope. */
export function checkSettleCoverage(scopes: string[]): void {
  const sel = scopes.join(",");
  const orphans: string[] = [];
  document.querySelectorAll<HTMLElement>('[class*="cx-"]').forEach((el) => {
    const hasCx = Array.from(el.classList).some((c) => c.startsWith("cx-"));
    if (!hasCx) return;
    if (sel && el.closest(sel)) return;
    orphans.push(describe(el));
  });
  if (orphans.length) {
    console.warn(`[cinema/assert] ${orphans.length} .cx-* node(s) without a settle scope:`, orphans.slice(0, 20));
  }
}

const LAYERS = [".lp-stage > *", ".cx-dos-stage", ".cx-ch4-stage", ".cx-rig", ".lp-labels > *"];

/** After settle(1): every ch1–4 layer must be invisible. */
export function checkLayersOff(): void {
  const lit: string[] = [];
  for (const sel of LAYERS) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.001) lit.push(describe(el));
    });
  }
  if (lit.length) console.warn("[cinema/assert] settle(1) left ch1–4 layers visible:", lit);
}

export function checkMasterDuration(tl: gsap.core.Timeline, expected: number): void {
  const d = tl.duration();
  if (Math.abs(d - expected) > 1e-6) {
    console.warn(`[cinema/assert] master duration is ${d}, expected ${expected} — a tween runs past the master end`);
  }
}

export function resetAssertions(): void {
  writes.clear();
  reported.clear();
}

/* ── v3 ─────────────────────────────────────────────────────── */

/** Properties a per-frame v3 writer may claim (documentation + typo guard). */
export type FrameWriterProp =
  | "transform"
  | "opacity"
  | "visibility"
  | "filter"
  | "d"
  | "clip-path"
  | "border-radius"
  | "color"
  | "--scan-x"
  | (string & {});

/** Single-writer claim for a per-frame writer that touches el.style / attributes directly. */
export function claimFrameWriter(pkg: PackageId, targets: gsap.TweenTarget, props: FrameWriterProp[]): void {
  if (!IS_DEV) return;
  claim(pkg, targets, props as string[]);
}

const listV = (vs: Violation[]): string[] => vs.map((v) => `${v.rule}: ${v.detail}`);

/** §4.2: warn for the NEW / _v3 channels; list v2 violations once (accepted when the baseline has them). */
export function assertScore(): Violation[] {
  const all = checkScore();
  const v3 = all.filter((v) => !isV2Channel(v.id));
  const v2 = all.filter((v) => isV2Channel(v.id));
  if (v3.length) console.warn("[cinema/assert] §4.2 score rules violated by v3 channels:", listV(v3));
  if (v2.length) console.info("[cinema/assert] §4.2 v2 channels (accepted only if identical on v3/baseline):", listV(v2));
  return all;
}

const V2_NAMES = new Set([
  "sphereR", "sphereVisible", "dive", "soft", "fieldOp", "focus", "sweepGain", "chargeGain",
  "ring0", "ring1", "ring2", "ring3", "ticks", "cross", "warp", "rimIn", "embers", "dawn", "lit", "creep",
  "fovThud", "fovWiden", "fovUniverse", "dust", "dustGain", "labelsGate", "sweepFlash", "breathHero", "breathUni",
]);
const isV2Channel = (id: string): boolean => V2_NAMES.has(id.split("@")[0]);

/** §2.3: list pour-before-plateau violations of the live tables (the v2 list is fixed by WP7). */
export function assertPours(items: PourItem[]): Violation[] {
  const vs = checkPours(items);
  if (vs.length) console.info("[cinema/assert] §2.3 pour-before-plateau violations (live T / CH4_T / RESPIRO_T):", listV(vs));
  return vs;
}

let probe: HTMLElement | null = null;
/** The measured height of a hidden `height: 100vh` element (not innerHeight). */
export function probe100(): number {
  if (typeof document === "undefined") return 0;
  if (!probe || !probe.isConnected) {
    probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:100vh;visibility:hidden;pointer-events:none;";
    document.body.appendChild(probe);
  }
  return probe.getBoundingClientRect().height;
}

let lastTrackMsg = "";
/** §2.2: the master's scroll span in vh ((st.end − st.start) / (probe100 / 100)) vs S_END(profile). */
export function assertTracks(spanPx: number, profile: DilationProfile, strict: boolean): void {
  const p = probe100();
  if (!(p > 0)) return;
  const r = checkTrackSpan((spanPx / p) * 100, profile);
  if (r.ok) {
    lastTrackMsg = "";
    return;
  }
  const msg = `[cinema/assert] §2.2 track span ${r.got.toFixed(2)} vh ≠ S_END(${profile}) ${r.expected.toFixed(1)}`;
  if (msg === lastTrackMsg) return;
  lastTrackMsg = msg;
  if (strict || !r.v2Tracks) console.warn(msg);
  else console.info(msg + " (v2 tracks in place: warn-only until WP1 lands the track CSS)");
}

/** §5.2: per-frame glyph writer budget (≤ 140 glyph writes, ≤ 8 promoted words). */
export const GLYPH_WRITE_CAP = 140;
export const GLYPH_PROMOTE_CAP = 8;
export const glyphBudget = {
  writes: 0,
  promoted: 0,
  deferred: 0,
  frames: 0,
  overFrames: 0,
  begin(): void {
    this.writes = 0;
    this.promoted = 0;
    this.deferred = 0;
  },
  write(n: number): void {
    this.writes += n;
  },
  promote(n: number): void {
    this.promoted += n;
  },
  /** Writes the writer deferred to the next frame (over the cap). */
  defer(n: number): void {
    this.deferred += n;
  },
  end(): void {
    if (!IS_DEV) return;
    this.frames++;
    if (this.writes > GLYPH_WRITE_CAP || this.promoted > GLYPH_PROMOTE_CAP) {
      this.overFrames++;
      if (this.overFrames <= 5 || this.overFrames % 100 === 0) {
        console.warn(`[cinema/assert] glyph writer: ${this.writes} writes / ${this.promoted} promoted words in one frame (caps ${GLYPH_WRITE_CAP} / ${GLYPH_PROMOTE_CAP})`);
      }
    } else if (this.deferred > 0 && this.overFrames < 5) {
      console.info(`[cinema/assert] glyph writer deferred ${this.deferred} writes to the next frame`);
    }
  },
};
