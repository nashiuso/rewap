/**
 * Touch dragging.
 *
 * jsdom has no touch stack, so these tests drive the pointer events a browser
 * would produce from a finger: `pointerType: "touch"`, one pointer, no hover
 * phase before `pointerdown`.
 */

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Item } from "../src/react/Item";
import { Layout } from "../src/react/Layout";
import type { DragEndEvent, DragStartEvent } from "../src/core/types";
import {
  advanceFrame,
  dragPointer,
  firePointer,
  installGeometry,
  slotCenter,
  type InstalledGeometry,
} from "./helpers";

const CELLS = {
  ids: ["a", "b"],
  columns: 1,
  cellWidth: 200,
  cellHeight: 120,
  gap: 10,
};
let geometry: InstalledGeometry;

const idsInDom = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>("[data-rewap-item]")].map(
    (element) => element.dataset.rewapItem ?? "",
  );

const itemOf = (container: HTMLElement, id: string): HTMLElement =>
  container.querySelector<HTMLElement>(
    `[data-rewap-item="${id}"]`,
  ) as HTMLElement;

beforeEach(() => {
  geometry = installGeometry(CELLS);
});

afterEach(() => {
  geometry.restore();
});

describe("touch dragging", () => {
  it("reports touch as the input source", async () => {
    const onDragStart = vi.fn<(event: DragStartEvent) => void>();
    const onDragEnd = vi.fn<(event: DragEndEvent) => void>();
    const { container } = render(
      <Layout onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(1, CELLS),
      pointerType: "touch",
    });

    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragStart.mock.calls[0]?.[0]?.source).toBe("touch");
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDragEnd.mock.calls[0]?.[0]?.source).toBe("touch");
    expect(idsInDom(container)).toEqual(["b", "a"]);
  });

  it("keeps the item under the finger while it is being dragged", async () => {
    const { container } = render(
      <Layout>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: { x: 120, y: 260 },
      pointerType: "touch",
      release: false,
    });

    const element = itemOf(container, "a");
    expect(element.style.transform).toMatch(/translate3d\(/);
    expect(element.style.transform).not.toBe("translate3d(0px, 0px, 0)");
    // The layout, not the item, carries the dragging flag.
    expect(
      container
        .querySelector("[data-rewap-layout]")
        ?.hasAttribute("data-rewap-dragging"),
    ).toBe(true);

    await act(async () => {
      firePointer(window, "pointercancel", {
        clientX: 120,
        clientY: 260,
        pointerType: "touch",
      });
    });
    // `cancel` settles the item back into its slot, so the flag clears a little
    // later rather than on the spot.
    await advanceFrame(60);
    expect(
      container
        .querySelector("[data-rewap-layout]")
        ?.hasAttribute("data-rewap-dragging"),
    ).toBe(false);
  });

  it("does not wait for a hover phase on a handle-only item", async () => {
    const { container } = render(
      <Layout>
        <Item id="a" handleOnly label="Card A">
          <Item.Handle />
          content
        </Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a").querySelector("button") as HTMLElement,
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(1, CELLS),
      pointerType: "touch",
    });

    expect(idsInDom(container)).toEqual(["b", "a"]);
  });

  it("leaves the gesture to the page when the finger starts on the content of a handle-only item", async () => {
    const { container } = render(
      <Layout>
        <Item id="a" handleOnly>
          <Item.Handle />
          <p>scroll me</p>
        </Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    const paragraph = container.querySelector("p") as HTMLElement;
    fireEvent.pointerDown(paragraph, {
      pointerType: "touch",
      clientX: 100,
      clientY: 160,
    });
    fireEvent.pointerMove(window, {
      pointerType: "touch",
      clientX: 100,
      clientY: 300,
    });

    expect(itemOf(container, "a").style.transform).toBe("");
    expect(idsInDom(container)).toEqual(["a", "b"]);
  });

  it("marks draggable items as non-scrolling, and handle-only items as scrollable", () => {
    const { container } = render(
      <Layout>
        <Item id="a">A</Item>
        <Item id="b" handleOnly>
          <Item.Handle />B
        </Item>
        <Item id="c" disabled>
          C
        </Item>
      </Layout>,
    );

    expect(itemOf(container, "a").style.touchAction).toBe("none");
    expect(itemOf(container, "b").style.touchAction).toBe("auto");
    expect(itemOf(container, "c").style.touchAction).toBe("auto");
  });
});
