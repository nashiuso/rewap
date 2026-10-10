import { describe, expect, it } from "vitest";

import {
  applyStoredOrder,
  createPersistence,
  memoryStorage,
  resolveStorage,
} from "../src/core/persistence";

describe("core/persistence", () => {
  it("round-trips an order through a storage implementation", () => {
    const persistence = createPersistence({
      key: "layout",
      storage: memoryStorage(),
      mode: "reorder",
    });
    expect(persistence.load()).toBeNull();
    persistence.save(["a", "b"]);
    const loaded = persistence.load();
    expect(loaded?.ids).toEqual(["a", "b"]);
    expect(loaded?.version).toBe(1);
    expect(loaded?.mode).toBe("reorder");
    expect(typeof loaded?.savedAt).toBe("number");
    persistence.clear();
    expect(persistence.load()).toBeNull();
  });

  it("ignores corrupt payloads instead of throwing", () => {
    const storage = memoryStorage();
    const persistence = createPersistence({ key: "layout", storage });
    storage.setItem("layout", "{not json");
    expect(persistence.load()).toBeNull();
    storage.setItem("layout", JSON.stringify({ version: 2, ids: ["a"] }));
    expect(persistence.load()).toBeNull();
    storage.setItem("layout", JSON.stringify({ version: 1, ids: [1, 2] }));
    expect(persistence.load()).toBeNull();
    storage.setItem("layout", JSON.stringify({ version: 1, ids: [] }));
    expect(persistence.load()?.ids).toEqual([]);
  });

  it("never throws when writes fail", () => {
    const failing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const persistence = createPersistence({ key: "layout", storage: failing });
    expect(persistence.load()).toBeNull();
    expect(() => persistence.save(["a"])).not.toThrow();
    expect(() => persistence.clear()).not.toThrow();
  });

  it("falls back to memory storage when the browser blocks storage", () => {
    const storage = resolveStorage("localStorage");
    expect(typeof storage.getItem).toBe("function");
    storage.setItem("k", "v");
    expect(storage.getItem("k")).toBe("v");
    storage.removeItem("k");
    expect(storage.getItem("k")).toBeNull();
  });

  it("applies a stored order without hiding or duplicating items", () => {
    expect(applyStoredOrder(["b", "a"], ["a", "b", "c"])).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(applyStoredOrder(["b", "gone"], ["a", "b", "c"])).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(applyStoredOrder([], ["a", "b"])).toEqual(["a", "b"]);
    expect(applyStoredOrder(["a", "a"], ["a", "b"])).toEqual(["a", "a", "b"]);
  });
});
