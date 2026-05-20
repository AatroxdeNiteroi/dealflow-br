import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // App atual — dashboard de inteligência M&A.
        main: "index.html",
        // Landing cinematográfica — Capítulo 1 (Hero) e seguintes.
        landing: "landing.html",
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  preview: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
