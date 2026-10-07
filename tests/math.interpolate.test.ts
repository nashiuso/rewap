import { describe, expect, it } from "vitest";

import {
  clamp,
  clamp01,
  damp,
  dampPoint,
  inverseLerp,
  lerp,
  lerpPoint,
  lerpRect,
  now,
  remap,
  smootherstep,
  smoothstep,
  snapToNearest,
  snapToNearestSorted,
  snapToStep,
  sum,
} from "../src/math/interpolate";

describe("math/interpolate", () => {
  it("clamps and interpolates", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(lerp(10, 0, 0.5)).toBe(5);
    expect(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
    expect(
      lerpRect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 10, width: 20, height: 20 }, 0.5),
    ).toEqual({
      x: 5,
      y: 5,
      width: 15,
      height: 15,
    });
  });

  it("inverts lerp and remaps ranges", () => {
    expect(inverseLerp(0, 10, 5)).toBe(0.5);
    expect(inverseLerp(5, 5, 5)).toBe(0);
    expect(remap(5, 0, 10, 0, 100)).toBe(50);
    expect(remap(500, 0, 10, 0, 100)).toBe(100);
  });

  it("eases with smoothstep variants", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 6);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 6);
    expect(smoothstep(2)).toBe(1);
  });

  it("damps towards a target independently of the frame rate", () => {
    const sixtyFps = (() => {
      let value = 0;
      for (let i = 0; i < 60; i += 1) value = damp(value, 100, 0.05, 1 / 60);
      return value;
    })();
    const oneStep = damp(0, 100, 0.05, 1);
    expect(sixtyFps).toBeCloseTo(oneStep, 4);
    expect(damp(10, 10, 0.05, 1)).toBe(10);
    expect(damp(0, 100, 0.05, 0)).toBe(0);
    const point = dampPoint({ x: 0, y: 0 }, { x: 100, y: 100 }, 0.05, 1);
    expect(point.x).toBeCloseTo(sixtyFps, 6);
    expect(point.y).toBeCloseTo(sixtyFps, 6);
  });

  it("snaps values", () => {
    expect(snapToStep(12, 5)).toBe(10);
    expect(snapToStep(13, 5)).toBe(15);
    expect(snapToStep(13, 0)).toBe(13);
    expect(snapToNearest(12, [0, 10, 20])).toEqual({ value: 10, index: 1, distance: 2 });
    expect(snapToNearest(17, [0, 10, 20], 1).index).toBe(-1);
    expect(snapToNearestSorted(12, [0, 10, 20])).toEqual({ index: 1, value: 10 });
    expect(snapToNearestSorted(16, [0, 10, 20])).toEqual({ index: 2, value: 20 });
    expect(snapToNearestSorted(5, [])).toBeNull();
  });

  it("sums values and exposes a monotonic clock", () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
    expect(typeof now()).toBe("number");
  });
});
