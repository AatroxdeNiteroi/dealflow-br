/* cinema/env.ts — build-mode probe without a vite-env.d.ts (the project
   has none, and the ROADMAP cleanup recipe deletes *.d.ts under src/).
   esbuild strips the cast; Vite injects/replaces import.meta.env. */
export const IS_DEV: boolean =
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

/** Dev captures (`?cx-still`): every time-based field term is frozen at
 *  t = 0 (the clock passes t = 0, dt = 0 and velocity 0 to the field; the
 *  field skips flare(), snaps the cursor to its target). Pure f(vh) frames
 *  for golden-frame comparisons. Never set in production builds. */
export const CX_STILL: boolean =
  IS_DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cx-still");
