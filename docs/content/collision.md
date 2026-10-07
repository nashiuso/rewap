# Collision

A collision strategy answers one question: _where does this land?_ Five of them ship
with the library, and the mode picks a sensible default.

| Strategy       | Answers with                         | Good for                              |
| -------------- | ------------------------------------ | ------------------------------------- |
| `pointer`      | the slot under the pointer           | `swap` — "what am I over?"            |
| `center`       | the slot under the item's centre     | dragging by an offset, or large items |
| `intersection` | the slot that overlaps the most      | grids and dense dashboards            |
| `nearest`      | the closest slot by centre distance  | sparse layouts, short drags           |
| `projection`   | an insertion position along one axis | lists, kanban columns, `reorder`      |

```tsx
<Layout collision="intersection">          // override the mode's default
<Layout collision="projection" minCollisionScore={0.25}>
```

`minCollisionScore` rejects weak matches (`0`–`1`). An empty candidate list — a
layout measured mid-transition — returns `null` from every strategy rather than
throwing.

## Place-based and position-based

`pointer`, `center`, `intersection` and `nearest` treat a slot as a location: the
answer is "the slot that matches best". `projection` is different — it treats the
axis as a line and answers with a _position_ in the resulting order.

`resolveCollision()` handles the difference for you:

```ts
resolveCollision({ activeRect, pointer, candidates, mode }, { strategy, exclude: "dragged-id" });
```

Place-based strategies get the dragged item's slot filtered out before they run.
Projection keeps the full list, because the slot the item is being held over is a
valid answer.

## How projection actually works

The version that looks obvious — count how many slot _centres_ the pointer has
passed — is wrong in a way that is easy to miss: the dragged item's own centre is
under the pointer, so the count includes it and every insertion is one short. The
symptom is a placeholder that flickers to the neighbour the instant a drag starts.

This implementation counts **boundaries** instead:

```
slots at y 100–220, 230–350, 360–480
boundaries at 225 and 355
pointer at 380 → one boundary behind it → position 1
```

Each boundary sits in the middle of the space between two slots when they are
separated, and at the midpoint of the two centres when they overlap. A position is
the number of boundaries behind the reference point, so the answer depends only on
where things are and never on the item being dragged.

`insertionPosition(candidates, value, axis, exclude?)` is exported if you need the
same maths for your own layout.

> **Maintainer note**
> This is the code that took the longest to get right and the shortest to write.
> The fix was three attempts in the wrong direction first (React batching, the
> shared ticker, jsdom ordering) before the destination indices were logged during
> a keyboard drag and the off-by-one was obvious. `docs/history/PROJECT-HISTORY.md`
> has the long version.

## Choosing a strategy

- **Lists and columns** → `projection`. It gives you a range shift rather than a
  swap, which is what list UIs mean.
- **Dashboards of equal cells** → `intersection`. Items are big, the pointer is
  somewhere inside one of them, and overlap is the honest measure.
- **Icons or chips** → `nearest`. Small targets, and a slot stays reachable even
  when the pointer sits between two of them.
- **Anything where the grab point matters** → `pointer` or `center`. `pointer` is
  what a mouse user expects; `center` is more forgiving when the item is larger than
  the slot.

## Axis

`projection` measures along `y` by default, which is what a vertical list wants. A
horizontal carousel passes `axis: "x"`:

```tsx
resolveCollision(input, { strategy: "projection", axis: "x" });
```

`<Layout>` picks the axis from the measured slots: if the first row contains more
than one item, the list is read horizontally.

## Writing your own

A strategy is a pure function:

```ts
type CollisionFn = (input: CollisionInput) => CollisionResult | null;

const myStrategy: CollisionFn = ({ activeRect, candidates }) => {
  // …
  return { id, index, slot, rect, score, strategy: "custom" };
};
```

It receives the active rectangle, the pointer (or the item's centre for a keyboard
drag), and the candidate slots. Return `null` for "nothing matches" — the drag keeps
its previous destination rather than jumping to a fallback.
