# Contributing

Issues and pull requests are welcome. This is a small project maintained by one
person, so the most useful thing you can do is make a report reproducible.

## Before you send a patch

- `npm test` has to pass, including the suites that cover the path you touched.
- `npm run test:e2e` covers the browser behaviour; it needs
  `npx playwright install chromium` once, and `--with-deps` on a bare Linux image.
- `npm run ci` runs the whole pipeline in the order CI does. Running it before you
  push saves a round trip.
- Keep changes focused. A bug report and a refactor are two pull requests; a
  refactor and a rename are two as well.
- If you change behaviour on purpose, say so in the description. Several tests in
  this repository encode deliberate oddities and the comments explain why.

## Reporting a bug

Include:

1. The commit or tag you installed (`rewap` isn't on the npm registry — see
   [README](README.md#install) — so "version" means the git ref you pinned).
2. The mode (`swap`, `reorder`, `grid`) and the input (`pointer`, `touch`,
   keyboard).
3. What you expected and what happened instead.
4. A reproduction — a StackBlitz, a repository, or the smallest snippet you can
   write. A description of a drag is very hard to act on.

If it is a layout problem, mention the browser. If it is a persistence problem,
mention whether the order is controlled by your application.

## Adding a utility

The `useBattery`/`useNetworkInfo`/`usePerformance`/`useKeyboardLayout` family
follows one shape: feature-detect before touching an API, return
`{ supported: false, reason }` when it's missing instead of inventing a value,
and add a test for the missing-API case before the happy path. See
`docs/content/known-limitations.mdx` for what this currently applies to.

## Code style

Prettier and ESLint are configured; `npm run lint` is part of CI. Beyond that:

- Comments explain _why_. If the code says what it does, that is enough.
- No new runtime dependencies in `core/`, and no React import in `core/` either —
  it should stay usable from something other than React someday.
- American spelling in code (`normalize`, `center`); either is fine in prose, pick
  one per file and stay consistent.

## Commit messages

Roughly conventional commits, no ceremony:

```
fix: keep the drop target on the grabbed slot while arming
docs: explain why handles exist
test: cover reorder with a fragment between items
```

## Tagging a version

There's no npm publish step — see [README](README.md#install) for why. Cutting a
version is: bump `package.json`, update `CHANGELOG.md` with what actually changed,
then `git tag vX.Y.Z && git push --tags`. That tag is what people pin in their own
`package.json` (`github:nashiuso/rewap#vX.Y.Z`).
