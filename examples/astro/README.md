# Rewap + Astro

This example depends on the package in this repository (`file:../..`), not a
published version. Install the root first: its `prepare` script builds `dist/`,
which the example links to.

```bash
# from the repository root
npm ci

# then in this directory
cd examples/astro
npm ci
npm run dev
```

There is no Rewap-specific Astro integration, and there does not need to be: the
React bindings render on the server and hydrate in the browser, so `@astrojs/react`
is the whole story.

- `src/pages/index.astro` loads the dashboard with `client:visible`, and a second
  copy with `client:load` to show the difference.
- `src/components/Dashboard.tsx` is an ordinary React component. It renders safely
  during `astro build`'s static HTML pass — no `window`/`document` access outside
  an effect — then hydrates and measures its own geometry in the browser.

Dependency audit findings for this example are recorded in `NOTES.md`.
