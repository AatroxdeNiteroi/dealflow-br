/* ============================================================
   three/createField.ts — the field factory (§7.1, §9.3). Owner: WP-GL.

   Returns the live WebGL engine (PointField) or, when WebGL is not
   available (no context, a shader that fails to compile, any throw
   during construction), the NullField: same FieldAdapter API,
   `ok: false`, so Landing adds `.landing.no-webgl` and every timeline,
   the guidance and the plans keep running on the CSS fallback.
   `?nowebgl` forces the fallback in dev builds (FLAGS.DEV_NO_WEBGL).
   ============================================================ */

import { PointField } from "./PointField";
import { NullField } from "./NullField";
import { FLAGS } from "../cinema/flags";
import type { FieldAdapter } from "../cinema/types";

export interface CreateFieldOptions {
  reduced: boolean;
}

export function createField(canvas: HTMLCanvasElement, opts: CreateFieldOptions): FieldAdapter {
  if (FLAGS.DEV_NO_WEBGL) return new NullField(opts);
  try {
    return new PointField(canvas, opts);
  } catch (err) {
    console.warn("[field] WebGL unavailable — using the CSS fallback", err);
    return new NullField(opts);
  }
}
