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
   ============================================================ */

import gsap from "gsap";
import type { PackageId } from "../types";

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
