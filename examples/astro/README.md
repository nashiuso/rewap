# Rewap + Astro

```bash
npm install
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

This example depends on the package in this repository (`file:../..`), not a
published version, so `npm run build` in the repo root has to run first.
