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

1. The version (`@nashiuso/rewap` in your lockfile).
2. The mode (`swap`, `reorder`, `grid`) and the input (`pointer`, `touch`,
   keyboard).
3. What you expected and what happened instead.
4. A reproduction — a stackblitz, a repository, or the smallest snippet you can
   write. A description of a drag is very hard to act on.

If it is a layout problem, mention the browser. If it is a persistence problem,
mention whether the order is controlled by your application.

## Adding a utility

Read the "How to add a utility" section of `MAINTAINERS.md` first. The short
version: feature-detect, report honestly, never invent a value, and add a test for
the missing-API case.

## Code style

Prettier and ESLint are configured; `npm run lint` is part of CI. Beyond that:

- Comments explain _why_. If the code says what it does, that is enough.
- No new runtime dependencies in the core.
- British or American spelling, pick one per file and stay consistent. The code
  uses American spelling (`normalize`, `center`) and the prose does not.

## Commit messages

Roughly conventional commits, no ceremony:

```
fix: keep the drop target on the grabbed slot while arming
docs: explain why handles exist
test: cover reorder with a fragment between items
```

## Releases

Maintainer only. See the release checklist at the end of `MAINTAINERS.md`.
