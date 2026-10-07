# Motion

The goal is not to make everything look physical. The goal is to make movement
predictable.

## Presets

```tsx
<Layout motion="smooth">   // the default: a soft spring, no overshoot
<Layout motion="snappy">   // stiffer and faster, for small items
<Layout motion="soft">     // a tween instead of a spring
<Layout motion="instant">  // no animation at all
```

| Preset    | Kind                          | Character                                           |
| --------- | ----------------------------- | --------------------------------------------------- |
| `smooth`  | spring, `320 / 32 / mass 1`   | short, slightly damped settle                       |
| `snappy`  | spring, `520 / 38 / mass 0.9` | fast and decisive, good for swap previews           |
| `soft`    | spring, `180 / 26 / mass 1.1` | gentle; used for long travel and ghost placeholders |
| `instant` | zero-length tween             | the item is where it should be, now                 |

## Springs

```tsx
<Layout motion={{ type: "spring", stiffness: 220, damping: 24, mass: 1 }}>
<Item id="card" motion={{ type: "spring", stiffness: 90, damping: 12 }}>   // bouncy
```

`stiffness` pulls toward the target, `damping` removes energy, `mass` slows the
response. The spring is integrated at a fixed step and comes to rest below a
distance _and_ velocity threshold, so it never writes sub-pixel transforms forever.

`criticalDamping(stiffness, mass)` returns the damping value that removes overshoot
exactly — useful when you want a fast spring without the bounce.

## Tweens

```tsx
<Layout motion={{ type: "tween", duration: 260, easing: "ease-out-quint" }}>
```

A tween with no `duration` is 240 ms with `ease-out-cubic`. The easing list is
shorter than a full animation library's on purpose: `linear`, `ease-in-out-cubic`,
`ease-out-cubic`, `ease-out-expo`, `ease-out-quint`, plus `cubicBezier(a, b, c, d)`
for anything else.

## Reduced motion

`prefers-reduced-motion: reduce` resolves every plan to `instant`. The drag still
works, the item simply appears in its new place. Nothing needs to be configured.

```tsx
// Escape hatch, for an animation that is decorative rather than movement:
<Layout motion={{ type: "spring", stiffness: 200, damping: 20, respectReducedMotion: false }}>
```

Use it rarely. The preference exists because motion makes some people ill, and the
exception is for things like a brief colour change, not for a flying card.

## What animates

| Thing                            | Motion source                               |
| -------------------------------- | ------------------------------------------- |
| Item following the pointer       | spring, `mass`-weighted, plus the snap pull |
| Items displaced by a drop        | FLIP, using the layout's motion             |
| Item returning after a cancel    | a spring back to the slot it started in     |
| Placeholder moving to a new slot | `placeholderMotion` (defaults to `motion`)  |
| Hover lift and drag effects      | the item's motion                           |

## Maintaining frame budget

One shared `requestAnimationFrame` loop drives every animation on the page, started
when the first animation registers and stopped when the last one ends. A page that
is not animating runs nothing.

During a drag, React renders on status and destination changes only. The transform
is written imperatively by the element state controller, so a 60 Hz drag on a
sixty-item board does not produce sixty renders per second.

> **Maintainer note**
> The spring integrator uses a fixed 1/60 step with sub-stepping rather than a
> continuous solver. The error at these durations is invisible, and a fixed step
> keeps the tests deterministic — the alternative was a test suite that passed on
> one machine and failed on another.
