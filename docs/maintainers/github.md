# GitHub setup (for @nashiuso)

Exact manual steps to get this workspace's code onto `github.com/nashiuso/rewap`
and get the repository's settings into the state the rest of this project
assumes (Pages via Actions, branch protection, topics). None of this has been
done for you — no agent in this environment has push access or admin access to
the real repository, so every step below is something you run yourself.

## 1. Get the code into git

This workspace was never `git init`'d before this pass (there's no commit
history to preserve, fabricate, or lose). If you're reading this from a copy of
the workspace rather than the already-initialized repo:

```bash
cd rewap
git init
git add -A
git commit -m "chore: initial commit"
```

Write your own commit message if you'd rather not use that one — it's a
placeholder, not a script output you're required to keep.

## 2. Point it at the real remote and push

```bash
git remote add origin git@github.com:nashiuso/rewap.git
git branch -M main
git push -u origin main
```

If `github.com/nashiuso/rewap` already has commits (for example, if this
workspace was cloned from it originally — see the top of `CHANGELOG.md` for
whether that's the case for your copy), reconcile the histories yourself
(`git pull --rebase origin main` or a fresh clone) rather than force-pushing
over existing work.

## 3. Repository settings (Settings tab, needs admin access)

These are UI steps — there is no API call in this repository that performs
them, on purpose, so that nothing here can silently change settings you didn't
ask for.

- **Settings → General → Description**: something like `Draggable, swappable,
reorderable React layouts. Framework-neutral core, small public API.` Keep it
  under GitHub's ~350-character limit and don't restate the README's tagline
  word for word.
- **Settings → General → Website**: `https://nashiuso.github.io/rewap/` (only
  valid once step 5 below is live).
- **About (gear icon next to the repo description) → Topics**: suggestions —
  `react`, `drag-and-drop`, `reorder`, `layout`, `typescript`, `accessibility`.
  Add what's actually true of the project; don't copy a competitor's topic list.
- **Settings → General → Features**: enable Issues (for the templates in
  `.github/ISSUE_TEMPLATE/`) and Discussions if you want the "Question or
  discussion" link in `.github/ISSUE_TEMPLATE/config.yml` to resolve instead of 404.
- **Settings → Branches → Branch protection rule** for `main`: require the
  `check` jobs from `.github/workflows/ci.yml` to pass before merging, require
  a pull request before merging (even to yourself — it keeps the history of
  _why_ linear), and consider "Require branches to be up to date before
  merging." Skip "Require approvals" for now; you're the only maintainer, and
  requiring your own approval on your own PR is just a extra click, not a
  safeguard.
- **Settings → Pages → Build and deployment → Source**: set to **GitHub
  Actions**, not "Deploy from a branch." `.github/workflows/pages.yml` already
  targets this mode (`actions/configure-pages` + `actions/deploy-pages`); it
  will not deploy anything until this setting is switched.

## 4. Secrets (only if you intend to use `release.yml`)

`.github/workflows/release.yml` publishes to npm when a `v*` tag is pushed, and
needs an `NPM_TOKEN` repository secret (**Settings → Secrets and variables →
Actions → New repository secret**) containing an npm **Automation** token
scoped to this package. Nothing in this repository invents, stores, or assumes
this secret exists — the workflow will simply fail loudly at the publish step
if it's missing, which is the intended behavior until you add it on purpose.

The Pages workflow (`pages.yml`) needs **no secret at all** — it uses GitHub's
built-in Pages OIDC permissions (`id-token: write`, `pages: write`), which is
why those two permissions are declared at the top of that file.

## 5. First Pages deploy

Once step 3's Pages source is set to GitHub Actions, push to `main` (or run
`pages.yml` manually from the Actions tab via `workflow_dispatch`) and watch it
build. First build can take a minute or two. The result should be at
`https://nashiuso.github.io/rewap/` with the docs at the root and the
playground at `https://nashiuso.github.io/rewap/playground/`.

This has been tested locally (`npm run site:build` + `node
scripts/site/preview.mjs`, which mirrors the `/rewap/` base path — see
`docs/maintainers/final-audit.md` for the exact commands and what they
verified) but **the actual GitHub Pages deployment has not been exercised**,
because that requires the real repository and real admin access neither of
which this environment has. Budget time to watch the first real run rather
than assuming it will be identical to the local mirror.

## 6. Optional: scripted metadata

`scripts/github/setup.sh` wraps steps in "3. Repository settings" that the
[GitHub CLI](https://cli.github.com/) (`gh`) can do non-interactively
(description, topics, Issues/Discussions toggles). It does **not** touch
branch protection or Pages source — the `gh` API for those is more invasive
and more worth doing by hand once, with the Settings page open next to it. Run
it only after `gh auth login` with an account that has admin on the repo; read
it before running it, like you should with any script that changes a GitHub
repository's settings.
