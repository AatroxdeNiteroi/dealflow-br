/* ============================================================
   three/constants.ts — engine constants and colours (WP-GL).

   Two colour families, on purpose:
   - LINEAR (THREE.Color, colour-managed → stored linear, written
     raw by our ShaderMaterials): the points, sweep and dark sphere
     keep TODAY's look exactly (park parity, §7.11 / §12.3 WP-GL).
   - SRGB (raw 0..1 triplets): new surfaces that must equal a DOM
     colour to the pixel — the interior dome (respiro contrast), the
     lit body (= paper), the gold rim/line (= the DOM #cf9b1e border
     at the C4a handoff), the instrument lines (= today's #241a10).
   ============================================================ */

import * as THREE from "three";
import { RING_WORLD_R } from "../cinema/beats";

export const TWO_PI = Math.PI * 2;

/* ── field layout (today's grid) ────────────────────────────── */
export const COLS = 66;
export const ROWS = 42;
export const GRID_COUNT = COLS * ROWS; // 2772
export const FIELD_W = 26.4;
export const FIELD_H = 17.0;
/** Fixed seed: same grid every load (captures, labels and chips are stable). */
export const FIELD_SEED = 0x6e5630;
/** The narrative count: base + dust at T0 = exactly 117.965 points. */
export const TOTAL_POINTS = 117965;

/* ── sweep / charge (today's constants) ─────────────────────── */
export const TRAIL = 1.15;
export const SWEEP_SPEED = TWO_PI / 19;
export const SWEEP_RADIUS = 13.5;
export const CHARGE_LIFE = 6.5;
/** Analytic charge span in radians behind the sweep (= the CPU trail of today). */
export const CHARGE_SPAN = SWEEP_SPEED * CHARGE_LIFE;
export const SWEEP_START = 2.3;
export const MOUSE_RADIUS = 0.34;
/** Points inside 1.4R of SP are removed: nothing sits inside the company. */
export const SP_EXCLUDE = 1.4;

/* ── instrument (today's radii) ─────────────────────────────── */
export const RING_RADII = RING_WORLD_R;
export const RING_SEGMENTS = 96;
export const TICK_COUNT = 60;
export const INSTRUMENT_Z = -1;

/* ── colours ────────────────────────────────────────────────── */
const lin = (hex: number) => new THREE.Color(hex);
const srgb = (hex: number) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

export const LINEAR = {
  ink: () => lin(0x6e5630),
  inkDeep: () => lin(0x120e08),
  gold: () => lin(0xcf9b1e),
  goldHot: () => lin(0xd99f1c),
  sphereB: () => lin(0x0c0a07),
  sphereL: () => lin(0x4a3a22),
  sphereRim: () => lin(0xd9a441),
};

export const SRGB = {
  domeCentre: () => srgb(0x1d140b),
  domeEdge: () => srgb(0x0c0a07),
  gold: () => srgb(0xcf9b1e),
  goldCore: () => srgb(0xf3c560),
  litA: () => srgb(0xe9e1cf),
  litB: () => srgb(0xfbf9f4),
  ink: () => srgb(0x1f1812),
  line: () => srgb(0x241a10),
};
