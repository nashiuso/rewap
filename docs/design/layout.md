# Layout

The interaction model, and why it is split the way it is.

## Three layers

```
react/     turns events and snapshots into DOM, and DOM into measurements
core/      order, collision, drag session, history, persistence, keyboard
math/      rectangles, grids, geometry, interpolation, statistics
```

`core/` does not import React. That is not architecture for its own sake — it is
what makes the drag session testable without a renderer, and it is why `swap`,
`reorder` and `grid` can share one controller with different strategies.

`react/` is deliberately thin. `Layout.tsx` reads events and draws the
placeholder; `useLayoutEngine.ts` owns state; `elementState.ts` writes transforms.
Between them they do very little that could be done in `core/`.

## Committed order and preview order

There are two lists, and mixing them up causes most of the bugs in this area:

- `ids` — the committed order. Changes only when a gesture ends, a programmatic
  move happens, or history/persistence changes it.
- `renderIds` — what the DOM currently renders. Follows the destination slot during
  a drag so the user sees the item land where it will actually go.

`useLayout()` exposes both, and the docs say plainly which is which. Everything
that writes `ids` also notifies `onChange`; nothing writes it during a drag.

Modes:

| mode      | collision default | drop semantics                                            |
| --------- | ----------------- | --------------------------------------------------------- |
| `swap`    | `pointer`         | exchange the dragged item with the one in the target slot |
| `reorder` | `projection`      | remove the item and insert it at the target position      |
| `grid`    | `intersection`    | place in the target cell, reordering the rest             |

The mode decides the _result_, and the collision strategy decides the _target_.
They are separate on purpose: a kanban board in `reorder` mode with an
`intersection` strategy is a legitimate setup.

## Why there is no re-render during a drag

Dragging writes a transform on one element and moves a placeholder. Neither needs
React. The engine publishes a snapshot on status and destination changes (a handful
of renders per drag), and the element state controller applies position, scale,
opacity, blur and shadow imperatively through `requestAnimationFrame`.

The trade-off: transforms are outside React's model, so anything that reads the DOM
has to know that a transform may be in flight. `baseRectOf()` subtracts the
transform we wrote before measuring, which is the rule that keeps measurement
honest. If you add a new measurement path, do the same.

## The placeholder

`auto` (outline), `outline`, `ghost` and `none`, plus `renderPlaceholder` for a
custom element. It is positioned from the _destination slot's_ rectangle, so it
follows the collision result rather than the pointer.

`ghost` renders a copy of the item and is the most expensive option: it clones the
element and animates the clone. It exists because it looks right in dashboards, and
it is not the default for that reason.

## History

The history records committed orders, not gestures. Drag from A to B and back
before dropping and nothing is recorded, which is what people expect from undo.

The stack is seeded with the first order the layout actually knows, not with the
empty order from the first render. That distinction was a real bug in 1.0.x: the
first undo of a session cleared the layout, and the browser quietly fell back to
the authored child order, so it looked like nothing happened.
