# Geometry

How rectangles are produced, and why the library is fussy about it.

## One rectangle type

```ts
rect(x, y, width, height);
```

Every measurement in the library ends up in this shape. `DOMRect` never travels
further than `rectFromDOMRect()`, because a `DOMRect` carries `top`/`right`/`bottom`/
`left` alongside `x`/`y` and two of those disagree just often enough to be
infuriating. One shape means one place to look.

`sanitizeRect()` is applied at every boundary where numbers come from outside —
`getBoundingClientRect`, a `GeometryProvider`, a stored rect. It zeroes components
that are not finite. NaN in a transform is silent and sticky; the layout stops
responding and nothing throws. Better to lose a rectangle than the whole drag.

## Measurement

Items are measured relative to the container, in the container's coordinate space,
so scrolling and CSS zoom do not have to be modelled. `engine.slots()` returns
`SlotCandidate[]` — id, index, rect, slot — and is lazily recomputed: it is marked
dirty on registration, resize, scroll and the start of a drag, and recomputed on
the next read.

`ResizeObserver` on each item invalidates the cache; there is no `window.resize`
listener because a layout can change size without the window doing anything. The
cost is that a layout inside a CSS transition re-measures a few times, which is
cheap next to being wrong.

## Base rectangles and transforms

During a drag the active element has a transform. `baseRectOf()` subtracts exactly
that transform before using the measurement, so the engine always reasons about
where an item _would_ be, not where it currently is. Without this, a fast drag
feeds its own output back into the next measurement and the item runs away.

Components that measure outside the engine (`Chart`, the placeholder) use the same
rule.

## Grid layout

`gridCellAtPoint()` maps a point to a cell and clamps to the last visible column:
a point past the right edge belongs to the nearest cell rather than to nothing, which
matches how people drag. `clusterLines()` groups slots into visual rows for
keyboard navigation, using overlap rather than the column index so a staggered grid
still behaves.

## Geometry providers

`GeometryProvider` is injected, not hard-coded: `{ measure(element), viewport() }`.
`domGeometry` is the default. `createStaticGeometry()` exists for tests and
virtualised lists, where the DOM does not know where things are.

This is also why the test suite can exercise the real component tree in jsdom. The
geometry is synthetic; everything above it is real.
