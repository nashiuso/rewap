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

## On the devDependency audit warnings

`npm audit` reports vulnerabilities in the `vitest` → `esbuild` → `tinypool`
chain — all in test tooling, nothing that ships to a consumer. Fixing them needs
a major-version bump of `vitest`, which hasn't made it into a pass yet. See
`docs/content/docs/known-limitations.mdx`.

## On this not being a one-release project

This is real, maintained software, not a demo generated to look like one. It is
also genuinely pre-1.0-in-spirit (even though the version number says 1.1.1) —
the API has had one real consumer-facing iteration. Treat confidence in the docs'
prose as "this is how it's meant to work," not "this has survived contact with
many production apps," because it hasn't yet.
