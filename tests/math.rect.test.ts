import { describe, expect, it } from "vitest";

import {
  clampRect,
  fitScale,
  inflateRect,
  insetRect,
  rect,
  rectArea,
  rectBottom,
  rectCenter,
  rectContainsPoint,
  rectContainsRect,
  rectEscapeVector,
  rectFromPoints,
  rectIntersection,
  rectIntersects,
  rectOverlapArea,
  rectOverlapRatio,
  rectRight,
  rectUnion,
  translateRect,
} from "../src/math/rect";

describe("math/rect", () => {
  const a = rect(0, 0, 100, 100);
  const b = rect(50, 50, 100, 100);

  it("exposes derived properties", () => {
    expect(rectRight(a)).toBe(100);
    expect(rectBottom(a)).toBe(100);
    expect(rectArea(a)).toBe(10_000);
    expect(rectCenter(a)).toEqual({ x: 50, y: 50 });
    expect(rectArea(rect(0, 0, -5, 10))).toBe(0);
  });

  it("builds rectangles from points and translates them", () => {
    expect(rectFromPoints({ x: 10, y: 30 }, { x: 40, y: 10 })).toEqual(
      rect(10, 10, 30, 20),
    );
    expect(translateRect(a, 5, -5)).toEqual(rect(5, -5, 100, 100));
  });

  it("inflates and insets", () => {
    expect(inflateRect(a, 10)).toEqual(rect(-10, -10, 120, 120));
    expect(insetRect(a, { left: 10, top: 5 })).toEqual(rect(10, 5, 90, 95));
    expect(insetRect(a, { top: 200 }).height).toBe(0);
  });

  it("detects intersection and containment", () => {
    expect(rectIntersects(a, b)).toBe(true);
    expect(rectIntersects(a, rect(200, 200, 10, 10))).toBe(false);
    // Touching edges are not an intersection.
    expect(rectIntersects(a, rect(100, 0, 10, 10))).toBe(false);
    expect(rectContainsPoint(a, { x: 50, y: 50 })).toBe(true);
    expect(rectContainsPoint(a, { x: 101, y: 50 })).toBe(false);
    expect(rectContainsRect(rect(0, 0, 100, 100), rect(10, 10, 10, 10))).toBe(
      true,
    );
    expect(rectContainsRect(a, b)).toBe(false);
  });

  it("computes overlap area, ratio and intersection", () => {
    expect(rectOverlapArea(a, b)).toBe(2500);
    expect(rectOverlapArea(a, rect(200, 200, 10, 10))).toBe(0);
    expect(rectOverlapRatio(a, b)).toBeCloseTo(0.25, 6);
    expect(rectIntersection(a, b)).toEqual(rect(50, 50, 50, 50));
    expect(rectIntersection(a, rect(500, 500, 10, 10))).toBeNull();
  });

  it("unions rectangles", () => {
    expect(rectUnion([a, b])).toEqual(rect(0, 0, 150, 150));
    expect(rectUnion([rect(10, 10, 5, 5)])).toEqual(rect(10, 10, 5, 5));
    expect(rectUnion([])).toBeNull();
  });

  it("clamps a rectangle inside bounds", () => {
    const bounds = rect(0, 0, 100, 100);
    expect(clampRect(bounds, rect(80, 80, 40, 40))).toEqual(
      rect(60, 60, 40, 40),
    );
    expect(clampRect(bounds, rect(-20, -20, 40, 40))).toEqual(
      rect(0, 0, 40, 40),
    );
    // Larger than the bounds: clamped to the origin rather than pushed outside.
    expect(clampRect(bounds, rect(-10, -10, 200, 200))).toEqual(
      rect(0, 0, 200, 200),
    );
  });

  it("finds the shortest escape vector", () => {
    // Overlap is 40 wide and 20 tall, so the shortest way out is vertical.
    expect(rectEscapeVector(rect(0, 0, 50, 20), rect(10, 0, 50, 20))).toEqual({
      x: 0,
      y: -20,
    });
    // Overlap is 20 wide and 40 tall, so the shortest way out is horizontal.
    expect(rectEscapeVector(rect(0, 0, 20, 50), rect(0, 10, 20, 50))).toEqual({
      x: -20,
      y: 0,
    });
    // No overlap at all means no escape needed.
    expect(rectEscapeVector(a, rect(500, 500, 10, 10))).toEqual({ x: 0, y: 0 });
  });

  it("fits an inner size into an outer size", () => {
    expect(
      fitScale({ width: 100, height: 50 }, { width: 50, height: 50 }),
    ).toBe(0.5);
    expect(fitScale({ width: 0, height: 0 }, { width: 50, height: 50 })).toBe(
      1,
    );
  });
});
