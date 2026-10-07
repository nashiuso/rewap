import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup.ts"],
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
      "@nashiuso/rewap/charts": new URL("./src/charts/index.ts", import.meta.url).pathname,
      "@nashiuso/rewap/widgets": new URL("./src/widgets/index.ts", import.meta.url).pathname,
      "@nashiuso/rewap/utilities": new URL("./src/utilities/index.ts", import.meta.url).pathname,
      "@nashiuso/rewap/providers": new URL("./src/providers/index.ts", import.meta.url).pathname,
      "@nashiuso/rewap/math": new URL("./src/math/index.ts", import.meta.url).pathname,
      "@nashiuso/rewap/motion": new URL("./src/motion/index.ts", import.meta.url).pathname,
      "@nashiuso/rewap": new URL("./src/index.ts", import.meta.url).pathname,
    },
  },
});
