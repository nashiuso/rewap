import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "docs/dist/**",
      "examples/dist/**",
      "examples/astro/dist/**",
      "examples/astro/.astro/**",
      // Astro's own tooling writes this file; it is not ours to restyle.
      "examples/astro/src/env.d.ts",
      "assets/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  // Formatting belongs to Prettier; this only silences the stylistic rules that
  // would otherwise disagree with it. No rules are added here.
  prettier,
  {
    files: ["**/*.mjs", "scripts/**", "docs/build.mjs", "docs/serve.mjs"],
    // Node globals, plus the browser ones: these scripts hand small callbacks to
    // Playwright's `page.evaluate`, and those run in the page, not in Node.
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
