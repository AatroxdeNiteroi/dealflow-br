/* ============================================================
   three/gpuTimer.ts — GPU time per draw (QA PERF-3 / PERF-6) and the
   v3 `?cx-perf` per-beat log (spec rev 3.1 §9.4, §11 items 41–43).
   Owner: WP8.

   EXT_disjoint_timer_query_webgl2 TIME_ELAPSED queries, read back a few
   frames later (never in the frame they were issued: results only exist
   once control returns to the browser). Disjoint results are dropped.
   At most one query is open at a time (the extension forbids nesting)
   and at most RING are in flight; when either limit is hit the draw is
   simply not timed. Without the extension `ok` is false and nothing is
   ever measured (the governor then falls back to frame intervals).

   `?cx-perf` (any build: perf runs use the production preview, §10.2):
   every frame query (the recurring render callback — PointField's
   `onGpu`; one-off warm-up timings are not frames) is attributed to the
   beat that was on screen WHEN IT WAS ISSUED (not when it is read back),
   and an independent rAF recorder measures frame intervals against the
   panel's vsync interval I (low quartile of the first 120 frames — §4.9
   says median; the boot frames are often slow multiples of I):
   a frame is dropped when its interval exceeds 1.5·I. Per beat it keeps
   GPU ms p50/p95, frame p50/p95, dropped %, and logs a line with
   console.info("[cx-perf] …") each time a beat is left; the whole table
   is `window.__cxPerf.table()` / `.print()` / `.reset()`. The beat clock
   (master vh + phase) is attached by the guide machine (`cxPerf.attach`).
   With the flag absent `cxPerf` is null and nothing here runs.
   ============================================================ */

import { BEATS, MASTER_END } from "../cinema/beats";

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

interface Pending {
  q: WebGLQuery;
  cb: (ms: number) => void;
  /** cx-perf: beat on screen when the query was issued (frame queries only) */
  beat: string | null;
}

const RING = 4;

/* ── ?cx-perf per-beat log ─────────────────────────────────────── */

export interface PerfRow {
  beat: string;
  frames: number;
  dropped: number;
  droppedPct: number;
  frameP50: number;
  frameP95: number;
  gpuN: number;
  gpuP50: number;
  gpuP95: number;
}

const pct = (a: number[], p: number): number => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))];
};
const r2 = (v: number): number => Math.round(v * 100) / 100;

export class CxPerfLog {
  private vhOf: (() => number) | null = null;
  private phaseOf: (() => string) | null = null;
  private readonly gpu = new Map<string, number[]>();
  private readonly frames = new Map<string, number[]>();
  private readonly drops = new Map<string, number>();
  private readonly warm: number[] = [];
  private vsync = 0;
  private lastTs = -1;
  private curBeat = "boot";
  private visitStart = 0;
  private running = false;

  /** The beat clock: master vh and phase (attached by the guide machine). */
  attach(vh: () => number, phase: () => string): void {
    this.vhOf = vh;
    this.phaseOf = phase;
    if (!this.running) this.start();
  }

  /** Beat id on screen now: GW / GW-enter / J1 … C4d (plateaus count with the beat they end) / Ch5. */
  beatNow(): string {
    const ph = this.phaseOf ? this.phaseOf() : "gateway";
    if (ph === "gateway") return "GW";
    if (ph === "entering") return "GW-enter";
    const vh = this.vhOf ? this.vhOf() : 0;
    if (vh >= MASTER_END) return "Ch5";
    let id = "J1";
    for (const b of BEATS) if (vh >= b.start) id = b.id;
    return id;
  }

  /** A frame's GPU time (ms), attributed to the beat it was issued in. */
  gpuSample(beat: string, ms: number): void {
    let a = this.gpu.get(beat);
    if (!a) this.gpu.set(beat, (a = []));
    a.push(ms);
  }

  private start(): void {
    this.running = true;
    const loop = (ts: number) => {
      // a hidden tab (rAF paused) or a debugger stop is not a dropped frame
      const dt = this.lastTs >= 0 ? ts - this.lastTs : -1;
      if (dt > 0 && dt < 1000 && !document.hidden) {
        if (!this.vsync) {
          this.warm.push(dt);
          // the low quartile, not the median: the first 120 frames are the
          // Gateway boot, where slow frames are multiples of I (measured under
          // SwiftShader: median 48.5 ms); vsync is the shortest regular interval
          if (this.warm.length >= 120) this.vsync = pct(this.warm, 0.25);
        } else {
          const beat = this.beatNow();
          if (beat !== this.curBeat) this.leave(beat, ts);
          let a = this.frames.get(beat);
          if (!a) this.frames.set(beat, (a = []));
          a.push(dt);
          if (dt > 1.5 * this.vsync) this.drops.set(beat, (this.drops.get(beat) ?? 0) + 1);
        }
      }
      this.lastTs = ts;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private leave(next: string, ts: number): void {
    const prev = this.curBeat;
    const secs = (ts - this.visitStart) / 1000;
    this.curBeat = next;
    this.visitStart = ts;
    const row = this.row(prev);
    if (row && row.frames > 0) {
      console.info(
        `[cx-perf] ${prev} (${secs.toFixed(1)} s) gpu p50 ${row.gpuP50} / p95 ${row.gpuP95} ms (n ${row.gpuN}) · frame p50 ${row.frameP50} / p95 ${row.frameP95} ms · dropped ${row.droppedPct} % (vsync ${r2(this.vsync)} ms)`,
      );
    }
  }

  row(beat: string): PerfRow | null {
    const f = this.frames.get(beat) ?? [];
    const g = this.gpu.get(beat) ?? [];
    if (!f.length && !g.length) return null;
    const d = this.drops.get(beat) ?? 0;
    return {
      beat,
      frames: f.length,
      dropped: d,
      droppedPct: f.length ? Math.round((1000 * d) / f.length) / 10 : 0,
      frameP50: r2(pct(f, 0.5)),
      frameP95: r2(pct(f, 0.95)),
      gpuN: g.length,
      gpuP50: r2(pct(g, 0.5)),
      gpuP95: r2(pct(g, 0.95)),
    };
  }

  /** Every beat seen so far, in story order. */
  table(): PerfRow[] {
    const order = ["boot", "GW", "GW-enter", ...BEATS.map((b) => b.id), "Ch5"];
    const keys = new Set([...this.frames.keys(), ...this.gpu.keys()]);
    const out: PerfRow[] = [];
    for (const k of order) if (keys.has(k)) out.push(this.row(k)!);
    return out;
  }

  vsyncMs(): number {
    return this.vsync;
  }

  reset(): void {
    this.gpu.clear();
    this.frames.clear();
    this.drops.clear();
  }
}

const PERF_ON =
  typeof window !== "undefined" && typeof location !== "undefined" && /(?:^|[?&])cx-perf(?:=|&|$)/.test(location.search);

/** The `?cx-perf` log, or null when the flag is absent. */
export const cxPerf: CxPerfLog | null = PERF_ON ? new CxPerfLog() : null;

if (cxPerf) {
  const log = cxPerf;
  (window as unknown as Record<string, unknown>).__cxPerf = {
    table: () => log.table(),
    print: () => console.table(log.table()),
    reset: () => log.reset(),
    vsync: () => log.vsyncMs(),
  };
}

/* ── the timer ─────────────────────────────────────────────────── */

export class GpuTimer {
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: TimerExt | null;
  private readonly pending: Pending[] = [];
  private open = false;
  /** cx-perf: how often each callback was used (the recurring one is the frame query) */
  private readonly uses = new WeakMap<(ms: number) => void, number>();
  private readonly ring = cxPerf ? 8 : RING;

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    const g2 = gl as WebGL2RenderingContext;
    this.gl = g2;
    let ext: TimerExt | null = null;
    try {
      ext = typeof g2.createQuery === "function" ? (g2.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null) : null;
    } catch {
      ext = null;
    }
    this.ext = ext;
    if (cxPerf && !ext) console.info("[cx-perf] EXT_disjoint_timer_query_webgl2 unavailable: frame intervals only");
  }

  get ok(): boolean {
    return this.ext !== null;
  }

  /** Opens a TIME_ELAPSED query, or returns null (no extension / busy). */
  begin(): WebGLQuery | null {
    if (!this.ext || this.open || this.pending.length >= this.ring) return null;
    const q = this.gl.createQuery();
    if (!q) return null;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.open = true;
    return q;
  }

  end(q: WebGLQuery | null, cb: (ms: number) => void): void {
    if (!q || !this.ext) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.open = false;
    let beat: string | null = null;
    if (cxPerf) {
      const n = (this.uses.get(cb) ?? 0) + 1;
      this.uses.set(cb, n);
      if (n >= 3) beat = cxPerf.beatNow();
    }
    this.pending.push({ q, cb, beat });
  }

  /** Reads back every finished query (call once per frame, before new ones). */
  poll(): void {
    if (!this.ext || !this.pending.length) return;
    const gl = this.gl;
    if (!gl.getQueryParameter(this.pending[0].q, gl.QUERY_RESULT_AVAILABLE)) return;
    const disjoint = !!gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.pending.length) {
      const p = this.pending[0];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT) as number;
      gl.deleteQuery(p.q);
      if (!disjoint && ns > 0) {
        p.cb(ns / 1e6);
        if (cxPerf && p.beat !== null) cxPerf.gpuSample(p.beat, ns / 1e6);
      }
    }
  }

  dispose(): void {
    for (const p of this.pending) this.gl.deleteQuery(p.q);
    this.pending.length = 0;
  }
}
