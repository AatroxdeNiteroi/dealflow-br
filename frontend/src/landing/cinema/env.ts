/* cinema/env.ts — build-mode probe without a vite-env.d.ts (the project
   has none, and the ROADMAP cleanup recipe deletes *.d.ts under src/).
   esbuild strips the cast; Vite injects/replaces import.meta.env. */
export const IS_DEV: boolean =
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
