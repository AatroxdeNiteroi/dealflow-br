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

   v3 (spec rev 3.1 §4.10, WP0 stubs → WP2): ringScreen from the anchor
   (r = anchor.r + 14 + 6i), setPlayhead / setTextMask / setLabelChip /
   setPinned / resetTimeLayer no-ops, frameData.echoes = [], lockPulse
   ignored. WP2 adds the REQUIRED CSS beam (`.cx-null__beam`, host in
   Cinema.tsx) driven by the shared BeamClock (field/beamClock.ts).
   ============================================================ */

import { CAMERA, R_FALLBACK } from "../cinema/beats";
import { dawnFrontPx, progress, seeded, viewW } from "../cinema/geometry";
import { createScoreState, evaluateScore } from "../cinema/field/score";
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

  constructor(_opts?: { reduced: boolean }) {
    this.update(0, 0, 0);
  }

  update(vh: number, t: number, _dt: number): void {
    evaluateScore(vh, this.score);
    const w = viewW();
    const h = window.innerHeight;
    const r = fallbackRadius(vh, w, h);
    const inside = r >= Math.hypot(w, h) / 2 - 0.5 && this.score.dawn < 1;
    const half = (v: number) => Math.round(v * 2) / 2;
    this.anchor = { x: half(w / 2), y: half(h / 2), r: half(r), visible: true, inside };
    // a slow static bearing keeps the HUD/needle alive without GL
    this.frameData.sweepBearing = (247 + t * (360 / 19)) % 360;
    this.writeDome(vh, w, h);
  }

  render(): void {}
  setVelocity(_v01: number): void {}
  flare(): void {}
  setMouse(_nx: number, _ny: number): void {}
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
  resetTimeLayer(): void {}
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
}
