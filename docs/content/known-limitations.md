# Known limitations

Things the library does not do, on purpose or because the platform does not let it.
Written here instead of discovered in an issue.

## Interaction

- **No cross-`<Layout>` dragging.** An item cannot be picked up from one `<Layout>`
  and dropped into another. Doing that well needs a shared session, a shared
  measurement pass and a decision about which layout owns the order while a drag is
  in flight — a feature worth designing on purpose, not bolting on. Nest a `grid` or
  use one `<Layout>` with sections if you need items to move between groups today.
- **No free-form (absolute position) dragging.** Every mode resolves to a slot.
  There is no mode where an item can be dropped at an arbitrary `x, y` and stay
  there; that is a different interaction model with different collision rules.
- **`columnSpan` / `rowSpan` only apply in `grid` mode.** They are ignored (not
  errored on) in `swap` and `reorder`, since neither has a second axis to span.

## Platform APIs

- **`useKeyboardLayout().layout` is always `null`.** The Web Keyboard API only
  exposes `getLayoutMap()` inside a keyboard-locked element, which a normal page is
  never in. The hook reports platform, modifiers and language, which are genuinely
  readable, and reports `layout: null` rather than guess at the rest.
- **`usePerformance().cpuTemperature` is always `unsupported`.** No browser exposes
  this to a web page. The field carries `{ supported: false, reason }` instead of a
  number that would otherwise look real.
- **`useBattery()` only works in Chromium, and only on some origins.** The Battery
  Status API was removed from Firefox and Safari over privacy concerns. Elsewhere
  the hook reports `{ supported: false }` and nothing else.
- **`useNetworkInfo()`'s `effectiveType` / `downlink` / `rtt` need
  `navigator.connection`.** Safari does not implement the Network Information API at
  all; `online` still works everywhere because it comes from a different event.

## Rendering

- **Server rendering paints the authored order, not the persisted one.**
  Persistence is read in an effect (it needs `localStorage`/`sessionStorage`, which
  do not exist on the server), so a server-rendered page's first paint can differ
  from what the user had last time, for one frame. If that visible flash matters for
  your page, render a skeleton until mount instead of the real board.
- **No React Native target.** `core/` does not depend on the DOM, but the gesture
  handling, measurement and accessibility work are web APIs (`PointerEvent`,
  `ResizeObserver`, ARIA). A native binding is a different project, not a flag here.

## Scale

- **Not benchmarked past a few hundred items.** The measurement and collision code
  is `O(n)` per frame in the item count, which is fine for a dashboard or a board and
  untested for a list with thousands of rows. Virtualizing a draggable list is its
  own problem and out of scope for 1.x.

## Documentation site

- **The docs you are reading are a static build, not an interactive app.** Search is
  a client-side filter over page titles and headings — no server, no indexing
  service. There is no live, editable playground embedded in a page; for that, run
  the actual playground (`npm run examples:dev`) or open the one hosted alongside
  these docs.

If something you hit is not on this page, it is probably a bug rather than a
limitation — see [CONTRIBUTING](https://github.com/nashiuso/rewap/blob/main/CONTRIBUTING.md)
for how to report it.
