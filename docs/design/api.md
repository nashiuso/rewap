# API

Notes on the shape of the public surface. The reference is in `docs/content/api.md`.

## Two components, one hook

```tsx
<Layout>
  {" "}
  // container, order, interaction
  <Item id="a">
    {" "}
    // a draggable unit
    <Item.Handle /> // optional: restrict dragging to a grip
  </Item>
</Layout>
```

`useLayout()` gives the imperative surface: order, slots, programmatic moves, undo,
redo, reset, announcements, element lookup, scroll. It is the same object a
`controllerRef` receives, so a component can use whichever fits.

## Uncontrolled by default, controlled on request

- No props: the authored child order is the order.
- `defaultItems`: start from a list, own it internally.
- `items` + `onChange`: the application owns it. The layout stops writing
  persistence in this case — if it wrote, the next mount would resurrect an order
  the application had already decided against.

`items` accepts strings or `{ id, data }`, and `onChange` returns the same shape it
was given, so object items survive a round trip.

## One API, three modes

Mode changes drop semantics, not the component tree. That means an application can
switch a board between `reorder` and `swap` at runtime without remounting anything.

`move(id, index)` follows the mode. In `swap` it exchanges the item with the one at
that index; in `reorder` it inserts. This surprises people (it surprised me while
writing the tests), and it is the honest behaviour: a programmatic move should land
in the same state a drag would have produced.

## Event payloads

`onSwap`, `onDragStart`, `onDragMove`, `onDragEnd` and `onChange` all carry slots
rather than indexes where slots are available: `{ index, column, row, rect }`. Index
alone is not enough to place a custom preview or an analytics event, and computing
a slot from an index outside the engine means duplicating the measurement.

`onSwap` fires when the destination changes, which during a drag is more than once.
`onChange` fires when the order is committed. If you only care about the final
result, listen to `onChange` and ignore `onSwap`.

## Optional entry points

```
@nashiuso/rewap            core: Layout, Item, engine, math, motion
@nashiuso/rewap/math       geometry, grids, interpolation, statistics
@nashiuso/rewap/motion     springs, easing, ticker, presets
@nashiuso/rewap/utilities  browser hooks
@nashiuso/rewap/providers  weather, IP location, email verification adapters
@nashiuso/rewap/charts     local SVG charts
@nashiuso/rewap/widgets    ready-made widgets
```

Charts and widgets are separate on purpose: an application that only needs drag and
swap should not pay for a chart renderer it never imports. The stylesheets follow
the same split (`styles.css`, `charts.css`, `widgets.css`, `tokens.css`).

## What is not in the API on purpose

- No global reset. The styles are scoped to `rw-*` classes and the tokens are
  custom properties; a page can use rewap without adopting a design system.
- No `theme` prop. Tokens are CSS variables, so theming is a stylesheet concern.
- No data fetching in the core. Providers are objects the application creates.
- No `onBeforeSwap` veto hook. It was requested once and it turns a predictable
  model into a callback maze; a `canDrop` predicate would be the right shape if it
  ever comes back.
