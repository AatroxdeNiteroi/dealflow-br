/* ============================================================
   three/NullField.ts — no-WebGL fallback (§9.3). Owner: WP-GL.

   Same API as the live field, `ok: false`. Every GL method is a
   no-op; the score still evaluates (DOM consumers read dawn etc.);
   the anchor is the viewport centre with r from R_FALLBACK(vh);
   isDarkAt uses that lookup plus dawn. It also drives the DOM dome
   (`.cx-dome`): a dark disc of that same radius (so the target the
   brackets lock onto is visible) that swallows the frame by 465,
   opened by the dawn hole (`--dawn-r`) — one radial mask, written
   only when a radius changes. Timelines, guidance and plans run.

   v3 (spec rev 3.1 §4.10, WP2): ringScreen from the anchor
   (r = anchor.r + 14 + 6i), setPlayhead / setTextMask / setLabelChip /
   setPinned no-ops, frameData.echoes = [], lockPulse ignored; and the
   REQUIRED CSS beam over 0–352 (`.cx-null__beam`, host in Cinema.tsx,
   styles in three/nullBeam.css): one rotor — a static conic ink veil
   behind a 1.5 px gold line — rotated by `transform` from the SAME
   BeamClock as the GL beam (scroll turns it, time turns it 16 s/turn,
   the J2 hunt locks it on the target), faded by sweepGain_v3. Its hub
   sits where the GL hub would be relative to SP (up-left of the dark
   disc, receding as the camera would approach), so the hunt ends ON the
   target. Reduced motion: frozen at SWEEP_START. resetTimeLayer
   re-latches the hunt (playhead.jump).
   ============================================================ */

import "./nullBeam.css";
import { CAMERA, R_FALLBACK } from "../cinema/beats";
import { CX_STILL } from "../cinema/env";
import { clamp01, dawnFrontPx, progress, seeded, smooth01, viewW } from "../cinema/geometry";
import { createScoreState, evaluateScore } from "../cinema/field/score";
import { SWEEP_START, TWO_PI } from "./constants";
import { BeamClock, wrap2Pi } from "./field/beamClock";
import type {
  AnchorScreen,
  EchoMark,
  FieldAdapter,
  FieldFrameData,
  FieldScoreState,
  FieldTime,
  LabelChipBox,
  PauseReason,
  Rect,
  RingScreen,
  RippleEvent,
} from "../cinema/types";

function fallbackRadius(vh: number, w: number, h: number): number {
  const full = Math.hypot(w, h) / 2;
  const k = R_FALLBACK.keys;
  const val = (i: number) => (k[i][1] < 0 ? full : k[i][1]);
  if (vh <= k[0][0]) return val(0);
  for (let i = 0; i < k.length - 1; i++) {
    if (vh < k[i + 1][0]) return val(i) + (val(i + 1) - val(i)) * progress(k[i][0], k[i + 1][0], vh);
  }
  return val(k.length - 1);
}

/* CSS beam geometry, from the GL hero/R1 poses (§6.3 table, 1440×900): SP sits (64.5, 35.8) px
   right/below the hub at vh 0 and (157, 88) px at 352 — the same direction. The fallback's
   target is the viewport centre, so the CSS hub is placed at centre − dir·L(vh). */
const NB_DIR_X = 0.8743;
const NB_DIR_Y = 0.4853;
/** |SP − hub| / viewport height at vh 0 and at 352. */
const NB_L0 = 0.082;
const NB_L1 = 0.2;
/** SP's bearing from the hub (world convention: y up). */
const NB_BETA = Math.atan2(-NB_DIR_Y, NB_DIR_X);
/** The CSS beam exists over the radar only (sweepGain_v3 is 0 from 352). */
const NB_TO_VH = 400;

/** Distance from the CSS hub (at centre − dir·L) to the farthest viewport corner. */
function nbReach(w: number, h: number, L: number): number {
  const hx = w / 2 - NB_DIR_X * L;
  const hy = h / 2 - NB_DIR_Y * L;
  return Math.max(Math.hypot(hx, hy), Math.hypot(w - hx, hy), Math.hypot(hx, h - hy), Math.hypot(w - hx, h - hy));
}

export class NullField implements FieldAdapter {
  readonly ok = false;
  readonly tier = 3 as const;
  time: FieldTime = { entryZ: 0, shockR: -1, fovGate: 0, ringBoost: [0, 0, 0, 0], lockPulse: 0 };
  readonly score: FieldScoreState = createScoreState();
  frameData: FieldFrameData = { cursorLabels: [], sweepBearing: 247, sweepFlash: null, echoes: [] as EchoMark[] };

  private anchor: AnchorScreen = { x: 0, y: 0, r: 4, visible: true, inside: false };
  private dome: HTMLElement | null = null;
  private lastOpacity = -1;
  private lastDawnR = -1;
  private lastCoverR = -1;

  /* CSS beam (§4.10) */
  private readonly reduced: boolean;
  private readonly clock = new BeamClock();
  private pendingJump = false;
  private beamHost: HTMLElement | null = null;
  private rotor: HTMLElement | null = null;
  private lastXf = "";
  private lastSize = -1;
  private lastOp = -1;
  private lastK = -1;
  private lastKw = -1;

  constructor(opts?: { reduced: boolean }) {
    this.reduced = !!opts?.reduced;
    this.update(0, 0, 0);
  }

  update(vh: number, _t: number, dt: number): void {
    evaluateScore(vh, this.score);
    const w = viewW();
    const h = window.innerHeight;
    const r = fallbackRadius(vh, w, h);
    const inside = r >= Math.hypot(w, h) / 2 - 0.5 && this.score.dawn < 1;
    const half = (v: number) => Math.round(v * 2) / 2;
    this.anchor = { x: half(w / 2), y: half(h / 2), r: half(r), visible: true, inside };
    // the shared beam clock (same angle law as the GL beam): HUD AZ + Gateway needle + CSS beam
    if (this.pendingJump) {
      this.clock.jump(vh);
      this.pendingJump = false;
    }
    const motion = this.reduced || CX_STILL ? 0 : 1;
    const theta = this.reduced ? SWEEP_START : wrap2Pi(this.clock.step(vh, dt, motion, NB_BETA));
    this.frameData.sweepBearing = (theta / TWO_PI) * 360;
    this.writeDome(vh, w, h);
    this.writeBeam(vh, w, h, theta);
  }

  render(): void {}
  setVelocity(_v01: number): void {}
  flare(): void {}
  setMouse(_nx: number, _ny: number, _kind?: string): void {}
  clearMouse(): void {}
  resize(): void {}
  dispose(): void {}
  addRipple(_e: RippleEvent): void {}
  setPaused(_reason: PauseReason, _on: boolean): void {}

  getAnchorScreen(): AnchorScreen {
    return this.anchor;
  }

  /* ── v3 API (§4.10) ── */

  /** The anchor stands in for the GL ring: centre = anchor, r = anchor.r + 14 + 6i. */
  ringScreen(i: number): RingScreen {
    const a = this.anchor;
    return { x: a.x, y: a.y, r: a.r + 14 + 6 * Math.max(0, i | 0), visible: a.visible };
  }
  setPlayhead(_v: number): void {}
  /** playhead.jump / settle: re-latch the hunt from the next frame's vh. */
  resetTimeLayer(): void {
    this.pendingJump = true;
  }
  setTextMask(_i: number, _rect: Rect | null): void {}
  setLabelChip(_box: LabelChipBox): void {}
  setPinned(_indices: readonly number[]): void {}

  /** The hero pinhole (camera (0,0,16) → origin, FOV 46): the same numbers the
   *  live field gives at the hero pose, so the Gateway glide lands identically. */
  projectToScreen(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const w = viewW();
    const h = window.innerHeight;
    const [cx, cy, cz] = CAMERA.in.points[0];
    const depth = cz - z;
    if (depth <= CAMERA.near) return { x: w / 2, y: h / 2, visible: false };
    const f = h / 2 / Math.tan(((CAMERA.fovBase / 2) * Math.PI) / 180);
    const sx = w / 2 + ((x - cx) / depth) * f;
    const sy = h / 2 - ((y - cy) / depth) * f;
    return {
      x: Math.round(sx * 2) / 2,
      y: Math.round(sy * 2) / 2,
      visible: sx >= 0 && sx <= w && sy >= 0 && sy <= h,
    };
  }

  /** Screen radius of a ring on the z = −1 plane at the hero pose. */
  ringRadiusPx(worldR: number): number {
    const depth = CAMERA.in.points[0][2] + 1;
    const f = window.innerHeight / 2 / Math.tan(((CAMERA.fovBase / 2) * Math.PI) / 180);
    return (worldR / depth) * f;
  }

  sampleScreenPoints(n: number, seed: number, _atVh: number, exclude?: Rect): Array<{ x: number; y: number }> {
    const w = viewW();
    const h = window.innerHeight;
    const rnd = seeded(seed);
    const out: Array<{ x: number; y: number }> = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 40) {
      const x = 24 + rnd() * (w - 48);
      const y = 24 + rnd() * (h - 48);
      if (exclude && x > exclude.x && x < exclude.x + exclude.w && y > exclude.y && y < exclude.y + exclude.h) continue;
      out.push({ x, y });
    }
    return out;
  }

  isDarkAt(x: number, y: number): boolean {
    const a = this.anchor;
    const w = viewW();
    const h = window.innerHeight;
    if (a.inside) return Math.hypot(x - w / 2, y - h / 2) > dawnFrontPx(this.score.dawn, w, h);
    // after the dawn the camera is still inside a CLEARED sphere until the
    // membrane (the fallback r stays full-screen over 765–1605): nothing is dark
    if (this.score.dawn >= 1 && this.score.lit < 1) return false;
    if (this.score.lit >= 1) return false;
    return Math.hypot(x - a.x, y - a.y) < a.r;
  }

  /** The DOM stand-in for the company sphere: a dark disc of the fallback
   *  radius (the same r the anchor reports, so the brackets lock onto a
   *  visible target), which swallows the frame by 465 and is then opened by
   *  the dawn hole. One radial mask carries both radii; written on change. */
  private writeDome(vh: number, w: number, h: number): void {
    if (!this.dome) this.dome = document.querySelector<HTMLElement>(".cx-dome");
    const el = this.dome;
    if (!el) return;
    const opacity = this.score.dawn >= 1 ? 0 : 1;
    if (opacity !== this.lastOpacity) {
      el.style.opacity = String(opacity);
      this.lastOpacity = opacity;
    }
    const dawnR = Math.round(dawnFrontPx(this.score.dawn, w, h));
    const coverR = Math.round(fallbackRadius(vh, w, h) * 2) / 2;
    if (dawnR !== this.lastDawnR || coverR !== this.lastCoverR) {
      el.style.setProperty("--dawn-r", dawnR + "px");
      const full = coverR >= Math.hypot(w, h) / 2 - 0.5;
      const edge = full ? "#000 100%" : `#000 ${coverR}px, transparent ${coverR + 0.75}px`;
      const mask = `radial-gradient(circle at 50% 50%, transparent ${dawnR}px, #000 ${dawnR + 0.75}px, ${edge})`;
      el.style.setProperty("-webkit-mask-image", mask);
      el.style.setProperty("mask-image", mask);
      this.lastDawnR = dawnR;
      this.lastCoverR = coverR;
    }
  }

  /** The CSS beam: one rotor at the hub, `translate(hub) rotate(−θ)`, opacity and the needle's
   *  two scale variables written only on change (θ quantised to 0.05°, hub to 0.25 px, opacity
   *  to 1/250, needle to 1/500); size only on resize. */
  private writeBeam(vh: number, w: number, h: number, theta: number): void {
    if (this.rotor && !this.rotor.isConnected) {
      // the host was re-mounted: rebuild the rotor in the live one
      this.rotor = null;
      this.beamHost = null;
      this.lastXf = "";
      this.lastSize = -1;
      this.lastOp = -1;
      this.lastK = -1;
      this.lastKw = -1;
    }
    if (!this.rotor) {
      if (!this.beamHost) this.beamHost = document.querySelector<HTMLElement>(".cx-null__beam");
      const host = this.beamHost;
      if (!host) return;
      const rotor = document.createElement("div");
      rotor.className = "cx-null__rotor";
      host.appendChild(rotor);
      this.rotor = rotor;
    }
    const el = this.rotor;
    const op = vh < NB_TO_VH ? Math.round(clamp01(this.score.sweepGain_v3) * 250) / 250 : 0;
    if (op !== this.lastOp) {
      el.style.opacity = String(op);
      el.style.visibility = op > 0 ? "visible" : "hidden";
      this.lastOp = op;
    }
    if (op <= 0) return;
    // hub: up-left of the target, receding as the GL camera would approach (vh 0 → 352)
    const L = h * (NB_L0 + (NB_L1 - NB_L0) * smooth01(clamp01(vh / 352)));
    const hx = w / 2 - NB_DIR_X * L;
    const hy = h / 2 - NB_DIR_Y * L;
    // the rotor reaches the farthest viewport corner from ANY hub of the path (the distance to a
    // corner is convex in the hub position, so the path's two ends bound it): a size that only
    // changes on resize, never per frame (no layout while scrolling)
    const reach = Math.max(nbReach(w, h, NB_L0 * h), nbReach(w, h, NB_L1 * h));
    const size = Math.ceil(reach * 2 + 2);
    if (size !== this.lastSize) {
      el.style.width = size + "px";
      el.style.height = size + "px";
      this.lastSize = size;
    }
    const q = (v: number, step: number) => Math.round(v / step) * step;
    const deg = q((-theta * 180) / Math.PI, 0.05);
    const xf = `translate3d(${q(hx - size / 2, 0.25)}px, ${q(hy - size / 2, 0.25)}px, 0) rotate(${deg.toFixed(2)}deg)`;
    if (xf !== this.lastXf) {
      el.style.transform = xf;
      this.lastXf = xf;
    }
    // J2 needle (as the GL beam's): the line and its veil shorten until they end on the target
    // (hidden under the disc) and the line thickens 1.5 → 2.25 px — two compositor-only scales
    const needle = clamp01(this.score.needle);
    const kEnd = Math.min(1, (L + 0.95 * this.anchor.r) / (size / 2));
    const k = Math.round((1 + (kEnd - 1) * needle) * 500) / 500;
    const kw = Math.round((1 + 0.5 * needle) * 100) / 100;
    if (k !== this.lastK || kw !== this.lastKw) {
      el.style.setProperty("--nb-k", String(k));
      el.style.setProperty("--nb-w", String(kw));
      el.style.setProperty("--nb-f", Math.round(58 + 38 * needle) + "%");
      this.lastK = k;
      this.lastKw = kw;
    }
  }
}
