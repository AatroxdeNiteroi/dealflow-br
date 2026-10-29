/* ============================================================
   cinema/guide/machine.ts — the dock state machine (§3; v3 spec rev 3.1
   §5.7, §7 E7/E8, §3 G3). Owner: WP8.

   The dock always says ONE of two things: what is happening now (a
   gerund, the ring filling) or what to do to continue (an imperative,
   the chevron breathing), and where you are on the five-station rail.

   Fed every frame (FrameOrder.Guide) by the FOLLOWED master vh and the
   playhead's velocity (ctx.playhead, §5.7 rule 9 — not lenis.velocity),
   idle time, phase and blocked(). Every verb is pre-rendered as glyph
   cells (GuideDock), so a swap writes only opacity / transform /
   visibility: 0 layouts (§9.2). Geometry is transform / clip-path /
   stroke-dashoffset only.

   States, resolved in this order:
     hidden    not revealed (gateway, entering, after a return)
     arrival   the onboarding card is up (first non-quiet entry)
     back      the playhead runs backwards (> 2 vh/s) → "voltando ·
               ⟨Estação⟩", ring drains, chevron flipped; wins over any
               lead or read window (§5.7 rule 4); ends 250 ms after the
               backward motion stops (at once on a forward push). A
               backward glide the user did not ask for (a snap settling
               into a plateau right after a forward wheel) is not "back".
     rest      inside a rest plateau AND landed (|v| < 2 vh/s, §6.4):
               imperative, full ring, gold flash + aria-live on arrival
     lead      §5.7 rules 2–3: the next rest's imperative + breathing
               chevron from its lead start (max(W(s(R) − 30), last act):
               345 / 645 / 856.5 / 1152.3 / 1375.5 / 1552 / 1783 on fine
               pointers) to its lead end (R1/R3/R5: the plateau end; the
               read windows D2/D4/D7/D9: the meter end 673 / 1186 / 1590
               / 1848), at any speed — the reader is told what to do
               while still scrolling. Ring = beat progress (v2 meaning).
     handoff   from the R7 lead end to 1900: "a seguir: os planos"
     transit   gerund of the sub-segment (6 vh hysteresis), ring =
               local progress between plateaus, .78 while moving
   Rules (§5.7): an imperative, once shown, stays ≥ 1.2 s unless the user
   reverses (rule 5); the reading meter (rule 6) shows inside a read
   window from its text-full mark to its meter end, m = (s − s(full)) /
   (s(end) − s(full)) on the followed playhead, fading 160 ms, reaching
   exactly 1 as the text leaves; no "continue rolando" inside a read
   window and the rest nudge waits 6 s there (rule 7); never blank (rule
   8: the previous verb stays until the next one pours in; inversion only
   changes colours). Modifiers: idleRest (1.6 s still at a rest / lead:
   verb emphasis + 2-bob chevron nudge), idleMid (1.2 s still mid-beat,
   outside read windows: "continue rolando" + ring pulse + nudge) —
   nudges repeat every 6 s, ≤ 3 per position; fling (|v| > 200 vh/s):
   .45 and verb swaps deferred; lifted (reducer).

   Also built here: the onboarding card + its clip-path morph into the
   pill (no scale, §3 G3), the verb glyph swapper (INK in 220 ms / 8 ms,
   EVAPORATE out 140 ms / 6 ms, §5.3 time variants) with the dock's
   visual width on a spring (ζ 0.6, ω 14 — compositor-side clip, §1.2),
   the rail on STATIONS_V3 (needle, gold fill, ticks, feathered reels),
   on-dark inversion at the (lifted) pill centre, aria-live, the
   dock-button scroll (timed in s-vh), the `?cx-perf` beat clock, and —
   one entry build per package — the reducer and snap.

   Root ownership: the dock ROOT's autoAlpha belongs to the reveal hook
   here (G3: 0.35 s after reveal, instant on a quiet entry) and, from
   Ch5 start, to Landing's cue-off trigger. Its `.is-cinema` class is the
   reducer's. Everything state-driven is written INSIDE the root (stack
   opacity, pill, rail), never on it.
   ============================================================ */

import gsap from "gsap";
import { FrameOrder, type CinemaCtx, type GuideSnapBus, type Rect } from "../types";
import {
  GATEWAY_TIMING,
  MARKS,
  MASTER_END,
  PLATEAU_HALF,
  REST_COUNT,
  RESTS,
  STATIONS_V3,
  VERB_HYSTERESIS,
  VERB_IDLE_MID,
  VERB_SEGMENTS,
  restAt,
  verbBack,
  type Rest,
} from "../beats";
import { ariaRestAnnouncement } from "../copy";
import { clamp, clamp01, damp } from "../geometry";
import { runtime } from "../runtime";
import { IS_DEV } from "../env";
import { FLAGS } from "../flags";
import { READ_WINDOWS, Winv, currentProfile, leadStart, meterAt, type DilationProfile, type Dwell } from "../dilation";
import { SPRINGS, Spring } from "../../three/springs";
import { cxPerf } from "../../three/gpuTimer";
import { DOCK_VERBS } from "./GuideDock";
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
  /** Desktop: px the corner CTA rises when the footer returns (1840–1880),
   *  so its bottom keeps footerH + 10 like the dock (QA D5); 0 on mobile. */
  ctaFootLift: number;
  /** 1 vh in px. */
  vhPx: number;
  mobile: boolean;
}

/** v3: the snap's fields (phase, flying, lastInputAt, lastDir) are frozen in
 *  types.ts (GuideSnapBus) so WP1 (snap.ts) and WP8 (this file) never edit
 *  each other's files. */
export interface GuideBus extends GuideSnapBus {
  metrics: GuideMetrics;
  /** Called after every refresh-time measurement. */
  onMeasured: Array<() => void>;
}

/* ── tuning (§5.7; velocities in master vh per second) ─────────── */

const T = {
  /** below this the playhead is still (transit opacity, idle timers) */
  moveVps: 2,
  /** §5.7 rule 4: the back verb wins while v < −2 vh/s */
  backVps: 2,
  /** §6.4: landed = on the plateau and |v| < 2 vh/s (×2.5 hysteresis once resting) */
  landVps: 2,
  /** v2's 30 px/frame at 60 Hz on a 900 px viewport */
  flingVps: 200,
  backHoldMs: 250,
  /** a forward user input this recent vetoes "back" for a glide the user did not make */
  fwdInputVetoMs: 1500,
  idleRestMs: 1600,
  /** §5.7 rule 7: inside a read window the rest nudge waits 6 s */
  idleRestReadMs: 6000,
  idleMidMs: 1200,
  nudgeEveryMs: 6000,
  nudgeMax: 3,
  announceEveryMs: 1500,
  dismissPx: 4,
  /** §5.7 rule 5 */
  impFloorMs: 1200,
  /** §5.7 rule 6 */
  meterFade: 0.16,
} as const;

/** §5.3 time variants for the dock verb (seconds). */
const SWAP = { inDur: 0.22, inStagger: 0.008, outDur: 0.14, outStagger: 0.006 } as const;

type Mode = "hidden" | "arrival" | "rest" | "lead" | "handoff" | "transit" | "back";

const SEG_N = VERB_SEGMENTS.length;
const HANDOFF = VERB_SEGMENTS[SEG_N - 1];
const R0 = RESTS[0];
const R0_END = R0.at + PLATEAU_HALF;
const FIRST_TRANSIT_VERB = VERB_SEGMENTS.find((s) => s.state === "transit")!.verb; // "mergulhando no campo"
const LAST_TRANSIT_VERB = [...VERB_SEGMENTS].reverse().find((s) => s.state === "transit")!.verb;
const PLATEAUS = RESTS.filter((r) => r.plateau !== null);
const IMPERATIVES = new Set(RESTS.map((r) => r.verb));
const STATIONS = STATIONS_V3;

/** Every string the verb line can show → slot width (a swap never resizes the pill). */
const VERB_CHARS = Math.max(...DOCK_VERBS.map((v) => [...v].length));
const verbIndex = (text: string): number => {
  const k = DOCK_VERBS.indexOf(text);
  return k >= 0 ? k : 0;
};

const segIndexAt = (vh: number): number => {
  for (let i = 0; i < SEG_N; i++) if (vh < VERB_SEGMENTS[i].to) return i;
  return SEG_N - 1;
};
/** Active station (STATIONS_V3: estimativa 1198, universo 1602 — after the
 *  previous close has evaporated, §2.1). Inside a rest plateau it is THAT
 *  rest's station, the same one the imperative and aria-live name. */
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

/** Rail needle 0..1 on STATIONS_V3: each chapter takes a quarter. */
function railProgressV3(vh: number): number {
  const n = STATIONS.length - 1;
  if (vh <= STATIONS[0].at) return 0;
  for (let i = 0; i < n; i++) {
    const a = STATIONS[i].at;
    const b = STATIONS[i + 1].at;
    if (vh < b) return (i + (vh - a) / (b - a)) / n;
  }
  return 1;
}

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

/* ── §5.7 leads: a rest's imperative from its lead start to its lead end ── */

interface Lead {
  rest: Rest;
  from: number;
  to: number;
  read: Dwell | null;
}
function buildLeads(p: DilationProfile): Lead[] {
  return PLATEAUS.map((r) => {
    const read = READ_WINDOWS.find((d) => d.rest === r.id) ?? null;
    return { rest: r, from: leadStart(r.id, p), to: read?.meterEnd ?? r.plateau![1], read };
  });
}

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Spacebar"]);
const BACK_KEYS = new Set(["ArrowUp", "PageUp", "Home"]);

/* ── verb swapper: every verb is a pre-rendered glyph layer ────────
   out = EVAPORATE (140 ms, 6 ms stagger from the end, cx-evap), in = INK
   (opacity cx-ink-bloom over 1/1.6 of 220 ms, y / skew / rotate cx-ink-settle
   over 220 ms, 8 ms stagger in reading order), the in starting as the out's
   last glyphs fade (85 % of it): there is always ink on the pill (§5.7 rule
   8) and the two lines never garble each other.
   Interruptible: every layer animates from its current values, a request
   back to the verb on its way out simply pours it back in. ─────── */

interface Layer {
  el: HTMLElement;
  glyphs: HTMLElement[];
  tl: gsap.core.Timeline | null;
  state: "hidden" | "in" | "shown" | "out";
  touched: boolean;
}

interface Swapper {
  /** Ask for a verb; returns true when it starts a swap. */
  request(text: string): boolean;
  setNow(text: string): void;
  /** The verb shown or pouring in. */
  target(): string;
  targetIndex(): number;
  /** Seconds the current out needs before the line is mostly free (width spring delay). */
  outLead(): number;
  /** Seconds from the last request until the new verb starts pouring in. */
  inDelay(): number;
  setFontPx(px: number, mobile: boolean): void;
  kill(): void;
}

function createSwapper(slot: HTMLElement): Swapper {
  const layers: Layer[] = Array.from(slot.querySelectorAll<HTMLElement>(".cx-guide__vv")).map((el) => ({
    el,
    glyphs: Array.from(el.querySelectorAll<HTMLElement>(".cx-guide__vg")),
    tl: null,
    state: "hidden",
    touched: false,
  }));
  let targetK = 0;
  let fontPx = 10;
  let mobile = false;
  // seeded ±3° per glyph (the INK grammar's ρ_g), stable per verb and position
  const rho = (k: number, j: number): number => {
    const s = Math.sin((k + 1) * 12.9898 + (j + 1) * 78.233) * 43758.5453;
    return ((s - Math.floor(s)) * 2 - 1) * 3;
  };
  const show = (L: Layer, on: boolean) => {
    L.el.style.visibility = on ? "inherit" : "hidden";
  };
  layers.forEach((L, k) => {
    L.el.classList.remove("is-shown");
    show(L, k === 0);
    L.state = k === 0 ? "shown" : "hidden";
  });
  // Warm GSAP's transform cache for every glyph at build (one style read here,
  // behind the Gateway): the first tween on an uncached element parses its
  // computed transform, which forces a layout — measured: 2 layouts on the
  // first swap to each verb without this, 0 with it (§9.2 "0 layouts per swap").
  // Identity values only: nothing moves.
  const IDENTITY = { opacity: 1, y: 0, skewX: 0, rotation: 0, transformOrigin: "0% 100%" } as const;
  gsap.set(
    layers.flatMap((L) => L.glyphs),
    IDENTITY,
  );
  let lastOutTotal = 0;
  let lastInDelay = 0;

  const out = (L: Layer) => {
    L.tl?.kill();
    L.touched = true;
    L.state = "out";
    const n = L.glyphs.length;
    lastOutTotal = SWAP.outDur + SWAP.outStagger * Math.max(0, n - 1);
    L.tl = gsap.timeline({
      onComplete: () => {
        L.tl = null;
        L.state = "hidden";
        show(L, false);
      },
    });
    L.tl.to(L.glyphs, {
      opacity: 0,
      y: -0.22 * fontPx,
      duration: SWAP.outDur,
      ease: "cx-evap",
      stagger: { each: SWAP.outStagger, from: "end" },
      overwrite: "auto",
    });
  };

  const inn = (L: Layer, k: number, delay: number) => {
    L.tl?.kill();
    const fromHidden = L.state === "hidden";
    L.touched = true;
    L.state = "in";
    show(L, true);
    const tl = gsap.timeline({
      delay,
      onComplete: () => {
        L.tl = null;
        L.state = "shown";
      },
    });
    const g = L.glyphs;
    const dOp = SWAP.inDur / 1.6; // opacity = bloom(min(1, q·1.6))
    if (fromHidden) {
      tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: dOp, ease: "cx-ink-bloom", stagger: SWAP.inStagger, immediateRender: true }, 0);
      tl.fromTo(
        g,
        {
          y: 0.32 * fontPx,
          skewX: mobile ? 0 : -7,
          rotation: mobile ? 0 : (j: number) => rho(k, j),
          transformOrigin: "0% 100%",
        },
        { y: 0, skewX: 0, rotation: 0, duration: SWAP.inDur, ease: "cx-ink-settle", stagger: SWAP.inStagger, immediateRender: true },
        0,
      );
    } else {
      tl.to(g, { opacity: 1, duration: dOp, ease: "cx-ink-bloom", stagger: SWAP.inStagger, overwrite: "auto" }, 0);
      tl.to(g, { y: 0, skewX: 0, rotation: 0, duration: SWAP.inDur, ease: "cx-ink-settle", stagger: SWAP.inStagger }, 0);
    }
    L.tl = tl;
  };

  return {
    request(text) {
      const k = verbIndex(text);
      if (k === targetK) return false;
      targetK = k;
      let outing = false;
      layers.forEach((L, j) => {
        if (j !== k && (L.state === "shown" || L.state === "in")) {
          out(L);
          outing = true;
        } else if (j !== k && L.state === "out") outing = true;
      });
      // the new verb pours in as the old one's last glyphs evaporate: there is
      // always ink on the pill (never blank), and the two centred lines never
      // read on top of each other (the old line dissolves from its end, so its
      // first glyphs — where the new line starts pouring — go last; measured:
      // starting at ½ of the out garbled "ROLE CERCANDO" for ~100 ms)
      lastInDelay = outing ? clamp(0.85 * lastOutTotal, 0.1, 0.26) : 0;
      inn(layers[k], k, lastInDelay);
      return true;
    },
    setNow(text) {
      const k = verbIndex(text);
      targetK = k;
      layers.forEach((L, j) => {
        L.tl?.kill();
        L.tl = null;
        if (L.touched) {
          // back to identity (not clearProps: that would drop the warm cache)
          gsap.set(L.glyphs, IDENTITY);
          L.touched = false;
        }
        L.state = j === k ? "shown" : "hidden";
        show(L, j === k);
      });
    },
    target: () => DOCK_VERBS[targetK],
    targetIndex: () => targetK,
    outLead: () => lastOutTotal,
    inDelay: () => lastInDelay,
    setFontPx(px, m) {
      fontPx = px;
      mobile = m;
    },
    kill() {
      layers.forEach((L) => {
        L.tl?.kill();
        L.tl = null;
      });
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
    metrics: { pillX: 0, pillY: 0, railW: 0, ctaLift: 0, footLift: 0, ctaFootLift: 0, vhPx: window.innerHeight / 100, mobile: ctx.isMobile },
    onMeasured: [],
  };
  // one entry build per package: the reducer and the snap are built here
  buildReducer(ctx, bus);
  buildSnap(ctx, bus);
  // ?cx-perf: the per-beat GPU / frame log reads the followed vh and the phase
  cxPerf?.attach(
    () => ctx.vh(),
    () => bus.phase,
  );

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
  const pillShape = q(".cx-guide__pill-shape");
  const pillIn = q(".cx-guide__pill-in");
  const ringEl = q(".cx-guide__ring");
  const arc = q<SVGCircleElement>(".cx-guide__ring-arc");
  const flashEl = q<SVGCircleElement>(".cx-guide__ring-flash");
  const chevBob = q(".cx-guide__chev-bob");
  const chevRot = q(".cx-guide__chev-rot");
  const verbSlot = q(".cx-guide__verb");
  const meterEl = q(".cx-guide__meter");
  const meterFill = q(".cx-guide__meter-fill");
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
  const cardShape = q(".cx-guide__card-shape", card);
  const cardEdge = q(".cx-guide__card-edge", card);
  const cardBg = q(".cx-guide__card-bg", card);
  const cardBody = q(".cx-guide__card-body", card);
  const cardWords = qa(".cx-guide__cw", card);

  root.style.setProperty("--cx-verb-chars", String(VERB_CHARS));
  if (IS_DEV) {
    const long = DOCK_VERBS.filter((v) => [...v].length > 30);
    if (long.length) console.warn("[cinema/guide] verbs over 30 characters:", long);
  }

  const swapper = createSwapper(verbSlot);
  const setStackOp = gsap.quickSetter(stack, "opacity") as (v: number) => void;
  const setNeedleX = gsap.quickSetter(needle, "x", "px") as (v: number) => void;
  const setFill = gsap.quickSetter(railFill, "scaleX") as (v: number) => void;
  const setRingX = gsap.quickSetter(ringEl, "x", "px") as (v: number) => void;
  const setMeterX = gsap.quickSetter(meterFill, "x", "px") as (v: number) => void;

  /* ── §5.7 leads (per dilation profile) ─────────────────────── */
  let profile: DilationProfile = currentProfile();
  let leads = buildLeads(profile);
  const leadAt = (vh: number): Lead | null => {
    for (const l of leads) if (vh >= l.from && vh <= l.to) return l;
    return null;
  };

  /* ── dock width spring (§1.2: compositor only) ─────────────── */
  // Δ_k = (slot width − verb k's ink width) / 2: the clip inset on each side
  // of the stadium; the ring rides the left edge by the same Δ.
  let deltas: number[] = DOCK_VERBS.map(() => 0);
  let pillW = 0;
  let pillH = 32;
  const width = new Spring(SPRINGS.dockWidth, 0);
  let widthTarget = 0;
  let widthPending: { at: number; to: number } | null = null;
  let lastD = NaN;
  const writeWidth = (d: number) => {
    const v = Math.max(0, Math.round(d * 10) / 10);
    if (v === lastD) return;
    lastD = v;
    pillShape.style.setProperty("--cx-dock-d", `${v}px`);
    setRingX(v);
  };
  /** Aim the spring at verb k: wider at once (the new verb must fit as it
   *  pours), narrower once the old verb has mostly evaporated. */
  const aimWidth = (k: number, now: number, immediate = false) => {
    const to = deltas[k] ?? 0;
    if (immediate) {
      widthPending = null;
      widthTarget = to;
      width.reset(to);
      writeWidth(to);
      return;
    }
    if (to <= widthTarget) {
      widthPending = null;
      widthTarget = to;
    } else widthPending = { at: now + 600 * swapper.outLead(), to };
  };

  /* ── reading meter (§5.7 rule 6) ───────────────────────────── */
  let meterOn = false;
  let meterM = 0;
  let meterWin: Dwell | null = null;
  let meterTween: gsap.core.Tween | null = null;
  let lastMeterX = NaN;
  const showMeter = (on: boolean, instant = false) => {
    if (on === meterOn) return;
    meterOn = on;
    meterTween?.kill();
    meterTween = instant
      ? (gsap.set(meterEl, { autoAlpha: on ? 1 : 0 }), null)
      : gsap.to(meterEl, { autoAlpha: on ? 1 : 0, duration: T.meterFade, ease: "cx-flow", overwrite: "auto" });
  };
  const writeMeter = (m: number, d: number) => {
    // the fill's round front travels from the stadium's left end (m 0) to its right end (m 1)
    const x = Math.round((d - (pillW + pillH) + m * (pillW - 2 * d)) * 4) / 4;
    if (x === lastMeterX) return;
    lastMeterX = x;
    setMeterX(x);
  };

  /* ── refresh-time measurement (never per frame) ─────────────── */
  const metrics = bus.metrics;
  let cardRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  let cardClip = "";
  let cardClipIn = "";
  // the two clip boxes inside the card ∪ pill shape: [top, right, bottom, left, R]
  let cardIns: number[] | null = null;
  let pillIns: number[] | null = null;
  const inset = (t: number, r: number, b: number, l: number, R: number) =>
    `inset(${t.toFixed(2)}px ${r.toFixed(2)}px ${b.toFixed(2)}px ${l.toFixed(2)}px round ${Math.max(0, R).toFixed(2)}px)`;
  /** The morph's clip at progress p: the box AND the radius interpolate, so
   *  every frame is one rounded rect with circular corners (R 18 → h/2). The
   *  strings are written here (not tweened by GSAP: the browser normalises
   *  `inset(0 0 80px 0 …)` to fewer numbers than the target, and a complex-
   *  string tween with mismatched numbers never interpolates). */
  const writeMorphClip = (p: number) => {
    if (!cardIns || !pillIns) return;
    const v = cardIns.map((a, i) => a + (pillIns![i] - a) * p);
    cardEdge.style.clipPath = inset(v[0], v[1], v[2], v[3], v[4]);
    cardBg.style.clipPath = inset(v[0] + 1, v[1] + 1, v[2] + 1, v[3] + 1, v[4] - 1);
  };

  const measure = (): Rect => {
    const mobile = window.matchMedia("(max-width: 720px)").matches;
    // the root is never transformed (lift lives inside it), so its box
    // and the pill's offsets are the untransformed slot
    const rr = root.getBoundingClientRect();
    const top = rr.top + pill.offsetTop;
    const left = rr.left + pill.offsetLeft;
    pillW = pill.offsetWidth;
    pillH = pill.offsetHeight || 32;
    metrics.pillX = rr.left + rr.width / 2;
    metrics.pillY = top + pillH / 2;
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
      metrics.ctaFootLift = 0; // §3.11: the mobile CTA row is unchanged
    } else {
      metrics.ctaLift = 0;
      metrics.footLift = footerH + 10;
      const cta = document.querySelector<HTMLElement>(".lp-cta");
      const ctaBottom = cta ? parseFloat(getComputedStyle(cta).bottom) || 0 : 0;
      metrics.ctaFootLift = cta ? Math.max(0, footerH + 10 - ctaBottom) : 0;
    }

    // verb ink widths (one layout for all: Range rects of every layer)
    const slotW = verbSlot.offsetWidth;
    const fontPx = parseFloat(getComputedStyle(verbSlot).fontSize) || 10;
    swapper.setFontPx(fontPx, mobile);
    const range = document.createRange();
    deltas = qa(".cx-guide__vv", verbSlot).map((el) => {
      range.selectNodeContents(el);
      const w = range.getBoundingClientRect().width;
      return Math.max(0, (slotW - w) / 2);
    });
    range.detach?.();
    // the slot's own pill: the ring + gap + paddings are fixed (14 + 22 + 10 … 14)
    widthPending = null;
    widthTarget = deltas[swapper.targetIndex()] ?? 0;
    width.reset(widthTarget);
    lastD = NaN;
    writeWidth(widthTarget);
    lastMeterX = NaN;

    // §3 G3: the onboarding card's shape is sized ONCE to card ∪ pill; the
    // morph is then a clip-path tween between the two rects (no scale)
    const cr = card.getBoundingClientRect();
    const cy = Number(gsap.getProperty(card, "y")) || 0;
    const C: Rect = { x: cr.left, y: cr.top - cy, w: cr.width, h: cr.height };
    const d0 = deltas[verbIndex(FIRST_TRANSIT_VERB)] ?? 0;
    const P: Rect = { x: left + d0, y: top, w: Math.max(pillH, pillW - 2 * d0), h: pillH };
    const ux = Math.min(C.x, P.x);
    const uy = Math.min(C.y, P.y);
    const ur = Math.max(C.x + C.w, P.x + P.w);
    const ub = Math.max(C.y + C.h, P.y + P.h);
    cardShape.style.left = `${(ux - C.x).toFixed(2)}px`;
    cardShape.style.top = `${(uy - C.y).toFixed(2)}px`;
    cardShape.style.width = `${(ur - ux).toFixed(2)}px`;
    cardShape.style.height = `${(ub - uy).toFixed(2)}px`;
    const R = parseFloat(getComputedStyle(cardEdge).getPropertyValue("--lq-panel")) || (mobile ? 14 : 18);
    const ct = C.y - uy, crt = ur - (C.x + C.w), cb = ub - (C.y + C.h), cl = C.x - ux;
    const pt = P.y - uy, prt = ur - (P.x + P.w), pb = ub - (P.y + P.h), pl = P.x - ux;
    cardIns = [ct, crt, cb, cl, R];
    pillIns = [pt, prt, pb, pl, pillH / 2];
    cardClip = inset(ct, crt, cb, cl, R);
    cardClipIn = inset(ct + 1, crt + 1, cb + 1, cl + 1, R - 1);
    if (!morphing) {
      cardEdge.style.clipPath = cardClip;
      cardBg.style.clipPath = cardClipIn;
    }
    cardRect = C;

    // the dilation profile may have flipped (hybrid devices): re-derive the leads
    const p = currentProfile();
    if (p !== profile) {
      profile = p;
      leads = buildLeads(p);
    }

    bus.onMeasured.forEach((fn) => fn());
    lastNeedle = lastFill = NaN;
    return { x: rr.left, y: top, w: rr.width, h: pillH };
  };
  ctx.rects.register("guide.pill", measure);
  // §3 G3: the onboarding card is a no-go zone for echo chips (WP6). The rect is
  // the card's untransformed box; `guide.onboardingUp` says whether it is up.
  ctx.rects.register("guide.onboarding", () => ({ ...cardRect }));
  ctx.live.provide("guide.onboardingUp", () => arrival || morphing);

  /* ── visual states ────────────────────────────────────────────── */
  let revealTween: gsap.core.Tween | null = null;
  let cardTween: gsap.core.Timeline | null = null;
  let morphTl: gsap.core.Timeline | null = null;
  let nudgeTl: gsap.core.Timeline | null = null;
  let flashTl: gsap.core.Timeline | null = null;

  const railParts = [railFill, needle, ...ticks, ...labels];
  const setPill = (on: boolean) => {
    gsap.set([pillShape, pillIn], { autoAlpha: on ? 1 : 0, y: 0, clearProps: "filter" });
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

  const resetCardShape = () => {
    gsap.set([cardEdge, cardBg], { clearProps: "backgroundColor" });
    if (cardClip) {
      cardEdge.style.clipPath = cardClip;
      cardBg.style.clipPath = cardClipIn;
    }
    gsap.set(cardBody, { clearProps: "all" });
    gsap.set(cardWords, { clearProps: "opacity,transform" });
  };

  const killUi = () => {
    revealTween?.kill();
    cardTween?.kill();
    morphTl?.kill();
    nudgeTl?.kill();
    flashTl?.kill();
    meterTween?.kill();
    revealTween = cardTween = morphTl = nudgeTl = flashTl = meterTween = null;
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
  let lead: Lead | null = null;
  let segCur = 0;
  let segPrev = -1;
  let segBoundary = 0;
  let transitVerb = FIRST_TRANSIT_VERB;
  let back = false;
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
  // playhead velocity (vh/s, signed): ctx.playhead.velocity(); while it reads
  // exactly 0 but the followed vh moves (the WP0 identity follower is never
  // stepped), the damped frame derivative stands in
  let prevVh = Number.NaN;
  let vEst = 0;
  let vps = 0;
  // §5.7 rule 5: when the shown imperative was first asked for
  let impSince = -1e9;
  // last user input direction (wheel / touch / keys): +1 forward, −1 back
  let inputDir = 0;
  let inputDirAt = -1e9;
  let touchY = NaN;

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

  /* station (rail labels = odometer reels rolling in the travel direction,
     through feathered windows; cx-flow) */
  const REEL_OFF_TOP = 0;
  const REEL_ON = -100 / 3;
  const REEL_OFF_BOTTOM = -200 / 3;
  const REEL = { duration: 0.3, ease: "cx-flow" } as const;
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
        gsap.fromTo(reel, { yPercent: dir > 0 ? REEL_OFF_TOP : REEL_OFF_BOTTOM }, { yPercent: REEL_ON, ...REEL, overwrite: true });
      } else if (!on && was) {
        gsap.to(reel, { yPercent: dir > 0 ? REEL_OFF_BOTTOM : REEL_OFF_TOP, ...REEL, overwrite: true });
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
      gsap.fromTo(inn, { yPercent: dir > 0 ? 100 : -100 }, { yPercent: 0, ...REEL, overwrite: true });
      gsap.to(out, { yPercent: dir > 0 ? -100 : 100, ...REEL, overwrite: true });
      mSlot = 1 - mSlot;
    }
    stationIdx = next;
  };
  setStation(0, 1, true);

  /* ── onboarding (§3.5; v3 §3 G3) ─────────────────────────────── */
  const toDocked = () => {
    arrival = false;
    morphing = false;
    root.classList.remove("is-arrival");
    gsap.set(card, { autoAlpha: 0, y: 0 });
    resetCardShape();
    setPill(true);
    railDocked();
  };

  const enterArrival = () => {
    arrival = true;
    onboardDone = false;
    root.classList.add("is-arrival");
    setPill(false);
    railHidden();
    resetCardShape();
    gsap.set(card, { autoAlpha: 0, y: 10 });
    // G3: the LAST beat of the wake, ~0.5 s after the radar opens — the plate
    // condenses (cx-pour), its words pour in (INK time variant, 300 ms)
    const at = GATEWAY_TIMING.G3.onboardingAt;
    cardTween = gsap
      .timeline({ delay: at })
      .to(card, { autoAlpha: 1, duration: 0.3, ease: "cx-flow" }, 0)
      .to(card, { y: 0, duration: 0.42, ease: "cx-pour" }, 0)
      .fromTo(cardWords, { opacity: 0 }, { opacity: 1, duration: 0.3 / 1.6, ease: "cx-ink-bloom", stagger: 0.06 }, 0.08)
      .fromTo(
        cardWords,
        { y: 6, skewX: ctx.isMobile ? 0 : -4 },
        { y: 0, skewX: 0, duration: 0.3, ease: "cx-ink-settle", stagger: 0.06 },
        0.08,
      );
    scrollAcc = 0;
    lastScroll = runtime.lenis()?.scroll ?? window.scrollY;
    transitVerb = FIRST_TRANSIT_VERB;
    swapper.setNow(FIRST_TRANSIT_VERB);
    aimWidth(verbIndex(FIRST_TRANSIT_VERB), performance.now(), true);
  };

  /** Card → pill (§3 G3): the card's two fills animate their clip-path from the
   *  card rect (R 18) to the pill's rect (R h/2) inside the union box — no
   *  scale, so every corner stays a circle — while paper turns to the pill's
   *  colour; the card text evaporates first (160 ms), the pill's ring + verb
   *  arrive as it lands; the rail draws. */
  const morph = () => {
    morphing = true;
    const toBg = getComputedStyle(q(".cx-guide__pill-bg")).backgroundColor;
    const toEdge = getComputedStyle(q(".cx-guide__pill-edge")).backgroundColor;
    const tl = gsap.timeline({
      onComplete: () => {
        morphing = false;
        morphTl = null;
      },
    });
    tl.to(cardBody, { autoAlpha: 0, y: -6, duration: 0.16, ease: "cx-evap" }, 0);
    // the plate starts to flow once the text has mostly left it (rk-glide
    // leaves fast: starting together exposed the card text off its plate for
    // ~60 ms on 390 px, measured), so no text ever sits on the bare field
    const D = 0.1;
    if (cardIns && pillIns) {
      const m = { p: 0 };
      writeMorphClip(0);
      tl.to(m, { p: 1, duration: 0.45, ease: "rk-glide", onUpdate: () => writeMorphClip(m.p) }, D);
    }
    // paper holds while the card text dissolves, then the pill's colour fills
    // the shape as it lands (a straight 450 ms blend would sit in muddy greys)
    tl.to(cardBg, { backgroundColor: toBg, duration: 0.28, ease: "rk-io" }, D + 0.04);
    tl.to(cardEdge, { backgroundColor: toEdge, duration: 0.28, ease: "rk-io" }, D + 0.04);
    tl.fromTo(pillIn, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.22, ease: "cx-ink-settle" }, D + 0.2);
    // the landing frame: identical stadium → swap to the real pill
    tl.add(() => {
      gsap.set(pillShape, { autoAlpha: 1 });
      gsap.set(card, { autoAlpha: 0 });
      resetCardShape();
    }, D + 0.45);
    tl.add(railIn(), D + 0.3);
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
    aimWidth(verbIndex(FIRST_TRANSIT_VERB), performance.now(), true);
    if (shown < 0.35) {
      // the card never really landed: let it go, bring the docked pill in
      gsap.to(card, { autoAlpha: 0, duration: 0.14, ease: "cx-evap" });
      morphing = true;
      morphTl = gsap
        .timeline({
          onComplete: () => {
            morphing = false;
            morphTl = null;
            resetCardShape();
          },
        })
        .fromTo(pillShape, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "cx-flow" }, 0)
        .fromTo(pillIn, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "cx-ink-settle" }, 0.04)
        .add(railIn(), 0.1);
      return;
    }
    gsap.set(card, { autoAlpha: 1, y: 0 });
    gsap.set(cardWords, { opacity: 1, y: 0, skewX: 0 });
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
    gsap.to(chevBob, { y: 0, duration: 0.2, ease: "rk-settle", overwrite: "auto" });
    gsap.to(ringEl, { scale: 1, duration: 0.2, ease: "rk-settle", overwrite: "auto" });
  };
  const announce = (r: Rest) => {
    livePending = r;
  };

  /* ── the frame ───────────────────────────────────────────────── */
  ctx.frame.add(FrameOrder.Guide, (vh, _t, dt) => {
    const now = performance.now();
    const lenis = runtime.lenis();

    // §5.7 rule 9: the playhead's velocity, not lenis.velocity
    const pv = ctx.playhead.velocity();
    const dv = Number.isFinite(prevVh) ? vh - prevVh : 0;
    if (pv !== 0) {
      vps = pv;
      vEst = pv;
    } else if (Math.abs(dv) > 60 || !(dt > 0)) {
      vEst = 0; // a jump / settle / first frame: not a motion
      vps = 0;
      // the 1.2 s floor protects an imperative being read, never a stale one
      // after a jump (teleport, scrollbar drag, deep link)
      if (Math.abs(dv) > 60) impSince = -1e9;
    } else {
      vEst = damp(vEst, dv / dt, dv === 0 ? 10 : 18, dt);
      if (Math.abs(vEst) < 0.05) vEst = 0;
      vps = vEst;
    }
    prevVh = vh;
    const speed = Math.abs(vps);
    if (speed > 0.5) bus.lastDir = vps > 0 ? 1 : -1;

    // a dock flight that Lenis finished or a gesture cut short
    if (bus.flying && lenis && !lenis.isScrolling && now - flyStart > 150) bus.flying = false;

    // onboarding: dismissed by ≥ 4 px of REAL scroll (not the playhead)
    if (arrival && lenis) {
      const s = lenis.scroll;
      scrollAcc += Math.abs(s - lastScroll);
      lastScroll = s;
      if (scrollAcc >= T.dismissPx) dismiss();
    }

    const moving = speed > T.moveVps || bus.flying;
    const fwdVeto = inputDir > 0 && now - inputDirAt < T.fwdInputVetoMs && !bus.flying;
    const goingBack = vps < -T.backVps && !fwdVeto;
    const goingFwd = vps > T.backVps;
    if (goingBack) {
      back = true;
      backLast = now;
    } else if (back && (goingFwd || now - backLast > T.backHoldMs)) back = false;

    if (moving) stillSince = now;
    const idleFor = now - Math.max(stillSince, bus.lastInputAt);

    resolveSeg(vh, speed < 0.5);
    const seg = VERB_SEGMENTS[segCur];
    if (seg.state === "transit") transitVerb = seg.verb;

    const rest = restAt(vh);
    // landing has hysteresis: once resting, a slow drift inside the same
    // plateau never flickers the imperative off and on
    const landed = rest !== null && (speed < T.landVps || (lastMode === "rest" && lastRest === rest && speed < T.landVps * 2.5));
    const inRead = ctx.playhead.readWindow(vh);
    const readHold = inRead !== null && inRead.read ? inRead : null;
    lead = FLAGS.DOCK_LEAD ? leadAt(vh) : null;
    if (!revealed || bus.phase !== "radar") mode = "hidden";
    else if (arrival) mode = "arrival";
    else if (back) mode = "back";
    else if (landed) mode = "rest";
    else if (lead) mode = "lead";
    else if (vh >= HANDOFF.from) mode = "handoff";
    else mode = "transit";

    const restLike = mode === "rest" || mode === "handoff" || mode === "lead";
    const idleRest = restLike && idleFor >= (readHold ? T.idleRestReadMs : T.idleRestMs);
    // §5.7 rule 7: never "continue rolando" while a reader pauses on text
    const idleMid = mode === "transit" && !readHold && idleFor >= T.idleMidMs;
    // a fling is the user's own throw; a dock flight is the dock narrating
    // the trip it was asked for, so it keeps talking at full voice
    const fling = speed > T.flingVps && !bus.flying;

    // verb (swapped only when it changes; deferred during a fling and while
    // the onboarding morph owns the pill)
    if (mode !== "hidden" && mode !== "arrival" && !morphing && !fling) {
      let verb: string;
      if (mode === "rest") verb = rest!.verb;
      else if (mode === "lead") verb = lead!.rest.verb;
      else if (mode === "handoff") verb = HANDOFF.verb;
      else if (mode === "back") verb = verbBack(STATIONS[stationIndexAt(vh)]);
      else verb = idleMid ? VERB_IDLE_MID : transitVerb;
      // §5.7 rule 5: an imperative stays ≥ 1.2 s unless the user reverses
      // (another rest's imperative — the newer instruction — replaces it at once)
      const shown = swapper.target();
      if (
        verb !== shown &&
        mode !== "back" &&
        IMPERATIVES.has(shown) &&
        !IMPERATIVES.has(verb) &&
        now - impSince < T.impFloorMs
      )
        verb = shown;
      if (swapper.request(verb)) {
        // the floor counts from the imperative's first ink, not from the request
        if (IMPERATIVES.has(verb)) impSince = now + 1000 * swapper.inDelay();
        aimWidth(swapper.targetIndex(), now);
      }
    }

    // the dock's visual width (spring on the compositor-side clip)
    if (widthPending && now >= widthPending.at) {
      widthTarget = widthPending.to;
      widthPending = null;
    }
    writeWidth(width.step(widthTarget, dt));

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

    // ring: full at rest / handoff, local beat progress otherwise (drains back)
    const ring = mode === "rest" || mode === "handoff" ? 1 : ringAt(vh);
    if (!(Math.abs(ring - lastRing) < 5e-4)) {
      arc.style.strokeDashoffset = String(1 - ring);
      lastRing = ring;
    }

    // §5.7 rule 6: the reading meter, on the followed playhead in s-vh
    if (FLAGS.DOCK_METER && mode !== "hidden" && mode !== "arrival") {
      const d = readHold;
      if (d && d.full !== undefined && d.meterEnd !== undefined && vh >= d.full && vh <= d.meterEnd) {
        meterWin = d;
        meterM = meterAt(d, Winv(vh, profile), profile) ?? meterM;
        showMeter(true);
      } else if (meterOn && meterWin) {
        // leaving: forward it ends exactly full, backward exactly empty
        meterM = vh > meterWin.meterEnd! ? 1 : vh < meterWin.full! ? 0 : meterM;
        showMeter(false);
      }
      if (meterOn || meterTween?.isActive()) writeMeter(meterM, Math.max(0, Number.isFinite(lastD) ? lastD : 0));
    } else if (meterOn) showMeter(false, mode === "hidden");

    // stack opacity: .78 while moving in transit / back, .45 on a fling
    let op = 1;
    if (mode === "transit") op = speed > T.moveVps ? 0.78 : 1;
    else if (mode === "back") op = 0.78;
    if (fling && mode !== "arrival") op = 0.45;
    stackOp = mode === "hidden" ? op : damp(stackOp, op, 14, dt);
    if (!(Math.abs(stackOp - lastStackOp) < 2e-3)) {
      setStackOp(stackOp);
      lastStackOp = stackOp;
    }

    // chevron: breathes at rest / lead, frozen in transit, flipped going back
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
      const key = idleRest ? (rest ? rest.id : lead ? "L" + lead.rest.id : "handoff") : "m" + Math.round(vh);
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

    // rail: needle + gold fill (piecewise quarters on STATIONS_V3), stations
    const p = railProgressV3(vh);
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

    // on-dark inversion at the pill centre (at its lifted position); colours
    // only — the CSS cross-fades them together over 220 ms (cx-flow)
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
        liveEl.textContent = liveFlip ? text : text + " ";
        liveAt = now;
      }
    }

    lastMode = mode;
    lastRest = mode === "rest" ? rest : null;
  });

  /* ── the dock is a button (§3.9) ─────────────────────────────── */
  const nextTarget = (vh: number): { px: number; ds: number } | null => {
    const lenis = runtime.lenis();
    if (!lenis) return null;
    const vhPx = Math.max(metrics.vhPx, 1e-3);
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
      return { px, ds: Math.abs(px - lenis.scroll) / vhPx };
    }
    for (const r of PLATEAUS) {
      if (r.plateau![0] > vh) {
        const px = ctx.vhToPx(r.at);
        // §5.7 rule 9: timed by the SCROLL distance (s-vh), so a flight across
        // a dilated window is not rushed
        return { px, ds: Math.abs(px - lenis.scroll) / vhPx };
      }
    }
    return null;
  };

  const onClick = () => {
    if (arrival || bus.phase !== "radar" || runtime.blocked()) return;
    const lenis = runtime.lenis();
    if (!lenis || lenis.isStopped) return;
    const tgt = nextTarget(ctx.vh());
    if (!tgt) return;
    const duration = clamp((tgt.ds / 100) * 0.8, 0.5, 1.6);
    bus.flying = true;
    flyStart = performance.now();
    bus.lastInputAt = flyStart;
    inputDir = 1;
    inputDirAt = flyStart;
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

  /* ── input: idle timers, direction, interrupting a dock flight ── */
  const setDir = (d: number) => {
    if (!d) return;
    inputDir = d > 0 ? 1 : -1;
    inputDirAt = performance.now();
  };
  const onInput = (e: Event) => {
    bus.lastInputAt = performance.now();
    if (e.type === "wheel") setDir((e as WheelEvent).deltaY);
    else if (e.type === "touchstart") touchY = (e as TouchEvent).touches[0]?.clientY ?? NaN;
    else if (e.type === "touchmove") {
      const y = (e as TouchEvent).touches[0]?.clientY ?? NaN;
      if (Number.isFinite(touchY) && Number.isFinite(y) && Math.abs(touchY - y) > 2) setDir(touchY - y);
      touchY = y;
    }
    // wheel / touch interrupt Lenis' scrollTo natively; keep our flag true
    if (e.type === "wheel" || e.type === "touchstart") bus.flying = false;
  };
  const onKey = (e: KeyboardEvent) => {
    if (!SCROLL_KEYS.has(e.key)) return;
    onInput(e);
    setDir(BACK_KEYS.has(e.key) || (e.key === " " && e.shiftKey) ? -1 : 1);
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
      aimWidth(verbIndex(R0.verb), performance.now(), true);
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
    backLast = -1e9;
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
    const verb = to === 1 ? HANDOFF.verb : R0.verb;
    swapper.setNow(verb);
    aimWidth(verbIndex(verb), performance.now(), true);
    impSince = -1e9;
    meterOn = true;
    showMeter(false, true);
    meterWin = null;
    meterM = 0;
    lead = null;
    prevVh = Number.NaN;
    vEst = vps = 0;
    inputDir = 0;
    setStation(stationIndexAt(vh), 1, true);
    stackOp = 1;
    lastStackOp = lastRing = lastNeedle = lastFill = lastMeterX = NaN;
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
      shown: swapper.target(),
      lead: lead ? { rest: lead.rest.id, from: lead.from, to: lead.to } : null,
      ring: lastRing,
      meter: meterOn ? meterM : null,
      meterOn,
      meterWin: meterWin ? meterWin.id : null,
      widthDelta: lastD,
      velocity: vps,
      onDark,
      station: STATIONS[stationIdx].name,
      idle: idleCls,
      back,
      flying: bus.flying,
      arrival,
      morphing,
      cinema: root.classList.contains("is-cinema"),
      live: liveEl?.textContent ?? "",
      leads: leads.map((l) => ({ rest: l.rest.id, from: Math.round(l.from * 10) / 10, to: l.to })),
      metrics: { ...metrics },
    });
    // QA (§11 item 40 "0 layouts during a verb swap"): force one swap now
    (window as unknown as Record<string, unknown>).__cxGuideSwap = (text: string) => {
      if (swapper.request(text)) aimWidth(swapper.targetIndex(), performance.now());
      return swapper.target();
    };
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
      delete (window as unknown as Record<string, unknown>).__cxGuideSwap;
    }
  });
}
