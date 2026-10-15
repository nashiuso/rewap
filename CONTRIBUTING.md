# Contributing

Issues and pull requests are welcome. This is a small project maintained by one
person, so the most useful thing you can do is make a report reproducible.

## Repository setup

Run the setup script to configure your local environment and verify the GitHub
repository:

```bash
./scripts/github/setup.sh --local --yes   # configure local Git only
./scripts/github/setup.sh --check         # inspect everything, change nothing
./scripts/github/setup.sh --all           # configure local + GitHub (asks first)
./scripts/github/setup.sh --help          # all options and examples
```

The script installs Git aliases, sets `core.hooksPath` to
`scripts/github/hooks` for commit validation, checks for required tools, and
can configure GitHub repository metadata, branch protection and Pages.

## Prerequisites

- Git
- Node.js ≥ 20 (≥ 22.12 for the documentation site)
- npm
- [GitHub CLI](https://cli.github.com/) (`gh`) — only for GitHub configuration

```bash
sudo apt install git nodejs npm gh     # Debian/Kali
npm ci                                   # install the lockfile tree and build dist/
```

## Daily workflow

### 1. Create a branch

```bash
git checkout main
git pull
git checkout -b feat/my-change
```

Branch naming convention:

| Prefix      | Purpose                                 |
| ----------- | --------------------------------------- |
| `feat/`     | New feature or behaviour                |
| `fix/`      | Bug fix                                 |
| `docs/`     | Documentation                           |
| `test/`     | Adding or improving tests               |
| `refactor/` | Restructuring without behaviour change  |
| `ci/`       | CI/CD or workflow changes               |
| `chore/`    | Tooling, dependencies, repo maintenance |

### 2. Make changes and test

```bash
npm run ci              # format, types, lint, tests, build, package checks
npm test                # unit and component tests only
npm run test:e2e        # Playwright browser tests (needs Chromium: npx playwright install --with-deps chromium)
npm run site:build      # build and verify the documentation site (needs Node ≥22)
```

### 3. Commit

The repository includes a commit-msg hook that validates Conventional Commits.
The hook is activated automatically through `core.hooksPath` once the setup
script runs.

```
fix(react): preserve item identity after swaps
docs: clarify Astro installation
test(keyboard): cover focus restoration
refactor(motion): simplify transition state
chore: refresh development dependencies
```

Format: `<type>(<scope>): <description>`

Types: `feat` `fix` `docs` `test` `refactor` `perf` `build` `ci` `chore` `style` `revert`

Rules:

- Scope is optional. Keep it lowercase, ≤ 20 characters.
- Description starts lowercase, no trailing period.
- Subject line ≤ 72 characters.
- Use the body to explain _why_, not _what_ (the diff shows what).
- `BREAKING CHANGE:` footer or `!` before `:` for breaking changes.

### 4. Push and open a pull request

```bash
git push -u origin feat/my-change
gh pr create          # opens the PR using the repo template
```

CI runs format, types, lint, unit tests, build, package checks, Playwright
tests and documentation build. The browser tests need Chromium; the site build
needs Node ≥22.

### 5. Merge

Squash merging is the preferred default. Write a meaningful squash commit
message — usually the subject of the first commit in the branch.

## Before you send a patch

- `npm run ci` has to pass, including the suites that cover the path you touched.
- `npm run test:e2e` covers the browser behaviour; it needs
  `npx playwright install --with-deps chromium` once.
- `npm run ci` runs the core library checks (format, types, lint, tests, build,
  package checks). CI runs the browser tests and the documentation build as
  separate jobs. See `.github/workflows/ci.yml`.
- Keep changes focused. A bug report and a refactor are two pull requests; a
  refactor and a rename are two as well.
- If you change behaviour on purpose, say so in the description. Several tests in
  this repository encode deliberate oddities and the comments explain why.

## Reporting a bug

Include:

1. The commit or tag you installed (see the
   [GitHub installation instructions](README.md#installation)).
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
`{ supported: false, reason }` when it is missing instead of inventing a value,
and add a test for the missing-API case before the happy path. See
the [known limitations](https://nashiuso.github.io/rewap/known-limitations/) for
what this currently applies to.

## Code style

Prettier and ESLint are configured; `npm run lint` is part of CI. Beyond that:

- Comments explain _why_. If the code says what it does, that is enough.
- No new runtime dependencies in `core/`, and no React import in `core/` either —
  it should stay usable from something other than React someday.
- American spelling in code (`normalize`, `center`); either is fine in prose, pick
  one per file and stay consistent.

## Tagging a version

Distribution is GitHub-only; no npm registry release is involved. A maintainer
can prepare a pinned install by updating `package.json`, recording the changes in
`CHANGELOG.md`, and creating a Git tag when authorized. Consumers can pin that tag
or a full commit SHA in `package.json` (`github:nashiuso/rewap#<ref>`).

## Documentation site

The documentation site lives in `docs/` and is built with
[Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/).
It requires Node.js 22.12 or newer. Run `npm run site:build` from the repo root
to build and verify the site, or `npm run docs:dev` for a local dev server.
