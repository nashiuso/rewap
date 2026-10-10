import { describe, expect, it } from "vitest";

import {
  boundaryIndex,
  candidatesInDirection,
  defaultKeyboardOptions,
  describeMove,
  resolveTargetIndex,
  stepIndex,
} from "../src/core/keyboard";
import {
  idsEqual,
  insertionIndexFromProjection,
  insertId,
  moveId,
  orderAfterDrop,
  projectedCenters,
  reconcileIds,
  removeId,
  swapIds,
} from "../src/core/order";
import { createHistory, createStore } from "../src/core/store";
import type { SlotCandidate } from "../src/core/types";
import { rect } from "../src/math/rect";

const ids = ["a", "b", "c", "d"];

const candidates: SlotCandidate[] = [
  {
    id: "a",
    index: 0,
    rect: rect(0, 0, 100, 100),
    slot: { index: 0, column: 0, row: 0, rect: rect(0, 0, 100, 100) },
  },
  {
    id: "b",
    index: 1,
    rect: rect(110, 0, 100, 100),
    slot: { index: 1, column: 1, row: 0, rect: rect(110, 0, 100, 100) },
  },
  {
    id: "c",
    index: 2,
    rect: rect(220, 0, 100, 100),
    slot: { index: 2, column: 2, row: 0, rect: rect(220, 0, 100, 100) },
  },
  {
    id: "d",
    index: 3,
    rect: rect(0, 110, 100, 100),
    slot: { index: 3, column: 0, row: 1, rect: rect(0, 110, 100, 100) },
  },
];

describe("core/order", () => {
  it("swaps two ids without mutating the input", () => {
    expect(swapIds(ids, "a", "c")).toEqual(["c", "b", "a", "d"]);
    expect(ids).toEqual(["a", "b", "c", "d"]);
    expect(swapIds(ids, "a", "a")).toEqual(ids);
    expect(swapIds(ids, "a", "zz")).toEqual(ids);
  });

  it("moves an id to an index", () => {
    expect(moveId(ids, "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveId(ids, "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveId(ids, "a", 99)).toEqual(["b", "c", "d", "a"]);
    expect(moveId(ids, "a", -5)).toEqual(["a", "b", "c", "d"]);
    expect(moveId(ids, "zz", 0)).toEqual(ids);
  });

  it("removes and inserts", () => {
    expect(removeId(ids, "b")).toEqual(["a", "c", "d"]);
    expect(removeId(ids, "zz")).toEqual(ids);
    expect(insertId(["a", "c"], "b", 1)).toEqual(["a", "b", "c"]);
    expect(insertId(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
  });

  it("reconciles an order against the available ids", () => {
    expect(reconcileIds(["b", "a", "gone"], ["a", "b", "c"])).toEqual({
      ids: ["b", "a", "c"],
      added: ["c"],
      removed: ["gone"],
    });
    expect(reconcileIds([], ["a", "b"]).ids).toEqual(["a", "b"]);
  });

  it("compares orders", () => {
    expect(idsEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(idsEqual(["a", "b"], ["b", "a"])).toBe(false);
    expect(idsEqual(["a"], ["a", "b"])).toBe(false);
  });

  it("computes the order after a drop in both modes", () => {
    expect(orderAfterDrop(ids, "a", 0, 2, "swap")).toEqual([
      "c",
      "b",
      "a",
      "d",
    ]);
    expect(orderAfterDrop(ids, "a", 0, 2, "reorder")).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(orderAfterDrop(ids, "a", 0, 0, "swap")).toEqual(ids);
    expect(orderAfterDrop(ids, "a", 0, 9, "swap")).toEqual(ids);
  });

  it("projects an insertion index from slot centres", () => {
    const centers = projectedCenters(4, 0, 100, 10);
    // Centres are 50, 160, 270, 380 for cells of 100 with a 10 px gap.
    expect(centers).toEqual([50, 160, 270, 380]);
    expect(insertionIndexFromProjection(centers, -10)).toBe(0);
    expect(insertionIndexFromProjection(centers, 300)).toBe(3);
    expect(insertionIndexFromProjection(centers, 400)).toBe(4);
    expect(insertionIndexFromProjection(centers, 55)).toBe(1);
  });
});

describe("core/keyboard", () => {
  it("finds neighbours in a direction", () => {
    // Every slot to the right on the same row, nearest first.
    expect(
      candidatesInDirection(candidates, 0, "right").map((entry) => entry.index),
    ).toEqual([1, 2]);
    // Everything to the left on the same row, nearest first.
    expect(
      candidatesInDirection(candidates, 2, "left").map((entry) => entry.index),
    ).toEqual([1, 0]);
    expect(candidatesInDirection(candidates, 0, "up")).toEqual([]);
    expect(
      candidatesInDirection(candidates, 0, "down").map((entry) => entry.index),
    ).toEqual([3]);
    expect(candidatesInDirection(candidates, 99, "right")).toEqual([]);
  });

  it("steps several slots at once", () => {
    expect(stepIndex(candidates, 0, "right", 3)).toBe(2);
    expect(stepIndex(candidates, 2, "right", 3)).toBe(2);
    expect(boundaryIndex(candidates, "first")).toBe(0);
    expect(boundaryIndex(candidates, "last")).toBe(3);
    expect(boundaryIndex([], "last")).toBe(0);
  });

  it("resolves a target index for a key press", () => {
    expect(resolveTargetIndex(candidates, 0, "right")).toBe(1);
    expect(resolveTargetIndex(candidates, 0, "right", { large: true })).toBe(2);
    expect(resolveTargetIndex(candidates, 1, "last")).toBe(3);
    expect(resolveTargetIndex(candidates, 3, "first")).toBe(0);
    expect(defaultKeyboardOptions.step).toBe(1);
    expect(describeMove("Weather", 2, 4)).toBe(
      "Weather moved to position 3 of 4",
    );
  });
});

describe("core/store", () => {
  it("stores values and notifies subscribers", () => {
    const store = createStore(1);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(2);
    expect(store.get()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
    store.set(2);
    expect(listener).toHaveBeenCalledTimes(1);
    store.set((previous) => previous + 1);
    expect(store.get()).toBe(3);
  });

  it("batches notifications inside transact", () => {
    const store = createStore(0);
    const listener = vi.fn();
    store.subscribe(listener);
    store.transact(() => {
      store.set(1);
      store.set(2);
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe(2);
  });

  it("keeps a bounded history", () => {
    const history = createHistory(["a"], { limit: 2, equals: idsEqual });
    history.push(["b"]);
    history.push(["c"]);
    history.push(["d"]);
    expect(history.present()).toEqual(["d"]);
    expect(history.depth).toBe(2);
    expect(history.canUndo()).toBe(true);

    expect(history.undo()).toEqual(["c"]);
    expect(history.undo()).toEqual(["b"]);
    // The oldest entry was dropped by the limit.
    expect(history.undo()).toBeUndefined();
    expect(history.canRedo()).toBe(true);
    expect(history.redo()).toEqual(["c"]);
  });

  it("resets to the initial value and clears the redo stack", () => {
    const history = createHistory(["a"]);
    history.push(["b"]);
    history.undo();
    expect(history.canRedo()).toBe(true);
    expect(history.reset()).toEqual(["a"]);
    expect(history.canRedo()).toBe(false);

    history.push(["z"]);
    history.clear(["x"]);
    expect(history.present()).toEqual(["x"]);
    expect(history.canUndo()).toBe(false);
  });

  it("ignores identical pushes", () => {
    const history = createHistory(["a"], { equals: idsEqual });
    history.push(["a"]);
    expect(history.canUndo()).toBe(false);
  });
});
