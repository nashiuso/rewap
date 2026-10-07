# Changelog

Versions follow [semver](https://semver.org/). Dates are the day the tag was cut.

## 1.1.1

Mostly cleanup, packaging and the things you only find once people use a library
in an actual application.

The interaction model did not need another redesign, so this release is about
correctness in the corners:

- **Fixed: projection off by one.** `reorder` and `grid` layouts dropped items one
  slot short of where the pointer was, and the placeholder flickered as soon as a
  drag started. The projection strategy now measures the boundaries a slot has to
  cross instead of the distance to the next centre. Found while writing the
  keyboard tests; the first three attempts to blame the test runner were wrong.
- **Fixed: the first undo of a session emptied the layout.** The history was
  created on the first render, before the children had been reconciled, so it was
  seeded with an empty order. It is created on the first render that knows the
  order now, and reconciled/hydrated orders are mirrored into it.
- **Fixed: an inline `cache` object made `useWeather` render forever.** The hook
  memoised its storage on the options object, so `cache={{ ttlMs: 60000 }}` inside
  a component re-created the storage on every render and re-triggered the fetch
  effect. It now depends on the values.
- **Fixed: histogram charts drew the raw values as bars.** Bins were computed but
  the bar branch used the input points, so a histogram of a hundred values drew a
  hundred bars at the wrong heights.
- **Fixed: `height="12rem"` produced a 24px chart.** `parseFloat` read `12` out of
  the string. Only explicit `px` values are used now; other lengths are left to
  CSS.
- **Fixed: persistence wrote while the order was controlled.** The development
  warning said persistence is ignored in that case, and now it is true.
- **Fixed: `<Item.Handle aria-label="…" />` lost its label.** The handle passes
  `aria-label` through, which is the obvious thing to write, and it was being
  overwritten with `undefined` — a button with no accessible name. Found by the
  browser tests, of all things.
- **Fixed: `rewap info` read the export map wrong.** The package publishes nested
  conditions (`import`/`require`, each with `types` and `default`), and the command
  treated `exports[subpath].import` as a path, so it crashed on its own manifest
  instead of printing it.
- Keyboard dragging: `Shift` + arrow moves three slots in `reorder` and exchanges
  with the item three away in `swap`. This is documented now. It always behaved
  this way, which is why changing it would have been a breaking release.
- Charts accept CSS lengths for `height`, keep drawing when a container is
  measured as zero, and skip their intro animation under `prefers-reduced-motion`.
- An end-to-end suite now runs the built examples app in Chromium through
  Playwright: pointer drags, keyboard, reorder, responsiveness, reduced motion and
  the mobile layout on an emulated phone.
- The test suite covers touch, responsive, persistence, undo/redo, accessibility,
  utilities, providers, charts, widgets and server rendering.
- `README`, `NOTES.md`, `MAINTAINERS.md`, the docs site and the limitations page
  are new in this version. Documentation had been living in my notes app.

Some internal names are still a little ugly. `insertionIndexFromProjection` and
`projectedCenters` in `core/order.ts` are the old centre-based projection helpers;
nothing in the library calls them any more but they are exported, so they stay
until 2.0 instead of being deprecated for a single release.

## 1.1.0

- `grid` mode, with `columnSpan` / `rowSpan` on `<Item>`.
- Charts entry point (`@nashiuso/rewap/charts`): line, area, bar, scatter,
  histogram and sparkline, drawn as local SVG.
- Widgets entry point (`@nashiuso/rewap/widgets`).
- Statistics in the math layer: variance, standard deviation, percentile,
  correlation, regression, moving average, histogram.
- `useWeather`, `useNetworkInfo`, `useConnection`, `useBattery`, `usePerformance`,
  `useKeyboardLayout`, `useEmailVerification`, `useViewport`.
- Providers (weather, IP location, email verification) behind explicit adapters.
  Nothing is requested unless the application creates one.

## 1.0.2

- Fixed the FLIP animation leaving a transform behind when a drop landed in the
  slot the item came from.
- `Item.Handle` no longer swallows clicks on disabled items.
- Smaller type declarations; `--rw-*` tokens documented.

## 1.0.1

- Fixed a `useLayoutEffect` warning during server rendering. Reported twice and
  both times it was the same line.
- `aria-keyshortcuts` is only advertised on items that can actually be dragged.

## 1.0.0

First tagged release.

- `<Layout>` and `<Item>` with `swap`, `reorder` and `grid` modes.
- Pointer, touch and keyboard dragging with a placeholder, drag preview,
  cancellation and programmatic moves.
- Local motion engine with `smooth`, `snappy`, `soft` and `instant` presets.
- `useLayout()` with undo, redo, reset, persistence and announcements.

The API changed a lot between 0.9 and 1.0 and there is no migration guide, because
the only application using it was mine and I updated it in the same week.
