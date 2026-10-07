import { describe, expect, it } from "vitest";

import {
  add,
  angle,
  centerDistance,
  degrees,
  distance,
  distanceSquared,
  distanceToRect,
  dot,
  intervalOverlap,
  intervalsIntersect,
  magnitude,
  metrics,
  nearest,
  normalize,
  projectOnAxis,
  projectPointOnLine,
  projectPointOnSegment,
  projectRatio,
  radians,
  rotatePoint,
  scale,
  subtract,
} from "../src/math/geometry";
import { rect } from "../src/math/rect";

describe("math/geometry", () => {
  it("does vector arithmetic", () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    expect(subtract({ x: 3, y: 4 }, { x: 1, y: 2 })).toEqual({ x: 2, y: 2 });
    expect(scale({ x: 2, y: 2 }, 3)).toEqual({ x: 6, y: 6 });
    expect(dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
    expect(magnitude({ x: 3, y: 4 })).toBe(5);
    expect(normalize({ x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("measures distances", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distanceSquared({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
    expect(centerDistance(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(10);
    expect(distanceToRect({ x: 5, y: 5 }, rect(0, 0, 10, 10))).toBe(0);
    expect(distanceToRect({ x: 15, y: 5 }, rect(0, 0, 10, 10))).toBe(5);
    expect(distanceToRect({ x: 13, y: 14 }, rect(0, 0, 10, 10))).toBe(5);
  });

  it("finds the nearest entry with configurable metrics", () => {
    const entries = [
      { id: "a", rect: rect(0, 0, 100, 100) },
      { id: "b", rect: rect(200, 0, 100, 100) },
      { id: "c", rect: rect(400, 0, 100, 100) },
    ];
    expect(nearest(entries, { x: 60, y: 50 })?.id).toBe("a");
    expect(nearest(entries, { x: 260, y: 250 })?.id).toBe("b");
    // The edge metric ignores centres: 10 px past b's right edge is nearer to b
    // than to c, even though c's centre is closer along x.
    expect(nearest(entries, { x: 310, y: 50 }, { metric: metrics.edge })?.id).toBe("b");
    // Directly above c, the edge metric picks c while the centre metric picks b.
    expect(nearest(entries, { x: 450, y: 250 }, { metric: metrics.edge })?.id).toBe("c");
    expect(nearest(entries, { x: 450, y: 250 }, { metric: metrics.center })?.id).toBe("c");
    expect(nearest(entries, { x: 300, y: 250 }, { metric: metrics.center })?.id).toBe("b");
    expect(nearest(entries, { x: 60, y: 50 }, { exclude: ["a"] })?.id).toBe("b");
    expect(nearest(entries, { x: 5000, y: 5000 }, { maxDistance: 100 })).toBeNull();
    expect(nearest([], { x: 0, y: 0 })).toBeNull();
  });

  it("projects points onto lines and segments", () => {
    expect(projectPointOnLine({ x: 5, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 0 });
    expect(projectPointOnSegment({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 10, y: 0 });
    expect(projectPointOnSegment({ x: -50, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(projectPointOnLine({ x: 5, y: 5 }, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });

  it("projects on an axis and returns a clamped ratio", () => {
    expect(projectOnAxis({ x: 10, y: 20 }, { x: 0, y: 0 }, "x")).toBe(10);
    expect(projectOnAxis({ x: 10, y: 20 }, { x: 0, y: 0 }, "y")).toBe(20);
    expect(projectRatio({ x: 5, y: 50 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0.5);
    expect(projectRatio({ x: 500, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(1);
    expect(projectRatio({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });

  it("rotates points and converts angles", () => {
    const rotated = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
    expect(rotated.x).toBeCloseTo(0, 6);
    expect(rotated.y).toBeCloseTo(10, 6);
    expect(degrees(Math.PI)).toBeCloseTo(180, 6);
    expect(radians(180)).toBeCloseTo(Math.PI, 6);
    expect(angle({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(Math.PI / 4, 6);
  });

  it("measures interval overlap", () => {
    expect(intervalOverlap(0, 10, 5, 15)).toBe(5);
    expect(intervalOverlap(0, 10, 20, 30)).toBe(0);
    expect(intervalsIntersect(0, 10, 10, 20)).toBe(false);
    expect(intervalsIntersect(0, 10, 9, 20)).toBe(true);
  });
});
