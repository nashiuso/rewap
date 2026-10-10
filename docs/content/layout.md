# Layout

`<Layout>` is the container: it owns the order, the drag session, history,
persistence and measurement. It renders a `<div>` by default (`as` changes that)
with `role="list"` unless you pass your own role.

```tsx
<Layout
  mode="swap"
  label="Dashboard panels"
  placeholder="auto"
  motion="smooth"
  onChange={(items, event) => console.log(event.source, items)}
>
  <Item id="a">A</Item>
  <Item id="b">B</Item>
</Layout>
```

## Props

| Prop                                       | Type                                                                    | Default                            | Notes                                             |
| ------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| `mode`                                     | `"swap" \| "reorder" \| "grid"`                                         | `"swap"`                           | Drop semantics; see [Swapping](swapping.html)     |
| `items`                                    | `LayoutItemInput[]`                                                     | —                                  | Controlled order                                  |
| `defaultItems`                             | `LayoutItemInput[]`                                                     | —                                  | Initial order, owned internally                   |
| `onChange`                                 | `(items, event) => void`                                                | —                                  | Fired when the order is committed                 |
| `onSwap`                                   | `(event) => void`                                                       | —                                  | Fired whenever the destination changes            |
| `onDragStart` / `onDragMove` / `onDragEnd` | event handlers                                                          | —                                  | Gesture lifecycle                                 |
| `collision`                                | `CollisionStrategy`                                                     | mode default                       | See [Collision](collision.html)                   |
| `minCollisionScore`                        | `number`                                                                | —                                  | Ignore slots below this score (`0`–`1`)           |
| `snap`                                     | `SnapOptions`                                                           | `{ enabled: true, threshold: 18 }` | Pull toward the slot centre                       |
| `threshold`                                | `number`                                                                | `4`                                | Pointer travel before a drag starts               |
| `motion`                                   | `MotionValue`                                                           | `"smooth"`                         | See [Motion](motion.html)                         |
| `placeholder`                              | `"auto" \| "outline" \| "ghost" \| "none"`                              | `"auto"`                           | Destination indicator                             |
| `renderPlaceholder`                        | `({ item, slot, mode }) => ReactNode`                                   | —                                  | Custom placeholder                                |
| `effects`                                  | `EffectsOptions`                                                        | `{}`                               | Defaults for every item                           |
| `history`                                  | `boolean \| { enabled?, limit? }`                                       | enabled, `limit: 50`               | See [Persistence](persistence.html)               |
| `persistence`                              | `boolean \| { key, storage? }`                                          | off                                | Local storage only                                |
| `keyboard`                                 | `boolean \| { enabled?, step?, largeStep? }`                            | enabled                            | See [Keyboard](keyboard.html)                     |
| `bounds`                                   | `"container" \| "viewport" \| null \| HTMLElement \| Rect \| RefObject` | `"container"`                      | Drag limits                                       |
| `disabled`                                 | `boolean`                                                               | `false`                            | Turns the whole layout read-only                  |
| `geometry`                                 | `GeometryProvider`                                                      | DOM measurement                    | For tests and virtualised lists                   |
| `columns`, `minColumnWidth`, `gap`         | `number \| string`                                                      | —                                  | Set `--rw-columns`, `--rw-min-column`, `--rw-gap` |
| `containerRef`                             | `Ref<HTMLDivElement>`                                                   | —                                  | The root element                                  |
| `controllerRef`                            | `Ref<LayoutController>`                                                 | —                                  | The same object `useLayout()` returns             |

## CSS variables

```css
.panels {
  --rw-columns: 3; /* grid columns */
  --rw-min-column: 220px; /* auto-fit minimum */
  --rw-gap: 16px;
}
```

`columns` sets `--rw-columns` and a matching `data-rw-columns` attribute. Without
them, the layout is a flow container: items are placed by the CSS you already have,
and rewap only measures where they ended up. This is the intended way to make a
layout responsive — one media query, no JavaScript breakpoints.

> **Maintainer note**
> There is no `breakpoint` prop on `<Layout>`. Breakpoints are a CSS concern, and
> duplicating them in JavaScript is how the two drift apart. If you need the current
> one in code, `useViewport()` gives you the same numbers.

## The root element

| Attribute             | Contents                                  |
| --------------------- | ----------------------------------------- |
| `data-rewap-layout`   | present on every layout root              |
| `data-mode`           | the current mode                          |
| `data-status`         | `"idle"`, `"dragging"` or `"settling"`    |
| `data-rewap-dragging` | present while a gesture is in flight      |
| `aria-describedby`    | points at the hidden instructions element |

## Nested layouts

A `<Layout>` inside another one works: the inner layout handles gestures that start
inside it, and the outer one ignores them. Dragging _between_ two sibling layouts is
not supported — see [known limitations](known-limitations.html).

## Example: a responsive grid

```tsx
<Layout mode="grid" columns="auto-fit" minColumnWidth={240} gap={16}>
  {cards.map((card) => (
    <Item
      key={card.id}
      id={card.id}
      columnSpan={card.wide ? 2 : 1}
      label={card.title}
    >
      <Card {...card} />
    </Item>
  ))}
</Layout>
```
