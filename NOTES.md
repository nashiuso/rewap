# Notes

Scratchpad for things that didn't fit in a commit message or a code comment, and
that would otherwise get re-litigated every few months. Not a changelog — see
`CHANGELOG.md` for that.

## On `active.source`

The bug that took longest to find in this project so far was the one fixed in
1.1.1: a drag could get "stuck" reporting pointer coordinates after switching to
keyboard input mid-drag, because `active.source` was set once at drag start and
never revisited. The fix (`hasLivePointer`) is three lines. Finding it took a lot
longer than three lines, because the symptom (stale coordinates) didn't point at
the cause (a stale enum) — the coordinates genuinely were correct for the source
they thought they had.

## On the documentation architecture

The original docs site was a Next.js + Fumadocs app in `docs/` with a separate Vite playground in `examples/playground/`. Both are now replaced by a single Astro + Starlight site in `docs/` with the playground integrated as a React island. The reasons:

1. One build system instead of two (Next.js static export + Vite).
2. The old Astro example (removed earlier) carried 27 of the 31 open advisories. Astro 7 is clean.
3. Pagefind replaces the Fumadocs/Orama static search index — same client-side search, fewer moving parts.
4. The playground is no longer a separate app that needs its own Vite config, lockfile, and CI job.

The site builds with `base: "/rewap"` always, so local preview and production produce identical URLs. The assembled artifact is `site-dist/` at the repo root; the library's `dist/` and the site's build output never share a directory.

The original plan for `examples/` was a small gallery — kanban, analytics,
dashboard, widget board, and so on. It's one playground with a mode and motion
switch instead, because a gallery of eight thin wrappers around the same three
components would have been eight places to keep in sync for roughly zero extra
signal about whether the library works.

## On distributing via GitHub instead of npm

There's no npm-registry release. `npm install github:nashiuso/rewap` plus a
`prepare` script that builds `dist/` on install covers the only thing the
registry was actually providing (a built artifact), without needing to manage
publish credentials or decide the project is "ready" for a public version
number it currently isn't. See the README's install section and
`CONTRIBUTING.md`'s tagging note.

## On the audit findings

Checked during the 1.1.1 alpha cleanup (see the cleanup branch's commit history for the date).

- **Root (dev tooling):** resolved by upgrading Vitest 3 → 4 (`4.1.11`). The two
  critical `tinypool` prototype-pollution advisories (fixed in `tinypool` 2.1.2+) are
  gone: Vitest 4 depends on tinypool 2.x. The upgrade raises `engines.node` from
  `>=18.18.0` to `>=20`, matching Vitest 4's declared range (`^20 || ^22 || >=24`) and
  the CI matrix in `.github/workflows/ci.yml` (`20`, `22`, `24`).
  Do not repeat `npm audit fix --force`: it installs Vite 8.x + Vitest 5.x against
  `@vitejs/plugin-react@4` (peer range ends at Vite 7) and leaves `npm ci` failing with
  `ERESOLVE`. Stay on Vitest 4 until `@vitejs/plugin-react` allows Vite 8.
- **Docs site:** `postcss-selector-parser` 6.1.4 (transitive via `postcss-nested` →
  `@expressive-code/core` → Starlight) has GHSA-rj75-hqrm-r3gf / CVE-2026-104844
  (moderate, CVSS 5.9): quadratic complexity in flat selector parsing allows CPU
  exhaustion. The fix is in 7.1.6; the 6.x line has no patched release. An `overrides`
  entry in `docs/package.json` forces `postcss-selector-parser` to 7.1.6, which is a
  6→7 major bump. The parser's public API is compatible for postcss-nested's usage and
  the Astro site builds and produces identical output with the override in place. After
  the override, `npm audit` reports 0 findings in both root and docs. If Starlight or
  expressive-code eventually ships with postcss-selector-parser ≥7.1.6 natively, the
  override can be removed.
- **Root:** 0 findings.
- **Astro example:** removed. It carried 27 of the 31 open advisories (1 critical,
  7 high, 19 moderate/low) through Astro 4.16.x and its tooling. Upgrading Astro 4 → 7
  is a three-major migration on a non-published demo; removing the example clears the
  advisories and the CI job without touching the library.

## On this not being a one-release project

This is real, maintained software, not a demo generated to look like one. It is
also genuinely pre-1.0-in-spirit (even though the version number says 1.1.1) —
the API has had one real consumer-facing iteration. Treat confidence in the docs'
prose as "this is how it's meant to work," not "this has survived contact with
many production apps," because it hasn't yet.
