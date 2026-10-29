/* ============================================================
   cinema/director.ts — the master timeline and the scroll geometry
   (spec rev 3.1 §2.2, §6.2, §8.2; WP1).

   ONE paused timeline, time unit = 1 master vh, duration fixed at
   MASTER_END (1900). It no longer has a ScrollTrigger of its own:
   the clock writes it from the followed playhead (cinema/playhead.ts),
   `tl.time(vh)` once per frame and only when vh moved.

   ScrollTrigger is kept for GEOMETRY ONLY: one trigger, same as v2
   (.lp-scroll "top top" → .ch4-track "bottom bottom" = .ch5-track
   "top bottom", so Ch5 chains unchanged), no animation, no scrub. It
   is created first (creation order = scroll order: teleport's settle
   loop and refresh order depend on it), and settleScrubbed() skips it
   naturally (no scrub).

   Scroll space (§0.2, §2.2):
     s      = progress · S_END(profile)              s-vh, what the wheel moves
     target = W(s)                                    master vh the scroll maps to
     vhToPx(vh) = st.start + Winv(vh)/S_END·(st.end − st.start)
     pxToVh(px) = W((px − st.start)/(st.end − st.start)·S_END)
   The profile is "fine" or "coarse" (`(pointer: coarse)`, the media
   query the track CSS uses). FLAGS.DILATION / TOUCH_DILATION = false
   give the identity map for that profile (S_END = 1900, W(s) = s) and
   put `html.cx-nodil` on, which switches landing.css back to the v2
   tracks (dev only: production ships both on).

   Refresh (§6.2, §2.2): the master has no ScrollTrigger, so the
   director replays what `invalidateOnRefresh` did:
     refreshInit → remember the followed vh x and the target vh (the
                   scroll position, read with the OLD geometry);
     refresh     → (1) keep the story where it was: if the target sat
                   inside the cinema and the new geometry maps the
                   unchanged scroll px elsewhere (a resize changes every
                   vh-based track in px), the scroll is moved back to
                   vhToPx(target) (immediate); (2) replay the master:
                   progress(0, true).invalidate(), immediateRender
                   children re-rendered at 0 (as ScrollTrigger does),
                   tl.time(x, true): every function-based value
                   (closeShift(), innerHeight·k) is re-evaluated against
                   the rects measured on refreshInit; (3) listeners run
                   and the glyph writer writes every block (onRefreshed).
   A profile change (hybrid devices) is detected on refresh (and a
   refresh is forced from the matchMedia `change`): the master vh never
   jumps — scroll → vhToPx(x) under the new profile and playhead.jump(x).

   Geometry hold: between a layout-changing resize and the refresh that
   re-measures it, st.start/st.end are stale while the browser may move
   the scroll (clamping, scroll anchoring). The target is held at its
   last value until the refresh (or a 1.2 s safety timeout), so a
   rotation or a window resize never drags the playhead. Height-only
   resizes on touch devices (URL bar) mirror ScrollTrigger's
   ignoreMobileResize: no hold (CSS vh, hence the tracks, do not move).
   ============================================================ */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
import { BEATS, MASTER_END, RESTS } from "./beats";
import { FLAGS } from "./flags";
import { S_END, W as dilW, Winv as dilWinv, type DilationProfile } from "./dilation";

/** The playhead surface the director needs on refresh / profile change. */
export interface DirectorPlayhead {
  vh(): number;
  jump(vh: number): void;
}

export interface Director {
  tl: gsap.core.Timeline;
  /** Geometry-only trigger (no animation). */
  st: ScrollTrigger;
  /** Last master vh written (= the followed playhead). */
  vh(): number;
  /** Write the master at vh (tl.time + listeners) when it moved, or always with `force`. */
  render(vh: number, force?: boolean): boolean;
  /** Listeners run after every master write (acts + guide bookkeeping only). */
  listen(fn: (vh: number) => void): () => void;

  /* ── scroll space ── */
  profile(): DilationProfile;
  /** Dilation active for the current profile (false = identity map, v2 tracks). */
  dilated(): boolean;
  /** s-vh at the master end for the current map. */
  sEnd(): number;
  /** master vh → s-vh (current map). */
  Winv(vh: number): number;
  /** s-vh → master vh (current map). */
  W(s: number): number;
  /** Current scroll position in s-vh, clamped to [0, sEnd] (held while the geometry is stale). */
  s(): number;
  /** The follower's target: W(s()) in [0, MASTER_END]. */
  target(): number;
  /** Master vh → document scroll px (valid after the trigger's refresh). */
  vhToPx(vh: number): number;
  /** Document scroll px → master vh (unclamped; > MASTER_END past the cinema). */
  pxToVh(px: number): number;

  /** Hook the playhead and the refresh side effects (index.ts, once). */
  bind(o: { playhead: DirectorPlayhead; onRefreshed(vh: number): void }): void;
  /** Dev / QA only (golden frames): scroll to vh and hold the target at EXACTLY vh while the scroll
   *  stays within 1.5 px of it (window scroll px are integers: ±0.055 vh otherwise); any real scroll
   *  releases it. null releases at once. */
  devPin(vh: number | null): void;
  dispose(): void;
}

const COARSE = "(pointer: coarse)";
/** Hold safety: release a stale-geometry hold if no refresh came (ScrollTrigger refreshes ~0.2 s after a resize). */
const HOLD_TIMEOUT_MS = 1200;

const identity = (v: number): number => v;

export function createDirector(opts: { lenis: Lenis | null }): Director {
  const { lenis } = opts;
  const listeners = new Set<(vh: number) => void>();

  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } }); // local; global gsap.defaults stays rk-settle for Ch5
  // fixes the duration: 1 timeline second = 1 vh
  tl.to({}, { duration: MASTER_END }, 0);
  for (const r of RESTS) tl.addLabel(r.id, r.at);
  for (const b of BEATS) tl.addLabel(b.id, b.start);

  const st = ScrollTrigger.create({
    trigger: ".lp-scroll",
    start: "top top",
    endTrigger: ".ch4-track",
    end: "bottom bottom",
  });

  /* ── profile + map ──────────────────────────────────────────── */
  const mql = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(COARSE) : null;
  const liveProfile = (): DilationProfile => (mql && mql.matches ? "coarse" : "fine");
  const dilatedFor = (p: DilationProfile): boolean => (p === "coarse" ? FLAGS.TOUCH_DILATION : FLAGS.DILATION);
  let profile: DilationProfile = liveProfile();
  let dilated = dilatedFor(profile);
  let sEnd = dilated ? S_END(profile) : MASTER_END;
  let mapW: (s: number) => number = dilated ? (s) => dilW(s, profile) : identity;
  let mapWinv: (vh: number) => number = dilated ? (vh) => dilWinv(vh, profile) : identity;
  const applyProfile = (p: DilationProfile) => {
    profile = p;
    dilated = dilatedFor(p);
    sEnd = dilated ? S_END(p) : MASTER_END;
    mapW = dilated ? (s) => dilW(s, p) : identity;
    mapWinv = dilated ? (vh) => dilWinv(vh, p) : identity;
    // CSS: the identity map scrolls the v2 tracks (dev flags only)
    if (typeof document !== "undefined") document.documentElement.classList.toggle("cx-nodil", !dilated);
  };
  applyProfile(profile);

  const scrollPx = (): number => (lenis ? lenis.scroll : st.scroll());
  const span = (): number => st.end - st.start;

  /* ── geometry hold (resize → refresh) ───────────────────────── */
  let held = false;
  let heldS = 0;
  let heldAt = 0;
  let baseW = typeof window !== "undefined" ? window.innerWidth : 0;
  let baseH = typeof window !== "undefined" ? window.innerHeight : 0;
  const sRaw = (): number => {
    const d = span();
    if (!(d > 0)) return 0;
    const p = (scrollPx() - st.start) / d;
    return (p < 0 ? 0 : p > 1 ? 1 : p) * sEnd;
  };
  // dev / QA pin (devPin): exact master vh for golden frames
  let pinVh: number | null = null;
  let pinPx = 0;
  const sNow = (): number => {
    if (pinVh !== null) {
      if (Math.abs(scrollPx() - pinPx) <= 1.5) return mapWinv(pinVh);
      pinVh = null; // a real scroll moved away
    }
    if (held) {
      if (performance.now() - heldAt < HOLD_TIMEOUT_MS) return heldS;
      held = false; // no refresh came: the geometry did not change after all
    }
    return sRaw();
  };
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === baseW && h === baseH) return;
    // ScrollTrigger's ignoreMobileResize: a touch device's height-only change
    // (URL bar) under 25 % never refreshes, and CSS vh (the tracks) stay put
    if (w === baseW && ScrollTrigger.isTouch === 1 && Math.abs(h - baseH) <= h * 0.25) return;
    if (!held) {
      heldS = sRaw();
      held = true;
    }
    heldAt = performance.now();
  };
  window.addEventListener("resize", onResize);

  /* ── master writes ─────────────────────────────────────────── */
  let cur = 0;
  const render = (vh: number, force = false): boolean => {
    if (!force && vh === cur) return false;
    cur = vh;
    tl.time(vh);
    listeners.forEach((fn) => fn(vh));
    return true;
  };

  /** §6.2 refresh replay (what invalidateOnRefresh did for the scrubbed master). */
  const replay = (vh: number) => {
    tl.progress(0, true).invalidate();
    // as ScrollTrigger's invalidateOnRefresh: from()/fromTo() children re-render their start
    tl.getChildren(true, true, false).forEach((t) => {
      if (t.vars.immediateRender) t.render(0, true, true);
    });
    cur = vh;
    tl.time(vh, true);
    tl.time(vh);
    listeners.forEach((fn) => fn(vh));
  };

  /* ── refresh orchestration ─────────────────────────────────── */
  let bound: { playhead: DirectorPlayhead; onRefreshed(vh: number): void } | null = null;
  let pending: { x: number; target: number } | null = null;

  const onRefreshInit = () => {
    if (!bound || pending) return;
    // read with the OLD geometry and the OLD profile (consistent pair)
    const s = sNow();
    pending = { x: bound.playhead.vh(), target: Math.min(MASTER_END, Math.max(0, mapW(s))) };
    // a profile flip switches the dilation class BEFORE the triggers re-measure
    const lp = liveProfile();
    if (lp !== profile && dilatedFor(lp) !== dilated) document.documentElement.classList.toggle("cx-nodil", !dilatedFor(lp));
  };

  const onRefresh = () => {
    held = false;
    baseW = window.innerWidth;
    baseH = window.innerHeight;
    const r = pending;
    pending = null;
    if (!bound || !r) return;
    let jump = false;
    const lp = liveProfile();
    if (lp !== profile) {
      applyProfile(lp);
      jump = true; // §2.2: the master vh never jumps across a profile change
    }
    // (1) keep the story where it was (only inside the cinema: Ch5+ keeps its px)
    const keep = jump ? r.x : r.target;
    if (keep < MASTER_END && span() > 0) {
      const px = st.start + (mapWinv(keep) / sEnd) * span();
      if (Math.abs(px - scrollPx()) > 0.5) {
        if (lenis) {
          lenis.resize(); // fresh limit before the clamp inside scrollTo
          lenis.scrollTo(px, { immediate: true, force: true });
        } else {
          window.scrollTo(0, px);
        }
      }
    }
    // (2) master replay with fresh function-based values, (3) listeners + glyphs
    replay(r.x);
    if (jump) bound.playhead.jump(r.x);
    else bound.onRefreshed(r.x);
  };

  ScrollTrigger.addEventListener("refreshInit", onRefreshInit);
  ScrollTrigger.addEventListener("refresh", onRefresh);

  const onProfileChange = () => {
    // a refresh that already ran (a matchMedia-driven one) may have switched it
    if (liveProfile() !== profile) ScrollTrigger.refresh();
  };
  mql?.addEventListener("change", onProfileChange);

  return {
    tl,
    st,
    vh: () => cur,
    render,
    listen(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    profile: () => profile,
    dilated: () => dilated,
    sEnd: () => sEnd,
    Winv: (vh) => mapWinv(vh),
    W: (s) => mapW(s),
    s: sNow,
    target() {
      const s = sNow();
      if (pinVh !== null) return pinVh;
      const v = mapW(s);
      return v < 0 ? 0 : v > MASTER_END ? MASTER_END : v;
    },
    vhToPx: (vh) => st.start + (mapWinv(vh) / sEnd) * span(),
    pxToVh: (px) => {
      const d = span();
      return d > 0 ? mapW(((px - st.start) / d) * sEnd) : 0;
    },
    bind(o) {
      bound = o;
    },
    devPin(vh) {
      if (vh === null) {
        pinVh = null;
        return;
      }
      const v = Math.min(MASTER_END, Math.max(0, vh));
      const px = st.start + (mapWinv(v) / sEnd) * span();
      if (lenis) lenis.scrollTo(px, { immediate: true, force: true });
      else window.scrollTo(0, px);
      pinPx = Math.round(px);
      pinVh = v;
    },
    dispose() {
      window.removeEventListener("resize", onResize);
      mql?.removeEventListener("change", onProfileChange);
      ScrollTrigger.removeEventListener("refreshInit", onRefreshInit);
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      document.documentElement.classList.remove("cx-nodil");
      st.kill();
      tl.kill();
      listeners.clear();
      bound = null;
    },
  };
}
