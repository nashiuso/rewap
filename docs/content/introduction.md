# Introduction

Rewap is a React interaction library for layouts whose items move: swapping,
reordering, grids, dashboards, boards.

The public surface is deliberately small — a container, an item, and a hook. The
work sits underneath it: measuring slots, resolving collisions, animating what
moved, keeping the keyboard path equivalent to the pointer path, and announcing
what happened to a screen reader.

```tsx
import { Item, Layout } from "@nashiuso/rewap";

<Layout mode="reorder">
  <Item id="a">A</Item>
  <Item id="b">B</Item>
</Layout>;
```

That is the whole idea. Everything below is either a mode, a motion setting, or a
piece of information the layout hands back to you.

## What it is not

- **Not a general animation library.** The motion engine exists to move items
  convincingly and to run on the layout's own ticker. It is not a replacement for
  a full animation runtime.
- **Not a data layer.** External information (weather, IP location, server-side
  email checks) only happens through providers you create, with endpoints you chose.
- **Not a component kit.** The stylesheet is scoped, tokens are CSS variables, and
  you can ignore both.
- **Not a framework.** There is no plugin system, no adapter registry to learn, and
  no configuration file.

## The three layers

| Layer              | Contains                                                       | Depends on |
| ------------------ | -------------------------------------------------------------- | ---------- |
| `react/`           | `Layout`, `Item`, the engine hook, element state               | React      |
| `core/`            | order, collision, drag session, history, persistence, keyboard | nothing    |
| `math/`, `motion/` | rectangles, grids, interpolation, statistics, springs          | nothing    |

`core/` does not import React. That is what makes the interaction model testable
without a renderer, and it is why pointer, touch, keyboard and programmatic moves
all produce the same result.

## Where to go next

- [Installation](installation.html) — what to install and what to import.
- [Quick start](quick-start.html) — a working board in twenty lines.
- [Layout](layout.html), [Items](items.html) — the two components.
- [Dragging](dragging.html) through [Collision](collision.html) — how a drop is
  decided.
- [Keyboard](keyboard.html) and [Accessibility](accessibility.html) — the paths that
  are usually left for later.
- [Known limitations](known-limitations.html) — read this before planning around
  browser APIs.
