<p align="center">
  <img src="./assets/banner.svg" alt="rewap — draggable, swappable React layouts" width="100%">
</p>

<h1 align="center">rewap</h1>

<p align="center">
  Drag to swap, reorder or place items in a grid.<br>
  A React library for layouts that move, with pointer, touch and keyboard input.
</p>

<p align="center">
  <a href="https://nashiuso.github.io/rewap/"><img src="./assets/buttons/docs.svg" alt="Documentation" height="32"></a>
  <a href="https://nashiuso.github.io/rewap/playground/"><img src="./assets/buttons/examples.svg" alt="Playground" height="32"></a>
  <a href="https://nashiuso.github.io/rewap/quick-start/"><img src="./assets/buttons/start.svg" alt="Get started" height="32"></a>
  <a href="https://github.com/nashiuso/rewap"><img src="./assets/buttons/github.svg" alt="GitHub" height="32"></a>
</p>

<p align="center">
  <a href="https://github.com/nashiuso/rewap/actions/workflows/ci.yml"><img src="https://github.com/nashiuso/rewap/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status"></a>
  <img src="https://img.shields.io/badge/version-0.0.8-49A1A8?style=flat-square&labelColor=020204" alt="Version 0.0.8">
  <img src="https://img.shields.io/badge/license-MIT-49A1A8?style=flat-square&labelColor=020204" alt="MIT license">
</p>

<br>

## Install

```bash
npm install github:nashiuso/rewap
```

> [!NOTE]
> rewap is installed from GitHub and is not published to the npm registry. The
> `prepare` script builds `dist/` (ESM, CommonJS, types and stylesheets) on install.

Requires `react` 18 or newer and Node.js 20 or newer. For reproducible installs,
pin a commit: `npm install github:nashiuso/rewap#<commit-sha>`.

## Quick start

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

## Modes

| Mode               | A drop…                                                        |
| ------------------ | -------------------------------------------------------------- |
| `swap` _(default)_ | exchanges the dragged item with the item in the target slot    |
| `reorder`          | inserts the item at the target and shifts the items in between |
| `grid`             | places the item in the target cell                             |

Shape a grid with `columns`, `minColumnWidth`, and `columnSpan` / `rowSpan` on `Item`.
Controlled order, persistence, motion presets and collision strategies are in the
[documentation](https://nashiuso.github.io/rewap/).

## Keyboard

Focus an item, then:

| Key                | Action      |
| ------------------ | ----------- |
| `Space`            | Grab / drop |
| Arrow keys         | Move        |
| `Esc`              | Cancel      |
| `Ctrl` / `⌘` + `Z` | Undo        |

Keyboard input drives the same drag controller as the pointer, and changes are
announced through a live region. `prefers-reduced-motion: reduce` makes movement
instant. `Layout` and `Item` render the same markup on server and client; see
[Accessibility and SSR](https://nashiuso.github.io/rewap/accessibility-and-ssr/).

## API

| Export                | Description                                  |
| --------------------- | -------------------------------------------- |
| `Layout`              | Container: order, drag session, history      |
| `Item`, `Item.Handle` | A draggable unit and an optional drag handle |
| `useLayout()`         | Current state and programmatic moves         |
| `createRewap`         | Framework-agnostic engine                    |

<details>
<summary>Optional entry points and stylesheets</summary>

<br>

Imported explicitly and only bundled when used.

| Entry                           | Contents                                                 |
| ------------------------------- | -------------------------------------------------------- |
| `@nashiuso/rewap/core`          | Framework-agnostic engine                                |
| `@nashiuso/rewap/math`          | Geometry, grids, interpolation, statistics               |
| `@nashiuso/rewap/motion`        | Springs, easings, shared animation ticker                |
| `@nashiuso/rewap/accessibility` | Live-region announcer and keyboard grammar               |
| `@nashiuso/rewap/utilities`     | Browser hooks that report what the platform exposes      |
| `@nashiuso/rewap/providers`     | Adapters for external data, only when you configure them |
| `@nashiuso/rewap/charts`        | `Chart`, an SVG chart with an accessible data table      |
| `@nashiuso/rewap/widgets`       | Ready-made dashboard widgets                             |

Stylesheets: `styles.css` (layout defaults), plus `tokens.css`, `charts.css` and
`widgets.css` for the optional modules. Styles are scoped to `rw-*` classes and
`--rw-*` custom properties.

</details>

## Development

```bash
npm ci                  # install and build dist/
npm run ci              # format, types, lint, tests, build, package checks
npm run docs:install    # docs dependencies (Node 22.12+)
npm run docs:dev        # docs dev server
npm run site:build      # build docs and assemble site-dist/
npm run verify:github-install
```

The docs site lives in `docs/`, built with [Astro](https://astro.build/) and
[Starlight](https://starlight.astro.build/).

<br>

<p align="center">
  <a href="./LICENSE">MIT</a> © <a href="https://github.com/nashiuso">nashiuso</a>
</p>
