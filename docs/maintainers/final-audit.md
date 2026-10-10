# Final audit

Written after every command below was actually run against this exact commit
(`git log -1`: `chore: initial commit`), not before. Nothing in this document is
aspirational — if something couldn't be verified, it says so instead of
assuming it would have worked.

## What was fixed

- `active.source === "pointer"` bug: ordinary mouse/touch drags silently used a
  reconstructed element position instead of the live pointer, causing
  intermittent-looking collision misses. Root cause was a string comparison
  that only matched pen input. See `CHANGELOG.md` 1.1.1 for the full
  explanation.
- `drop()` could commit a stale destination if the pointer was released
  between animation frames.
- CSS grid layouts collapsed to one column because
  `repeat(var(--rw-columns, auto-fit), …)` doesn't behave like a literal
  `auto-fit` in Chromium.
- Projection-based collision was off by one slot in `reorder`/`grid`.
- First `undo()` of a session could empty the layout (history seeded before
  children reconciled).
- `useWeather`'s inline `cache` object caused an infinite render loop.
- Histogram chart bars were drawn from raw points instead of computed bins.
- `height="12rem"` on a chart silently became 24px (`parseFloat` bug).
- Persistence could write while the order was controlled, contradicting its
  own dev warning.
- `<Item.Handle aria-label="…" />` lost the label to an `undefined` override.
- `rewap info` crashed reading its own nested `exports` map.
- A missing `.gitignore` plus an incomplete ESLint/Prettier ignore list meant
  `lint`/`format:check` only passed because nobody had built
  `examples/playground/dist` yet — ignore lists now use `**/dist/**` (plus
  `site-dist/**`, added this pass) and a `.gitignore` exists.
- `docs/content/examples.md` described eight example apps that were never
  built. Rewritten to describe what actually ships (see "Rewritten" below).
- The README's Features, Examples, Architecture and — most importantly —
  **License** sections existed only inside HTML comments and never rendered on
  GitHub. The repository is MIT licensed (`LICENSE` file, real) but had no
  visible license statement anywhere in the rendered README.
- `.prettierignore` didn't exempt `examples/astro/src/env.d.ts`, which Astro's
  own tooling (re)writes on every install/build — eslint already special-cased
  it with a comment explaining why; `format:check` didn't, and would fail
  spuriously the moment someone built the Astro example locally. Added the
  matching exemption.

## What was added

- `docs/content/known-limitations.md` — was linked from four existing docs
  pages (`introduction`, `layout`, `reorder`, `faq`) and from `CONTRIBUTING.md`
  but did not exist.
- `MAINTAINERS.md` and `NOTES.md` at the repo root — `CONTRIBUTING.md`
  referenced `MAINTAINERS.md` by name twice; neither file existed before this
  pass.
- A real docs site generator: `docs/build.mjs` (markdown → branded, searchable
  static HTML, self-hosted Montserrat/Roboto Mono via `@fontsource`, no CDN,
  no framework) and `docs/serve.mjs` (local preview server). `docs/package.json`
  gained one new devDependency, `marked`, for markdown parsing.
- `scripts/site/build.mjs` and `scripts/site/preview.mjs` — assemble the docs
  build and the playground build into `site-dist/` for GitHub Pages (docs at
  the root, playground under `/playground/`, matching the `GH_PAGES` env-var
  contract already present in `examples/playground/vite.config.ts`).
- `.github/workflows/pages.yml` — builds and deploys `site-dist/` via the
  official `actions/configure-pages` + `actions/upload-pages-artifact` +
  `actions/deploy-pages`, using GitHub's built-in Pages OIDC token. No secret
  is defined or referenced by this workflow.
- `.github/workflows/codeql.yml`, `.github/workflows/dependency-review.yml`,
  `.github/workflows/release.yml` (wired up, never run — no tag exists).
- `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`, `config.yml`,
  `.github/pull_request_template.md`, `.github/CODEOWNERS` (`* @nashiuso`
  only), `.github/dependabot.yml` (npm + github-actions).
- `.devcontainer/devcontainer.json`.
- `docs/maintainers/github.md` — exact manual steps for @nashiuso to push this
  code, configure repository settings, and enable Pages.
- `scripts/github/setup.sh` — optional, `gh`-CLI-based script for the
  non-destructive subset of those settings (description, homepage, topics,
  Issues/Discussions). Requires the maintainer's own `gh auth login`; not run
  by anything in this session.
- This file.

## What was removed

- Dead HTML comments in `README.md` that hid the Features, Examples,
  Architecture and License sections from GitHub's renderer.
- Stale build artifacts from earlier verification passes: `test-results/`,
  `playwright-report/`, `coverage/`, a stray `nashiuso-rewap-1.1.1.tgz`,
  `examples/astro/node_modules/`, `examples/astro/dist/`. All regenerable,
  none committed.

## What was rewritten

- `README.md`: full rewrite in structure (banner → tagline → real badges →
  install → quick start → API → CLI → examples with a real screenshot →
  documentation → utilities/accessibility/performance/browser-support tables →
  architecture → development/testing → **visible** license), keeping the
  existing custom SVG buttons, banner, and brand palette
  (`#020204`/`#49A1A8`/`#D9DBDF`) as-is.
- `docs/content/examples.md`: previously described a gallery of eight example
  apps (dashboard, analytics, kanban, widget board, statistics, developer
  dashboard, mobile layout, responsive grid) that do not exist in
  `examples/`. Rewritten to describe the one playground app (mode/motion
  switcher, six widget panels, live code view, fixture data) and the Astro SSR
  example, which is what actually builds and runs.
- `CHANGELOG.md`'s 1.1.1 entry: extended with this pass's additions; the
  heading already correctly read "unreleased, alpha" from a prior pass.

## Tested (commands actually run against this commit, in this order)

```
npm ci                                    # clean install from package-lock.json, 7 known dev-only audit warnings (see Known limitations)
npm run format:check                      # prettier . --check            -> clean
npm run typecheck                         # tsc --noEmit (library)        -> clean
npm run typecheck:examples                # tsc --noEmit (playground)     -> clean
npm run lint                              # eslint . --max-warnings=0     -> clean
npm test                                  # vitest                        -> 359/359 (30 files)
npm run test:types                        # tsc --noEmit (public API)     -> clean
npm run build                             # tsup + types + css            -> clean
npm run lint:package                      # publint                       -> "All good!"
npm run verify:package                    # pack, install, import, CLI    -> all 10 subpaths import, CSS resolves, `rewap version` -> 1.1.1
npm run examples:build                    # vite build (playground)       -> clean, 211.72 kB JS / 10.94 kB CSS (pre-gzip)
npm run docs:build                        # docs/build.mjs                -> 25 pages written to docs/dist/
npm run site:build                        # scripts/site/build.mjs        -> site-dist/ with docs at root, playground at /playground/
CI=1 npx playwright test                  # e2e                           -> 8/8 (chromium + mobile-emulated projects)
npm pack --dry-run                        # 141 files, ~957 kB packed / 3.9 MB unpacked
(cd examples/astro && npm install && npm run build)   # Astro SSR example -> clean, 1 static page
```

Also manually verified (not just "exit code 0"):

- `node scripts/site/preview.mjs` + `curl` against `/rewap/`, `/rewap/layout.html`,
  `/rewap/playground/`, and the playground's hashed asset URLs — all 200,
  confirming the `/rewap/` base path actually resolves end to end locally, the
  way GitHub Pages will serve it.
- `node docs/serve.mjs` + `curl` against every cross-linked `.html` page
  referenced from `introduction.md`/`layout.md`/`reorder.md`/`faq.md`,
  `styles.css`, `fonts/fonts.css`, `search.js`, `search-index.json`, and
  `brand/buttons/mark.svg` — all 200.
- `assets/screenshots/playground-dashboard.png` is a real screenshot of the
  actual playground app (visually confirmed: the swap/reorder/grid switch, the
  four motion presets, the six widget panels and the live code panel are all
  the real UI, not a mockup).

## Could not be configured externally

Everything in this section requires access this environment does not have
(push access or admin access to `github.com/nashiuso/rewap`, or an npm publish
token). Exact manual steps are in `docs/maintainers/github.md`.

- **Code was not pushed anywhere.** `git init` was run in this workspace for
  the first time this session; one commit exists locally
  (`chore: initial commit`); there is no remote configured and nothing was
  pushed. No prior git history existed to preserve or lose.
- **GitHub repository settings** (description, homepage, topics, Issues/
  Discussions toggles, branch protection, Pages source) were not changed —
  this environment has no admin access to the real repository.
- **GitHub Pages has never actually been deployed.** `pages.yml` has never run
  (it triggers on push to `main`, and nothing was pushed). The local preview
  (`scripts/site/preview.mjs`) mirrors the base path and verifies the build
  output is structurally correct, but that is not the same as a real Pages
  deployment succeeding — treat that as unverified until the first real run is
  watched.
- **`npm publish` was not run, and no `v1.1.1` tag was created.** Both are
  explicitly out of scope for this work. `release.yml` exists and is wired up
  but has never executed; it requires an `NPM_TOKEN` secret that was not
  created (this environment has no npm publish credentials for this
  package either).

## Known limitations

- **`npm audit` reports 7 vulnerabilities**, all in the `vitest` →
  `@vitest/mocker`/`esbuild`/`tinypool`/`vite`/`vite-node` devDependency chain.
  Fixing them needs a major-version bump of `vitest` (and `esbuild`
  transitively), which is a bigger change than this pass had room to make
  safely. Dev-only; nothing in the published package depends on these.
  Documented here and in `NOTES.md` rather than fixed.
- See `docs/content/known-limitations.md` for the product-level limitations
  (no cross-`<Layout>` dragging, `useKeyboardLayout().layout` always `null`,
  no React Native target, SSR first-paint vs. persisted-order caveat, and
  others) — unchanged by this pass, still accurate.
- **One flaky test observed once, not reproduced on demand**: see "On one
  flaky-looking test" in `NOTES.md`. `npm test` was green on every run in this
  session except the one described there, which occurred under unusually
  heavy concurrent load (immediately after a typecheck + docs-build run in the
  same shell).
- The docs site's search is a client-side substring filter over page titles
  and excerpts — it is not a real search index and will not rank results or
  handle typos.
- `scripts/github/setup.sh` is untested against a real repository in this
  session (it needs real `gh` credentials this environment doesn't have); it
  was reviewed for correctness, not executed.
