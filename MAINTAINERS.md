# Maintainers

One person maintains this project right now: [@nashiuso](https://github.com/nashiuso).
No team, no rotation, no on-call. This file exists so that if that changes, the
next person does not have to reverse-engineer the decisions from commit messages.

## Scope decisions

- The root export (`@nashiuso/rewap`) stays small on purpose: `Layout`, `Item`,
  `useLayout`, `createRewap`. Everything else — math, motion, accessibility,
  utilities, providers, charts, widgets — is a subpath export. If you are tempted
  to re-export something from the root "for convenience," don't; add a line to the
  relevant subpath's docs page instead.
- `core/` does not import React, and never should. It is the part that could, in
  principle, back a different binding later. Treat a `core` file that imports
  `react` as a bug, not a style nit.
- Providers are the only place network access is allowed, and only when the
  consumer constructs one explicitly (`createOpenMeteoProvider(...)`). A hook or
  utility that reaches out to the network on its own is a bug, full stop — it
  breaks the "nothing talks to the internet unless you told it to" guarantee the
  rest of the library relies on.

## How to add a utility

The `useBattery` / `useNetworkInfo` / `usePerformance` / `useKeyboardLayout` family
follows one shape. Copy it rather than inventing a new one:

1. **Feature-detect first.** Check for the API (`"getBattery" in navigator`, etc.)
   before touching it. If it is missing, return `{ supported: false }` (plus a
   `reason` string if there is more than one way to be unsupported) and stop.
2. **Never invent a value.** If the platform cannot tell you the CPU temperature,
   the hook reports that it cannot — it does not return `0`, `null` pretending to
   be a real reading, or a plausible-looking fake number. See
   [`docs/content/known-limitations.md`](docs/content/known-limitations.md) for the
   current list of things this applies to.
3. **Clean up every listener.** Every `addEventListener` in a hook has a matching
   `removeEventListener` in the effect's cleanup. The test for a new hook should
   mount and unmount it and assert the listener count returns to zero (see
   `useNetworkInfo.test.ts` for the pattern).
4. **Add the missing-API test first.** Before the happy path, write the test that
   runs with the API absent from the global object and assert the hook degrades the
   way step 2 promises. This is the test most likely to be skipped under deadline
   pressure, which is exactly why it goes first.
5. **Export it from the right subpath**, not the root. `./utilities` is almost
   always the right place; add it to that entry point and to
   `docs/content/utilities.md` in the same change.
6. **SSR-check it.** Run `npm run test:types -- --filter ssr` or read
   `ssr.test.tsx` and confirm the new hook does not throw when `window` is
   undefined — it should return the unsupported shape, not crash the render.

## Reviewing a pull request

- Run it, don't just read it. `npm run ci` locally covers format, lint, types,
  unit tests and the package-install check; `npm run test:e2e` covers the browser
  behaviour and is not part of `ci` because it needs a browser binary installed.
- A pull request that changes behavior without a changelog line is incomplete, not
  just under-documented — ask for the line.
- Prefer asking the contributor to shrink a pull request over shrinking it
  yourself; it is their patch.

## Release checklist

There has been exactly one release cycle so far (working toward 1.1.1, currently
unreleased/alpha), so treat this as a first draft, not a procedure worn smooth by
repetition.

1. `npm run ci` passes, plus `npm run test:e2e` and `npm run verify:package` run
   separately (they are not part of `ci`).
2. `CHANGELOG.md` has a dated, human-written entry — no "various fixes," say what
   changed and why someone would care.
3. `npm run docs:build` and `npm run site:build` succeed and the output is
   actually opened once in a browser, not just "the command exited zero."
4. Bump the version in `package.json` with `npm version <patch|minor|major>
--no-git-tag-version` (no tag yet — see the note below) and update the subpath
   `package.json` files if the publish config duplicates the version anywhere.
5. `npm pack --dry-run` and read the file list. If something unexpected is in
   there, fix `files` in `package.json` or `.npmignore` before anything else.
6. Only after all of the above: `git tag vX.Y.Z`, push the tag, then `npm publish
--access public`. Nothing in this repository's scripts does this
   automatically, and nothing should — a release is a decision, not a side effect
   of a script finishing.

No `v1.1.1` tag exists yet and none should until this checklist has actually been
run end to end by a human with publish access, not by an agent following a spec.
