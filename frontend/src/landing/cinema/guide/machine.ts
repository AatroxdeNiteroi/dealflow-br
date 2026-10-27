/* ============================================================
   cinema/guide/machine.ts — WP-GUIDE entry build (§3).

   The dock always says ONE of two things: what is happening now (a
   gerund, the ring filling) or what to do to continue (an imperative,
   the chevron breathing), and where you are on the five-station rail.

   Fed every frame (FrameOrder.Guide) by master vh, lenis.velocity
   (px/frame, normalised to 60 Hz), lenis.direction, idle time, phase
   and blocked(). Text is written only when it changes; geometry is
   transform/opacity/stroke-dashoffset only.

   States (§3.3), resolved in this order:
     hidden    not revealed (gateway, entering, after a return)
     arrival   the onboarding card is up (first non-quiet entry)
     back      direction −1 for > 150 ms and |v| > .5 → "voltando ·
               ⟨Estação⟩", ring drains, chevron flipped; ends 400 ms
               after the backward motion stops (at once on a forward
               push — the dock must never lag the user)
     rest      inside a rest plateau AND landing (|v| < .6 vh/frame):
               imperative, full ring, gold flash + aria-live on arrival.
               Passing THROUGH a plateau at speed keeps the gerund
               (an imperative flashing by would be noise, not guidance)
     handoff   1798–1900 "a seguir: os planos" — rest style
     transit   gerund of the sub-segment (6 vh hysteresis), ring =
               local progress between plateaus, .78 while moving
   Modifiers: idleRest (1.6 s still at a rest: verb emphasis + 2-bob
   chevron nudge), idleMid (1.2 s still mid-beat: "continue rolando" +
   ring pulse + nudge) — nudges repeat every 6 s, ≤ 3 per position;
   fling (|v| > 30): .45 and verb swaps deferred; lifted (reducer).

   Also built here: the onboarding card + its Flip collapse into the
   pill, the rail (needle, gold fill, ticks, odometer labels), on-dark
   inversion at the (lifted) pill centre, aria-live, the dock-button
   scroll, and — one entry build per package — the reducer and snap.

   Root ownership: the dock ROOT's autoAlpha belongs to the reveal hook
   here (G3: 0.35 s after reveal, instant on a quiet entry) and, from
   Ch5 start, to Landing's cue-off trigger. Everything state-driven is
   written INSIDE the root (stack opacity, pill, rail), never on it.
   ============================================================ */

import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { FrameOrder, type CinemaCtx, type Phase, type Rect } from "../types";
import {
  GATEWAY_TIMING,
  MARKS,
  MASTER_END,
  PLATEAU_HALF,
  REST_COUNT,
  RESTS,
  STATIONS,
  VERB_HYSTERESIS,
  VERB_IDLE_MID,
  VERB_SEGMENTS,
  railProgress,
  restAt,
  verbBack,
  type Rest,
} from "../beats";
import { ariaRestAnnouncement } from "../copy";
import { clamp, clamp01, damp } from "../geometry";
import { runtime } from "../runtime";
import { IS_DEV } from "../env";
import { build as buildReducer, dockLiftAt } from "./reducer";
import { build as buildSnap } from "./snap";

/* ── shared package state (machine ↔ reducer ↔ snap) ──────────── */

export interface GuideMetrics {
  /** Untransformed pill centre, viewport px (on-dark probe). */
  pillX: number;
  pillY: number;
  /** Desktop rail width (needle travel), px; 0 when hidden. */
  railW: number;
  /** Mobile: px the dock rises to stack above the CTA row (0 on desktop). */
  ctaLift: number;
  /** px the dock rises when the footer returns (1840–1880). */
  footLift: number;
  /** 1 vh in px. */
  vhPx: number;
  mobile: boolean;
}

export interface GuideBus {
  phase: Phase;
  /** A dock-button scroll is in flight (snap stands down). */
  flying: boolean;
  /** performance.now() of the last wheel / touch / scroll-key input. */
  lastInputAt: number;
  /** Last direction of travel (snap's "ahead"). */
  lastDir: 1 | -1;
  metrics: GuideMetrics;
  /** Called after every refresh-time measurement. */
  onMeasured: Array<() => void>;
}

/* ── tuning (spec §3.3 values; px thresholds are per 60 Hz frame) ─ */

const T = {
  moveV: 0.5,
  flingV: 30,
  /** below this (vh/frame) inside a plateau the scroll is landing */
  landVh: 0.6,
  backAfterMs: 150,
  backHoldMs: 400,
  idleRestMs: 1600,
  idleMidMs: 1200,
  nudgeEveryMs: 6000,
  nudgeMax: 3,
  announceEveryMs: 1500,
  dismissPx: 4,
} as const;

type Mode = "hidden" | "arrival" | "rest" | "handoff" | "transit" | "back";

const SEG_N = VERB_SEGMENTS.length;
const HANDOFF = VERB_SEGMENTS[SEG_N - 1];
const R0 = RESTS[0];
const R0_END = R0.at + PLATEAU_HALF;
const FIRST_TRANSIT_VERB = VERB_SEGMENTS.find((s) => s.state === "transit")!.verb; // "mergulhando no campo"
const LAST_TRANSIT_VERB = [...VERB_SEGMENTS].reverse().find((s) => s.state === "transit")!.verb;
const PLATEAUS = RESTS.filter((r) => r.plateau !== null);

/** Every string the verb line can show → slot width (a swap never resizes the pill). */
const ALL_VERBS: readonly string[] = [
  ...VERB_SEGMENTS.map((s) => s.verb),
  VERB_IDLE_MID,
  ...STATIONS.map((s) => verbBack(s)),
];
const VERB_CHARS = Math.max(...ALL_VERBS.map((v) => [...v].length));

const segIndexAt = (vh: number): number => {
  for (let i = 0; i < SEG_N; i++) if (vh < VERB_SEGMENTS[i].to) return i;
  return SEG_N - 1;
};
/** Active station. Inside a rest plateau it is THAT rest's station: the
 *  chapter boundaries (880, 1160, 1560) sit on rest centres, so a landing
 *  a hair short of 880 must still read "Convergência" — the same station
 *  the imperative and aria-live name ("Etapa 4 de 8 · Convergência"). */
const stationIndexAt = (vh: number): number => {
  const r = restAt(vh);
  if (r) {
    const k = STATIONS.findIndex((s) => s.id === r.station);
    if (k >= 0) return k;
  }
  let i = 0;
  for (let k = 0; k < STATIONS.length; k++) if (vh >= STATIONS[k].at) i = k;
  return i;
};
const stationName = (r: Rest): string => STATIONS.find((s) => s.id === r.station)?.name ?? "";

/** Local beat progress for the ring: 0 leaving a plateau → 1 entering the next. */
function ringAt(vh: number): number {
  if (vh < R0_END || vh >= HANDOFF.from) return 1;
  let a = R0_END;
  let b = HANDOFF.from;
  for (const r of PLATEAUS) {
    const [p0, p1] = r.plateau!;
    if (vh >= p0 && vh <= p1) return 1;
    if (p1 <= vh) a = p1;
    else if (p0 >= vh) {
      b = p0;
      break;
    }
  }
  return clamp01((vh - a) / (b - a));
}

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Spacebar"]);

/* ── verb swapper: out 140 ms (blur 2, y −4) → in 200 ms rk-settle;
   interruptible — a new request during the out keeps one out and
   lands on the LATEST text; a request back to the shown text during
   the out simply returns it (§3.3 rules). ─────────────────────── */

interface Swapper {
  request(text: string): void;
  setNow(text: string): void;
  target(): string;
  kill(): void;
}

function createSwapper(el: HTMLElement): Swapper {
  let shown = el.textContent ?? "";
  let target = shown;
  let out: gsap.core.Tween | null = null;
  let inn: gsap.core.Tween | null = null;

  const bringIn = (fromState: boolean) => {
    inn?.kill();
    const vars = {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 0.2,
      ease: "rk-settle",
      overwrite: "auto" as const,
      onComplete: () => {
        inn = null;
        gsap.set(el, { clearProps: "filter" });
      },
    };
    inn = fromState ? gsap.fromTo(el, { opacity: 0, y: 4, filter: "blur(2px)" }, vars) : gsap.to(el, vars);
  };

  return {
    request(text) {
      if (text === target) return;
      target = text;
      if (out) {
        if (text === shown) {
          // changed our mind mid-out: return the shown text, no blink
          out.kill();
          out = null;
          bringIn(false);
        }
        return; // the running out lands on the latest target
      }
      if (text === shown) return;
      inn?.kill();
      inn = null;
      out = gsap.to(el, {
        opacity: 0,
        y: -4,
        filter: "blur(2px)",
        duration: 0.14,
        ease: "rk-settle",
        overwrite: "auto",
        onComplete: () => {
          out = null;
          el.textContent = target;
          shown = target;
          bringIn(true);
        },
      });
    },
    setNow(text) {
      out?.kill();
      inn?.kill();
      out = inn = null;
      target = shown = text;
      el.textContent = text;
      gsap.set(el, { opacity: 1, y: 0, clearProps: "filter" });
    },
    target: () => target,
    kill() {
      out?.kill();
      inn?.kill();
      out = inn = null;
    },
  };
}

/* ── build ───────────────────────────────────────────────────── */

export function build(ctx: CinemaCtx): void {
  const bus: GuideBus = {
    phase: "gateway",
    flying: false,
    lastInputAt: -1e9,
    lastDir: 1,
    metrics: { pillX: 0, pillY: 0, railW: 0, ctaLift: 0, footLift: 0, vhPx: window.innerHeight / 100, mobile: ctx.isMobile },
    onMeasured: [],
  };
  // one entry build per package: the reducer and the snap are built here
  buildReducer(ctx, bus);
  buildSnap(ctx, bus);

  const root = document.querySelector<HTMLButtonElement>(".lp-scrollcue");
  const card = document.querySelector<HTMLElement>(".cx-guide__card");
  const liveEl = document.querySelector<HTMLElement>(".cx-guide__live");
  if (!root || !card) {
    console.warn("[cinema/guide] dock markup missing — GuideDock not rendered");
    return;
  }
  const q = <E extends Element = HTMLElement>(sel: string, scope: ParentNode = root) => scope.querySelector<E>(sel)!;
  const qa = <E extends Element = HTMLElement>(sel: string, scope: ParentNode = root) =>
    Array.from(scope.querySelectorAll<E>(sel));

  const stack = q(".cx-guide__stack");
  const pill = q(".cx-guide__pill");
  const pillBg = q(".cx-guide__pill-bg");
  const pillEdge = q(".cx-guide__pill-edge");
  const pillIn = q(".cx-guide__pill-in");
  const ringEl = q(".cx-guide__ring");
  const arc = q<SVGCircleElement>(".cx-guide__ring-arc");
  const flashEl = q<SVGCircleElement>(".cx-guide__ring-flash");
  const chevBob = q(".cx-guide__chev-bob");
  const chevRot = q(".cx-guide__chev-rot");
  const verbEl = q(".cx-guide__verb-t");
  const rail = q(".cx-guide__rail");
  const railLine = q(".cx-guide__rail-line");
  const railFill = q(".cx-guide__rail-fill");
  const needle = q(".cx-guide__rail-needle");
  const ticks = qa(".cx-guide__rail-tick");
  const labels = qa(".cx-guide__rail-label");
  const reels = qa(".cx-guide__rail-reel");
  const mrail = q(".cx-guide__mrail");
  const mnames = qa(".cx-guide__mname");
  const mdots = qa(".cx-guide__mdot");
  const cardBg = q(".cx-guide__card-bg", card);
  const cardBody = q(".cx-guide__card-body", card);

  root.style.setProperty("--cx-verb-chars", String(VERB_CHARS));
  if (IS_DEV) {
    const long = ALL_VERBS.filter((v) => [...v].length > 30);
    if (long.length) console.warn("[cinema/guide] verbs over 30 characters:", long);
  }

  const swapper = createSwapper(verbEl);
  const setStackOp = gsap.quickSetter(stack, "opacity") as (v: number) => void;
  const setNeedleX = gsap.quickSetter(needle, "x", "px") as (v: number) => void;
  const setFill = gsap.quickSetter(railFill, "scaleX") as (v: number) => void;

  /* ── refresh-time measurement (never per frame) ─────────────── */
  const metrics = bus.metrics;
  const measure = (): Rect => {
    const mobile = window.matchMedia("(max-width: 720px)").matches;
    // the root is never transformed (lift lives inside it), so its box
    // and the pill's offsets are the untransformed slot
    const rr = root.getBoundingClientRect();
    const top = rr.top + pill.offsetTop;
    metrics.pillX = rr.left + rr.width / 2;
    metrics.pillY = top + pill.offsetHeight / 2;
    metrics.railW = rail.offsetWidth;
    metrics.vhPx = window.innerHeight / 100;
    metrics.mobile = mobile;
    const footer = document.querySelector<HTMLElement>(".lp-footer");
    const footerH = footer?.offsetHeight ?? 0;
    if (mobile) {
      // §3.11: once the CTA is up the dock sits ABOVE its row —
      // bottom = clamp(20px,4vh,38px) + ctaH + 10 (+ safe area, which
      // cancels: the dock's own bottom already carries it)
      const cta = document.querySelector<HTMLElement>(".lp-cta");
      const baseBottom = parseFloat(getComputedStyle(root).bottom) || 0;
      const sa = Math.max(0, baseBottom - 16);
      const ctaBottom = cta ? parseFloat(getComputedStyle(cta).bottom) || 0 : 0;
      const ctaH = cta?.offsetHeight ?? 0;
      const above = ctaBottom + ctaH + 10 + sa;
      metrics.ctaLift = Math.max(0, above - baseBottom);
      // footer visible: bottom = max(that, footerH + 10)
      metrics.footLift = Math.max(0, footerH + 10 - above);
    } else {
      metrics.ctaLift = 0;
      metrics.footLift = footerH + 10;
    }
    bus.onMeasured.forEach((fn) => fn());
    lastNeedle = lastFill = NaN;
    return { x: rr.left, y: top, w: rr.width, h: pill.offsetHeight };
  };
  ctx.rects.register("guide.pill", measure);

  /* ── visual states ────────────────────────────────────────────── */
  let revealTween: gsap.core.Tween | null = null;
  let cardTween: gsap.core.Tween | null = null;
  let morphTl: gsap.core.Timeline | null = null;
  let nudgeTl: gsap.core.Timeline | null = null;
  let flashTl: gsap.core.Timeline | null = null;

  const railParts = [railFill, needle, ...ticks, ...labels];
  const setPill = (on: boolean) => {
    gsap.set([pillBg, pillEdge, pillIn], { autoAlpha: on ? 1 : 0, y: 0, clearProps: "filter" });
  };
  const railDocked = () => {
    gsap.set(railLine, { scaleX: 1 });
    gsap.set(railParts, { autoAlpha: 1 });
    gsap.set(needle, { scale: 1 });
    gsap.set(mrail, { autoAlpha: 1, y: 0 });
  };
  const railHidden = () => {
    gsap.set(railLine, { scaleX: 0 });
    gsap.set(railParts, { autoAlpha: 0 });
    gsap.set(mrail, { autoAlpha: 0 });
  };
  /** The rail draws in: hairline scaleX 0 → 1 from the left (400 ms rk-expo),
   *  stations and labels appear as the line passes them. */
  const railIn = (): gsap.core.Timeline =>
    gsap
      .timeline()
      .fromTo(railLine, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "rk-expo" }, 0)
      .fromTo(needle, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "rk-settle" }, 0.02)
      .fromTo(railFill, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "rk-settle" }, 0.02)
      .fromTo(ticks, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "rk-settle", stagger: 0.05 }, 0.02)
      .fromTo(labels, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.24, ease: "rk-settle", stagger: 0.05 }, 0.06)
      .fromTo(mrail, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "rk-settle" }, 0.04);

  const killUi = () => {
    revealTween?.kill();
    cardTween?.kill();
    morphTl?.kill();
    nudgeTl?.kill();
    flashTl?.kill();
    revealTween = cardTween = morphTl = nudgeTl = flashTl = null;
    swapper.kill();
  };

  /* ── machine state ───────────────────────────────────────────── */
  let revealed = false;
  let arrival = false;
  let morphing = false;
  let onboardDone = false;
  let scrollAcc = 0;
  let lastScroll = 0;

  let mode: Mode = "hidden";
  let lastMode: Mode = "hidden";
  let lastRest: Rest | null = null;
  let segCur = 0;
  let segPrev = -1;
  let segBoundary = 0;
  let transitVerb = FIRST_TRANSIT_VERB;
  let back = false;
  let backSince = -1;
  let backLast = -1e9;
  let stillSince = performance.now();
  let flyStart = 0;
  let stackOp = 1;
  let lastStackOp = NaN;
  let lastRing = NaN;
  let lastNeedle = NaN;
  let lastFill = NaN;
  let onDark = false;
  let breathing = false;
  let idleCls = false;
  let flipped = false;
  let stationIdx = 0;
  let mSlot = 0;
  let nudgeKey = "";
  let nudgeAt = 0;
  const nudgeCount = new Map<string, number>();
  let livePending: Rest | null = null;
  let liveAt = -1e9;
  let liveFlip = false;

  const resolveSeg = (vh: number, settled: boolean) => {
    const raw = segIndexAt(vh);
    if (raw === segCur) return;
    // hysteresis: hopping straight back over the boundary we just crossed
    // needs 6 vh; once the scroll has settled, the dock tells the truth
    if (!settled && raw === segPrev && Math.abs(vh - segBoundary) < VERB_HYSTERESIS) return;
    segBoundary = raw > segCur ? VERB_SEGMENTS[segCur].to : VERB_SEGMENTS[segCur].from;
    segPrev = segCur;
    segCur = raw;
  };

  /* station (rail labels = odometer reels rolling in the travel direction) */
  const REEL_OFF_TOP = 0;
  const REEL_ON = -100 / 3;
  const REEL_OFF_BOTTOM = -200 / 3;
  gsap.set(reels, { yPercent: REEL_OFF_TOP });
  gsap.set(mnames, { yPercent: (i: number) => (i === 0 ? 0 : 100) });
  const setStation = (next: number, dir: 1 | -1, immediate: boolean) => {
    const prev = stationIdx;
    reels.forEach((reel, i) => {
      const on = i === next;
      const was = i === prev;
      if (immediate) {
        gsap.set(reel, { yPercent: on ? REEL_ON : REEL_OFF_TOP, overwrite: true });
      } else if (on && !was) {
        gsap.fromTo(
          reel,
          { yPercent: dir > 0 ? REEL_OFF_TOP : REEL_OFF_BOTTOM },
          { yPercent: REEL_ON, duration: 0.24, ease: "rk-settle", overwrite: true },
        );
      } else if (!on && was) {
        gsap.to(reel, { yPercent: dir > 0 ? REEL_OFF_BOTTOM : REEL_OFF_TOP, duration: 0.24, ease: "rk-settle", overwrite: true });
      }
    });
    ticks.forEach((t, i) => t.classList.toggle("is-passed", i <= next));
    mdots.forEach((d, i) => {
      d.classList.toggle("is-passed", i < next);
      d.classList.toggle("is-active", i === next);
    });
    // mobile: one label, two slots
    if (immediate) {
      mnames[mSlot].textContent = STATIONS[next].name;
      gsap.set(mnames[mSlot], { yPercent: 0, overwrite: true });
      gsap.set(mnames[1 - mSlot], { yPercent: 100, overwrite: true });
    } else if (next !== prev) {
      const out = mnames[mSlot];
      const inn = mnames[1 - mSlot];
      inn.textContent = STATIONS[next].name;
      gsap.fromTo(inn, { yPercent: dir > 0 ? 100 : -100 }, { yPercent: 0, duration: 0.24, ease: "rk-settle", overwrite: true });
      gsap.to(out, { yPercent: dir > 0 ? -100 : 100, duration: 0.24, ease: "rk-settle", overwrite: true });
      mSlot = 1 - mSlot;
    }
    stationIdx = next;
  };
  setStation(0, 1, true);

  /* ── onboarding (§3.5) ───────────────────────────────────────── */
  const toDocked = () => {
    arrival = false;
    morphing = false;
    root.classList.remove("is-arrival");
    gsap.set(card, { autoAlpha: 0, y: 0 });
    gsap.set([cardBg, cardBody], { clearProps: "all" });
    setPill(true);
    railDocked();
  };

  const enterArrival = () => {
    arrival = true;
    onboardDone = false;
    root.classList.add("is-arrival");
    setPill(false);
    railHidden();
    gsap.set([cardBg, cardBody], { clearProps: "all" });
    gsap.set(card, { autoAlpha: 0, y: 16 });
    // G3: the LAST beat of the wake, ~0.5 s after the radar opens
    cardTween = gsap.to(card, {
      autoAlpha: 1,
      y: 0,
      duration: 0.3,
      ease: "rk-settle",
      delay: GATEWAY_TIMING.G3.onboardingAt,
    });
    scrollAcc = 0;
    lastScroll = runtime.lenis()?.scroll ?? window.scrollY;
    transitVerb = FIRST_TRANSIT_VERB;
    swapper.setNow(FIRST_TRANSIT_VERB);
  };

  /** Card → pill: the card's paper collapses (Flip.fit, 450 ms rk-glide)
   *  into the pill's slot while darkening to brown-deep; its text leaves
   *  first, the pill's ring + verb arrive as it lands; the rail draws. */
  const morph = () => {
    morphing = true;
    const toColor = getComputedStyle(pillBg).backgroundColor;
    const tl = gsap.timeline({
      onComplete: () => {
        morphing = false;
        morphTl = null;
      },
    });
    tl.to(cardBody, { autoAlpha: 0, y: -6, filter: "blur(2px)", duration: 0.16, ease: "rk-settle" }, 0);
    const fit = Flip.fit(cardBg, pillBg, { scale: true, duration: 0.45, ease: "rk-glide" }) as gsap.core.Tween | null;
    if (fit && typeof (fit as gsap.core.Tween).duration === "function") tl.add(fit, 0);
    // paper holds while the card text dissolves, then ink fills the box as
    // it lands (a straight 450 ms blend would sit in muddy greys)
    tl.to(cardBg, { backgroundColor: toColor, borderColor: toColor, duration: 0.28, ease: "rk-io" }, 0.06);
    tl.fromTo(
      pillIn,
      { autoAlpha: 0, y: 4, filter: "blur(2px)" },
      { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.22, ease: "rk-settle" },
      0.2,
    );
    // the landing frame: identical brown box → swap to the real pill
    tl.add(() => {
      gsap.set(pillBg, { autoAlpha: 1 });
      gsap.set(card, { autoAlpha: 0 });
      gsap.set([cardBg, cardBody], { clearProps: "all" });
    }, 0.45);
    tl.fromTo(pillEdge, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "rk-settle" }, 0.45);
    tl.add(railIn(), 0.3);
    tl.add(() => gsap.set(pillIn, { clearProps: "filter" }));
    morphTl = tl;
  };

  /** Dismissed by a real scroll only (≥ 4 px cumulative), never a timer. */
  const dismiss = () => {
    arrival = false;
    onboardDone = true;
    root.classList.remove("is-arrival");
    const shown = Number(gsap.getProperty(card, "opacity")) || 0;
    cardTween?.kill();
    cardTween = null;
    swapper.setNow(FIRST_TRANSIT_VERB);
    if (shown < 0.35) {
      // the card never really landed: let it go, bring the docked pill in
      gsap.to(card, { autoAlpha: 0, duration: 0.14, ease: "rk-settle" });
      morphing = true;
      morphTl = gsap
        .timeline({
          onComplete: () => {
            morphing = false;
            morphTl = null;
          },
        })
        .fromTo([pillBg, pillEdge], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "rk-settle" }, 0)
        .fromTo(
          pillIn,
          { autoAlpha: 0, y: 4, filter: "blur(2px)" },
          { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.2, ease: "rk-settle" },
          0.04,
        )
        .add(railIn(), 0.1)
        .add(() => gsap.set(pillIn, { clearProps: "filter" }));
      return;
    }
    gsap.set(card, { autoAlpha: 1, y: 0 });
    morph();
  };

  /* ── small acts on the dock ──────────────────────────────────── */
  const flash = () => {
    flashTl?.kill();
    flashTl = gsap
      .timeline()
      .set(flashEl, { opacity: 0 })
      .to(flashEl, { opacity: 1, duration: 0.07, ease: "rk-settle" })
      .to(flashEl, { opacity: 0, duration: 0.23, ease: "rk-settle" });
  };
  /** 2-bob chevron nudge (6 px, 2 × 450 ms rk-settle); idleMid adds the
   *  ring pulse 1 → 1.12 → 1, twice, on the same beat. */
  const nudge = (withRing: boolean) => {
    nudgeTl?.kill();
    const tl = gsap.timeline();
    for (let i = 0; i < 2; i++) {
      const at = i * 0.45;
      tl.to(chevBob, { y: 6, duration: 0.14, ease: "rk-settle" }, at).to(chevBob, { y: 0, duration: 0.31, ease: "rk-settle" }, at + 0.14);
      if (withRing) {
        tl.to(ringEl, { scale: 1.12, duration: 0.14, ease: "rk-settle" }, at).to(
          ringEl,
          { scale: 1, duration: 0.31, ease: "rk-settle" },
          at + 0.14,
        );
      }
    }
    nudgeTl = tl;
  };
  const stopNudge = () => {
    if (!nudgeTl) return;
    nudgeTl.kill();
    nudgeTl = null;
    gsap.to([chevBob, ringEl], { y: 0, scale: 1, duration: 0.2, ease: "rk-settle", overwrite: "auto" });
  };
  const announce = (r: Rest) => {
    livePending = r;
  };

  /* ── the frame ───────────────────────────────────────────────── */
  ctx.frame.add(FrameOrder.Guide, (vh, _t, dt) => {
    const now = performance.now();
    const lenis = runtime.lenis();
    const vRaw = lenis ? Math.abs(lenis.velocity) : 0;
    const v60 = vRaw / Math.max(dt * 60, 0.25);
    const dirNow = lenis ? lenis.direction : 0;
    if (vRaw > 0.05 && dirNow !== 0) bus.lastDir = dirNow > 0 ? 1 : -1;

    // a dock flight that Lenis finished or a gesture cut short
    if (bus.flying && lenis && !lenis.isScrolling && now - flyStart > 150) bus.flying = false;

    // onboarding: dismissed by ≥ 4 px of real scroll
    if (arrival && lenis) {
      const s = lenis.scroll;
      scrollAcc += Math.abs(s - lastScroll);
      lastScroll = s;
      if (scrollAcc >= T.dismissPx) dismiss();
    }

    const moving = v60 > T.moveV || bus.flying;
    const goingBack = dirNow < 0 && v60 > T.moveV;
    const goingFwd = dirNow > 0 && v60 > T.moveV;
    if (goingBack) {
      if (backSince < 0) backSince = now;
      backLast = now;
    } else backSince = -1;
    if (!back && backSince >= 0 && now - backSince > T.backAfterMs) back = true;
    else if (back && (goingFwd || (!goingBack && now - backLast > T.backHoldMs))) back = false;

    if (moving) stillSince = now;
    const idleFor = now - Math.max(stillSince, bus.lastInputAt);

    resolveSeg(vh, v60 < 0.05);
    const seg = VERB_SEGMENTS[segCur];
    if (seg.state === "transit") transitVerb = seg.verb;

    const rest = restAt(vh);
    // landing has hysteresis: once resting, a slow drift inside the same
    // plateau never flickers the imperative off and on
    const landV = T.landVh * metrics.vhPx;
    const landed =
      rest !== null && (v60 < landV || (lastMode === "rest" && lastRest === rest && v60 < landV * 2.5));
    if (!revealed || bus.phase !== "radar") mode = "hidden";
    else if (arrival) mode = "arrival";
    else if (back) mode = "back";
    else if (landed) mode = "rest";
    else if (vh >= HANDOFF.from) mode = "handoff";
    else mode = "transit";

    const restLike = mode === "rest" || mode === "handoff";
    const idleRest = restLike && idleFor >= T.idleRestMs;
    const idleMid = mode === "transit" && idleFor >= T.idleMidMs;
    // a fling is the user's own throw; a dock flight is the dock narrating
    // the trip it was asked for, so it keeps talking at full voice
    const fling = v60 > T.flingV && !bus.flying;

    // verb (written only when it changes; swaps deferred during a fling
    // and while the onboarding morph owns the pill)
    if (mode !== "hidden" && mode !== "arrival" && !morphing && !fling) {
      let verb: string;
      if (mode === "rest") verb = rest!.verb;
      else if (mode === "handoff") verb = HANDOFF.verb;
      else if (mode === "back") verb = verbBack(STATIONS[stationIndexAt(vh)]);
      else verb = idleMid ? VERB_IDLE_MID : transitVerb;
      swapper.request(verb);
    }

    // rest arrival: the ring closes with one gold flash; aria-live
    if (
      mode === "rest" &&
      (lastMode !== "rest" || lastRest !== rest) &&
      lastMode !== "hidden" &&
      lastMode !== "arrival" &&
      !morphing
    ) {
      flash();
      announce(rest!);
    }

    // ring: full at rest / handoff, local progress otherwise (drains back)
    const ring = restLike ? 1 : ringAt(vh);
    if (!(Math.abs(ring - lastRing) < 5e-4)) {
      arc.style.strokeDashoffset = String(1 - ring);
      lastRing = ring;
    }

    // stack opacity: .78 while moving in transit / back, .45 on a fling
    let op = 1;
    if (mode === "transit") op = v60 > T.moveV ? 0.78 : 1;
    else if (mode === "back") op = 0.78;
    if (fling && mode !== "arrival") op = 0.45;
    stackOp = mode === "hidden" ? op : damp(stackOp, op, 14, dt);
    if (!(Math.abs(stackOp - lastStackOp) < 2e-3)) {
      setStackOp(stackOp);
      lastStackOp = stackOp;
    }

    // chevron: breathes at rest, frozen in transit, flipped going back
    if (restLike !== breathing) {
      root.classList.toggle("is-breathing", restLike);
      breathing = restLike;
    }
    const wantFlip = mode === "back";
    if (wantFlip !== flipped) {
      gsap.to(chevRot, { rotation: wantFlip ? 180 : 0, duration: 0.2, ease: "rk-settle", overwrite: "auto" });
      flipped = wantFlip;
    }
    if (idleRest !== idleCls) {
      root.classList.toggle("is-idle", idleRest);
      idleCls = idleRest;
    }

    // idle nudges: every 6 s, at most 3 per position
    if (idleRest || idleMid) {
      const key = idleRest ? (rest ? rest.id : "handoff") : "m" + Math.round(vh);
      if (key !== nudgeKey) {
        nudgeKey = key;
        nudgeAt = now;
      }
      if (now >= nudgeAt) {
        const n = nudgeCount.get(key) ?? 0;
        if (n < T.nudgeMax) {
          nudge(idleMid);
          nudgeCount.set(key, n + 1);
        }
        nudgeAt = now + T.nudgeEveryMs;
      }
    } else if (nudgeKey) {
      nudgeKey = "";
      stopNudge();
    }

    // rail: needle + gold fill (piecewise quarters), stations
    const p = railProgress(vh);
    const nx = p * metrics.railW;
    if (!(Math.abs(nx - lastNeedle) < 0.05)) {
      setNeedleX(nx);
      lastNeedle = nx;
    }
    if (!(Math.abs(p - lastFill) < 2e-4)) {
      setFill(p);
      lastFill = p;
    }
    const si = stationIndexAt(vh);
    if (si !== stationIdx) setStation(si, si > stationIdx ? 1 : -1, mode === "hidden");

    // on-dark inversion at the pill centre (at its lifted position)
    const dark = revealed && ctx.field.isDarkAt(metrics.pillX, metrics.pillY + dockLiftAt(vh, metrics));
    if (dark !== onDark) {
      root.classList.toggle("is-on-dark", dark);
      onDark = dark;
    }

    // aria-live: rest arrivals only, ≤ one per 1.5 s
    if (livePending && liveEl && now - liveAt >= T.announceEveryMs) {
      const r = livePending;
      livePending = null;
      if (mode === "rest" && rest === r) {
        const text = ariaRestAnnouncement(r.step, REST_COUNT, stationName(r), r.verb);
        liveFlip = !liveFlip; // same text twice must still be announced
        liveEl.textContent = liveFlip ? text : text + " ";
        liveAt = now;
      }
    }

    lastMode = mode;
    lastRest = mode === "rest" ? rest : null;
  });

  /* ── the dock is a button (§3.9) ─────────────────────────────── */
  const nextTarget = (vh: number): { px: number; dvh: number } | null => {
    const lenis = runtime.lenis();
    if (!lenis) return null;
    const r7 = RESTS[RESTS.length - 1];
    if (vh >= r7.plateau![0]) {
      // at R7 or beyond: where the first plan card is falling
      // (masterEnd + 0.30 × ch5 scroll length) — a scroll target only
      const track = document.querySelector<HTMLElement>(".ch5-track");
      const len = track?.offsetHeight ?? 0;
      let px: number;
      if (len > 0) px = ctx.vhToPx(MASTER_END) + MARKS.dockCh5Fraction * len;
      else {
        // narrow: Ch5 is a static section — bring its top under the header
        const stage = document.querySelector<HTMLElement>(".ch5-stage");
        if (!stage) return null;
        const nav = document.querySelector<HTMLElement>(".lp-nav");
        px = stage.getBoundingClientRect().top + lenis.scroll - (nav?.offsetHeight ?? 0);
      }
      return { px, dvh: Math.abs(px - lenis.scroll) / Math.max(metrics.vhPx, 1e-3) };
    }
    for (const r of PLATEAUS) {
      if (r.plateau![0] > vh) return { px: ctx.vhToPx(r.at), dvh: r.at - vh };
    }
    return null;
  };

  const onClick = () => {
    if (arrival || bus.phase !== "radar" || runtime.blocked()) return;
    const lenis = runtime.lenis();
    if (!lenis || lenis.isStopped) return;
    const tgt = nextTarget(ctx.vh());
    if (!tgt) return;
    const duration = clamp((tgt.dvh / 100) * 0.8, 0.5, 1.6);
    bus.flying = true;
    flyStart = performance.now();
    bus.lastInputAt = flyStart;
    lenis.scrollTo(tgt.px, {
      duration,
      easing: easeInOutCubic,
      onComplete: () => {
        bus.flying = false;
      },
    });
  };
  root.addEventListener("click", onClick);

  const syncDisabled = (b: boolean) => {
    root.disabled = b;
  };
  syncDisabled(runtime.blocked());
  const offBlocked = runtime.onBlockedChange(syncDisabled);

  /* ── input: idle timers + interrupting a dock flight ─────────── */
  const onInput = (e: Event) => {
    bus.lastInputAt = performance.now();
    // wheel / touch interrupt Lenis' scrollTo natively; keep our flag true
    if (e.type === "wheel" || e.type === "touchstart") bus.flying = false;
  };
  const onKey = (e: KeyboardEvent) => {
    if (SCROLL_KEYS.has(e.key)) onInput(e);
  };
  const LISTEN = { passive: true, capture: true } as const;
  window.addEventListener("wheel", onInput, LISTEN);
  window.addEventListener("touchstart", onInput, LISTEN);
  window.addEventListener("touchmove", onInput, LISTEN);
  window.addEventListener("keydown", onKey, { capture: true });

  /* ── reveal / phase (G3) ─────────────────────────────────────── */
  ctx.onReveal(({ quiet }) => {
    revealed = true;
    revealTween?.kill();
    revealTween = gsap.to(root, {
      autoAlpha: 1,
      duration: quiet ? 0 : 0.35,
      delay: quiet ? 0 : GATEWAY_TIMING.G3.dockAt,
      ease: "rk-settle",
      overwrite: "auto",
    });
    stillSince = performance.now();
    lastMode = "hidden";
    if (quiet || onboardDone) {
      // quiet entry (queued "Ver planos", ?auth=plans): no onboarding,
      // the dock is simply there at R0
      toDocked();
      swapper.setNow(R0.verb);
    } else {
      enterArrival();
    }
  });
  ctx.onPhase((p) => {
    bus.phase = p;
    if (p !== "radar") revealTween?.kill();
    if (p === "gateway") revealed = false;
  });

  /* ── settle: 0 = pre-reveal (return home), 1 = Ch5 start (teleport) ─ */
  const reset = (to: 0 | 1) => {
    killUi();
    gsap.set(root, { autoAlpha: 0 });
    toDocked();
    if (to === 0) {
      revealed = false;
      onboardDone = false; // a return to the portal resets the onboarding
    } else {
      onboardDone = true;
    }
    for (const c of ["is-on-dark", "is-idle", "is-breathing"]) root.classList.remove(c);
    onDark = idleCls = breathing = flipped = false;
    gsap.set(chevRot, { rotation: 0 });
    gsap.set([chevBob, ringEl], { y: 0, scale: 1 });
    gsap.set(flashEl, { opacity: 0 });
    back = false;
    backSince = -1;
    bus.flying = false;
    stillSince = performance.now();
    nudgeKey = "";
    nudgeCount.clear();
    livePending = null;
    if (liveEl) liveEl.textContent = "";
    const vh = to === 1 ? MASTER_END : 0;
    segCur = segIndexAt(vh);
    segPrev = -1;
    transitVerb = to === 1 ? LAST_TRANSIT_VERB : FIRST_TRANSIT_VERB;
    swapper.setNow(to === 1 ? HANDOFF.verb : R0.verb);
    setStation(stationIndexAt(vh), 1, true);
    stackOp = 1;
    lastStackOp = lastRing = lastNeedle = lastFill = NaN;
    mode = lastMode = "hidden";
    lastRest = null;
  };
  ctx.settle.register(
    "guide.dock",
    { start: () => reset(0), end: () => reset(1) },
    ".lp-scrollcue, .cx-guide__card, .cx-guide__live",
  );

  /* ── dev probe (verification only) ───────────────────────────── */
  if (IS_DEV) {
    // slow-motion capture of time-based UI (gsap.globalTimeline.timeScale)
    (window as unknown as Record<string, unknown>).__cxGsap = gsap;
    (window as unknown as Record<string, unknown>).__cxGuide = () => ({
      vh: ctx.vh(),
      mode,
      verb: swapper.target(),
      shown: verbEl.textContent,
      ring: lastRing,
      onDark,
      station: STATIONS[stationIdx].name,
      idle: idleCls,
      back,
      flying: bus.flying,
      arrival,
      morphing,
      live: liveEl?.textContent ?? "",
      metrics: { ...metrics },
    });
  }

  ctx.onDestroy(() => {
    killUi();
    root.removeEventListener("click", onClick);
    offBlocked();
    window.removeEventListener("wheel", onInput, { capture: true });
    window.removeEventListener("touchstart", onInput, { capture: true });
    window.removeEventListener("touchmove", onInput, { capture: true });
    window.removeEventListener("keydown", onKey, { capture: true });
    if (IS_DEV) {
      delete (window as unknown as Record<string, unknown>).__cxGuide;
      delete (window as unknown as Record<string, unknown>).__cxGsap;
    }
  });
}
