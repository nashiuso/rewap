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

## On not building eight example apps

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

- **Root (dev tooling):** 4 findings (2 critical, 2 moderate). All are in the
  dev-only Vitest chain: `vitest` and `@vitest/mocker`, plus `tinypool` (critical
  prototype-pollution advisories, fixed in `tinypool` 2.1.2+). Vitest 3 depends on
  tinypool 1.x, so the only fix npm offers is a Vitest 4 upgrade (`4.1.11`). Vitest 4
  declares Node `^20 || ^22 || >=24`, which would drop the Node 18 support this package
  still declares (`>=18.18.0`). We deliberately do not override `tinypool` to a major
  version Vitest 3 does not declare. Do not repeat `npm audit fix --force`: it
  installed Vite 8.3.4 + Vitest 5.0.4 against `@vitejs/plugin-react@4`, whose peer range
  ends at Vite 7, and left `npm ci` failing with `ERESOLVE`.
- **Docs and playground:** 0 findings each.
- **Astro example:** 16 findings (1 critical, 7 high, 8 moderate). These come from
  Astro 4.16.x and its tooling, and every listed Astro advisory range covers 4.x. The
  npm-suggested fix is Astro 6 (a major upgrade), so it is left for a separate decision.
  The static build (`astro build`, no adapter) does not run Astro's server or dev
  server; several advisories concern those. `@astrojs/react` 3.6.3 (latest stable 3.x)
  is flagged because its advisory range includes a 3.7.0 beta, and no stable fixed
  release exists.

## On this not being a one-release project

This is real, maintained software, not a demo generated to look like one. It is
also genuinely pre-1.0-in-spirit (even though the version number says 1.1.1) —
the API has had one real consumer-facing iteration. Treat confidence in the docs'
prose as "this is how it's meant to work," not "this has survived contact with
many production apps," because it hasn't yet.
