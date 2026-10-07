# Physics

The motion engine trades realism for predictability in three specific places. This
page explains them, because the code is short and the reasoning is not obvious.

## Semi-implicit Euler, fixed step

```
velocity += (stiffness * (target - position) - damping * velocity) / mass * dt
position += velocity * dt
```

`dt` is fixed at `1/60` and long frames are sub-stepped. That is not the most
accurate integrator available; it is the one whose behaviour does not change with
the frame rate. A drag on a 120 Hz display and the same drag on a 60 Hz display
produce the same path, and the tests can assert on numbers.

## Rest is declared

A spring is at rest when both the distance to its target **and** the velocity are
below their thresholds, at which point it is snapped to the target and the animation
ends.

Without the velocity condition a spring that is passing through its target at speed
would stop there. Without the distance condition it would keep writing transforms
that round to the same pixel for another second, keeping the ticker alive for
nothing.

## Velocity and smoothing

The pointer's velocity is sampled over a short window — the last handful of events,
not the last two — so one jittery frame does not decide anything on its own.
`smoothing` (0.35 by default) blends each new sample into the running estimate:
lower is calmer, 1 is raw.

Three things use it:

- **`velocityRotation`**, the small rotation an item picks up while being dragged;
- **the event payloads**, where `velocity` is reported in pixels per millisecond;
- **magnetic dragging**, where the item follows the pointer through an exponential
  lag instead of snapping to it.

What it does _not_ do is fling the item on release. The settle is a fixed shape: the
duration comes from how far the item has to travel (`0.16 s` minimum, `0.45 s` for a
long trip), eased with an ease-out cubic. A fling was tried and removed — with a
placeholder already showing where the item will land, the extra travel read as
imprecision rather than momentum.

> **Historical note**
> `PhysicsOptions` used to carry an `inertiaThreshold` documented as the speed above
> which inertia engages. Nothing ever read it; it was removed in 1.1.1 rather than
> kept as a knob that does nothing.

`createVelocityTracker()` is exported if you want the same sampling elsewhere. It
reports `value`, `speed`, `direction` and `sampleCount`.

## Overshoot

Heavy springs overshoot, and that is allowed:

```tsx
<Item id="card" motion={{ type: "spring", stiffness: 90, damping: 12 }}>
```

The card will bounce past its slot and come back. This is deliberate — a drop that
never overshoots can look like a jump cut on a large movement — and it is why
`criticalDamping()` exists for anyone who wants the opposite.

## What is not simulated

- **No coupling between items.** An item does not push its neighbours; the FLIP
  animation moves them independently. A real rigid-body look would need a solver and
  a lot more state per item.
- **No gravity, no friction surfaces, no collisions between items.** Drag bounds are
  clamping, not contact.
- **No momentum transfer on swap.** Two items exchanging places each animate to a
  known slot; neither inherits the other's velocity.

The honest summary: this is a spring system that produces convincing motion, not a
physics engine. If you need items to pile up or knock each other around, use
something else for that part.
