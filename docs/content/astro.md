# Astro and SSR

There is no Rewap integration for Astro, and there does not need to be. The React
bindings render on the server and hydrate in the browser, so `@astrojs/react` is the
whole story:

```bash
npx astro add react
```

```astro
---
import { Dashboard } from "../components/Dashboard";
import "@nashiuso/rewap/styles.css";
---

<html lang="en">
  <body>
    <!-- Hydrates when it scrolls into view. -->
    <Dashboard client:visible />
    <!-- Hydrates as soon as the page loads. -->
    <Queue client:load />
  </body>
</html>
```

`Dashboard` and `Queue` are ordinary React components. The directive decides when each
one becomes interactive; the library does not care which one you pick.

## What server rendering does and does not do

- **Renders.** `<Layout>`, `<Item>` and the widgets produce the same markup on the
  server as on the client: items in order, `role="list"`, labels, `aria-keyshortcuts`,
  the instructions each item points at.
- **Does not measure.** No element is measured during render, so no geometry is read on
  the server. Slots are measured in an effect after hydration, which is also when
  `ResizeObserver` is attached.
- **Does not touch the browser.** Nothing at module scope reads `window`, `document`,
  `navigator`, `localStorage`, `matchMedia`, `ResizeObserver` or `requestAnimationFrame`.
  Each is looked up when it is used, behind an availability check.
- **Does not warn.** The layout effect hooks degrade to `useEffect` when there is no
  window (`src/react/useIsomorphicLayoutEffect.ts`), so React's "useLayoutEffect does
  nothing on the server" warning never appears.

The hooks follow the same rule. `useWeather()` or `useNetworkInfo()` called during
server rendering return the honest empty state — `unsupported`, or `online` with
`supported` flags set to `false` — and fill in after hydration. A widget rendered on the
server says `unsupported` rather than an invented number, which is what
`tests/ssr.test.tsx` asserts by rendering the components with `renderToString` in a
plain Node environment.

## Persistence and islands

`persistence={{ key: "dashboard" }}` reads storage on mount, so a server render always
starts from the authored order and the stored order arrives with hydration. That is the
same behaviour as any client-only render, and it means the server HTML is correct for a
first-time visitor.

If you render the same component twice on one page, give each layout its own key —
otherwise they share a storage entry and the second one wins:

```tsx
<Dashboard client:visible title="Dashboard, hydrated on visible" />
<Queue client:load />
<Queue client:visible />
```

## The example in this repository

[`examples/astro/`](../examples/astro) is a real Astro app, not a snippet. It builds a
static page with three islands and is the thing the claims above are checked against:

```bash
npm install && npm run build     # from the repository root, for the package itself
cd examples/astro && npm install && npm run build
```

It is a standalone application rather than a workspace, because Astro pulls in a large
dependency tree that the root install should not pay for. Its README says the same.

## Other frameworks

Astro is the example because it is the least magical: a static build and a directive.
The same component works in Next.js, Remix or Vite's SSR, with two things to keep in
mind:

1. Import the stylesheet once, in the place your framework handles global CSS.
2. If your framework renders on the server and hydrates, read
   [Persistence](persistence.html) — the stored order arrives after mount, by design.
