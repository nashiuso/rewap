<div align="center">

<img src="./assets/banner.svg" alt="rewap: draggable, swappable, reorderable React layouts" width="100%">

<br>

**Draggable, swappable and reorderable layouts for React.**<br>
Built-in motion engine, TypeScript throughout, no runtime dependencies beyond React.

<br>

<a href="#quick-start"><img src="./assets/buttons/start.svg" alt="Get started" height="32"></a>&nbsp;
<a href="docs/content/api.md"><img src="./assets/buttons/docs.svg" alt="API docs" height="32"></a>&nbsp;
<a href="examples/"><img src="./assets/buttons/examples.svg" alt="Examples" height="32"></a>&nbsp;
<a href="https://www.npmjs.com/package/@nashiuso/rewap"><img src="./assets/buttons/npm.svg" alt="npm" height="32"></a>&nbsp;
<a href="https://github.com/nashiuso/rewap"><img src="./assets/buttons/github.svg" alt="GitHub" height="32"></a>

[![npm](https://img.shields.io/npm/v/@nashiuso/rewap?style=flat-square&labelColor=020204&color=49A1A8)](https://www.npmjs.com/package/@nashiuso/rewap)
[![license](https://img.shields.io/npm/l/@nashiuso/rewap?style=flat-square&labelColor=020204&color=D9DBDF)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-49A1A8?style=flat-square&labelColor=020204)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18%20%7C%2019-49A1A8?style=flat-square&labelColor=020204)](https://react.dev)
[![runtime deps](https://img.shields.io/badge/runtime%20deps-0-D9DBDF?style=flat-square&labelColor=020204)](./package.json)

</div>

<br>

## Why

The interaction model should stay small. Geometry, motion, accessibility and real-world edge cases belong underneath it, not in your code. Rewap is two components and a hook; modes and physics are props.<br>
<sub>> nashiuso</sub>

<!--## Features

- **Small API.** `<Layout>`, `<Item>`, `<Item.Handle />` and `useLayout()`.
- **Three modes.** `swap`, `reorder` and `grid`. Switching mode never remounts the tree.
- **One drag session.** Pointer, touch, keyboard and programmatic moves share a single path.
- **Local motion engine.** Springs, tweens and presets: `smooth`, `snappy`, `soft`, `instant`.
- **Measured geometry.** `ResizeObserver` and injected geometry. No fixed sizes.
- **Honest utilities.** Browser hooks report `unsupported` when nothing is exposed.
- **Local-first.** Persistence writes to storage you choose; the core makes no network calls.
- **Accessible.** Full keyboard grammar, ARIA wiring, live announcements, reduced-motion path.-->
## Installation

```bash
npm install @nashiuso/rewap
```

[*React 18*](https://18.react.dev/) is the only peer dependency. Nothing else is needed at runtime.

### Entry points

Small core, explicit extras. Optional entry points are bundled **only when imported**.

```tsx
import { Layout, Item } from "@nashiuso/rewap";                    // core
import "@nashiuso/rewap/styles.css";                               // scoped styles

import { Chart } from "@nashiuso/rewap/charts";                    // optional
import { StatsWidget } from "@nashiuso/rewap/widgets";             // optional
import { useWeather } from "@nashiuso/rewap/utilities";            // optional
import { createOpenMeteoProvider } from "@nashiuso/rewap/providers"; // optional · external data
```

## Quick start

```tsx
import { Item, Layout } from "@nashiuso/rewap";
import "@nashiuso/rewap/styles.css";

const panels = ["weather", "traffic", "notes", "activity"];

export const Dashboard = () => (
  <Layout mode="reorder" placeholder="auto" motion="smooth" onSwap={console.log}>
    {panels.map((id) => (
      <Item key={id} id={id} label={id}>
        {id}
      </Item>
    ))}
  </Layout>
);
```

Drag with a pointer, a finger, or `Space` and the arrow keys. Everything else is opt-in.

## API

| Export            | Role                                                                    |
| :---------------- | :---------------------------------------------------------------------- |
| `<Layout>`        | Container: mode, motion, placeholder, history, persistence, collision.  |
| `<Item id>`       | Draggable unit: `label`, `draggable`, `disabled`, `handleOnly`, `effects`, `motion`, `columnSpan`. |
| `<Item.Handle />` | Restricts dragging to a grip inside the item.                           |
| `useLayout()`     | Moves from code: `move`, `swap`, `grab`, `release`, `undo`, `redo`, `reset`, `announce`, `scrollIntoView`, `ids`, `renderIds`, `element`. |

Full reference in [*`docs/content/api.md`*](docs/content/api.md).

<details>
<summary><b>Configuration example</b></summary>

<br>

```tsx
<Layout
  mode="reorder"                  // swap | reorder | grid
  items={items}                   // controlled…
  onChange={setItems}             // …or defaultItems + internal state
  onSwap={handleSwap}             // fires while the destination changes
  collision="projection"          // pointer | center | intersection | nearest | projection
  placeholder="outline"           // auto | outline | ghost | none
  renderPlaceholder={({ item }) => <div className="slot">{item}</div>}
  motion={{ type: "spring", stiffness: 220, damping: 24 }}
  history={{ enabled: true, limit: 50 }}
  persistence={{ key: "dashboard", storage: "localStorage" }}
  keyboard={{ step: 1, largeStep: 3 }}
  snap={{ enabled: true, threshold: 18 }}
  label="Dashboard panels"
/>
```

`onSwap` payload:

```ts
{ item, previousSlot, nextSlot, position, velocity }
```

</details>

<!--## Examples

Vite apps in [`examples/`](examples/), built from source with no CDN and no remote assets: dashboard, analytics view, kanban board, widget board, statistics dashboard, mobile layout.

```bash
npm install
npm run examples:dev
```-->

## Utilities

Browser hooks from `@nashiuso/rewap/utilities`. Each reports what the browser exposes, and says so when it exposes nothing.

| Hook                     | Availability | Notes                                                              |
| :----------------------- | :----------- | :----------------------------------------------------------------- |
| `useViewport()`          | Local        | Size, orientation, breakpoint, visual viewport height.             |
| `useKeyboardLayout()`    | Local        | Platform, modifiers, language. Physical layout reports `null`.     |
| `usePerformance()`       | Browser      | FPS, frame time, long tasks, memory. CPU temperature: unsupported. |
| `useNetworkInfo()`       | Browser      | Online state, `effectiveType`, `downlink`, `rtt`, `saveData`.      |
| `useConnection()`        | Browser      | Same data as a label for a badge.                                  |
| `useBattery()`           | Chromium     | `supported: false` elsewhere.                                      |
| `useEmailVerification()` | Local + provider | Syntax checks offline; remote checks via your provider.        |
| `useWeather()`           | Provider     | Never geolocates without an explicit source.                       |

## Accessibility

| Area             | Behavior                                                                                       |
| :--------------- | :--------------------------------------------------------------------------------------------- |
| **Keyboard**     | `Space`/`Enter` grab · arrows move · `Shift`+arrow moves 3 · `Home`/`End` jump · `Esc` cancels |
| **History**      | `Cmd/Ctrl+Z` undo · `Cmd/Ctrl+Shift+Z` or `Ctrl+Y` redo                                        |
| **Screen readers** | List items with role description, shortcuts and hidden instructions. Grabs, moves and cancels announced via a live region created on demand. |
| **Reduced motion** | `prefers-reduced-motion: reduce` collapses every animation to one instant step. Dragging still works. |
| **Focus**        | Follows the item through keyboard moves; returns to it after a drop.                           |

## Performance

- One transform controller per element. React renders on status and destination changes, not per pointer event.
- One shared `requestAnimationFrame` loop for all animations.
- Slots are measured lazily and cached; `ResizeObserver` invalidates them.
- Core entry point: ~30 kB minified and gzipped. Run `npm run size` to measure locally.

## Browser support

Chromium, Firefox and Safari, current and previous major versions. Requires pointer events, `ResizeObserver`, `requestAnimationFrame` and `Intl`.

When an API is missing, the matching utility returns `supported: false` with a reason. Rewap does not guess.

Server rendering is supported: nothing touches the DOM during render, and layout is measured in an effect.

<!--## Architecture

```text
src/
├─ core/            order, collision, drag session, history, persistence, keyboard
├─ react/           Layout, Item, engine hook, element state, FLIP
├─ motion/          springs, easing, ticker, presets
├─ math/            rects, grids, geometry, interpolation, statistics
├─ accessibility/   live region, keyboard grammar
├─ utilities/       browser hooks
├─ providers/       external data adapters
├─ charts/          optional SVG charts
├─ widgets/         optional widgets
└─ styles/          tokens, scoped stylesheets
```

`core/` does not import React. Design notes live in [`docs/design/`](docs/design/).
-->

## Development

```bash
npm install
npm test              # vitest || jsdom || * layers
npm run test:e2e      # playwright || real browser
npm run build         # bundles || types || stylesheets
npm run docs:dev      # docs site      -> :4173
npm run examples:dev  # examples app   -> :5173
npm run ci            # format || typecheck || lint || tests || build || package checks
```

Browser tests need Chromium once per machine:

```bash
npx playwright install chromium             # local
npx playwright install --with-deps chromium # Linux CI: adds shared libraries
```



---

<!--## Testing

- **Vitest + jsdom.** Synthetic geometry drives the real component tree: drag, swap, reorder, collision, motion, keyboard, touch, persistence, undo/redo, utilities, accessibility, reduced motion, charts and widgets. Public types are tested separately in `tests/types`.
- **Playwright.** `e2e/` covers what jsdom cannot: real pointer, layout and painting. Runs the built examples app in Chromium on desktop and emulated phone, plus a `reducedMotion: reduce` spec. Only the browser is downloaded at test time.

## License

MIT © [nashiuso](https://github.com/nashiuso)
-->