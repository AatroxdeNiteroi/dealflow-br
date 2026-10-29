/* ============================================================
   cinema/dev/checks.ts — pure contract checks (spec rev 3.1, WP0).

   No DOM, no GSAP: the same functions run in the browser (dev asserts,
   cinema/dev/assert.ts) and in node (unit tests under
   scratchpad/work/v3qa/wp0). Every check returns a list of violations;
   an empty list means the contract holds.

   - §4.2 rule 1 neutral at park: every NEW channel equals its neutral
     value for vh ≥ 1890 (glowTau 1.6, ringFade 1, others 0); every
     `_v3` channel equals its v2 channel there (park parity).
   - §4.2 rule 2 flat plateaus: every SCORE channel is constant over every
     plateau R1–R7, sampled every 0.25 vh (|max − min| ≤ 1e−9: the gauss
     tails, ~1e−39, count as flat). v2 violations are listed and accepted
     only when the baseline has the identical violation.
   - §4.2 rule 3 J2 reset: seek, needle, ringTravel*, ringMerge reach 0 and
     ringFade 1 over 398–400, and stay there.
   - §2.3 pour before plateau: every scrubbed text pour ends at or before
     the start of the next rest plateau (P1); no text changes inside a
     plateau (P3); inside a read window every pour that starts before the
     rest is settled by the window's `full` mark (P2).
   - §2.2 track sum: the master's scroll span in vh (px over the measured
     height of a 100vh probe, ×100) equals S_END(profile) within 0.5.
   ============================================================ */

import {
  J2_RESET,
  PARK_NEUTRAL_FROM,
  RESTS,
  SCORE,
  SCORE_V3_NEW,
  neutralOf,
  type ScoreChannel,
  type TextWindowKind,
} from "../beats";
import { evalChannel } from "../geometry";
import { READ_WINDOWS, S_END, type DilationProfile } from "../dilation";

export interface Violation {
  rule: string;
  id: string;
  detail: string;
}

const STEP = 0.25;
const TOL = 1e-9;
const EPS_VH = 1e-6;
const ALL = Object.keys(SCORE) as ScoreChannel[];

const r4 = (v: number): string => (Math.round(v * 1e4) / 1e4).toString();

/* ── §4.2 rule 1 ─────────────────────────────────────────────── */

export function checkNeutralAtPark(to = 1960): Violation[] {
  const out: Violation[] = [];
  for (const c of SCORE_V3_NEW) {
    const n = neutralOf(c);
    for (let vh = PARK_NEUTRAL_FROM; vh <= to; vh += STEP) {
      const v = evalChannel(SCORE[c], vh);
      if (Math.abs(v - n) > TOL) {
        out.push({ rule: "neutral-at-park", id: c, detail: `${c}(${vh}) = ${r4(v)}, neutral ${n}` });
        break;
      }
    }
  }
  return out;
}

/* ── §4.2 rule 2 ─────────────────────────────────────────────── */

export function checkFlatPlateaus(channels: readonly ScoreChannel[] = ALL): Violation[] {
  const out: Violation[] = [];
  for (const r of RESTS) {
    if (!r.plateau) continue;
    const [a, b] = r.plateau;
    for (const c of channels) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let vh = a; vh <= b + 1e-9; vh += STEP) {
        const v = evalChannel(SCORE[c], vh);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi - lo > TOL) out.push({ rule: "flat-plateau", id: `${c}@${r.id}`, detail: `${c} varies by ${r4(hi - lo)} over ${a}–${b}` });
    }
  }
  return out;
}

/* ── §4.2 rule 3 ─────────────────────────────────────────────── */

export function checkJ2Reset(to = 1960): Violation[] {
  const out: Violation[] = [];
  const targets: Array<[ScoreChannel, number]> = [
    ...J2_RESET.toZero.map((c) => [c as ScoreChannel, 0] as [ScoreChannel, number]),
    ...J2_RESET.toOne.map((c) => [c as ScoreChannel, 1] as [ScoreChannel, number]),
  ];
  for (const [c, target] of targets) {
    // held over [plateau R1 start, 398] (no change between the lock and the reset) …
    const held = evalChannel(SCORE[c], 352);
    for (let vh = 352; vh <= J2_RESET.from + 1e-9; vh += STEP) {
      const v = evalChannel(SCORE[c], vh);
      if (Math.abs(v - held) > TOL) {
        out.push({ rule: "j2-reset", id: c, detail: `${c} moves at ${vh} (before the 398–400 reset)` });
        break;
      }
    }
    // … and at its rest value from 400 on
    for (let vh = J2_RESET.to; vh <= to; vh += STEP) {
      const v = evalChannel(SCORE[c], vh);
      if (Math.abs(v - target) > TOL) {
        out.push({ rule: "j2-reset", id: c, detail: `${c}(${vh}) = ${r4(v)}, expected ${target} from ${J2_RESET.to}` });
        break;
      }
    }
  }
  return out;
}

/** Every §4.2 rule at once. */
export function checkScore(): Violation[] {
  return [...checkNeutralAtPark(), ...checkFlatPlateaus(), ...checkJ2Reset()];
}

/** SCORE dump at the given vh (dev, §10 WP0 done-when). */
export function scoreDump(vhs: readonly number[], channels: readonly ScoreChannel[] = ALL): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const vh of vhs) {
    const row: Record<string, number> = {};
    for (const c of channels) row[c] = evalChannel(SCORE[c], vh);
    out[String(vh)] = row;
  }
  return out;
}

/* ── §2.3 pour before plateau ────────────────────────────────── */

export interface PourItem {
  id: string;
  from: number;
  to: number;
  kind: TextWindowKind;
}

export function checkPours(items: readonly PourItem[]): Violation[] {
  const out: Violation[] = [];
  const plateaus = RESTS.filter((r) => r.plateau).map((r) => ({ id: r.id, a: r.plateau![0], b: r.plateau![1] }));
  for (const it of items) {
    if (it.kind !== "pour" && it.kind !== "exit") continue;
    if (it.kind === "pour") {
      const next = plateaus.find((p) => p.b > it.from + EPS_VH);
      if (next && it.to > next.a + EPS_VH) {
        out.push({ rule: "P1 pour-before-plateau", id: it.id, detail: `${it.id} ${r4(it.from)}–${r4(it.to)} ends after ${next.id}'s plateau starts (${next.a})` });
      }
    }
    for (const p of plateaus) {
      if (it.from < p.b - EPS_VH && it.to > p.a + EPS_VH) {
        out.push({ rule: "P3 no-text-change-on-plateau", id: it.id, detail: `${it.id} ${r4(it.from)}–${r4(it.to)} overlaps ${p.id} ${p.a}–${p.b}` });
      }
    }
  }
  for (const d of READ_WINDOWS) {
    const rest = RESTS.find((r) => r.id === d.rest);
    if (!rest || !rest.plateau || d.full === undefined) continue;
    const restStart = rest.plateau[0];
    for (const it of items) {
      if (it.kind !== "pour") continue;
      if (it.from < restStart - EPS_VH && it.to > d.from + EPS_VH && it.to > d.full + EPS_VH) {
        out.push({ rule: "P2 read-window-settled", id: it.id, detail: `${it.id} ends at ${r4(it.to)}, after ${d.id}'s text-full mark ${d.full} (${d.rest})` });
      }
    }
  }
  return out;
}

type Win = readonly [number, number] | { from: number; to: number };
const span = (w: Win): [number, number] => (Array.isArray(w) ? [w[0], w[1]] : [(w as { from: number }).from, (w as { to: number }).to]);

/** v2 dossier T keys that are text (everything else is a panel or a move). */
const V2_DOSSIER_TEXT: Record<string, "pour" | "exit"> = {
  desc: "pour", label: "pour", reelIn: "pour", caption: "pour", revIn: "pour", c2Lead: "pour", c2Sub: "pour",
  reel1: "pour", est: "pour", endsWords: "pour", c3Lead: "pour", c3Sub: "pour", reel2: "pour",
  c2Drop: "exit", c2Fade: "exit", captionOut: "exit", revOut: "exit", c3Drop: "exit", c3Fade: "exit",
  eyebrowOut: "exit", pinnedOut: "exit",
  // v3 names (if a table already uses them)
  c2Evap: "exit", c3Evap: "exit",
};
const V2_CH4_TEXT: Record<string, "pour" | "exit"> = { label: "pour", lead: "pour", sub: "pour", closeOut: "exit" };

export interface RespiroTiming {
  rise: { start: number; step: number; len: number };
  dolly: { from: number; to: number };
}

/** Pour items of the live (v2-shaped) tables: dossier T, CH4_T, RESPIRO_T. */
export function pourItemsFromTables(
  dossierT: Readonly<Record<string, unknown>>,
  ch4T: Readonly<Record<string, unknown>>,
  respiro: RespiroTiming,
  respiroWords: number,
): PourItem[] {
  const items: PourItem[] = [];
  for (const [k, kind] of Object.entries(V2_DOSSIER_TEXT)) {
    const w = dossierT[k] as Win | undefined;
    if (!w || typeof w !== "object") continue;
    const [a, b] = span(w);
    items.push({ id: `T.${k}`, from: a, to: b, kind });
  }
  for (const [k, kind] of Object.entries(V2_CH4_TEXT)) {
    const w = ch4T[k] as Win | undefined;
    if (!w || typeof w !== "object") continue;
    const [a, b] = span(w);
    items.push({ id: `CH4_T.${k}`, from: a, to: b, kind });
  }
  for (let i = 0; i < respiroWords; i++) {
    const a = respiro.rise.start + i * respiro.rise.step;
    items.push({ id: `RESPIRO_T.rise[${i}]`, from: a, to: a + respiro.rise.len, kind: "pour" });
  }
  items.push({ id: "RESPIRO_T.dolly", from: respiro.dolly.from, to: respiro.dolly.to, kind: "exit" });
  return items;
}

/** Pour items of a TEXT_V3-shaped table ({ dossier: {k: {from,to,kind}}, ch4: {…} }). */
export function pourItemsFromV3(
  text: { dossier: Readonly<Record<string, { from: number; to: number; kind: TextWindowKind }>>; ch4: Readonly<Record<string, { from: number; to: number; kind: TextWindowKind }>> },
  respiro: RespiroTiming,
  respiroWords: number,
): PourItem[] {
  const items: PourItem[] = [];
  for (const [k, w] of Object.entries(text.dossier)) items.push({ id: `T.${k}`, from: w.from, to: w.to, kind: w.kind });
  for (const [k, w] of Object.entries(text.ch4)) items.push({ id: `CH4_T.${k}`, from: w.from, to: w.to, kind: w.kind });
  for (let i = 0; i < respiroWords; i++) {
    const a = respiro.rise.start + i * respiro.rise.step;
    items.push({ id: `RESPIRO_T.rise[${i}]`, from: a, to: a + respiro.rise.len, kind: "pour" });
  }
  items.push({ id: "RESPIRO_T.dolly", from: respiro.dolly.from, to: respiro.dolly.to, kind: "exit" });
  return items;
}

/* ── §2.2 track sum ──────────────────────────────────────────── */

export interface TrackCheck {
  ok: boolean;
  /** measured master scroll span in vh ((st.end − st.start) / (probe100 / 100)) */
  got: number;
  expected: number;
  profile: DilationProfile;
  /** the measured span is v2's 1900 (WP1 has not landed the v3 track CSS yet) */
  v2Tracks: boolean;
}

export function checkTrackSpan(spanVh: number, profile: DilationProfile): TrackCheck {
  const expected = S_END(profile);
  return { ok: Math.abs(spanVh - expected) < 0.5, got: spanVh, expected, profile, v2Tracks: Math.abs(spanVh - 1900) < 0.5 };
}
