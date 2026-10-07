# Items

`<Item>` is one draggable unit. It renders a `<div>` by default, becomes a proper
list item, and carries the ARIA wiring the layout needs for announcements.

```tsx
<Item id="weather" label="Weather panel" effects={{ hover: "lift" }}>
  <WeatherPanel />
</Item>
```

## Props

| Prop                     | Type             | Notes                                                                  |
| ------------------------ | ---------------- | ---------------------------------------------------------------------- |
| `id`                     | `string`         | Required and unique within the layout                                  |
| `label`                  | `string`         | Accessible name and the word used in announcements                     |
| `draggable`              | `boolean`        | `false` keeps the item in place but does not remove it                 |
| `disabled`               | `boolean`        | Not draggable, not focusable                                           |
| `handleOnly`             | `boolean`        | Only drag from an `<Item.Handle />`. Inferred when a handle is present |
| `effects`                | `EffectsOptions` | Per-item visual behaviour, merged over the layout's                    |
| `motion`                 | `MotionValue`    | Overrides the layout's motion for this item                            |
| `columnSpan` / `rowSpan` | `number`         | Grid spans                                                             |
| `as`                     | `ElementType`    | Element to render                                                      |

Anything else is passed to the root element: `className`, `style`, `onClick`, and
so on.

## The label matters

The label is what a screen reader hears when the item is grabbed or moved, and it is
the fallback used when the content itself is not a good summary (an icon, a chart, a
canvas).

If you do not pass one, rewap uses the item's text, trimmed to 64 characters, and
falls back to `item 3` for an item with no text at all. A label is still worth
setting: "Card, position 1 of 4" is more useful than "Revenue is up 12% this
quarter, position 1 of 4".

## Handles

```tsx
<Item id="editor" handleOnly>
  <Item.Handle label="Reorder editor" />
  <textarea defaultValue="Drag the grip, not the text" />
</Item>
```

`<Item.Handle />` renders a `<button>` with a grip icon drawn inline — no icon font,
no SVG file to load — and sets `touch-action: none` on itself only. The item keeps
`touch-action: auto` when a handle is present, so a finger can still scroll the page
by dragging the body of the item.

The handle is decorative by default (no accessible name) unless you pass `label`,
because the item already announces its own instructions.

## Non-item children

Anything that is not an `<Item>` stays where it was authored:

```tsx
<Layout>
  <h2>Today</h2>
  <Item id="a">A</Item>
  <Item id="b">B</Item>
  <footer>Updated 9:14</footer>
</Layout>
```

Headings, dividers and footers are rendered in place; only items take part in the
order. Fragments are transparent, so a list wrapped in a fragment behaves the same.

## Effects

```tsx
<Item
  id="card"
  effects={{
    hover: "lift",             // "none" | "lift" | "raise"
    drag: "magnetic",          // "none" | "magnetic" | "tilt"
    velocityRotation: 0.02,    // rotation per pixel/second of pointer speed
    dragScale: 1.03,
    dragOpacity: 0.9,
    shadow: true,
    backdropBlur: 6,
  }}
>
```

Effects are opt-in per item and merge over `effects` on the layout. Every one of
them is a transform or a filter written through the same element state controller
that moves the item, so there is no fight over `style.transform`.

> **Why is this like this?**
> `backdropBlur` is the most expensive thing in here on a low-end device. It is a
> prop rather than a default because a blurred backdrop repainted on every frame is
> a good way to make a nice-looking dashboard feel broken on an older phone.
