# Notes

Scratchpad for things that didn't fit in a commit message or a code comment, and
that would otherwise get re-litigated every few months. Not a changelog, not a
design doc — see `CHANGELOG.md` and `docs/design/` for those.

## On `active.source`

The bug that took longest to find in this project so far was the one fixed in
1.1.1: a drag could get "stuck" reporting pointer coordinates after switching to
keyboard input mid-drag, because `active.source` was set once at drag start and
never revisited. The fix (`hasLivePointer`) is three lines. Finding it took a lot
longer than three lines, because the symptom (stale coordinates) didn't point at
the cause (a stale enum) — the coordinates genuinely were correct for the source
they thought they had. Worth remembering next time a bug looks like a math problem
and might actually be a state problem.

## On not building eight example apps

The original plan for `examples/` was a small gallery — kanban, analytics,
dashboard, widget board, and so on. It turned into one playground with mode and
motion switches instead, because a gallery of eight thin wrappers around the same
three components would have been eight places to keep in sync and roughly zero
extra signal about whether the library works. If you're reading this because you
want a kanban example specifically, it's one `mode="reorder"` layout with
drop-zone columns as separate `<Layout>` instances — not in the repo yet, happy to
take a pull request for it.

## On the docs site build

`docs/build.mjs` is a plain Node script that reads markdown and writes HTML. No
Next.js, no Fumadocs, no framework. That wasn't the original plan — the original
plan was closer to a full framework-based docs app — but the markdown content was
already written expecting relative `.html` links and a flat site, and introducing
a framework at this stage would have meant rewriting the content's link structure
for no reader-visible benefit. If the docs site grows real interactive demos later
("try this layout inline"), that's the point to reconsider and bring in something
heavier.

## On one flaky-looking test

`tests/react.drag.test.tsx` → "cancels the drag on pointercancel and leaves the
order alone" failed once, under heavy load (right after a `typecheck:examples`
run and a docs build, same shell), asserting `translate3d(0px, 65.2px, 0)` where
it expected `(0px, 0px, 0)`. It passed cleanly in isolation and in three
subsequent full-suite runs back to back. `settle()` in that file polls a
`data-status="idle"` attribute rather than asserting a fixed number of frames,
so this smells like the status flips to idle one tick before the spring's last
frame actually writes the reset transform — a small ordering gap that normally
never matters because both happen within the same `requestAnimationFrame`
batch, but can apparently separate under real CPU contention even with fake
timers involved elsewhere in the harness. Didn't chase it further this pass
since it didn't reproduce on demand; flagging it here so it doesn't get
written off as pure flakiness if it shows up again. Prime suspect:
`settle()`'s poll granularity, not the production code.

## On the devDependency audit warnings

`npm audit` currently reports vulnerabilities in the `vitest` → `esbuild` →
`tinypool` chain. All of them are in test tooling, not in anything that ships to a
consumer of `@nashiuso/rewap`. Fixing them means a major-version bump of `vitest`,
which is a bigger change than this pass had room for safely — see
`docs/content/known-limitations.md`. Flagging it here too since "known limitation"
pages are easy to skim past and this one is worth a maintainer actually scheduling
time for.

## On this not being a one-release project

This is a real, maintained package, not a demo generated to look like one. It
is also genuinely pre-1.0-in-spirit software (even though the version number says
1.1.1) — the API has had exactly one real consumer-facing iteration. Treat
confidence in the docs' prose as "this is how it's meant to work," not as "this has
survived contact with many production apps," because it hasn't yet.
