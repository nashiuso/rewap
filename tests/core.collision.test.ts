import { describe, expect, it } from "vitest";

import {
  centerCollision,
  collisionStrategyNames,
  intersectionCollision,
  nearestCollision,
  nearestSlot,
  pointerCollision,
  projectionCollision,
  resolveCollision,
  slotProgress,
  strategies,
} from "../src/core/collision";
import type { SlotCandidate } from "../src/core/types";
import { metrics } from "../src/math/geometry";
import { rect } from "../src/math/rect";

/** A 2×2 grid: 100×100 cells, 10 px gaps, origin at (0, 100). */
const makeGrid = (): SlotCandidate[] => {
  const cells = [
    [0, 100],
    [110, 100],
    [0, 210],
    [110, 210],
  ];
  return cells.map(([x, y], index) => {
    const cell = rect(x ?? 0, y ?? 0, 100, 100);
    return {
      id: `item-${index}`,
      index,
      rect: cell,
      slot: { index, column: index % 2, row: Math.floor(index / 2), rect: cell },
    };
  });
};

const candidates = makeGrid();

describe("core/collision", () => {
  it("exposes the documented strategies", () => {
    expect(collisionStrategyNames).toEqual(["pointer", "center", "intersection", "nearest", "projection"]);
    expect(Object.keys(strategies).sort()).toEqual([...collisionStrategyNames].sort());
  });

  it("pointer: prefers the slot under the pointer and falls back to the closest band", () => {
    // The grid is 2×2: slots 0/1 on the top row (y 100–200), slots 2/3 below.
    const inside = pointerCollision({
      activeRect: rect(120, 120, 80, 80),
      pointer: { x: 150, y: 150 },
      candidates,
    });
    expect(inside?.index).toBe(1);
    expect(inside?.score).toBe(1);

    // Outside every cell (above the grid): the fallback follows the layout axis,
    // so asking for the horizontal axis picks the nearest column of the top row.
    const outside = pointerCollision({
      activeRect: rect(400, 120, 80, 80),
      pointer: { x: 250, y: 40 },
      candidates,
      axis: "x",
    });
    expect(outside?.index).toBe(1);
    expect(outside?.score).toBeGreaterThan(0);

    expect(pointerCollision({ activeRect: rect(0, 0, 10, 10), candidates })).toBeNull();
  });

  it("center: matches the slot whose centre is closest to the dragged rect", () => {
    const result = centerCollision({ activeRect: rect(20, 220, 60, 60), candidates });
    expect(result?.index).toBe(2);
    expect(result?.score).toBeGreaterThan(0);
  });

  it("nearest: matches by pointer distance", () => {
    const result = nearestCollision({
      activeRect: rect(-200, -200, 10, 10),
      pointer: { x: 300, y: 250 },
      candidates,
    });
    expect(result?.index).toBe(3);
  });

  it("intersection: needs real overlap and picks the largest ratio", () => {
    const result = intersectionCollision({ activeRect: rect(60, 150, 100, 100), candidates });
    // The dragged rect overlaps slot 0 by 2000 px² and slot 1 by 2500 px²; since
    // every overlap is measured against the smaller rectangle the ratio decides,
    // so slot 1 (0.25) beats slot 0 (0.2).
    expect(result?.index).toBe(1);

    // Touching but not overlapping produces nothing.
    expect(intersectionCollision({ activeRect: rect(100, 100, 10, 10), candidates })).toBeNull();
  });

  it("projection: returns a reading-order insertion along the axis", () => {
    const first = projectionCollision({
      activeRect: rect(0, 0, 100, 100),
      pointer: { x: 50, y: 60 },
      candidates,
    });
    expect(first?.index).toBe(0);

    // Below both rows: the last slot.
    const last = projectionCollision({
      activeRect: rect(0, 0, 100, 100),
      pointer: { x: 50, y: 900 },
      candidates,
    });
    expect(last?.index).toBe(3);

    // Horizontal axis for a single row.
    const row = candidates.filter((candidate) => candidate.slot.row === 0);
    const right = projectionCollision({
      activeRect: rect(0, 0, 100, 100),
      pointer: { x: 500, y: 150 },
      candidates: row,
      axis: "x",
    });
    expect(right?.index).toBe(1);
  });

  it("resolveCollision applies strategy, score threshold and exclusion", () => {
    const input = {
      activeRect: rect(40, 120, 80, 80),
      pointer: { x: 50, y: 150 },
      candidates,
    };
    expect(resolveCollision(input, { strategy: "pointer" })?.index).toBe(0);
    // Excluding the slot under the pointer falls back to the next best match.
    expect(resolveCollision(input, { strategy: "pointer", exclude: "item-0" })?.index).toBe(1);
    expect(resolveCollision(input, { strategy: "pointer", minScore: 2 })).toBeNull();
    expect(resolveCollision(input, { strategy: "nope" as never })).not.toBeNull();
  });

  it("falls back to the first slot when a requested axis has no candidates", () => {
    expect(projectionCollision({ activeRect: rect(0, 0, 10, 10), candidates: [] })).toBeNull();
    expect(
      pointerCollision({ activeRect: rect(0, 0, 10, 10), candidates: [], pointer: { x: 1, y: 1 } }),
    ).toBeNull();
    expect(centerCollision({ activeRect: rect(0, 0, 10, 10), candidates: [] })).toBeNull();
    expect(nearestCollision({ activeRect: rect(0, 0, 10, 10), candidates: [] })).toBeNull();
  });

  it("nearestSlot exposes the metric helpers", () => {
    // Slot 1 spans x 110–210, so (150, 150) is 10 px from its centre.
    expect(nearestSlot(candidates, { x: 150, y: 150 }, { metric: metrics.center })?.index).toBe(1);
    expect(nearestSlot(candidates, { x: 5000, y: 5000 }, { maxDistance: 10 })).toBeNull();
    expect(nearestSlot([], { x: 0, y: 0 })).toBeNull();
  });

  it("measures progress between two slots", () => {
    const from = rect(0, 0, 100, 100);
    const to = rect(0, 200, 100, 100);
    expect(slotProgress({ x: 0, y: 0 }, from, to)).toBe(0);
    expect(slotProgress({ x: 0, y: 150 }, from, to)).toBe(0.5);
    expect(slotProgress({ x: 0, y: 400 }, from, to)).toBe(1);
  });
});
