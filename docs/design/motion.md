# Motion

The goal is not to make everything look physical. The goal is to make movement
predictable. Sometimes the physically correct answer is the less pleasant one.

## A plan, not a config

`resolveMotion(motion, { prefersReducedMotion })` turns whatever the caller passed
into a `MotionPlan`:

- `{ kind: "spring", stiffness, damping, mass }` — velocity-aware, used for drops,
  FLIP and settles;
- `{ kind: "tween", duration, easing }` — used by the `soft` preset and where a
  spring would overshoot;
- `{ kind: "instant" }` — no animation at all.

Presets are `smooth` (default), `snappy`, `soft` and `instant`. Everything
downstream — the animator, the element state controller, the chart intro
animation, the placeholder — consumes a plan, so the reduced-motion path is not a
special case anywhere.

## Springs

`stepSpring()` is semi-implicit Euler at a fixed `1/60` step with sub-stepping for
long frames. Frame-rate independence comes from sub-stepping rather than from a
continuous solver, because the fixed step keeps test expectations stable and the
error is irrelevant at these durations.

Rest is declared, not observed: below a distance and a velocity threshold the
spring is snapped to its target. Otherwise a slow spring keeps writing sub-pixel
transforms for a second after it looks finished.

Heavy springs can overshoot visibly on purpose. `stiffness: 90, damping: 12` will
bounce. That is not a bug, and if it is not what you want, raise the damping —
`criticalDamping()` returns the value that removes overshoot exactly.

## One ticker

A single `requestAnimationFrame` loop drives every animation and is started when
the first one is registered and stopped when the last one ends. Thirty animated
items cost one frame callback, and a page that is not animating costs none.

`createTicker()` gives tests a ticker they can step by hand, which is how motion is
tested without waiting in real time.

## No re-render during a drag

The element state controller writes transforms, opacity, filter and box-shadow
directly during a drag. React sees a handful of updates per gesture (status and
destination changes) rather than one per pointer event.

The cost is that motion state is not in React. `elementStateFor(element)` memoises
a controller per element in a `WeakMap`, so both the drag path and the hover path
find the same one, and `applyState` is the only writer. That rule is in
`MAINTAINERS.md` for a reason: two writers on the same transform produce a fight
nobody can debug from a screenshot.
