<p align="center">
  <img src="./assets/banner.svg" alt="rewap — draggable, swappable React layouts" width="100%">
</p>

<h1 align="center">rewap</h1>

Rewap is a React library for layouts whose items move: drag to swap, reorder or
place items in a grid, with pointer, touch and keyboard input.

<p align="center">
  <a href="https://nashiuso.github.io/rewap/"><img src="./assets/buttons/docs.svg" alt="Documentation" height="32"></a>
  <a href="https://nashiuso.github.io/rewap/playground/"><img src="./assets/buttons/examples.svg" alt="Playground" height="32"></a>
  <a href="https://nashiuso.github.io/rewap/docs/quick-start/"><img src="./assets/buttons/start.svg" alt="Get started" height="32"></a>
  <a href="https://github.com/nashiuso/rewap"><img src="./assets/buttons/github.svg" alt="GitHub" height="32"></a>
</p>

<p align="center">
  <a href="https://github.com/nashiuso/rewap/actions/workflows/ci.yml"><img src="https://github.com/nashiuso/rewap/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status"></a>
  <img src="https://img.shields.io/badge/license-MIT-49A1A8?style=flat-square&labelColor=020204" alt="MIT license">
  <img src="https://img.shields.io/badge/status-1.1.1%20alpha-49A1A8?style=flat-square&labelColor=020204" alt="Status: 1.1.1 alpha">
</p>

> **1.1.1 alpha, unreleased.** Install from GitHub. The package is not published
> to the npm registry, and this repository has no release tags yet.

## Installation

```bash
npm install github:nashiuso/rewap
```

For a reproducible install, pin a full commit SHA or an existing tag:
`npm install github:nashiuso/rewap#<ref>`. npm records the resolved commit in your lockfile.

The git install runs the package's `prepare` script, which builds `dist/`
(ESM, CommonJS, declarations and stylesheets).

- Peer dependency: `react` 18 or newer. The test suite runs against React 18.3.
- Node.js 18.18.0 or newer for installing and using the package.

## Quick example

```tsx
import { Item, Layout } from "@nashiuso/rewap";
import "@nashiuso/rewap/styles.css";

export function App() {
  return (
    <Layout mode="swap">
      <Item id="one">One</Item>
      <Item id="two">Two</Item>
    </Layout>
  );
}
```

Drag an item with a pointer or touch, or focus it and press `Space`, move with the
arrow keys, and press `Space` again to drop. `Escape` cancels, and
`Ctrl`/`Cmd`+`Z` undoes.

## Layout modes

Set the mode with `<Layout mode="…">`. The mode decides what a drop produces.

- **`swap`** (default) exchanges the dragged item with the item in the target slot.
- **`reorder`** removes the item and inserts it at the target, shifting the items in between.
- **`grid`** places the item in the target cell. Shape the grid with `columns`,
  `minColumnWidth`, and `columnSpan` / `rowSpan` on `Item`.

Controlled and uncontrolled order, persistence, motion presets and collision
strategies are covered in the documentation.

## Public API

| Export                | What it is                                    |
| --------------------- | --------------------------------------------- |
| `Layout`              | The container: order, drag session, history   |
| `Item`, `Item.Handle` | A draggable unit, and an optional drag handle |
| `useLayout()`         | Current state and programmatic moves          |
| `createRewap`         | Framework-agnostic engine                     |

Optional entry points are imported explicitly and only pulled in when used:

- `@nashiuso/rewap/core`: The framework-agnostic engine
- `@nashiuso/rewap/math`: Geometry, grids, interpolation, statistics
- `@nashiuso/rewap/motion`: Springs, easings, the shared animation ticker
- `@nashiuso/rewap/accessibility`: Live-region announcer and keyboard grammar
- `@nashiuso/rewap/utilities`: Browser hooks that report what the platform exposes
- `@nashiuso/rewap/providers`: Adapters for external data, only when you configure them
- `@nashiuso/rewap/charts`: `Chart`, an SVG chart with an accessible data table
- `@nashiuso/rewap/widgets`: Ready-made dashboard widgets

Stylesheets: `styles.css` (layout defaults), plus `tokens.css`, `charts.css` and
`widgets.css` for the optional modules. Styles are scoped to `rw-*` classes and
`--rw-*` custom properties.

## Accessibility and server rendering

- Every mode has a keyboard path that drives the same drag controller as a pointer
  drag. Grab, move, drop and cancel changes are announced through a live region.
- `prefers-reduced-motion: reduce` makes movement instant. Dragging still works.
- `Layout` and `Item` render on the server with the same markup as the client.
  Measurement and persistence happen after mount, so the first server-rendered
  paint shows the authored order.

Details are in [Accessibility and SSR](https://nashiuso.github.io/rewap/docs/accessibility-and-ssr/).

## Documentation and playground

- [Documentation](https://nashiuso.github.io/rewap/): installation, API, motion,
  accessibility, SSR and known limitations.
- [Playground](https://nashiuso.github.io/rewap/playground/): six local items to try
  the modes and motion presets.

## Development

```bash
npm ci                    # installs the lockfile tree and builds dist/ via prepare
npm run ci                # format, types, lint, tests, build and package checks
npm run test:e2e          # browser tests (run `npx playwright install chromium` once)
npm run site:build        # docs + playground into site-dist/
npm run verify:github-install
```

The documentation site is a Next.js and Fumadocs app in `docs/` and requires
Node.js 20.9 or newer. The browser tests require Node.js 20 or newer. The Astro
example in `examples/astro` is described in its own README.

## License

[MIT](./LICENSE) © [nashiuso](https://github.com/nashiuso)
