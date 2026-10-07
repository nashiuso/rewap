# Performance

Drag is the kind of interaction where a careless implementation is felt
immediately. Three rules shaped this library.

## 1. No React render during pointer movement

React is never asked to re-render while the pointer moves. The dragged element is
positioned by writing `style.transform` directly, through the same single writer that
handles keyboard moves and settles:

- **React renders** when the order changes, or when the slot layout changes.
- **The drag writes** a transform string, at pointer rate, outside React.

The practical consequence: a layout with heavy children — charts, images, widgets —
drags at the same speed as an empty one, because none of those components render
during the gesture.

```tsx
// During a drag this component does NOT re-render.
<Item id="analytics">
  <AnalyticsPanel />
</Item>
```

`onSwap` does fire on destination changes, and if you call `setState` from it you
have opted into renders yourself. That is a legitimate thing to do (highlight a
counter, say) — just know what it costs.

## 2. Measure, do not assume

Slots come from measurement, once per layout change, batched into a single read pass.
No `getBoundingClientRect` per item per frame, no layout thrash.

- A `ResizeObserver` watches the layout and each item; measurements are re-read when
  something changes, then cached.
- Transforms are read and written in one place (`elementStateFor`), so the library
  never guesses where an element currently is.
- Collision detection runs against the cached slot rects, not the live DOM.

```tsx
<Layout geometry={virtualisedProvider}>   // supply your own measurement
```

## 3. One ticker, and it stops

Every animation in the library subscribes to a single rAF loop that suspends itself
when nothing is animating. A hundred items moving is one loop, not a hundred, and an
idle layout has no frame callback scheduled at all.

## What the drag costs

| Work per pointer event              | Cost                                      |
| ----------------------------------- | ----------------------------------------- |
| Destination resolution              | one pass over the cached slots            |
| Visual state                        | a few arithmetic ops, one transform write |
| React renders                       | 0                                         |
| Style recalcs forced by the library | 0                                         |

Pointer events arrive at up to the display rate (and faster on some hardware), so the
handlers are deliberately flat: no allocation-heavy structures, no closures built per
frame, no `Object.assign` of large state objects.

## Bundle size

The core entry point is the only one every application pays for. Extensions are
separate entry points and separate stylesheets, so importing `<Chart>` costs nothing
unless you import it.

Approximate gzipped sizes, measured by `node scripts/size.mjs` on the published
build:

| Entry point                 | Gzipped  |
| --------------------------- | -------- |
| `@nashiuso/rewap` (core)    | ~30.5 kB |
| `@nashiuso/rewap/motion`    | ~5.2 kB  |
| `@nashiuso/rewap/math`      | ~5.5 kB  |
| `@nashiuso/rewap/providers` | ~3.5 kB  |
| `@nashiuso/rewap/utilities` | ~8.3 kB  |
| `@nashiuso/rewap/charts`    | ~8.9 kB  |
| `@nashiuso/rewap/widgets`   | ~9.3 kB  |
| CSS (`styles.css`)          | ~2.5 kB  |

Run `node scripts/size.mjs` after a build for the current numbers rather than
trusting a table in a document — including this one.

## Guidelines for application code

- **Keep item subtrees cheap to mount, not cheap to update.** During a drag, mounting
  does not happen; ordering does.
- **Avoid `onSwap` handler churn.** `onSwap` fires on every destination change, which
  is many times per drag. If you need it, keep the handler small, and prefer
  `onDragEnd` for anything expensive.
- **Prefer CSS for effects.** `hover: "lift"` is a CSS class, not a JS animation.
- **Do not animate `top`/`left`.** The library writes `transform` only, and so should
  your item styles.
- **Long lists**: measure fewer things. `geometry` exists exactly for virtualised
  lists, where only visible items have real rectangles.

## Honest limits

- The library does not virtualise anything. That is the application's job.
- Rotated or scaled ancestors distort measurement; rects are read in viewport space
  and transformed back, but a heavily transformed container is out of scope.
- `performance.now()` granularity is coarse in some browsers, so reported velocities
  are best-effort — accurate enough to rotate an item slightly, not a basis for
  physics simulation.
