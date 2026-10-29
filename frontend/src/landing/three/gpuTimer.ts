/* ============================================================
   three/gpuTimer.ts — GPU time per draw (QA PERF-3 / PERF-6).
   Owner: WP-GL.

   EXT_disjoint_timer_query_webgl2 TIME_ELAPSED queries, read back a few
   frames later (never in the frame they were issued: results only exist
   once control returns to the browser). Disjoint results are dropped.
   At most one query is open at a time (the extension forbids nesting)
   and at most RING are in flight; when either limit is hit the draw is
   simply not timed. Without the extension `ok` is false and nothing is
   ever measured (the governor then falls back to frame intervals).
   ============================================================ */

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

interface Pending {
  q: WebGLQuery;
  cb: (ms: number) => void;
}

const RING = 4;

export class GpuTimer {
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: TimerExt | null;
  private readonly pending: Pending[] = [];
  private open = false;

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
  }

  get ok(): boolean {
    return this.ext !== null;
  }

  /** Opens a TIME_ELAPSED query, or returns null (no extension / busy). */
  begin(): WebGLQuery | null {
    if (!this.ext || this.open || this.pending.length >= RING) return null;
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
    this.pending.push({ q, cb });
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
      if (!disjoint && ns > 0) p.cb(ns / 1e6);
    }
  }

  dispose(): void {
    for (const p of this.pending) this.gl.deleteQuery(p.q);
    this.pending.length = 0;
  }
}
