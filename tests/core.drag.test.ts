/**
 * Drag engine tests.
 *
 * The controller is driven directly — no React — with a synthetic geometry
 * provider and a hand-cranked ticker, so every assertion is deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDragController, type DragController, type DragControllerOptions } from "../src/core/drag";
import { measureSlots } from "../src/core/measure";
import type { DragEndEvent, DragStartEvent, ItemId, SlotCandidate, SwapEvent } from "../src/core/types";
import { createTicker, type Ticker } from "../src/motion/ticker";
import { rect } from "../src/math/rect";
import { installGeometry, type InstalledGeometry } from "./helpers";

interface Harness {
  controller: DragController;
  ticker: Ticker;
  elements: Map<ItemId, HTMLElement>;
  order: ItemId[];
  slots: () => SlotCandidate[];
  events: {
    start: DragStartEvent[];
    destinations: (SwapEvent | null)[];
    drops: { ids: ItemId[]; fromIndex: number; toIndex: number }[];
    ends: DragEndEvent[];
  };
  time: () => number;
  tick(frames?: number): void;
  setOrder(order: ItemId[]): void;
}

const buildHarness = (options: {
  mode: "swap" | "reorder" | "grid";
  order?: ItemId[];
  columns?: number;
  bounds?: boolean;
  snap?: { enabledboolean?: never } | undefined;
  strategy?: "pointer" | "intersection" | "center" | "projection" | "nearest";
  snapEnabled?: boolean;
}): Harness => {
  const order = options.order ?? ["a", "b", "c"];
  const columns = options.columns ?? 1;

  const elements = new Map<ItemId, HTMLElement>();
  for (const id of order) {
    const element = document.createElement("div");
    element.dataset.rewapItem = id;
    document.body.appendChild(element);
    elements.set(id, element);
  }

  const geometryState: InstalledGeometry = installGeometry({ ids: order, columns });
  const ticker = createTicker();
  let clock = 0;

  const events: Harness["events"] = { start: [], destinations: [], drops: [], ends: [] };

  const controllerOptions: DragControllerOptions = {
    mode: options.mode,
    strategy: options.strategy,
    snap: options.snapEnabled === false ? { enabled: false } : { enabled: true, threshold: 24 },
    getSlots: () =>
      measureSlots(
        order.map((id) => ({ id, element: elements.get(id) ?? null })),
        {
          geometry: geometryState.provider,
        },
      ),
    getOrder: () => [...order],
    geometry: geometryState.provider,
    ticker,
    bounds: options.bounds ? () => rect(0, 100, 300, 400) : undefined,
    onStart: (event) => events.start.push(event),
    onDestination: (event) => events.destinations.push(event),
    onEnd: (event) => events.ends.push(event),
    onDrop: (result) =>
      events.drops.push({ ids: result.ids, fromIndex: result.fromIndex, toIndex: result.toIndex }),
    motion: () => ({ type: "tween", duration: 0.16, easing: "linear" }),
  };
  const controller = createDragController(controllerOptions);

  return {
    controller,
    ticker,
    elements,
    order,
    slots: () =>
      measureSlots(
        order.map((id) => ({ id, element: elements.get(id) ?? null })),
        {
          geometry: geometryState.provider,
        },
      ),
    events,
    time: () => clock,
    tick(frames = 1) {
      for (let i = 0; i < frames; i += 1) {
        clock += 16;
        ticker.tick(clock);
      }
    },
    setOrder(next) {
      order.length = 0;
      order.push(...next);
      geometryState.layout({ ids: next, index: (id) => next.indexOf(id) });
    },
  };
};

let harness: Harness | null = null;

beforeEach(() => {
  harness = null;
});

afterEach(() => {
  harness?.controller.destroy();
  harness = null;
  document.body.innerHTML = "";
});

describe("core/drag controller — pointer", () => {
  it("arms a drag, starts it past the threshold, and reports the destination", () => {
    const h = buildHarness({ mode: "swap" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;

    expect(h.controller.begin({ id: "a", element, pointer: { x: 100, y: 150 } })).toBe(true);
    expect(h.controller.getSnapshot().status).toBe("idle");
    expect(h.events.start).toHaveLength(0);

    // Below the threshold: still armed, nothing has started.
    h.controller.move({ x: 101, y: 151 });
    h.tick();
    expect(h.events.start).toHaveLength(0);
    expect(h.controller.getSnapshot().status).toBe("idle");

    // Past the threshold: the session starts and the chip follows the pointer.
    h.controller.move({ x: 100, y: 200 });
    h.tick();
    expect(h.events.start).toHaveLength(1);
    expect(h.events.start[0]?.item).toBe("a");
    expect(h.events.start[0]?.mode).toBe("swap");
    expect(h.controller.getSnapshot()).toMatchObject({
      status: "dragging",
      activeId: "a",
      startIndex: 0,
      destinationIndex: 0,
    });

    // Slot 1 spans y 230–350 in the synthetic list layout.
    h.controller.move({ x: 100, y: 280 });
    h.tick();
    expect(h.controller.getSnapshot().destinationIndex).toBe(1);
    // Moving back inside a slot and then out of the layout must still resolve.
    h.controller.move({ x: 100, y: 290 });
    h.tick();
    expect(h.controller.getSnapshot().destinationIndex).toBe(1);
  });

  it("emits a swap event with position and velocity when the destination changes", () => {
    const h = buildHarness({ mode: "swap" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, pointer: { x: 100, y: 150 } });
    h.controller.move({ x: 100, y: 260 });
    h.tick(2);

    h.controller.move({ x: 100, y: 380 });
    h.tick();
    const destinations = h.events.destinations.filter(Boolean) as SwapEvent[];
    const event = destinations[destinations.length - 1] as SwapEvent;
    expect(event.item).toBe("a");
    expect(event.previousSlot.index).toBe(0);
    expect(event.nextSlot.index).toBe(2);
    expect(event.mode).toBe("swap");
    expect(event.source).toBe("pointer");
    expect(event.position).toEqual({ x: 100, y: 380 });
    expect(typeof event.velocity.y).toBe("number");
  });

  it("commits a swap on drop and clears the session", () => {
    const h = buildHarness({ mode: "swap" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, pointer: { x: 100, y: 150 } });
    h.controller.move({ x: 100, y: 260 });
    h.tick(2);

    h.controller.drop();
    expect(h.events.drops).toHaveLength(1);
    expect(h.events.drops[0]).toEqual({ ids: ["b", "a", "c"], fromIndex: 0, toIndex: 1 });
    expect(h.events.ends[0]?.cancelled).toBe(false);
    expect(h.events.ends[0]?.reason).toBe("drop");
    expect(h.controller.isActive()).toBe(false);
    expect(h.controller.getSnapshot().activeId).toBeNull();
  });

  it("reorders instead of swapping in reorder mode", () => {
    const h = buildHarness({ mode: "reorder" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, pointer: { x: 100, y: 150 } });
    h.controller.move({ x: 100, y: 380 });
    h.tick(2);
    h.controller.drop();
    expect(h.events.drops[0]?.ids).toEqual(["b", "c", "a"]);
  });

  it("keeps the destination on the grabbed slot while the drag is arming", () => {
    const h = buildHarness({ mode: "reorder" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    // A keyboard grab places the virtual pointer at the item's own centre: the
    // destination has to stay put instead of flickering to the next slot.
    h.controller.begin({ id: "a", element, source: "keyboard", immediate: true });
    h.tick(3);
    expect(h.controller.getSnapshot().destinationIndex).toBe(0);
    expect(h.events.destinations).toHaveLength(0);
    h.controller.cancel("escape");
    h.tick(3);
  });

  it("crosses a slot boundary as soon as the item leaves a slot", () => {
    const h = buildHarness({ mode: "reorder" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, pointer: { x: 100, y: 150 } });
    // Slot 0 ends at y 220 and slot 1 starts at 230, so the boundary is at 225:
    // moving the pointer just past it is enough to claim the second slot.
    h.controller.move({ x: 100, y: 250 });
    h.tick(2);
    expect(h.controller.getSnapshot().destinationIndex).toBe(1);
    h.controller.move({ x: 100, y: 400 });
    h.tick(2);
    expect(h.controller.getSnapshot().destinationIndex).toBe(2);
    h.controller.cancel("escape");
    h.tick(3);
  });

  it("cancels without touching the order and animates back to rest", () => {
    const h = buildHarness({ mode: "swap" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, pointer: { x: 100, y: 150 } });
    h.controller.move({ x: 100, y: 300 });
    h.tick(3);
    const moved = h.controller.activeOffset();
    expect(Math.abs(moved.y)).toBeGreaterThan(6);

    h.controller.cancel("escape");
    expect(h.events.drops).toHaveLength(0);
    expect(h.events.ends[0]?.cancelled).toBe(true);
    expect(h.events.ends[0]?.reason).toBe("escape");

    h.tick(40);
    expect(h.controller.activeOffset()).toEqual({ x: 0, y: 0 });
    expect(element.style.transform).toBe("translate3d(0px, 0px, 0)");
  });

  it("clamps the drag inside the configured bounds", () => {
    const h = buildHarness({ mode: "swap", bounds: true });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, pointer: { x: 50, y: 150 } });
    h.controller.move({ x: 5000, y: 5000 });
    h.tick(2);
    const offset = h.controller.activeOffset();
    // The 200×120 item must stay inside the 300×400 bounds, so x cannot exceed 100.
    expect(offset.x).toBeLessThanOrEqual(100.001);
    expect(offset.y).toBeLessThanOrEqual(320.001);
  });

  it("pulls gently towards the destination when snapping is enabled", () => {
    const h = buildHarness({ mode: "reorder" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    // Slot 1 starts at y = 230; hovering 6 px below its origin.
    h.controller.begin({ id: "a", element, pointer: { x: 20, y: 150 } });
    h.controller.move({ x: 20, y: 236 });
    h.tick(2);
    const offset = h.controller.activeOffset();
    // Snapping pulls the chip towards y = 130 (slot 1 origin minus item origin).
    expect(offset.y).toBeLessThan(92);
    expect(offset.y).toBeGreaterThan(80);
  });

  it("keeps the transform stable when the DOM moves underneath the drag", () => {
    const h = buildHarness({ mode: "swap" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, pointer: { x: 100, y: 150 } });
    h.controller.move({ x: 100, y: 300 });
    h.tick(2);
    const before = h.controller.activeOffset();

    // Simulate a live preview: "a" is now rendered in slot 1.
    h.setOrder(["b", "a", "c"]);
    h.controller.rebase(new Map([["a", rect(0, 230, 200, 120)]]));
    const after = h.controller.activeOffset();
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y + (100 - 230), 6);
  });

  it("ignores a second begin while a session is running", () => {
    const h = buildHarness({ mode: "swap" });
    harness = h;
    const a = h.elements.get("a") as HTMLElement;
    const b = h.elements.get("b") as HTMLElement;
    expect(h.controller.begin({ id: "a", element: a, pointer: { x: 100, y: 150 } })).toBe(true);
    expect(h.controller.begin({ id: "b", element: b, pointer: { x: 100, y: 300 } })).toBe(false);
    h.controller.cancel("cancel");
  });

  it("refuses to start on an element with no measurable box or an unknown id", () => {
    const h = buildHarness({ mode: "swap" });
    harness = h;
    // An element that measures as zero-sized (not laid out, display: none, …)
    // cannot be dragged, because nothing about its geometry is known.
    const unmeasurable = document.createElement("div");
    expect(h.controller.begin({ id: "a", element: unmeasurable })).toBe(false);
    // An id that is not part of the order is refused too.
    expect(h.controller.begin({ id: "zz", element: h.elements.get("a") as HTMLElement })).toBe(false);
    expect(h.controller.isActive()).toBe(false);
  });
});

describe("core/drag controller — keyboard", () => {
  it("starts immediately, moves with the arrow keys and drops", () => {
    const h = buildHarness({ mode: "reorder" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, source: "keyboard", immediate: true });
    expect(h.controller.getSnapshot().status).toBe("dragging");
    expect(h.events.start[0]?.source).toBe("keyboard");

    expect(h.controller.moveInDirection("down")).toBe(true);
    expect(h.controller.getSnapshot().destinationIndex).toBe(1);
    expect(h.controller.moveInDirection("down")).toBe(true);
    expect(h.controller.getSnapshot().destinationIndex).toBe(2);
    // Nothing further down: the move is refused rather than clamped silently.
    expect(h.controller.moveInDirection("down")).toBe(false);
    expect(h.controller.moveInDirection("up")).toBe(true);
    expect(h.controller.getSnapshot().destinationIndex).toBe(1);

    h.controller.drop();
    expect(h.events.drops[0]?.ids).toEqual(["b", "a", "c"]);
    expect(h.events.ends[0]?.cancelled).toBe(false);
  });

  it("supports large steps and boundary jumps", () => {
    const h = buildHarness({ mode: "reorder", order: ["a", "b", "c", "d", "e", "f"] });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, source: "keyboard", immediate: true });

    h.controller.moveInDirection("down", { large: true });
    expect(h.controller.getSnapshot().destinationIndex).toBe(3);

    h.controller.moveInDirection("last");
    expect(h.controller.getSnapshot().destinationIndex).toBe(5);

    h.controller.moveInDirection("first");
    expect(h.controller.getSnapshot().destinationIndex).toBe(0);

    h.controller.cancel("escape");
    expect(h.events.drops).toHaveLength(0);
  });

  it("positions the dragged element on the target slot", () => {
    const h = buildHarness({ mode: "reorder" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, source: "keyboard", immediate: true });
    h.controller.moveInDirection("down");
    const offset = h.controller.activeOffset();
    // Slot 1 starts 130 px below slot 0 in the synthetic layout.
    expect(offset.y).toBeCloseTo(130, 6);
  });
});

describe("core/drag controller — programmatic and lifecycle", () => {
  it("moves an item without a session", () => {
    const h = buildHarness({ mode: "swap" });
    harness = h;
    const result = h.controller.moveItemTo("a", 2, "programmatic");
    expect(result?.ids).toEqual(["c", "b", "a"]);
    expect(result?.changed).toBe(true);
    expect(h.events.drops).toHaveLength(1);
    expect(h.controller.moveItemTo("a", 0)).toBeNull();
    expect(h.controller.moveItemTo("zz", 1)).toBeNull();
  });

  it("reports and clears state through the snapshot store", () => {
    const h = buildHarness({ mode: "grid" });
    harness = h;
    const listener = vi.fn();
    const unsubscribe = h.controller.subscribe(listener);
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, pointer: { x: 100, y: 150 } });
    h.controller.move({ x: 100, y: 400 });
    h.tick(2);
    expect(listener).toHaveBeenCalled();
    expect(h.controller.getSnapshot().status).toBe("dragging");
    h.controller.drop();
    expect(h.controller.getSnapshot().itemCount).toBe(3);
    unsubscribe();
    h.controller.destroy();
  });

  it("unsubscribes from the ticker when destroyed", () => {
    const h = buildHarness({ mode: "swap" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, pointer: { x: 100, y: 150 } });
    h.controller.move({ x: 100, y: 260 });
    h.tick(2);
    expect(h.ticker.size).toBeGreaterThan(0);
    h.controller.destroy();
    expect(h.ticker.size).toBe(0);
  });

  it("settle() returns the element without changing the order", () => {
    const h = buildHarness({ mode: "reorder" });
    harness = h;
    const element = h.elements.get("a") as HTMLElement;
    h.controller.begin({ id: "a", element, pointer: { x: 100, y: 150 } });
    h.controller.move({ x: 100, y: 380 });
    h.tick(2);
    h.controller.settle();
    expect(h.events.drops).toHaveLength(0);
    expect(h.events.ends[0]?.cancelled).toBe(true);
    h.tick(30);
    expect(h.controller.slots()).toHaveLength(3);
  });
});
