import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      // Was a list of specific dist paths ("dist/**", "docs/dist/**", etc.) that
      // missed examples/playground/dist — lint happily walked into a minified
      // production bundle and reported hundreds of "window is not defined"
      // errors against someone else's build output. One glob covers all of them.
      "**/dist/**",
      // Assembled Pages artifact (`scripts/site/build.mjs`) — a copy of
      // docs/dist + examples/playground/dist, already covered above and
      // already linted at its source.
      "site-dist/**",
      "node_modules/**",
      "coverage/**",
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
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      // An underscore prefix is the usual way to say "this parameter is part of
      // an interface I have to implement but don't need here" — e.g. a fixture
      // provider that ignores the request it's handed. Only args get the pass;
      // unused local variables and imports still need to go.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
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
