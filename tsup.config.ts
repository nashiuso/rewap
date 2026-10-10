import { defineConfig } from "tsup";

/**
 * Builds every public entry point from local source only.
 *
 * No entry point fetches anything at runtime: `dist/` is fully self-contained and
 * every internal import is a relative path inside the package.
 */
export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "react/index": "src/react/index.ts",
      "core/index": "src/core/index.ts",
      "accessibility/index": "src/accessibility/index.ts",
      "math/index": "src/math/index.ts",
      "motion/index": "src/motion/index.ts",
      "utilities/index": "src/utilities/index.ts",
      "providers/index": "src/providers/index.ts",
      "charts/index": "src/charts/index.ts",
      "widgets/index": "src/widgets/index.ts",
    },
    format: ["esm", "cjs"],
    // Declarations come from `tsc -p tsconfig.build.json`, not from tsup: one tsc
    // pass emits all of them, uses far less memory than ten rollup-plugin-dts
    // bundling runs, and keeps the `.d.ts` tree matching the source tree.
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: "es2020",
    external: ["react", "react-dom", "react/jsx-runtime"],
    banner: {
      js: "/* @nashiuso/rewap v1.1.1 | MIT | github.com/nashiuso */",
    },
  },
  // The CLI is a Node program, not a browser module: ESM only, with a shebang, and
  // built separately so it never ends up in the browser bundles above.
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    platform: "node",
    target: "node18",
    dts: false,
    clean: false,
    sourcemap: false,
    banner: {
      js: "#!/usr/bin/env node\n/* @nashiuso/rewap v1.1.1 | MIT | github.com/nashiuso */",
    },
  },
]);
