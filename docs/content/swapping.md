# Swapping

Three modes, one component tree. Switching at runtime does not remount anything.

| Mode      | Default collision | A drop does this                                               |
| --------- | ----------------- | -------------------------------------------------------------- |
| `swap`    | `pointer`         | Exchanges the dragged item with the item in the target slot    |
| `reorder` | `projection`      | Removes the dragged item and inserts it at the target position |
| `grid`    | `intersection`    | Places it in the target cell and reorders the rest             |

```tsx
<Layout mode="swap">     // two panels trade places
<Layout mode="reorder">  // a list shifts up or down
<Layout mode="grid">     // a dashboard cell
```

Mode affects the _result_. The collision strategy affects which slot is chosen.
They are separate settings on purpose: a kanban board is usually `reorder` with an
`intersection` strategy.

## The swap event

`onSwap` fires every time the destination changes — during a drag that is more than
once. Use `onChange` if you only care about the committed result.

```ts
{
  item: "notes",
  previousSlot: { index: 1, column: 0, row: 1, rect: { x: 0, y: 232, width: 320, height: 132 } },
  nextSlot:     { index: 0, column: 0, row: 0, rect: { x: 0, y: 88,  width: 320, height: 132 } },
  position: { x: 160, y: 154 },   // pointer, or the item centre for keyboard
  velocity: { x: 0.42, y: -1.9 }, // pixels per millisecond
  mode: "reorder",
  source: "pointer"               // "pointer" | "mouse" | "touch" | "keyboard" | "programmatic"
}
```

Slots rather than indexes, because a slot carries the rectangle and placing a custom
preview or an analytics event usually needs it.

## Programmatic moves

```tsx
const api = useLayout();

api.move("notes", 0); // follows the mode: swaps in `swap`, inserts in `reorder`
api.swap("a", "c"); // exchange two items, whatever the mode
api.move("missing", 0); // false
```

`move()` returns `false` for an unknown id or a no-op, `true` when the order changed.
Indexes are clamped, so `move("a", 999)` goes to the last slot rather than failing.

> **Why does `move()` follow the mode?**
> Because a programmatic move should land in the state a drag would have produced.
> In a `swap` board, `move(id, 2)` exchanging rather than inserting is the honest
> answer, and the alternative is two functions that behave differently from the
> gesture they are meant to imitate. It surprises people, including me while
> writing the tests for it.

## Changing mode

```tsx
const [mode, setMode] = useState<LayoutMode>("swap");

<>
  <button onClick={() => setMode(mode === "swap" ? "reorder" : "swap")}>
    Toggle mode
  </button>
  <Layout mode={mode}>…</Layout>
</>;
```

The order is preserved, history is preserved, and any drag in flight is resolved with
the old mode before the new one takes over.

## Grid spans

```tsx
<Layout mode="grid" columns={4}>
  <Item id="hero" columnSpan={2} rowSpan={2}>
    Hero
  </Item>
  <Item id="stats" columnSpan={2}>
    Stats
  </Item>
</Layout>
```

Spans are written as `grid-column: span N` / `grid-row: span N` on the item. The
collision strategy works on the measured rectangles, so a spanning item is just a
bigger slot as far as the engine is concerned.
