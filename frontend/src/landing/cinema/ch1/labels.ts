/* ============================================================
   cinema/ch1/labels.ts — every DOM chip on the field + the
   `--sweep-bearing` sink. Owner: WP6 (spec rev 3.1 §3 J1–J2, §5.4,
   §5.6, §7 E6). Runs in the clock's Labels slot (after field.update).

   One chip anatomy for all four kinds: a gold DROPLET pin on the point,
   a round-capped LEADER hairline, and a PILL on a paper plate (α 0.98,
   1 px inset hairline): name 11 px Plex Mono 500 brown-deep (full, never
   cut), value 13 px Playfair 600 ink, every "███" run an ink capsule.
   The JS owns in/out (no CSS transition): INK time pour in, EVAPORATE
   out (from the far edge). Only transform / opacity / clip-path are
   written per frame; text is written at bloom only.

   Pools
   - POOL = 4 cursor slots (unchanged count). Mode 1, CURSOR (radar, vh <
     300, labelsGate > 0): the field's cursorLabels, slots keyed by point
     index (a point keeps its slot), in 200 ms / out 160 ms. Values show
     only above strength .62: the full and the redacted layers CROSS-FADE
     with strength and the pill's width flows between them (clip-path,
     paint only) — no hard text swap. From vh 220 labels near the target
     are suppressed; labelsGate fades them over 260–300 (v2).
     Mode 2, SWEEP-FLASH (C4c 1720–1800): every 400 ms at most one point
     just behind the sweep (frameData.sweepFlash), on screen and clear of
     the Ch4 panel / close / the pinned company, ALWAYS redacted, 900 ms
     life, in 160 ms / out 160 ms.
   - CHIP_POOL = 4 nodes, ≤ 3 chips on screen (2 on mobile), an evaporating
     one included, fed by
     frameData.echoes (WP3):
     ECHO   a named candidate pings (vh 8–226, echoGate open): bloom 240
            ms, then held fully shown 2.4 s (2.7 s when nothing waits for
            a slot), evaporate 160 ms. Name full; value full only above
            strength .62 (and only if the mark carries a value), else
            redacted. Past the closure (336) or after a playhead jump
            every chip evaporates at once.
     DECOY  time-based once triggered (the mark appears at the forward
            crossing of its flare peak): bloom 240 ms, an ink STRIKE draws
            across the name 0.5–0.8 s after the bloom (cx-flow), the chip
            dims, hold 1.8 s, evaporate 160 ms. Value always redacted.
            Scrolling back past (trigger vh − 4) evaporates it at once. A
            decoy pre-empts the oldest echo chip (≥ 1.2 s shown).
     Placement: one of 4 diagonal offsets, preferring the side away from
     the target; never on screen edges, within max(120, r + 40) px of the
     target, the onboarding card, the HUD, the dock, a live cursor label
     or another chip (rule re-checked every frame: a chip that would
     break it evaporates). Chip points are PINNED (field.setPinned, on
     change) so the GL never moves them off their leaders.
   - At refresh: the widest full / redacted pill is measured (canvas
     text metrics, no layout) and sent as field.setLabelChip.
   ============================================================ */

import { FrameOrder, RECT_KEYS, type CinemaCtx, type CursorLabel, type EchoMark, type Rect } from "../types";
import { PACE, SCORE } from "../beats";
import { FLAGS } from "../flags";
import { claim } from "../dev/assert";
import { IS_DEV } from "../env";
import { runtime } from "../runtime";
import { COMPANY_NAMES, LABEL_VALUE_MIN_STRENGTH, NAME_REDACTED, REDACTED, formatBRL } from "../copy";
import { progress, smoothstep, viewH, viewW } from "../geometry";
import {
  GCell,
  buildCharCells,
  buildWordCells,
  eases,
  evapAt,
  inkAt,
  newState,
  seededRot,
  type Eases,
  type GState,
} from "./ink";

const POOL = 4;
const CHIP_POOL = 4;
const CHIP_CAP = { desktop: 3, mobile: 2 } as const;

/** Target suppression (J2): cursor labels within 120 px of the projected target, from vh 220. */
const SUPPRESS = { from: 214 * PACE, full: 226 * PACE, radius: 120, soft: 36, ringPad: 40 } as const;
/** The picker's chip origin is the point + (13, −11) (three/labels.ts OFFSET_X/Y). */
const CURSOR_OFF = { x: 13, y: -11 } as const;

/** C4c sweep-flash cadence (seconds). */
const FLASH = { every: 0.4, hold: 0.9, keepOut: 12, spacing: 96, anchorPad: 90 } as const;

/** Time variants (seconds, §5.3). */
const TIME = {
  chipIn: 0.24,
  cursorIn: 0.2,
  flashIn: 0.16,
  out: 0.16,
  /** echo hold, counted from the END of the bloom (fully shown): ≥ 2.4 s when
   *  another chip waits for the slot, else 2.7 s (§2.4: 2.4–3.0 s; the plate
   *  is opaque ~0.1 s into the 0.24 s bloom, so the plate-opaque time measured
   *  in the page is ≈ 0.15 s longer: 2.55–2.85 s). The sonar's echo mark
   *  lives 3.2 s from its ping, and a chip blooms ≤ 0.5 s after the ping, so
   *  the mark always outlives the minimum hold. */
  echoHold: 2.4,
  echoHoldMax: 2.7,
  decoyHold: 1.8,
  strike: [0.5, 0.8] as const,
  /** a pre-empted / lost chip is shown at least this long */
  minShown: 1.2,
  /** the same company does not re-bloom while this fresh */
  cooldown: 4.5,
  /** a ping older than this does not bloom a chip any more */
  freshPing: 0.5,
} as const;

/** Echo chips bloom only over J1 (vh 8 → 226) while the echo gate is open. */
const ECHO_WINDOW: readonly [number, number] = [8 * PACE, 226 * PACE];
/** Decoys evaporate at once when the playhead goes back below trigger − 4 vh. */
const DECOY_BACK = 4 * PACE;
/** No echo / decoy chip outlives the hunt: from the reticle's closure on
 *  (and after any playhead jump — teleport, dock flight, settle) every
 *  chip evaporates at once instead of finishing its hold. */
const CHIP_ZONE_END = 336 * PACE;
const JUMP_VH = 30 * PACE;

/* geometry (px) */
const LEAD_GAP = 18;
const EDGE = 12;
/** Radar r1: a plate never spawns (nor revives) across this inset (16 px at ≤ 720); one that
 *  drifts past KILL_EDGE of the viewport edge evaporates (the hysteresis keeps it from flickering). */
const INSET = { desktop: 24, narrow: 16 } as const;
const KILL_EDGE = 4;
/** Radar r1 admission (desktop): ≤ 2 cursor labels while ≥ 2 echo / decoy chips are live (≤ 5 plates). */
const CURSOR_CAP_BUSY = 2;
const NOGO_PAD = 12;
const TARGET_KEEP = 120;
/** plate padding (CSS mirror: .lp-label-text left/top, right padding) */
const PAD = { l: 14, r: 16 } as const;
const LEAD_BASE = 64;

const K_NONE = -1;

type Kind = "none" | "cursor" | "flash" | "echo" | "decoy";

/* ── cached style writer ─────────────────────────────────────── */
class Prop {
  private last: string | null = null;
  constructor(
    private readonly el: HTMLElement,
    private readonly name: string,
  ) {}
  set(v: string): void {
    if (v === this.last) return;
    this.last = v;
    this.el.style.setProperty(this.name, v);
  }
  reset(): void {
    this.last = null;
  }
}
const r2 = (v: number): number => Math.round(v * 2) / 2;
const f3 = (v: number): string => (Math.round(v * 1000) / 1000).toString();
const f2 = (v: number): string => (Math.round(v * 100) / 100).toString();

interface Layer {
  host: HTMLElement;
  name: HTMLElement;
  val: HTMLElement;
  cells: GCell[];
  /** font px per cell (name 11 / value 13) */
  em: number[];
  rho: number[];
  /** visible text width (px), from canvas metrics */
  w: number;
  nameW: number;
  key: string;
  op: Prop;
}

interface Chip {
  kind: Kind;
  idx: number;
  root: HTMLElement;
  plate: HTMLElement;
  lead: HTMLElement;
  pin: HTMLElement;
  bg: HTMLElement;
  strike: HTMLElement;
  layers: [Layer, Layer];
  /* writers */
  rootT: Prop;
  rootO: Prop;
  rootV: Prop;
  plateT: Prop;
  plateTO: Prop;
  plateO: Prop;
  leadT: Prop;
  pinT: Prop;
  bgClip: Prop;
  strikeT: Prop;
  /* lifecycle (seconds) */
  born: number;
  /** evaporation start, −1 = holding */
  outAt: number;
  /** earliest allowed out (pre-empt / lost rules) */
  minOut: number;
  hold: number;
  inDur: number;
  /* geometry */
  px: number;
  py: number;
  ox: number;
  oy: number;
  /** plate height / current width */
  h: number;
  w: number;
  /** leader end (relative to the point) */
  ax: number;
  ay: number;
  /* echo / decoy */
  triggerVh: number;
  lostAt: number;
  rejected: boolean;
  /** cursor: full ↔ redacted mix (0..1) */
  mix: number;
  strength: number;
  /** last frame's in/out envelope state, to skip idle writes */
  settled: boolean;
}

export interface LabelsApi {
  hideAll(): void;
  /** settle(0) (return home, under the closed veil): hide with a CUT and
   *  keep the pools off until the phase is "radar" again (QA
   *  RETURN-HOME-LABEL-GHOST). */
  hideAndLatch(): void;
}

const rectHit = (a: Rect, b: Rect, pad: number): boolean =>
  b.w > 0 &&
  b.h > 0 &&
  a.x < b.x + b.w + pad &&
  a.x + a.w > b.x - pad &&
  a.y < b.y + b.h + pad &&
  a.y + a.h > b.y - pad;

/** Distance from a point to a rect (0 inside). */
const distToRect = (px: number, py: number, r: Rect): number => {
  const dx = px < r.x ? r.x - px : px > r.x + r.w ? px - (r.x + r.w) : 0;
  const dy = py < r.y ? r.y - py : py > r.y + r.h ? py - (r.y + r.h) : 0;
  return Math.hypot(dx, dy);
};

/** Nearest point of a stadium (pill) to (px, py), relative coordinates. */
function attachPoint(px: number, py: number, x: number, y: number, w: number, h: number): { x: number; y: number } {
  const R = h / 2;
  const cx = Math.min(Math.max(px, x + R), x + w - R);
  const cy = y + R;
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy) || 1;
  return { x: cx + (dx / d) * R, y: cy + (dy / d) * R };
}

/* ── canvas text metrics (no layout) ─────────────────────────── */
interface Metrics {
  name(text: string): number;
  value(text: string): number;
  refresh(): void;
}
function createMetrics(): Metrics {
  const c = document.createElement("canvas").getContext("2d");
  let mono = "monospace";
  let display = "serif";
  const cache = new Map<string, number>();
  const run = (font: string, text: string, ls: number): number => {
    if (!c) return text.length * 7;
    c.font = font;
    return c.measureText(text).width + ls * text.length;
  };
  const split = (text: string, rest: (t: string) => number, red: (t: string) => number): number => {
    let w = 0;
    for (const p of text.split(/(█+)/)) if (p) w += p.startsWith("█") ? red(p) : rest(p);
    return w;
  };
  return {
    refresh() {
      const cs = getComputedStyle(document.documentElement);
      mono = cs.getPropertyValue("--f-mono").trim() || mono;
      display = cs.getPropertyValue("--f-display").trim() || display;
      cache.clear();
    },
    name(text) {
      const k = "n|" + text;
      let w = cache.get(k);
      if (w === undefined) {
        // 11 px, uppercase, tracking .05em (the redaction runs too)
        w = run(`500 11px ${mono}`, text.toUpperCase(), 0.55);
        cache.set(k, w);
      }
      return w;
    },
    value(text) {
      const k = "v|" + text;
      let w = cache.get(k);
      if (w === undefined) {
        w = split(
          text,
          (t) => run(`600 13px ${display}`, t, 0),
          (t) => run(`400 13px ${mono}`, t, 0),
        );
        cache.set(k, w);
      }
      return w;
    },
  };
}

/* ============================================================ */

export function buildLabels(ctx: CinemaCtx): LabelsApi {
  const E: Eases = eases();
  const lite = ctx.isMobile;
  const layer = ctx.labelLayer;
  const metrics = createMetrics();
  const st: GState = newState();
  const ev: GState = newState();

  /* ── DOM ─────────────────────────────────────────────────── */
  const mkLayer = (parent: HTMLElement, mod: string): Layer => {
    const host = document.createElement("span");
    host.className = `lp-label-text lp-label-text--${mod}`;
    const name = document.createElement("span");
    name.className = "lp-label-name";
    const val = document.createElement("span");
    val.className = "lp-label-val";
    host.append(name, val);
    parent.append(host);
    return { host, name, val, cells: [], em: [], rho: [], w: 0, nameW: 0, key: "", op: new Prop(host, "opacity") };
  };
  const mkChip = (): Chip => {
    const root = document.createElement("div");
    root.className = "lp-label";
    const lead = document.createElement("i");
    lead.className = "lp-label-lead";
    const pin = document.createElement("i");
    pin.className = "lp-label-pin";
    const plate = document.createElement("div");
    plate.className = "lp-label-chip";
    const bg = document.createElement("i");
    bg.className = "lp-label-bg";
    plate.append(bg);
    const a = mkLayer(plate, "a");
    const b = mkLayer(plate, "b");
    const strike = document.createElement("i");
    strike.className = "lp-label-strike";
    plate.append(strike);
    root.append(lead, pin, plate);
    layer.append(root);
    return {
      kind: "none",
      idx: K_NONE,
      root,
      plate,
      lead,
      pin,
      bg,
      strike,
      layers: [a, b],
      rootT: new Prop(root, "transform"),
      rootO: new Prop(root, "opacity"),
      rootV: new Prop(root, "visibility"),
      plateT: new Prop(plate, "transform"),
      plateTO: new Prop(plate, "transform-origin"),
      plateO: new Prop(plate, "opacity"),
      leadT: new Prop(lead, "transform"),
      pinT: new Prop(pin, "transform"),
      // the pill's visible width: `--cut` from the right (labels.css clips the ring + plate)
      bgClip: new Prop(plate, "--cut"),
      strikeT: new Prop(strike, "transform"),
      born: 0,
      outAt: -1,
      minOut: 0,
      hold: 0,
      inDur: TIME.chipIn,
      px: 0,
      py: 0,
      ox: 0,
      oy: 0,
      h: 40,
      w: 0,
      ax: 0,
      ay: 0,
      triggerVh: 0,
      lostAt: -1,
      rejected: false,
      mix: 1,
      strength: 1,
      settled: false,
    };
  };
  const cursorPool: Chip[] = Array.from({ length: POOL }, mkChip);
  const chipPool: Chip[] = Array.from({ length: CHIP_POOL }, mkChip);
  const all = [...cursorPool, ...chipPool];
  if (FLAGS.DEV_ASSERT) {
    claim("CH1", all.map((c) => c.root), ["opacity", "transform", "visibility"]);
    claim("CH1", all.map((c) => c.plate), ["opacity", "transform"]);
    claim("CH1", all.flatMap((c) => [c.lead, c.pin, c.strike]), ["transform"]);
    claim("CH1", all.map((c) => c.plate), ["--cut"]);
  }

  /* ── refresh: chip height, widest pills → field.setLabelChip ── */
  let chipH = 40;
  let wMax = 260;
  const measureChip = (): Rect => {
    metrics.refresh();
    // the probe is a real (hidden) chip: its plate height is the CSS truth
    const probe = cursorPool[0];
    const hh = probe.plate.offsetHeight; // layout height (a mid-bloom scale must not count)
    if (hh > 0) chipH = hh;
    let nameMax = 0;
    for (const nm of COMPANY_NAMES) nameMax = Math.max(nameMax, metrics.name(nm));
    const valMax = Math.max(metrics.value(formatBRL(99.9)), metrics.value(formatBRL(0.999)));
    const wFull = Math.ceil(PAD.l + Math.max(nameMax, valMax) + PAD.r);
    const wRedacted = Math.ceil(PAD.l + Math.max(metrics.name(NAME_REDACTED), metrics.value(REDACTED)) + PAD.r);
    wMax = Math.max(wFull, wRedacted) + 4;
    for (const c of all) {
      c.plate.style.width = `${wMax}px`;
      c.plate.style.setProperty("--r", `${f2(chipH / 2)}px`);
      c.h = chipH;
      c.bgClip.reset();
      c.layers[0].key = c.layers[1].key = "";
    }
    ctx.field.setLabelChip({ wFull, wRedacted, h: Math.ceil(chipH), gap: 6 });
    return { x: 0, y: 0, w: wFull, h: chipH };
  };
  ctx.rects.register("ch1.chip", measureChip);

  // no-go zones measured at refresh (never per frame)
  ctx.rects.register("ch1.nogo.dock", () => {
    const el = document.querySelector<HTMLElement>(".lp-scrollcue .cx-guide__pill") ?? document.querySelector<HTMLElement>(".lp-scrollcue");
    const r = el?.getBoundingClientRect();
    return r && r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: 0, y: 0, w: 0, h: 0 };
  });
  ctx.rects.register("ch1.nogo.onboard", () => {
    const el = document.querySelector<HTMLElement>(".cx-guide__card");
    const r = el?.getBoundingClientRect();
    return r && r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: 0, y: 0, w: 0, h: 0 };
  });

  /* ── content (at bloom only) ───────────────────────────────── */
  const setContent = (L: Layer, name: string, value: string) => {
    const key = name + "\u0000" + value;
    if (L.key === key) return;
    L.key = key;
    const nc = buildCharCells(L.name, name, "lp-g");
    const vc = buildWordCells(L.val, value, "lp-g");
    L.cells = [...nc, ...vc];
    L.em = [...nc.map(() => 11), ...vc.map(() => 13)];
    L.rho = L.cells.map((_, i) => seededRot(i * 3 + name.length));
    L.nameW = metrics.name(name);
    L.w = PAD.l + Math.max(L.nameW, metrics.value(value)) + PAD.r;
  };

  /* ── per-chip envelope (in/out) ────────────────────────────── */
  /** Writes the plate, pin, leader and glyphs for time t. Returns false once gone. */
  const writeEnvelope = (c: Chip, t: number, layersOn: number): boolean => {
    const age = t - c.born;
    const out = c.outAt >= 0 ? t - c.outAt : -1;
    if (out >= TIME.out) return false;
    const inK = Math.min(1, Math.max(0, age / c.inDur));
    const idle = inK >= 1 && out < 0;
    if (idle && c.settled) return true;
    c.settled = idle;

    // leader: draws 0 → 1 over the first half of the bloom; retracts on the way out
    const dIn = E.flow(Math.min(1, age / (c.inDur * 0.5)));
    const dOut = out >= 0 ? 1 - E.evap(progress(0.06, TIME.out, out)) : 1;
    const draw = Math.max(0, dIn * dOut);
    const len = Math.hypot(c.ax, c.ay);
    if (len > 0.5 && draw > 0.001) {
      const ang = Math.atan2(c.ay, c.ax);
      c.leadT.set(`rotate(${f3(ang)}rad) scaleX(${f3((len * draw) / LEAD_BASE)})`);
    } else c.leadT.set("scaleX(0)");
    // pin: pops in (cx-pour), fades with the leader
    const pin = E.pour(Math.min(1, age / (c.inDur * 0.4))) * dOut;
    c.pinT.set(pin >= 0.999 ? "none" : `scale(${f3(Math.max(0, pin))})`);

    // plate: condenses about its attach side (cx-pour), evaporates (cx-evap)
    const pIn = progress(0.15, 1, inK);
    const pOut = out >= 0 ? E.evap(progress(0.03, TIME.out, out)) : 0;
    const sc = (0.9 + 0.1 * E.pour(pIn)) * (1 - 0.04 * pOut);
    const op = E.bloom(Math.min(1, pIn * 1.6)) * (1 - pOut);
    c.plateO.set(op >= 0.999 ? "1" : f3(op));
    c.plateT.set(`translate3d(${f2(c.ox)}px, ${f2(c.oy)}px, 0)${sc === 1 ? "" : ` scale(${f3(sc)})`}`);

    // glyphs: INK pour (ltr) in, EVAPORATE (rtl) out
    for (let li = 0; li < 2; li++) {
      if (!(layersOn & (1 << li))) continue;
      const L = c.layers[li];
      const nCells = L.cells.length;
      const span = c.inDur * 0.75;
      const gDur = c.inDur * 0.5;
      const stg = nCells > 1 ? (span - gDur) / (nCells - 1) : 0;
      const oSpan = TIME.out * 0.75;
      const oDur = TIME.out * 0.5;
      const ostg = nCells > 1 ? (oSpan - oDur) / (nCells - 1) : 0;
      for (let j = 0; j < nCells; j++) {
        const qIn = (age - c.inDur * 0.2 - j * stg) / gDur;
        inkAt(E, qIn, L.em[j], L.rho[j], lite, st);
        if (out >= 0) {
          evapAt(E, (out - (nCells - 1 - j) * ostg) / oDur, L.em[j], ev);
          st.op *= ev.op;
          st.y += ev.y;
        }
        L.cells[j].write(st);
      }
    }
    return true;
  };

  const placePlateAt = (c: Chip, ox: number, oy: number) => {
    c.ox = ox;
    c.oy = oy;
    const a = attachPoint(0, 0, ox, oy, c.w, c.h);
    // stop 1.5 px short of the pill (the hairline meets its edge, not its fill)
    const d = Math.hypot(a.x, a.y) || 1;
    c.ax = a.x - (a.x / d) * 1.5;
    c.ay = a.y - (a.y / d) * 1.5;
    c.plateTO.set(`${f2(a.x - ox)}px ${f2(a.y - oy)}px`);
  };

  const start = (c: Chip, kind: Kind, idx: number, t: number, inDur: number) => {
    c.kind = kind;
    c.idx = idx;
    c.born = t;
    c.outAt = -1;
    c.minOut = t;
    c.inDur = inDur;
    c.lostAt = -1;
    c.rejected = false;
    c.settled = false;
    c.root.classList.toggle("is-decoy", kind === "decoy");
    c.root.classList.remove("is-rejected");
    c.strikeT.set("scaleX(0)");
    c.rootV.set("visible");
  };
  const cut = (c: Chip) => {
    chipName.delete(c);
    c.kind = "none";
    c.idx = K_NONE;
    c.outAt = -1;
    c.rootO.set("0");
    c.rootV.set("hidden");
  };
  const evaporate = (c: Chip, t: number) => {
    if (c.outAt < 0) c.outAt = Math.max(t, c.minOut);
  };
  const live = (c: Chip) => c.kind !== "none";
  const dying = (c: Chip) => c.kind !== "none" && c.outAt >= 0;

  const plateBox = (c: Chip): Rect => ({ x: c.px + c.ox, y: c.py + c.oy, w: c.w, h: c.h });

  /* ── radar r1: one name per plate on screen, edge keep-out ── */
  /** the name each live plate shows (held until the plate is cut, so no two plates on screen
   *  ever read the same company, even while one evaporates) */
  const chipName = new Map<Chip, string>();
  /** COMPANY_NAMES[(i + k) % N] with the smallest k no other live plate shows */
  const pickName = (i: number, self: Chip | null): string => {
    const N = COMPANY_NAMES.length;
    for (let k = 0; k < N; k++) {
      const nm = COMPANY_NAMES[(i + k) % N];
      let taken = false;
      for (const [o, on] of chipName) if (o !== self && on === nm) taken = true;
      if (!taken) return nm;
    }
    return COMPANY_NAMES[i % N];
  };
  const inset = (): number => (viewW() <= 720 ? INSET.narrow : INSET.desktop);
  /** the box sits inside the viewport inset by `m` px */
  const inView = (b: Rect, m: number): boolean =>
    b.x >= m && b.y >= m && b.x + b.w <= viewW() - m && b.y + b.h <= viewH() - m;

  /* ── phase / latch ─────────────────────────────────────────── */
  let radar = false;
  let suppressed = false;
  ctx.onPhase((p) => {
    radar = p === "radar";
    if (radar && suppressed) suppressed = false;
  });

  /* ── pinned list (write on change) ─────────────────────────── */
  let pinKey = "";
  const syncPinned = () => {
    const idx: number[] = [];
    for (const c of chipPool) if (live(c) && c.idx >= 0) idx.push(c.idx);
    idx.sort((a, b) => a - b);
    const key = idx.join(",");
    if (key === pinKey) return;
    pinKey = key;
    ctx.field.setPinned(idx.slice(0, 8));
  };

  const hideAll = () => {
    for (const c of all) cut(c);
    flashT = 0;
    chipVh = Number.NaN;
    syncPinned();
  };
  const hideAndLatch = () => {
    suppressed = true;
    hideAll();
  };

  /* ── mode 1: cursor labels ─────────────────────────────────── */
  const cursorMode = (vh: number, t: number, gateK: number) => {
    const cur = ctx.field.frameData.cursorLabels;
    const supK = progress(SUPPRESS.from, SUPPRESS.full, vh);
    const a = supK > 0 ? ctx.field.getAnchorScreen() : null;
    const radius = a ? Math.max(SUPPRESS.radius, a.r + SUPPRESS.ringPad) * supK : 0;
    // slots keyed by point index: keep, then assign new ones to free slots
    // admission (desktop): while ≥ 2 echo / decoy chips are up, ≤ 2 cursor labels (the strongest)
    let chipsUp = 0;
    for (const c of chipPool) if (live(c) && c.outAt < 0) chipsUp++;
    const capN = !lite && chipsUp >= 2 ? CURSOR_CAP_BUSY : POOL;
    const m0 = inset();
    for (const c of cursorPool) {
      if (c.kind === "flash") cut(c);
      if (c.kind !== "cursor") continue;
      const still = cur.some((l) => l.i === c.idx);
      if (!still) evaporate(c, t);
      // a plate the camera carries to the viewport edge leaves before it is cut by it
      else if (c.outAt < 0 && !inView(plateBox(c), KILL_EDGE)) evaporate(c, t);
    }
    let active = 0;
    for (const c of cursorPool) if (c.kind === "cursor" && c.outAt < 0) active++;
    if (active > capN) {
      const extra = cursorPool
        .filter((c) => c.kind === "cursor" && c.outAt < 0)
        .sort((p, q) => p.strength - q.strength)
        .slice(0, active - capN);
      for (const c of extra) evaporate(c, t);
      active = capN;
    }
    for (const l of cur) {
      let c = cursorPool.find((s) => s.kind === "cursor" && s.idx === l.i);
      // an echo / decoy chip already names this company
      if (!c && chipPool.some((s) => live(s) && s.idx === l.i)) continue;
      if (c && c.outAt >= 0) {
        // revive only inside the cap and the edge inset
        if (active >= capN || !inView({ x: l.x, y: l.y, w: c.w, h: chipH }, m0)) continue;
        active++;
        // came back while leaving: pour again from here
        c.outAt = -1;
        c.born = t - c.inDur * 0.5;
        c.settled = false;
      }
      if (!c) {
        if (active >= capN) continue;
        c = cursorPool.find((s) => !live(s)) ?? cursorPool.find((s) => dying(s));
        if (!c) continue;
        const name = pickName(l.i, c);
        const val = formatBRL(l.value);
        // the full plate (the widest it flows to) must clear the edge inset
        const wFull = PAD.l + Math.max(metrics.name(name), metrics.value(val)) + PAD.r;
        if (!inView({ x: l.x, y: l.y, w: wFull, h: chipH }, m0)) continue;
        start(c, "cursor", l.i, t, TIME.cursorIn);
        chipName.set(c, name);
        active++;
        setContent(c.layers[0], name, val);
        setContent(c.layers[1], NAME_REDACTED, REDACTED);
        c.w = c.layers[0].w;
        placePlateAt(c, 0, 0);
      }
      c.px = l.x - CURSOR_OFF.x;
      c.py = l.y - CURSOR_OFF.y;
      c.strength = l.strength;
      let k = 1;
      if (a && a.visible && radius > 0) {
        k = smoothstep(radius, radius + SUPPRESS.soft, distToRect(a.x, a.y, { x: l.x, y: l.y, w: c.layers[0].w, h: chipH }));
      }
      c.rootO.set(f3(Math.min(1, l.strength * 1.4) * gateK * k));
    }
    for (const c of cursorPool) {
      if (c.kind !== "cursor") continue;
      // full ↔ redacted cross-fade with strength, the pill's width flows between them
      const mix = smoothstep(LABEL_VALUE_MIN_STRENGTH - 0.05, LABEL_VALUE_MIN_STRENGTH + 0.05, c.strength);
      const A = c.layers[0];
      const B = c.layers[1];
      if (mix !== c.mix) {
        c.mix = mix;
        c.settled = false;
      }
      A.op.set(f3(mix));
      B.op.set(f3(1 - mix));
      c.w = B.w + (A.w - B.w) * mix;
      placePlateAt(c, CURSOR_OFF.x, CURSOR_OFF.y);
      c.bgClip.set(`${f2(Math.max(0, wMax - c.w))}px`);
      c.rootT.set(`translate3d(${r2(c.px)}px, ${r2(c.py)}px, 0)`);
      if (!writeEnvelope(c, t, (mix > 0.001 ? 1 : 0) | (mix < 0.999 ? 2 : 0))) cut(c);
    }
  };

  /* ── mode 2: C4c sweep-flash (always redacted) ─────────────── */
  let flashT = 0;
  const flashOk = (c: CursorLabel, w: number): boolean => {
    const vw = viewW();
    const vhPx = viewH();
    const box: Rect = { x: c.x, y: c.y, w, h: chipH };
    if (box.x < 8 || box.y < 8 || box.x + box.w > vw - 8 || box.y + box.h > vhPx - 8) return false;
    if (rectHit(box, ctx.rects.get(RECT_KEYS.ch4Panel), FLASH.keepOut)) return false;
    if (rectHit(box, ctx.rects.get(RECT_KEYS.ch4Close), FLASH.keepOut)) return false;
    // never over the pinned company (its ring and "R$ 24,3 mi")
    const a = ctx.field.getAnchorScreen();
    if (a.visible && distToRect(a.x, a.y, box) < a.r + FLASH.anchorPad) return false;
    for (const s of cursorPool) if (s.kind === "flash" && Math.hypot(s.px - c.x, s.py - c.y) < FLASH.spacing) return false;
    return true;
  };
  const flashMode = (t: number) => {
    for (const c of cursorPool) if (c.kind === "cursor") cut(c);
    if (t >= flashT) {
      flashT = t + FLASH.every;
      const f = ctx.field.frameData.sweepFlash;
      const free = cursorPool.find((s) => !live(s));
      if (f && free) {
        const w = PAD.l + Math.max(metrics.name(NAME_REDACTED), metrics.value(REDACTED)) + PAD.r;
        if (flashOk(f, w)) {
          start(free, "flash", f.i, t, TIME.flashIn);
          setContent(free.layers[0], NAME_REDACTED, REDACTED);
          free.layers[0].op.set("1");
          free.layers[1].op.set("0");
          free.w = free.layers[0].w;
          free.px = f.x - CURSOR_OFF.x;
          free.py = f.y - CURSOR_OFF.y;
          placePlateAt(free, CURSOR_OFF.x, CURSOR_OFF.y);
          free.bgClip.set(`${f2(Math.max(0, wMax - free.w))}px`);
          free.rootO.set("1");
        }
      }
    }
    const lf = ctx.field.frameData.sweepFlash;
    for (const c of cursorPool) {
      if (c.kind !== "flash") continue;
      // follow the same point while the field keeps reporting it
      if (lf && lf.i === c.idx && c.outAt < 0) {
        c.px = lf.x - CURSOR_OFF.x;
        c.py = lf.y - CURSOR_OFF.y;
      }
      if (c.outAt < 0 && t - c.born >= FLASH.hold - TIME.out) evaporate(c, t);
      c.rootT.set(`translate3d(${r2(c.px)}px, ${r2(c.py)}px, 0)`);
      if (!writeEnvelope(c, t, 1)) cut(c);
    }
  };

  /* ── echo + decoy chips ────────────────────────────────────── */
  const cooldown = new Map<number, number>();
  const decoyFired = new Set<number>();
  const NO_MARKS: readonly EchoMark[] = [];
  /** the playhead vh of the previous chip frame (jump detection) */
  let chipVh = Number.NaN;
  const nogo = (vh: number): Rect[] => {
    const out: Rect[] = [];
    if (vh < 62 * PACE) out.push(ctx.rects.get("ch1.hud"));
    out.push(ctx.rects.get("ch1.nogo.dock"));
    if (vh < 30 * PACE) out.push(ctx.rects.get("ch1.nogo.onboard"));
    for (const c of cursorPool) if (live(c) && c.kind === "cursor") out.push(plateBox(c));
    return out;
  };
  const targetClear = (box: Rect): boolean => {
    const a = ctx.field.getAnchorScreen();
    if (!a.visible) return true;
    return distToRect(a.x, a.y, box) >= Math.max(TARGET_KEEP, a.r + 40);
  };
  const boxOk = (box: Rect, self: Chip | null, zones: Rect[]): boolean => {
    const vw = viewW();
    const vhPx = viewH();
    const m = Math.max(EDGE, inset());
    if (box.x < m || box.y < m || box.x + box.w > vw - m || box.y + box.h > vhPx - m) return false;
    if (!targetClear(box)) return false;
    for (const z of zones) if (rectHit(box, z, NOGO_PAD)) return false;
    for (const o of chipPool) if (o !== self && live(o) && rectHit(box, plateBox(o), NOGO_PAD)) return false;
    return true;
  };

  /** Pick the plate offset for a chip at (px, py); false if no clean spot exists. */
  const place = (c: Chip, px: number, py: number, vh: number): boolean => {
    const a = ctx.field.getAnchorScreen();
    const zones = nogo(vh);
    const w = c.w;
    const h = c.h;
    const g = LEAD_GAP;
    const cand = [
      { ox: g, oy: -g - h, dx: 1, dy: -1 },
      { ox: -g - w, oy: -g - h, dx: -1, dy: -1 },
      { ox: g, oy: g, dx: 1, dy: 1 },
      { ox: -g - w, oy: g, dx: -1, dy: 1 },
      // straight above / below (narrow screens: a pill rarely fits beside the point)
      { ox: -w / 2, oy: -g - h, dx: 0, dy: -1.4 },
      { ox: -w / 2, oy: g, dx: 0, dy: 1.4 },
    ];
    // away from the target first (the diagonals before the verticals at equal score)
    const ax = a.visible ? px - a.x : 1;
    const ay = a.visible ? py - a.y : -1;
    const score = (k: { dx: number; dy: number }) => (k.dx * ax + k.dy * ay) / Math.hypot(k.dx, k.dy) - (k.dx === 0 ? 1 : 0);
    cand.sort((p, q) => score(q) - score(p));
    for (const k of cand) {
      if (boxOk({ x: px + k.ox, y: py + k.oy, w, h }, c, zones)) {
        c.px = px;
        c.py = py;
        placePlateAt(c, k.ox, k.oy);
        return true;
      }
    }
    // narrow screens: slide the pill sideways into the viewport (it always sits
    // ≥ 18 px above or below the point, so it never covers its own bead)
    const vw = viewW();
    for (const k of cand) {
      const x = Math.min(Math.max(px + k.ox, inset()), vw - inset() - w);
      if (x === px + k.ox) continue;
      if (boxOk({ x, y: py + k.oy, w, h }, c, zones)) {
        c.px = px;
        c.py = py;
        placePlateAt(c, x - px, k.oy);
        return true;
      }
    }
    return false;
  };

  const markOf = (idx: number): EchoMark | null => {
    for (const m of ctx.field.frameData.echoes) if (m.i === idx) return m;
    return null;
  };

  const bloomChip = (m: EchoMark, t: number, vh: number): boolean => {
    const c = chipPool.find((s) => !live(s));
    if (!c) return false;
    const decoy = m.kind === "decoy";
    // a cursor label already names this company
    if (cursorPool.some((s) => s.kind === "cursor" && s.outAt < 0 && s.idx === m.i)) return false;
    const name = pickName(m.i, c);
    // `value` (R$ mi) is an additive EchoMark field (integrator request: WP3 fills it
    // from the base field's values); without it the value is the redacted run
    const value = (m as EchoMark & { value?: number }).value;
    const showValue = !decoy && m.strength > LABEL_VALUE_MIN_STRENGTH && typeof value === "number" && Number.isFinite(value);
    const valueText = showValue ? formatBRL(value as number) : REDACTED;
    // place first, from canvas metrics (setContent's own width formula): a mark
    // with no legal spot never rebuilds the pooled chip's glyph cells
    c.w = PAD.l + Math.max(metrics.name(name), metrics.value(valueText)) + PAD.r;
    c.h = chipH;
    if (!place(c, m.x, m.y, vh)) return false;
    setContent(c.layers[0], name, valueText);
    c.w = c.layers[0].w;
    start(c, decoy ? "decoy" : "echo", m.i, t, TIME.chipIn);
    chipName.set(c, name);
    c.layers[0].op.set("1");
    c.layers[1].op.set("0");
    c.bgClip.set(`${f2(Math.max(0, wMax - c.w))}px`);
    c.strike.style.width = `${f2(c.layers[0].nameW + 6)}px`;
    c.hold = decoy ? TIME.chipIn + TIME.decoyHold : TIME.chipIn + TIME.echoHold;
    c.triggerVh = vh;
    c.rootO.set("1");
    cooldown.set(m.i, t);
    return true;
  };

  const chipMode = (vh: number, t: number) => {
    const echoes = ctx.field.frameData.echoes;
    const cap = lite ? CHIP_CAP.mobile : CHIP_CAP.desktop;
    // every chip on screen counts against the cap, an evaporating one too: a
    // new chip blooms only once the one it replaces has fully left (≤ 160 ms)
    const shown = () => {
      let n = 0;
      for (const c of chipPool) if (live(c)) n++;
      return n;
    };
    const echoOpen =
      FLAGS.ECHO_CHIPS && vh >= ECHO_WINDOW[0] && vh < ECHO_WINDOW[1] && ctx.field.score.echoGate > 0.5;

    // a decoy re-arms only once its mark has gone (scrolled back past it)
    for (const idx of decoyFired) if (!echoes.some((m) => m.i === idx && m.kind === "decoy")) decoyFired.delete(idx);

    // past the closure, or after a jump: everything leaves now (no new blooms this frame)
    const jumped = Number.isFinite(chipVh) && Math.abs(vh - chipVh) > JUMP_VH;
    chipVh = vh;
    if (vh >= CHIP_ZONE_END || jumped) {
      for (const c of chipPool) {
        if (!live(c) || (c.outAt >= 0 && c.outAt <= t)) continue;
        c.minOut = t;
        c.outAt = t;
      }
    }
    const blooms = vh < CHIP_ZONE_END && !jumped;

    let waiting = false;
    for (const m of blooms ? echoes : NO_MARKS) {
      if (chipPool.some((c) => live(c) && c.idx === m.i)) continue;
      if (m.kind === "decoy") {
        if (!FLAGS.DECOY_CHIPS || decoyFired.has(m.i)) continue;
        if (shown() >= cap) {
          // a decoy pre-empts the oldest echo chip (shown ≥ 1.2 s)
          const old = chipPool
            .filter((c) => c.kind === "echo" && c.outAt < 0)
            .sort((p, q) => p.born - q.born)[0];
          if (old) {
            old.minOut = Math.max(old.minOut, old.born + TIME.minShown);
            evaporate(old, t);
          }
          continue;
        }
        if (bloomChip(m, t, vh)) decoyFired.add(m.i);
        continue;
      }
      if (!echoOpen || m.age > TIME.freshPing) continue;
      if ((cooldown.get(m.i) ?? -1e9) > t - TIME.cooldown) continue;
      if (shown() >= cap) {
        waiting = true;
        continue;
      }
      if (bloomChip(m, t, vh)) break; // one bloom per frame
    }

    let zones: Rect[] | null = null;
    for (const c of chipPool) {
      if (!live(c)) continue;
      // follow the point while the field reports it
      const m = markOf(c.idx);
      if (m) {
        c.px = m.x;
        c.py = m.y;
        c.lostAt = -1;
      } else if (c.lostAt < 0) c.lostAt = t;
      const age = t - c.born;
      // a decoy evaporates AT ONCE when the playhead goes back past its trigger − 4
      if (c.kind === "decoy" && vh < c.triggerVh - DECOY_BACK && (c.outAt < 0 || c.outAt > t)) {
        c.minOut = t;
        c.outAt = t;
      }
      if (c.outAt < 0) {
        if (c.lostAt >= 0) {
          c.minOut = Math.max(c.minOut, c.born + TIME.minShown);
          evaporate(c, t);
        } else if (c.kind === "echo") {
          const held = age - c.inDur;
          if (held >= TIME.echoHoldMax || (held >= TIME.echoHold && waiting)) evaporate(c, t);
        } else if (c.kind === "decoy" && age >= c.hold) {
          evaporate(c, t);
        }
        // the rules hold every frame: a chip that would break them leaves
        const box = plateBox(c);
        const vw = viewW();
        const vhPx = viewH();
        const off = c.px < -20 || c.py < -20 || c.px > vw + 20 || c.py > vhPx + 20;
        let clash = !targetClear(box) || off || !inView(box, KILL_EDGE);
        if (!clash) {
          zones ??= nogo(vh);
          for (const z of zones) if (rectHit(box, z, 0)) clash = true;
        }
        if (clash) {
          c.minOut = t;
          evaporate(c, t);
        }
      }
      // decoy: the strike draws across the name 0.5–0.8 s after the bloom, then the chip dims
      if (c.kind === "decoy") {
        const k = E.flow(progress(TIME.strike[0], TIME.strike[1], age));
        c.strikeT.set(`scaleX(${f3(k)})`);
        const struck = k >= 1;
        if (struck !== c.rejected) {
          c.rejected = struck;
          c.root.classList.toggle("is-rejected", struck);
        }
        c.layers[0].op.set(f3(1 - 0.42 * E.dry(progress(TIME.strike[1], TIME.strike[1] + 0.25, age))));
      }
      c.rootT.set(`translate3d(${r2(c.px)}px, ${r2(c.py)}px, 0)`);
      if (!writeEnvelope(c, t, 1)) cut(c);
    }
    syncPinned();
  };

  /* ── dev: synthetic echo marks (?cx-echo-sim) until WP3 lands ── */
  const sim = IS_DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cx-echo-sim");
  const simMarks: EchoMark[] = [];
  const simulate = (vh: number, t: number) => {
    const cur = ctx.field.frameData.echoes;
    if (!sim || (cur.length && cur !== simMarks)) return; // the real sonar is talking
    simMarks.length = 0;
    const pts = ctx.field.sampleScreenPoints(12, 7, vh);
    // one "ping" per 1.3 s, cycling through 12 companies; decoys at their flare peaks
    for (let k = 0; k < pts.length; k++) {
      const phase = (((t / 1.3 - k) % 12) + 12) % 12;
      if (phase >= 0 && phase < 3) {
        simMarks.push({ x: pts[k].x, y: pts[k].y, i: k * 37 + 5, kind: "echo", age: phase * 1.3, reject: false, strength: k % 2 ? 0.8 : 0.4 });
      }
    }
    const peaks = [SCORE.decoy0, SCORE.decoy1, SCORE.decoy2].map((ch) => (ch.kind === "gauss" ? ch.center : 0));
    peaks.forEach((pk, d) => {
      if (pk > 0 && vh >= pk && vh < pk + 60 && pts[d]) {
        simMarks.push({ x: pts[d + 3].x, y: pts[d + 3].y, i: 900 + d, kind: "decoy", age: 0, reject: true, strength: 1 });
      }
    });
    (ctx.field.frameData as { echoes: EchoMark[] }).echoes = simMarks;
  };

  /* ── the frame fn ──────────────────────────────────────────── */
  let lastBearing = -1;
  ctx.frame.add(FrameOrder.Labels, (vh, t) => {
    const f = ctx.field.frameData;

    // the gateway emblem is a mini radar: its needle mirrors the live bearing
    // (scoped to `.grl`, never :root; written only when the 0.1° value changes)
    const gate = runtime.gateEl();
    if (gate) {
      const b = Math.round(f.sweepBearing * 10) / 10;
      if (b !== lastBearing) {
        gate.style.setProperty("--sweep-bearing", String(b));
        lastBearing = b;
      }
    } else {
      lastBearing = -1;
    }

    if (!radar || suppressed) {
      for (const c of all) if (live(c)) cut(c);
      chipVh = Number.NaN;
      syncPinned();
      return;
    }
    if (sim) simulate(vh, t);
    const score = ctx.field.score;
    if (score.sweepFlash > 0) flashMode(t);
    else {
      for (const c of cursorPool) if (c.kind === "flash") cut(c);
      const gateK = score.labelsGate;
      if (gateK > 0) cursorMode(vh, t, gateK);
      else for (const c of cursorPool) if (live(c)) cut(c);
    }
    chipMode(vh, t);
  });

  ctx.onDestroy(() => {
    all.forEach((c) => c.root.remove());
    ctx.field.setPinned([]);
  });
  return { hideAll, hideAndLatch };
}
