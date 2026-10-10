# API

Everything the library exports, in one place. The core surface is three components
and one hook; the rest is opt-in.

```tsx
import { Layout, Item, useLayout } from "@nashiuso/rewap";
```

## Layout

| Prop                                       | Type                                        | Default                        | Notes                                                                 |
| ------------------------------------------ | ------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `mode`                                     | `"swap" \| "reorder" \| "grid"`             | `"swap"`                       | Changes the default collision strategy and what an arrow press does   |
| `items`                                    | `readonly LayoutItemInput[]`                | —                              | Controlled order; pair with `onChange`                                |
| `defaultItems`                             | `readonly LayoutItemInput[]`                | —                              | Uncontrolled initial order                                            |
| `onChange`                                 | `(items, event) => void`                    | —                              | Fires on every committed order change                                 |
| `onSwap`                                   | `(event: SwapEvent) => void`                | —                              | Fires whenever the drop destination changes                           |
| `onDragStart` / `onDragMove` / `onDragEnd` | event handlers                              | —                              | Drag lifecycle                                                        |
| `collision`                                | `CollisionStrategy`                         | from `mode`                    | `swap` → `pointer`, `reorder` → `projection`, `grid` → `intersection` |
| `minCollisionScore`                        | `number`                                    | `0`                            | Reject weak matches                                                   |
| `snap`                                     | `{ enabled?, threshold? }`                  | enabled, `40`                  | Pull the element toward the destination slot                          |
| `threshold`                                | `number`                                    | `4`                            | Pointer travel before a drag starts                                   |
| `motion`                                   | `MotionValue`                               | `"smooth"`                     | Motion for every item                                                 |
| `placeholderMotion`                        | `MotionValue`                               | `motion`                       | Motion for the placeholder only                                       |
| `placeholder`                              | `"auto" \| "outline" \| "ghost" \| "none"`  | `"auto"`                       | See [Swapping](swapping.html)                                         |
| `renderPlaceholder`                        | `({ item, slot }) => ReactNode`             | —                              | Replaces the placeholder's contents                                   |
| `effects`                                  | `EffectsOptions`                            | —                              | Hover lift, magnetic drag, velocity rotation, blur                    |
| `history`                                  | `boolean \| { enabled?, limit? }`           | `{ enabled: true, limit: 50 }` | Undo/redo                                                             |
| `persistence`                              | `boolean \| PersistenceConfig`              | —                              | Local storage only                                                    |
| `keyboard`                                 | `boolean \| KeyboardOptions & { enabled? }` | `{ step: 1, largeStep: 3 }`    | Keyboard dragging                                                     |
| `bounds`                                   | `LayoutBounds`                              | —                              | Confine the dragged element: an element, a rect, or a function        |
| `disabled`                                 | `boolean`                                   | `false`                        | Ignores every gesture                                                 |
| `as`                                       | `ElementType`                               | `"div"`                        | Root element                                                          |
| `columns` / `minColumnWidth` / `gap`       | `number \| string`                          | —                              | Written to `--rw-columns` / `--rw-min-column` / `--rw-gap`            |
| `label`                                    | `string`                                    | —                              | Accessible name of the list                                           |
| `containerRef`                             | `Ref<HTMLDivElement>`                       | —                              |                                                                       |
| `controllerRef`                            | `Ref<LayoutController>`                     | —                              | Imperative handle                                                     |
| `geometry`                                 | `GeometryProvider`                          | —                              | Replaces measurement (tests, virtualised lists)                       |

Plus any `div` attribute: `className`, `style`, `aria-*`, …

## Item

| Prop                     | Type             | Default  | Notes                                         |
| ------------------------ | ---------------- | -------- | --------------------------------------------- |
| `id`                     | `string`         | —        | Required, unique                              |
| `draggable`              | `boolean`        | `true`   | `false` makes the item static                 |
| `disabled`               | `boolean`        | `false`  | Not focusable, not draggable                  |
| `handleOnly`             | `boolean`        | auto     | Detected when an `<Item.Handle />` is present |
| `label`                  | `string`         | derived  | Accessible name                               |
| `effects`                | `EffectsOptions` | layout's | Merged over the layout's effects              |
| `motion`                 | `MotionValue`    | layout's | Overrides the layout's motion                 |
| `columnSpan` / `rowSpan` | `number`         | `1`      | `grid` mode                                   |
| `as`                     | `ElementType`    | `"div"`  |                                               |

`<Item.Handle />` renders a `<button data-rewap-handle>`.

## useLayout()

```tsx
const api = useLayout();
```

| Member                          | Type                                        | Notes                                                        |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `ids`                           | `string[]`                                  | Committed order                                              |
| `renderIds`                     | `string[]`                                  | What the DOM shows right now, including an in-flight preview |
| `mode`                          | `LayoutMode`                                |                                                              |
| `slots`                         | `Slot[]`                                    | Measured slots in reading order                              |
| `activeId`                      | `string \| null`                            | Item being dragged                                           |
| `isDragging`                    | `boolean`                                   |                                                              |
| `move(id, index)`               | `(string, number) => void`                  | Programmatic move, follows the mode                          |
| `swap(a, b)`                    | `(string, string) => void`                  | Exchange two items                                           |
| `grab(id, options?)`            | `(string) => void`                          | Start a keyboard-style drag                                  |
| `release()` / `cancel()`        | `() => void`                                | Commit or return                                             |
| `undo()` / `redo()` / `reset()` | `() => void`                                | History                                                      |
| `canUndo` / `canRedo`           | `boolean`                                   |                                                              |
| `announce(message, priority?)`  | `(string, "polite" \| "assertive") => void` | Live region                                                  |
| `element`                       | `HTMLElement \| null`                       | Layout root                                                  |
| `scrollIntoView(id)`            | `(string) => void`                          |                                                              |

`useLayout()` returns the snapshot from the current render. `slots` describes the
last measurement, so read it after the layout has mounted.

## Event payloads

```ts
onSwap: ({ item, previousSlot, nextSlot, position, velocity, mode, source }) => void
```

| Field                       | Meaning                                                   |
| --------------------------- | --------------------------------------------------------- |
| `item`                      | Id of the dragged item                                    |
| `previousSlot` / `nextSlot` | Where the destination was, and where it is now            |
| `position`                  | Pointer position, or the item's centre for keyboard drags |
| `velocity`                  | Pixels per second at the moment the destination changed   |

`DragStartEvent` adds `index` and `slot`; `DragMoveEvent` has `delta`, `velocity` and
`target`; `DragEndEvent` has `from`, `to`, `reason` (`drop`, `cancel`, `escape`,
`outside`), `cancelled` and `position`. `LayoutChangeEvent` has `ids`, an optional
`swap` and a `source` that can be `"history"`.

## Configuration objects

```ts
type EffectsOptions = {
  hover?: "none" | "lift" | "raise";
  drag?: "none" | "magnetic" | "tilt";
  velocityRotation?: boolean | number;
  dragScale?: number;
  dragOpacity?: number;
  backdropBlur?: number;
  elevation?: number;
};

type PersistenceConfig = {
  key: string;
  storage?: "localStorage" | "sessionStorage" | "memory" | StorageLike;
  mode?: LayoutMode;
  enabled?: boolean;
};

type SnapOptions = { enabled?: boolean; threshold?: number };
type KeyboardOptions = { step?: number; largeStep?: number };
type PhysicsOptions = { smoothing?: number }; // velocity sampling, 0.35 by default
```

## Motion

```ts
type MotionValue =
  "smooth" | "snappy" | "soft" | "instant" | MotionPlan | false | null;

type MotionPlan =
  | { type: "spring"; stiffness?: number; damping?: number; mass?: number }
  | { type: "tween"; duration?: number; easing?: (t: number) => number }
  | { type: "instant" };
```

`resolveMotion(motion, { prefersReducedMotion })` returns the plan that will actually
run. See [Motion](motion.html).

## Math

```ts
import { rect, containsPoint, intersect, ... } from "@nashiuso/rewap/math";

rect(x, y, width, height)          // the canonical rect constructor
centerOf(rect) / rectCenter(rect)
distance(a, b) / distanceSquared(a, b)
clamp / clamp01 / lerp / inverseLerp / remap / smoothstep / damp / snapToStep
mean / median / mode / variance / standardDeviation / percentile / correlation
movingAverage / histogram / normalizeValues
gridCellAtPoint / gridColumns / gridLayoutRect
createVelocityTracker
```

Full list: `math/rect.ts`, `math/geometry.ts`, `math/grid.ts`, `math/interpolate.ts`,
`math/statistics.ts`, `math/velocity.ts` — all re-exported from `@nashiuso/rewap/math`.

## Sub-path entry points

| Import                        | Contains                                                 |
| ----------------------------- | -------------------------------------------------------- |
| `@nashiuso/rewap`             | Layout, Item, useLayout, core types, persistence helpers |
| `@nashiuso/rewap/math`        | geometry, rects, interpolation, statistics, velocity     |
| `@nashiuso/rewap/motion`      | motion plans, presets, the shared ticker, springs        |
| `@nashiuso/rewap/utilities`   | browser hooks and email helpers                          |
| `@nashiuso/rewap/providers`   | explicit data providers                                  |
| `@nashiuso/rewap/charts`      | `<Chart>` and the scale/path helpers                     |
| `@nashiuso/rewap/widgets`     | the seven dashboard cards                                |
| `@nashiuso/rewap/styles.css`  | base layout, placeholder and item styles                 |
| `@nashiuso/rewap/tokens.css`  | the design tokens only                                   |
| `@nashiuso/rewap/charts.css`  | chart styles                                             |
| `@nashiuso/rewap/widgets.css` | widget styles                                            |

Every entry point is a real module in the package. Nothing is fetched at runtime and
no optional dependency installs itself.
