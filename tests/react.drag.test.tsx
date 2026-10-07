/**
 * Pointer dragging through the real `<Layout>` / `<Item>` tree.
 *
 * The synthetic geometry provider mirrors the DOM order on every measurement
 * (see `helpers.tsx`), so the layout reflows exactly like a browser would while
 * the preview order changes under the pointer.
 */

import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DragEndEvent, DragMoveEvent, DragStartEvent, LayoutChangeEvent } from "../src/core/types";
import { Item } from "../src/react/Item";
import { Layout } from "../src/react/Layout";
import {
  advanceFrame,
  dragPointer,
  firePointer,
  installGeometry,
  slotCenter,
  type GeometryOptions,
  type InstalledGeometry,
} from "./helpers";

const CELLS: GeometryOptions = { ids: ["a", "b", "c"], columns: 1 };

let geometry: InstalledGeometry;

const idsInDom = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>("[data-rewap-item]")].map(
    (element) => element.dataset.rewapItem ?? "",
  );

const itemOf = (container: HTMLElement, id: string): HTMLElement =>
  container.querySelector<HTMLElement>(`[data-rewap-item="${id}"]`) as HTMLElement;

const rootOf = (container: HTMLElement): HTMLElement =>
  container.querySelector<HTMLElement>("[data-rewap-layout]") as HTMLElement;

const placeholderOf = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>("[data-rewap-placeholder]");

/** `slotCenter` returns `{ x, y }`; pointer events want `clientX`/`clientY`. */
const at = (point: { x: number; y: number }, extra: Record<string, unknown> = {}) => ({
  clientX: point.x,
  clientY: point.y,
  ...extra,
});

/** Runs frames until the layout is idle again (spring settled). */
const settle = async (container: HTMLElement, limit = 400): Promise<void> => {
  for (let frame = 0; frame < limit; frame += 1) {
    if (rootOf(container).dataset.status === "idle") return;
    await advanceFrame(2);
  }
};

beforeEach(() => {
  geometry = installGeometry({
    ...CELLS,
    // Follow the rendered order, which is what a browser would do.
    ids: () => idsInDom(document.body),
  });
});

afterEach(() => {
  geometry.restore();
  document.body.className = "";
});

describe("<Layout> pointer dragging", () => {
  it("starts a drag once the pointer passes the threshold", async () => {
    const onDragStart = vi.fn<(event: DragStartEvent) => void>();
    const { container } = render(
      <Layout onDragStart={onDragStart}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    const item = itemOf(container, "a");
    const start = slotCenter(0, CELLS);

    // Below the threshold (4 px by default) nothing happens.
    await act(async () => {
      firePointer(item, "pointerdown", at(start));
      firePointer(window, "pointermove", at({ x: start.x, y: start.y + 2 }));
    });
    expect(rootOf(container).dataset.status).toBe("idle");
    expect(onDragStart).not.toHaveBeenCalled();

    await act(async () => {
      firePointer(window, "pointermove", at({ x: start.x, y: start.y + 40 }));
    });
    await advanceFrame(2);

    expect(rootOf(container).dataset.status).toBe("dragging");
    expect(rootOf(container).hasAttribute("data-rewap-dragging")).toBe(true);
    expect(itemOf(container, "a").hasAttribute("data-rewap-active")).toBe(true);
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragStart.mock.calls[0]?.[0]).toMatchObject({ item: "a", index: 0, source: "mouse" });

    await act(async () => {
      firePointer(window, "pointercancel", at(start));
    });
  });

  it("reports the pointer position and velocity while moving", async () => {
    const onDragMove = vi.fn<(event: DragMoveEvent) => void>();
    const { container } = render(
      <Layout onDragMove={onDragMove}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(1, CELLS),
      release: false,
    });

    expect(onDragMove).toHaveBeenCalled();
    const last = onDragMove.mock.calls[onDragMove.mock.calls.length - 1]?.[0];
    expect(last?.item).toBe("a");
    expect(last?.mode).toBe("swap");
    expect(last?.delta.y).toBeGreaterThan(0);
    expect(Number.isFinite(last?.velocity.y ?? Number.NaN)).toBe(true);

    await act(async () => {
      firePointer(window, "pointerup", at(slotCenter(1, CELLS)));
    });
  });

  it("moves the dragged element with the pointer and shows the destination placeholder", async () => {
    const { container } = render(
      <Layout>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );

    const item = itemOf(container, "a");
    const start = slotCenter(0, CELLS);

    await act(async () => {
      firePointer(item, "pointerdown", at(start));
      firePointer(window, "pointermove", at({ x: start.x, y: start.y + 40 }));
    });
    await advanceFrame(2);

    // The element follows the pointer through a transform, not through layout.
    const transform = itemOf(container, "a").style.transform;
    const [, rawX, rawY] = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(transform) ?? [];
    expect(transform).toMatch(/translate3d\(-?[\d.]+px, -?[\d.]+px, 0\)/);
    expect(Number(rawY)).toBeCloseTo(40, 0);
    expect(Number(rawX)).toBeCloseTo(0, 0);

    // The placeholder marks the slot the item would land on. Slot 0 spans
    // y 100–220 of the synthetic grid, and the container starts 10 px above it.
    const placeholder = placeholderOf(container);
    expect(placeholder).toBeTruthy();
    expect(placeholder?.dataset.style).toBe("auto");
    expect(Number.parseFloat(placeholder?.style.left ?? "")).toBeCloseTo(10, 5);
    expect(Number.parseFloat(placeholder?.style.top ?? "")).toBeCloseTo(10, 5);
    expect(Number.parseFloat(placeholder?.style.width ?? "")).toBeCloseTo(200, 5);
    expect(Number.parseFloat(placeholder?.style.height ?? "")).toBeCloseTo(120, 5);

    await act(async () => {
      firePointer(window, "pointercancel", at(start));
    });
    await settle(container);
  });

  it("draws the placeholder in the destination slot", async () => {
    const { container } = render(
      <Layout>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );

    const start = slotCenter(0, CELLS);
    const target = slotCenter(2, CELLS);

    await act(async () => {
      firePointer(itemOf(container, "a"), "pointerdown", at(start));
      firePointer(window, "pointermove", at({ x: start.x, y: start.y + 40 }));
    });
    await advanceFrame(2);
    const ownSlotTop = Number.parseFloat(placeholderOf(container)?.style.top ?? "");

    await act(async () => {
      firePointer(window, "pointermove", at(target));
    });
    await advanceFrame(4);

    // Slot 2 sits at y 360 in the synthetic grid, 260 px below the first one.
    const movedTop = Number.parseFloat(placeholderOf(container)?.style.top ?? "");
    expect(movedTop).toBeCloseTo(ownSlotTop + 260, 0);

    await act(async () => {
      firePointer(window, "pointercancel", at(target));
    });
    await settle(container);
  });

  it("commits the previewed order on drop and reports it once", async () => {
    const onChange = vi.fn<(items: unknown[], event: LayoutChangeEvent) => void>();
    const onDragEnd = vi.fn<(event: DragEndEvent) => void>();
    const { container } = render(
      <Layout onChange={onChange} onDragEnd={onDragEnd}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );

    const released = await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(2, CELLS),
      release: false,
    });
    void released;
    // Whatever the drag previewed is exactly what gets committed.
    const preview = idsInDom(container);
    expect(preview).toEqual(["c", "b", "a"]);

    await act(async () => {
      firePointer(window, "pointerup", at(slotCenter(2, CELLS)));
    });
    await settle(container);

    expect(idsInDom(container)).toEqual(preview);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(preview);
    expect(onChange.mock.calls[0]?.[1]).toMatchObject({ source: "mouse", ids: preview });

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    const end = onDragEnd.mock.calls[0]?.[0];
    expect(end).toMatchObject({ item: "a", cancelled: false, reason: "drop", source: "mouse" });
    expect(end?.from.index).toBe(0);
    expect(end?.to.index).toBe(2);

    await waitFor(() => expect(placeholderOf(container)).toBeNull());
    expect(itemOf(container, "a").hasAttribute("data-rewap-active")).toBe(false);
  });

  it("keeps the order when the pointer returns to the original slot", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Layout onChange={onChange}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: { x: slotCenter(0, CELLS).x + 30, y: slotCenter(0, CELLS).y + 20 },
    });

    expect(idsInDom(container)).toEqual(["a", "b"]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cancels the drag on pointercancel and leaves the order alone", async () => {
    const onChange = vi.fn();
    const onDragEnd = vi.fn<(event: DragEndEvent) => void>();
    const { container } = render(
      <Layout onChange={onChange} onDragEnd={onDragEnd}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(1, CELLS),
      release: false,
    });
    expect(idsInDom(container)).toEqual(["b", "a"]);

    await act(async () => {
      firePointer(window, "pointercancel", at(slotCenter(1, CELLS)));
    });
    await settle(container);

    expect(idsInDom(container)).toEqual(["a", "b"]);
    expect(onChange).not.toHaveBeenCalled();
    expect(onDragEnd.mock.calls[0]?.[0]).toMatchObject({ cancelled: true, reason: "cancel" });
    // Settled back to its resting state, with the element state cleared.
    expect(itemOf(container, "a").style.transform).toBe("translate3d(0px, 0px, 0)");
  });

  it("cancels with Escape while the pointer is down", async () => {
    const onDragEnd = vi.fn<(event: DragEndEvent) => void>();
    const { container } = render(
      <Layout onDragEnd={onDragEnd}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(1, CELLS),
      release: false,
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await settle(container);

    expect(idsInDom(container)).toEqual(["a", "b"]);
    expect(onDragEnd.mock.calls[0]?.[0]).toMatchObject({ cancelled: true, reason: "escape" });
  });

  it("drags from a handle but not from the item body of a handle-only item", async () => {
    const onDragStart = vi.fn();
    const { container } = render(
      <Layout onDragStart={onDragStart}>
        <Item id="a">
          <Item.Handle label="Reorder A" />A
        </Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    const item = itemOf(container, "a");
    await act(async () => {
      firePointer(item, "pointerdown", at(slotCenter(0, CELLS)));
      firePointer(window, "pointermove", at({ x: 100, y: 220 }));
    });
    expect(onDragStart).not.toHaveBeenCalled();

    const handle = container.querySelector<HTMLElement>("[data-rewap-handle]") as HTMLElement;
    await act(async () => {
      firePointer(handle, "pointerdown", at(slotCenter(0, CELLS)));
      firePointer(window, "pointermove", at({ x: 100, y: 240 }));
    });
    await advanceFrame(2);
    expect(onDragStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      firePointer(window, "pointercancel", at({ x: 100, y: 240 }));
    });
    await settle(container);
  });

  it("leaves interactive children alone", async () => {
    const onDragStart = vi.fn();
    const onClick = vi.fn();
    const { container } = render(
      <Layout onDragStart={onDragStart}>
        <Item id="a">
          <button type="button" onClick={onClick}>
            open
          </button>
        </Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    const button = container.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      firePointer(button, "pointerdown", at(slotCenter(0, CELLS)));
      firePointer(window, "pointermove", at({ x: 100, y: 260 }));
    });
    expect(onDragStart).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ignores disabled and static items", async () => {
    const onDragStart = vi.fn();
    const { container } = render(
      <Layout onDragStart={onDragStart}>
        <Item id="a" disabled>
          A
        </Item>
        <Item id="b" draggable={false}>
          B
        </Item>
      </Layout>,
    );

    for (const id of ["a", "b"]) {
      await act(async () => {
        firePointer(itemOf(container, id), "pointerdown", at(slotCenter(0, CELLS)));
        firePointer(window, "pointermove", at({ x: 100, y: 300 }));
      });
    }
    expect(onDragStart).not.toHaveBeenCalled();
    expect(rootOf(container).dataset.status).toBe("idle");
  });

  it("does not fire a click on the item after a completed drag", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <Layout>
        <Item id="a">
          <span onClick={onClick}>card</span>
        </Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(1, CELLS),
    });

    // The item also renders a hidden instructions span, so target the card's own
    // element rather than the first `span` in the container.
    const card = () =>
      [...container.querySelectorAll<HTMLElement>("span")].find(
        (element) => element.textContent === "card",
      ) as HTMLElement;

    // The browser fires this after pointerup; the layout swallows it.
    fireEvent.click(card());
    expect(onClick).not.toHaveBeenCalled();

    // A real click, on the other hand, still works.
    fireEvent.click(card());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ignores drags that start outside an item", async () => {
    const onDragStart = vi.fn();
    const { container } = render(
      <Layout onDragStart={onDragStart}>
        <Item id="a">A</Item>
      </Layout>,
    );

    await act(async () => {
      firePointer(rootOf(container), "pointerdown", at({ x: 500, y: 700 }));
      firePointer(window, "pointermove", at({ x: 520, y: 760 }));
    });
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("stops at the bounds when the drag is clamped to the container", async () => {
    const { container } = render(
      <Layout bounds="container">
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: { x: 4000, y: 4000 },
      release: false,
      steps: 2,
    });

    const transform = itemOf(container, "a").style.transform;
    const [, rawX, rawY] = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(transform) ?? [];
    expect(Math.abs(Number(rawY ?? 0))).toBeLessThan(1000);
    expect(Number.isFinite(Number(rawX ?? Number.NaN))).toBe(true);

    await act(async () => {
      firePointer(window, "pointerup", at({ x: 4000, y: 4000 }));
    });
    await settle(container);
  });
});
