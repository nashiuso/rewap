/**
 * The headless engine.
 *
 * These tests are the evidence for the claim in the README that React is a binding
 * over the engine rather than the engine itself: no React, no DOM, no jsdom
 * features — just an order, a history and a storage object.
 */

import { describe, expect, it, vi } from "vitest";

import { createRewap, type RewapPersistenceConfig } from "../src/core/rewap";
import { memoryStorage } from "../src/core/persistence";

describe("createRewap()", () => {
  it("starts from the ids it was given", () => {
    const layout = createRewap({ ids: ["a", "b", "c"] });
    expect(layout.ids()).toEqual(["a", "b", "c"]);
    expect(layout.mode()).toBe("swap");
  });

  it("moves an item and reports the change", () => {
    const layout = createRewap({ ids: ["a", "b", "c"], mode: "reorder" });
    const listener = vi.fn();
    layout.subscribe(listener);

    expect(layout.move("c", 0)).toBe(true);
    expect(layout.ids()).toEqual(["c", "a", "b"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("swaps instead of shifting in swap mode", () => {
    const layout = createRewap({ ids: ["a", "b", "c", "d"], mode: "swap" });
    layout.move("a", 2);
    expect(layout.ids()).toEqual(["c", "b", "a", "d"]);
  });

  it("does nothing when the move is a no-op or the id is unknown", () => {
    const layout = createRewap({ ids: ["a", "b"], mode: "reorder" });
    const listener = vi.fn();
    layout.subscribe(listener);

    expect(layout.move("a", 0)).toBe(false);
    expect(layout.move("nope", 1)).toBe(false);
    expect(layout.ids()).toEqual(["a", "b"]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("clamps a move past the ends of the order", () => {
    const layout = createRewap({ ids: ["a", "b", "c"], mode: "reorder" });
    layout.move("c", 99);
    expect(layout.ids()).toEqual(["a", "b", "c"]);
    layout.move("a", -3);
    expect(layout.ids()).toEqual(["a", "b", "c"]);
  });

  it("swaps two ids directly", () => {
    const layout = createRewap({ ids: ["a", "b", "c"] });
    expect(layout.swap("a", "c")).toBe(true);
    expect(layout.ids()).toEqual(["c", "b", "a"]);
    expect(layout.swap("a", "a")).toBe(false);
    expect(layout.swap("a", "zzz")).toBe(false);
  });

  it("records history, and can be turned off", () => {
    const layout = createRewap({ ids: ["a", "b", "c"], mode: "reorder" });
    layout.move("c", 0);
    expect(layout.canUndo()).toBe(true);
    expect(layout.undo()).toEqual(["a", "b", "c"]);
    expect(layout.canRedo()).toBe(true);
    expect(layout.redo()).toEqual(["c", "a", "b"]);
    expect(layout.reset()).toEqual(["a", "b", "c"]);

    const plain = createRewap({ ids: ["a", "b"], history: false });
    plain.move("b", 0);
    expect(plain.canUndo()).toBe(false);
    expect(plain.undo()).toBeNull();
  });

  it("keeps the history limit it was given", () => {
    const layout = createRewap({ ids: ["a", "b", "c", "d"], mode: "reorder", history: { limit: 2 } });
    layout.move("d", 0);
    layout.move("d", 1);
    layout.move("d", 2);
    expect(layout.undo()).not.toBeNull();
    expect(layout.undo()).not.toBeNull();
    expect(layout.undo()).toBeNull();
  });

  it("reconciles against the ids that still exist", () => {
    const layout = createRewap({ ids: ["a", "b", "c"] });
    // Kept ids hold their position, gone ids are dropped, new ids are appended:
    // that is `reconcileIds()` from the core, and the headless engine does not
    // pretend to have a different opinion about it.
    layout.reconcile(["b", "a", "d"]);
    expect(layout.ids()).toEqual(["a", "b", "d"]);
  });

  it("hydrates from storage and writes every change back", () => {
    const storage = memoryStorage();
    const first = createRewap({
      ids: ["a", "b", "c"],
      mode: "reorder",
      persistence: { key: "board", storage },
    });
    first.move("c", 0);
    first.destroy();

    const second = createRewap({
      ids: ["a", "b", "c"],
      mode: "reorder",
      persistence: { key: "board", storage },
    });
    expect(second.ids()).toEqual(["c", "a", "b"]);
  });

  it("appends items the stored order does not know about", () => {
    const storage = memoryStorage();
    const first = createRewap({ ids: ["a", "b"], mode: "reorder", persistence: { key: "board", storage } });
    first.move("b", 0);
    first.destroy();

    const second = createRewap({
      ids: ["a", "b", "c"],
      mode: "reorder",
      persistence: { key: "board", storage },
    });
    expect(second.ids()).toEqual(["b", "a", "c"]);
  });

  it("ignores a persistence option without a key instead of inventing one", () => {
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    // JavaScript callers never see the type that requires `key`, and inventing a
    // storage key is exactly the kind of quiet surprise this library avoids.
    const layout = createRewap({
      ids: ["a", "b"],
      persistence: { storage } as RewapPersistenceConfig,
    });
    layout.move("b", 0);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("stops notifying after destroy", () => {
    const layout = createRewap({ ids: ["a", "b"] });
    const listener = vi.fn();
    layout.subscribe(listener);
    layout.destroy();
    layout.move("b", 0);
    expect(listener).not.toHaveBeenCalled();
  });

  it("reports events with the indices it can honestly stand behind", () => {
    const changes: string[] = [];
    const layout = createRewap({
      ids: ["a", "b", "c"],
      mode: "reorder",
      onChange: (ids, event) =>
        changes.push(
          `${event.source}:${ids.join("")}:${event.swap?.previousSlot.index}->${event.swap?.nextSlot.index}`,
        ),
    });

    layout.move("a", 2);
    expect(changes).toEqual(["programmatic:bca:0->2"]);
    layout.undo();
    expect(changes[1]).toBe("history:abc:undefined->undefined");
  });
});
