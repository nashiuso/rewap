import { describe, expect, it } from "vitest";

import { createVelocityTracker } from "../src/core/velocity";

describe("core/velocity", () => {
  it("starts at rest and reports nothing for a single sample", () => {
    const tracker = createVelocityTracker();
    expect(tracker.value()).toEqual({ x: 0, y: 0 });
    tracker.add({ x: 10, y: 10 }, 0);
    expect(tracker.value()).toEqual({ x: 0, y: 0 });
    expect(tracker.direction()).toBeUndefined();
    expect(tracker.sampleCount).toBe(1);
  });

  it("measures pixels per second", () => {
    const tracker = createVelocityTracker({ smoothing: 1 });
    tracker.add({ x: 0, y: 0 }, 0);
    const velocity = tracker.add({ x: 10, y: 0 }, 100);
    expect(velocity.x).toBeCloseTo(100, 6);
    expect(tracker.speed()).toBeCloseTo(100, 6);
    expect(tracker.direction()).toBeCloseTo(0, 6);
  });

  it("smooths with the configured factor", () => {
    const tracker = createVelocityTracker({ smoothing: 0.5 });
    tracker.add({ x: 0, y: 0 }, 0);
    tracker.add({ x: 10, y: 0 }, 100);
    const smooth = tracker.value().x;
    expect(smooth).toBeCloseTo(50, 6);
    expect(smooth).toBeLessThan(100);
  });

  it("resets when samples are stale instead of reporting a jump", () => {
    const tracker = createVelocityTracker({ staleAfter: 50 });
    tracker.add({ x: 0, y: 0 }, 0);
    tracker.add({ x: 10, y: 0 }, 100);
    const stale = tracker.add({ x: 1000, y: 0 }, 400);
    expect(stale).toEqual({ x: 0, y: 0 });
  });

  it("caps the magnitude", () => {
    const tracker = createVelocityTracker({ smoothing: 1, maxSpeed: 500 });
    tracker.add({ x: 0, y: 0 }, 0);
    const velocity = tracker.add({ x: 1000, y: 1000 }, 16);
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(500, 6);
  });

  it("ignores non-increasing timestamps and equal positions", () => {
    const tracker = createVelocityTracker({ smoothing: 1 });
    tracker.add({ x: 0, y: 0 }, 100);
    expect(tracker.add({ x: 50, y: 50 }, 100)).toEqual({ x: 0, y: 0 });
    tracker.add({ x: 10, y: 10 }, 200);
    expect(tracker.add({ x: 10, y: 10 }, 300)).toEqual({ x: 0, y: 0 });
  });

  it("resets on demand", () => {
    const tracker = createVelocityTracker({ smoothing: 1 });
    tracker.add({ x: 0, y: 0 }, 0);
    tracker.add({ x: 100, y: 0 }, 100);
    tracker.reset();
    expect(tracker.sampleCount).toBe(0);
    expect(tracker.value()).toEqual({ x: 0, y: 0 });
  });
});
