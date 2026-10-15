import { defineConfig } from "vitest/config";

// Node 25+ exposes a global `localStorage` accessor that warns unless
// --localstorage-file is passed. The test suite does not need Node's native
// Web Storage (jsdom provides its own), so suppress the warning on affected
// versions. Gate on the major version so older Node runtimes are unaffected.
const nodeMajor = Number(process.versions.node.split(".")[0]);
const nodeFlags = nodeMajor >= 25 ? ["--no-experimental-webstorage"] : [];

export default defineConfig({
  test: {
    environment: "jsdom",
    // jsdom only exposes `localStorage`/`sessionStorage` when the document has a
    // real (non-opaque) origin. Vitest currently defaults its jsdom `url` to
    // `http://localhost:3000`, so storage happens to work — but that default
    // lives in Vitest, not here, and the persistence/layout suites depend on it.
    // Pinning it keeps `window.localStorage` and `window.sessionStorage` real
    // (not mocked) regardless of what the runner defaults to.
    environmentOptions: {
      jsdom: {
        url: "http://localhost:3000/",
      },
    },
    globals: true,
    setupFiles: ["tests/setup.ts"],
    ...(nodeFlags.length > 0 && {
      poolOptions: {
        forks: { execArgv: nodeFlags },
        threads: { execArgv: nodeFlags },
      },
    }),
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@nashiuso/rewap/charts": new URL(
        "./src/charts/index.ts",
        import.meta.url,
      ).pathname,
      "@nashiuso/rewap/widgets": new URL(
        "./src/widgets/index.ts",
        import.meta.url,
      ).pathname,
      "@nashiuso/rewap/utilities": new URL(
        "./src/utilities/index.ts",
        import.meta.url,
      ).pathname,
      "@nashiuso/rewap/providers": new URL(
        "./src/providers/index.ts",
        import.meta.url,
      ).pathname,
      "@nashiuso/rewap/math": new URL("./src/math/index.ts", import.meta.url)
        .pathname,
      "@nashiuso/rewap/motion": new URL(
        "./src/motion/index.ts",
        import.meta.url,
      ).pathname,
      "@nashiuso/rewap": new URL("./src/index.ts", import.meta.url).pathname,
    },
  },
});
