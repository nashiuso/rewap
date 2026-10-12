# Changelog

Versions follow [semver](https://semver.org/). Dates are the day the tag was cut.

## 1.1.1 (unreleased, alpha)

Mostly correctness fixes and repository cleanup. This alpha is not tagged; Rewap is
distributed from GitHub and is not published to the npm registry.

The interaction model did not need another redesign, so this release is about
correctness in the corners:

- **Fixed: a mouse or touch drag never used the live pointer position.** The
  internal check that picks between "follow the cursor" and "follow the
  dragged box" compared the session's input source against the literal string
  `"pointer"`, but real sessions are tagged `"mouse"` or `"touch"` — that
  string is only used for pen input. So every ordinary drag quietly fell back
  to the dragged element's own (reconstructed) center instead of where the
  finger or cursor actually was, and that reconstruction drifts whenever the
  live DOM reorder nudges the element's resting position mid-drag. The result
  looked like flaky collision detection — a `reorder` drag would sometimes
  travel two slots, then drop back to one, depending on exactly when the
  pointer let go. It wasn't the collision math; the input to it was wrong.
  Fixed by checking for any source that actually has a pointer to track
  (`mouse`, `touch`, `pointer`) and only falling back for `keyboard` /
  `programmatic` moves, which don't have one.
- **Fixed: `drop()` could commit a stale destination.** Destination resolution
  runs once per animation frame; letting go of the mouse between two frames —
  easy to do by hand, close to guaranteed from a script — used to commit
  whatever the previous frame had resolved. `drop()` now resolves once more,
  synchronously, against the pointer's actual position at release.
- **Fixed: grid layouts collapsed into a single column.** The base layout CSS
  built its `grid-template-columns` as `repeat(var(--rw-columns, auto-fit), …)`.
  Chromium does not treat a custom property that resolves to the keyword
  `auto-fit` the same as writing `auto-fit` directly in `repeat()` — the track
  list it produced was wrong, and every grid rendered as one wide column
  regardless of `minColumnWidth`. The auto-fit case is hardcoded now; the
  explicit-column-count case (an integer, not a keyword) still goes through
  the custom property because that one works fine.
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
- The documentation is a small Fumadocs app with a static search index. The Pages
  build exports it under `/rewap/` and the Vite playground under `/rewap/playground/`.
- GitHub installation is checked in a scratch consumer, including generated bundles,
  declarations and CSS exports.
- Removed the scaffold CLI and its templates: the `npx` interface depended on a
  registry package that this project does not publish.
- The playground remains one six-item example with local data and mode/motion controls.

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
