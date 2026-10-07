# Dragging

A drag has four phases: arm, drag, resolve, settle. Every input path walks the same
four.

| Phase   | Input                                | What happens                                                                   |
| ------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| Arm     | `pointerdown`, `Space`, `api.grab()` | Session created; nothing moves until the threshold is passed                   |
| Drag    | `pointermove`, arrow keys            | Transform follows the pointer, destination recalculated, preview order updated |
| Resolve | `pointerup`, `Enter`                 | Destination committed through `orderAfterDrop`                                 |
| Settle  | —                                    | Item springs to its slot, transforms cleared, gesture listeners removed        |

## Pointer and touch

Both go through pointer events, so there is one code path. A touch drag starts with
a `pointerdown` that a mouse never produces, and the `InputSource` on the events
reports `"touch"` so analytics and previews can tell them apart.

Items set `touch-action: none` so a finger drag does not scroll the page, except
when the item is handle-only — then only the grip does, and the item body scrolls as
usual. That asymmetry is deliberate: making a whole card non-scrollable is how a
dashboard becomes unusable on a phone.

## Arms and thresholds

The default threshold is 4 px: below that, a press is a click and the item does not
move. Keyboard and programmatic drags pass `immediate` and skip it.

```tsx
<Layout threshold={8}>   // a press has to travel 8px before an item starts to move
```

## Bounds

```tsx
<Layout bounds="container">   // default: stay inside the layout
<Layout bounds="viewport">
<Layout bounds={null}>        // unconstrained
<Layout bounds={panelRef}>
<Layout bounds={{ x: 0, y: 0, width: 800, height: 600 }}>
```

Bounds clamp the _visual_ position of the dragged item. The destination is still
decided by collision, so an item held against the edge of a container still drops
into the slot that is under it.

## Drag preview

The rendered order follows the destination while a drag is in flight:

```tsx
const { ids, renderIds } = useLayout();
// ids: committed order — does not change until the drop
// renderIds: what is on screen right now, including the preview
```

The DOM order changes, and the items that moved are animated from their old position
to the new one with a FLIP animation. Nothing re-renders per pointer event; a drag of
any length costs a handful of React renders (status and destination changes).

## Cancelling

Escape during a keyboard drag, `pointercancel`, a lost pointer capture, or
`api.cancel()`:

```tsx
const api = useLayout();
api.cancel(); // the item springs back to where it started
```

`onDragEnd` reports `{ cancelled: true, reason: "escape" | "cancel" | "blur" }` so an
application can tell a cancelled drag from a completed one.

## The click that follows a drag

A browser fires `click` after `pointerup`, on whatever is under the pointer. After a
drag, that click is almost never intended, so the layout cancels exactly one click
after a drag that moved and then gets out of the way. Clicks that are not preceded by
a drag are untouched, which matters for buttons and links inside items.

## Snap

```tsx
<Layout snap={{ enabled: true, threshold: 22 }}>
```

As an item nears a slot centre the visual position is pulled toward it, which makes
a drop feel decided rather than approximate. It is a visual pull only: the
destination comes from the collision strategy, so a high threshold cannot silently
change where an item lands.

## Rebase

If the DOM changes under a drag — an item is added, a panel collapses, a scroll
happens — call `rebase` on the controller and the engine re-measures, so the item
does not jump:

```ts
controllerRef.current?.rebase();
```

`<Layout>` does this itself on scroll and on resize of its container.
