import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// `GH_PAGES=1` is set by `scripts/site/build.mjs` when this build is being
// assembled into the Pages artifact at /rewap/playground/. A plain
// `npm run build` (or `npm run dev`) keeps the default root base, so the
// playground also works as a standalone app.
const base = process.env.GH_PAGES ? "/rewap/playground/" : "/";

export default defineConfig({
  // Pinned so `vite --config examples/playground/vite.config.ts` run from the
  // repo root (CI, Playwright's webServer) resolves the same project root as
  // running `vite` from inside this directory. Vite otherwise treats
  // `process.cwd()` as root, which quietly serves the library's own `dist/`.
  root: dirname(fileURLToPath(import.meta.url)),
  base,
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4174,
  },
});
