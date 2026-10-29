/* ============================================================
   cinema/ch1/hud.ts — the hero HUD "AZ ###° · varredura ativa".
   Owner: WP6 (spec rev 3.1 §3 G3/J1, §5.3, §5.4, §9.2).

   Markup (Ch1Stage.tsx): every character is its own inline-block cell
   (`.cx-hud__g`, mono: exact advances), the live dot is cell 0, and the
   three AZ digits sit in FIXED-WIDTH cells (`.cx-hud__d`, tabular-nums,
   `contain: layout size`). Only a changed digit's text node is written,
   so the per-frame AZ update never lays out the page (§11 item 44).

   - Reveal (time): the glyphs pour in (INK time variant, 320 ms ltr)
     while the readout counts 000 → the live bearing (220 ms rk-settle,
     unchanged); a quiet entry is live at once.
   - Live: AZ = frameData.sweepBearing (the displayed v3 θ, WP2), written
     only when a digit changes.
   - J1 30–62 (scrubbed, pure f(vh)): the HUD EVAPORATES glyph by glyph
     from its far edge (was a linear y −8 / autoAlpha over 30–70). The
     root is hidden from 62 on (settle(1) leaves `.lp-stage > *` hidden).
   - GL text mask rect 2 (§1.2, §4.4): the HUD box, so the beam veil,
     afterglow darkening and pings never sit under the readout. Written on
     change only; its right edge follows the evaporation (the veil takes
     the space back glyph by glyph, no pop) and it is cleared (null)
     whenever the HUD cannot be seen.
   ============================================================ */

import gsap from "gsap";
import { FrameOrder, type CinemaCtx, type Rect } from "../types";
import { TEXT_V3 } from "../beats";
import { FLAGS } from "../flags";
import { claim } from "../dev/assert";
import { HUD_COPY } from "../copy";
import { progress } from "../geometry";
import { GCell, eases, evapAt, inkAt, newState, seededRot } from "./ink";

/** J1 HUD exit (master vh): EVAPORATE (TEXT_V3.hudExit 30–62). */
export const HUD_OUT: readonly [number, number] = [TEXT_V3.hudExit.from, TEXT_V3.hudExit.to];
/** vh per glyph (EVAPORATE default, §5.2). */
const EVAP_GLYPH = 8;
const COUNT_DELAY = 0.15;
const COUNT_DUR = 0.22;
/** Reveal pour (seconds): the whole line in 320 ms, 200 ms per glyph. */
const POUR = { delay: 0.05, total: 0.32, glyph: 0.2 } as const;
/** Text-mask padding around the HUD box (px); the shader feathers 12 px beyond. */
const MASK_PAD = 8;
/** Word-level evaporation blur (desktop), px. */
const BLUR_MAX = 3;

export interface HudApi {
  reset(): void;
  /** Write the scrubbed state for vh now (settle). */
  apply(vh: number): void;
}

export function buildHud(ctx: CinemaCtx): HudApi | null {
  const hud = document.querySelector<HTMLElement>(".lp-stage > .cx-hud");
  const read = hud?.querySelector<HTMLElement>(".cx-hud__read") ?? null;
  const label = hud?.querySelector<HTMLElement>(".cx-hud__label") ?? null;
  const dot = hud?.querySelector<HTMLElement>(".cx-hud__dot") ?? null;
  if (!hud || !read || !label || !dot) {
    console.warn("[cinema/ch1] HUD DOM not found");
    return null;
  }
  const E = eases();
  const lite = ctx.isMobile;
  const digits = Array.from(read.querySelectorAll<HTMLElement>(".cx-hud__d"));
  const cellEls: HTMLElement[] = [
    dot,
    ...Array.from(read.querySelectorAll<HTMLElement>(".cx-hud__g")),
    ...Array.from(label.querySelectorAll<HTMLElement>(".cx-hud__g")),
  ];
  const cells = cellEls.map((el) => new GCell(el));
  const n = cells.length;
  const nRead = 1 + read.querySelectorAll(".cx-hud__g").length; // dot + readout cells
  const rho = cells.map((_, g) => seededRot(g + 7));
  /** EVAPORATE rtl: the last glyph leaves first; the dot leaves last. */
  const span = HUD_OUT[1] - HUD_OUT[0];
  const stagger = n > 1 ? (span - EVAP_GLYPH) / (n - 1) : 0;
  const evapStart = cells.map((_, g) => HUD_OUT[0] + (n - 1 - g) * stagger);

  if (FLAGS.DEV_ASSERT) {
    claim("CH1", hud, ["visibility"]);
    claim("CH1", cellEls, ["transform", "opacity"]);
    claim("CH1", [read, label], ["filter"]);
    claim("CH1", digits, ["textContent"]);
  }

  /* ── refresh-time geometry: font sizes + cell right edges (no per-frame reads) ── */
  let em = cells.map(() => 10);
  let box: Rect = { x: 0, y: 0, w: 0, h: 0 };
  let rightOf: number[] = cells.map(() => 0);
  let lastMask = "";
  ctx.rects.register("ch1.hud", () => {
    const r = hud.getBoundingClientRect();
    box = { x: r.left, y: r.top, w: r.width, h: r.height };
    em = cellEls.map((el) => parseFloat(getComputedStyle(el).fontSize) || 10);
    // layout offsets (untransformed: a refresh mid-pour must not skew them);
    // `.cx-hud` is the cells' offsetParent (position: absolute)
    rightOf = cellEls.map((el) => el.offsetLeft + el.offsetWidth);
    lastMask = "";
    return box;
  });

  /* ── live readout (fixed-width digit cells, write on change) ── */
  const shownDigits = ["", "", ""];
  let shown = -1;
  const write = (deg: number) => {
    const v = ((Math.round(deg) % 360) + 360) % 360;
    if (v === shown) return;
    shown = v;
    const s = HUD_COPY.azimuth(v); // "AZ ###°" — the digits are chars 3..5
    for (let i = 0; i < digits.length; i++) {
      const c = s.charAt(3 + i);
      if (c === shownDigits[i]) continue;
      shownDigits[i] = c;
      const node = digits[i].firstChild;
      if (node && node.nodeType === 3) (node as Text).nodeValue = c;
      else digits[i].textContent = c;
    }
  };

  const settleEase = gsap.parseEase("rk-settle") ?? gsap.parseEase("power3.out");
  let radar = false;
  let countFrom = -1;
  let pourFrom = -1;

  ctx.onReveal(({ quiet }) => {
    if (quiet) {
      countFrom = -1;
      pourFrom = -1;
      return;
    }
    countFrom = gsap.ticker.time + COUNT_DELAY;
    pourFrom = gsap.ticker.time + POUR.delay;
    write(0);
  });
  ctx.onPhase((p) => {
    radar = p === "radar";
    if (!radar) {
      countFrom = -1;
    }
  });

  /* ── scrubbed glyph state (EVAPORATE 30–62) ∘ reveal pour (INK time) ── */
  const st = newState();
  const ev = newState();
  let rootHidden: boolean | null = null;
  let idle: boolean | null = null;
  const blurOf = [Number.NaN, Number.NaN];
  const groups = [read, label];

  const setRootHidden = (h: boolean) => {
    if (h === rootHidden) return;
    rootHidden = h;
    // never "visible": that would pierce the hidden `.lp-stage` before the reveal
    hud.style.visibility = h ? "hidden" : "";
  };

  const writeMask = (rect: Rect | null) => {
    const key = rect ? `${Math.round(rect.x)}|${Math.round(rect.y)}|${Math.round(rect.w)}|${Math.round(rect.h)}` : "-";
    if (key === lastMask) return;
    lastMask = key;
    ctx.field.setTextMask(2, rect);
  };

  /** true once the rest state (every glyph settled, no blur) is on screen */
  let atRest = false;
  const writeGlyphs = (vh: number, t: number): number => {
    // idle at rest (vh before the exit, no pour): nothing to write
    if (pourFrom < 0 && vh <= HUD_OUT[0]) {
      if (atRest) return n - 1;
      atRest = true;
    } else atRest = false;
    let pouring = false;
    let rightmost = -1;
    for (let g = 0; g < n; g++) {
      const qE = (vh - evapStart[g]) / EVAP_GLYPH;
      evapAt(E, qE, em[g], ev);
      if (pourFrom >= 0) {
        const stg = n > 1 ? (POUR.total - POUR.glyph) / (n - 1) : 0;
        const qP = (t - pourFrom - g * stg) / POUR.glyph;
        if (qP < 1) pouring = true;
        inkAt(E, qP, em[g], rho[g], lite, st);
      } else {
        st.op = 1;
        st.y = 0;
        st.skew = 0;
        st.rot = 0;
      }
      st.op *= ev.op;
      st.y += ev.y;
      cells[g].write(st);
      if (ev.op > 0.02) rightmost = g;
    }
    if (pourFrom >= 0 && !pouring) pourFrom = -1;
    // word-level evaporation blur (desktop): the readout and the label as two words
    if (!lite) {
      for (let k = 0; k < 2; k++) {
        const a = k === 0 ? 0 : nRead;
        const b = k === 0 ? nRead - 1 : n - 1;
        const q = progress(evapStart[b], evapStart[a] + EVAP_GLYPH, vh);
        const px = Math.round(BLUR_MAX * E.evap(q) * 4) / 4;
        if (px !== blurOf[k]) {
          blurOf[k] = px;
          groups[k].style.filter = px > 0 ? `blur(${px}px)` : "";
        }
      }
    }
    return rightmost;
  };

  const apply = (vh: number, t = gsap.ticker.time) => {
    const off = !radar || vh >= HUD_OUT[1];
    if (off !== idle) {
      idle = off;
      hud.classList.toggle("is-idle", off);
    }
    setRootHidden(vh >= HUD_OUT[1]);
    if (off) {
      writeMask(null);
      return;
    }
    const rightmost = writeGlyphs(vh, t);
    if (rightmost < 0 || box.w <= 0) writeMask(null);
    else {
      const w = Math.min(box.w, rightOf[rightmost]);
      writeMask({ x: box.x - MASK_PAD, y: box.y - MASK_PAD, w: w + 2 * MASK_PAD, h: box.h + 2 * MASK_PAD });
    }
  };

  ctx.frame.add(FrameOrder.Labels, (vh, t) => {
    apply(vh, t);
    // the stage is hidden outside the radar phase and past the J1 exit: no text writes
    if (!radar || vh >= HUD_OUT[1]) return;
    const live = ctx.field.frameData.sweepBearing;
    if (countFrom < 0) {
      write(live);
      return;
    }
    const k = (t - countFrom) / COUNT_DUR;
    if (k < 0) write(0);
    else if (k < 1) write(live * settleEase(k));
    else {
      countFrom = -1;
      write(live);
    }
  });

  ctx.onDestroy(() => ctx.field.setTextMask(2, null));

  return {
    reset() {
      countFrom = -1;
      pourFrom = -1;
      shown = -1;
      for (const c of cells) c.reset();
      blurOf[0] = blurOf[1] = Number.NaN;
      rootHidden = null;
      atRest = false;
    },
    apply(vh: number) {
      apply(vh);
    },
  };
}
