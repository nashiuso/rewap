# Reorder

`reorder` moves an item and shifts everything between the old and the new position.
It is the mode for lists: a queue, a playlist, a set of rows where the order itself is
the data.

```tsx
<Layout
  mode="reorder"
  gap={8}
  onSwap={(event) => console.log(event.nextSlot.index)}
>
  {rows.map((row) => (
    <Item key={row.id} id={row.id} label={row.title}>
      {row.title}
    </Item>
  ))}
</Layout>
```

## What `reorder` does to the order

Dragging one item from index `0` to index `2`:

```text
before   a  b  c  d
after    b  c  a  d
```

`b` and `c` each moved back one position; nothing else changed. Compare with
[`swap`](swapping.html), which exchanges the two items and leaves the middle alone,
and with `grid`, which moves into a cell.

| Mode      | One drag from `a@0` to index `2` | Use it for                                     |
| --------- | -------------------------------- | ---------------------------------------------- |
| `swap`    | `c b a d`                        | dashboards, panels of different sizes          |
| `reorder` | `b c a d`                        | lists, queues, rankings                        |
| `grid`    | `b c a d`, placed by cell        | tile boards where the position is a 2D address |

The mode lives on the layout, and changing it does not remount the items. It does
change what the committed order is, so pick one per layout.

## Handles

A row with a link, a checkbox or a button inside it should not start a drag when
someone clicks the control. Put an `<Item.Handle />` in the item and dragging only
starts there:

```tsx
<Item id={task.id} label={task.title} className="task">
  <span className="task__meta">{task.minutes} min</span>
  <span className="task__title">{task.title}</span>
  <Item.Handle className="task__handle" label={`Reorder ${task.title}`}>
    ⠿
  </Item.Handle>
  <button type="button" onClick={() => complete(task.id)}>
    Done
  </button>
</Item>
```

The handle is a real `<button type="button">` with a `data-rewap-handle` attribute,
and it is deliberately out of the tab order: the item itself is the keyboard target,
so a keyboard user grabs the row with Space rather than tabbing to a grip first. Give
it an accessible name (`label`, or the icon alone for a decorative one).

When a handle is present the item behaves as `handleOnly`; you can also set
`handleOnly` on the item directly. `drag-pointer.spec.ts` and `reorder.spec.ts` cover
both halves of that rule in a real browser: the handle starts a drag, the body does
not.

## Collision strategy

Where the item lands is decided by the collision strategy, not by the mode. For lists
the useful ones are:

- `projection` (the default for `reorder`) — moves the item across the boundary of a
  slot, which is what the eye expects in a vertical list.
- `pointer` — uses the pointer position alone; predictable when items differ in size.
- `center` — the item whose centre is nearest to the dragged centre.
- `nearest` — nearest by distance, with the edges of the layout pulling.

```tsx
<Layout mode="reorder" collision="projection" minCollisionScore={0.4} />
```

The full model, including `intersection` and the scoring, is in
[Collision](collision.html).

## Reordering without a pointer

Everything the pointer can do, the keyboard and the API can do too:

```tsx
const { move } = useLayout();

move("row-3", 0); // to the front
move("row-1", 2); // to index 2
```

`move` follows the layout's mode, clamps an index past the ends rather than throwing,
and returns `false` when the move would not change anything. Keyboard users grab with
Space or Enter, move with the arrows, jump with `Home`/`End`, and `Shift` + arrow
moves three slots. See [Keyboard](keyboard.html).

## Where it is used in this repository

The kanban columns in [`examples/`](../examples/) are three independent `reorder`
layouts, and the release queue in `examples/astro/` is the same idea with handles.
Cross-column dragging is not part of this version — the [known
limitations](known-limitations.html) page says so plainly rather than pretending
otherwise.
