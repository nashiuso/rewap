/**
 * Reorder and grid modes: items shift instead of swapping, and grid placement
 * follows the intersection strategy.
 */

import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Item } from "../src/react/Item";
import { Layout } from "../src/react/Layout";
import { useLayout } from "../src/react/useLayout";
import {
  advanceFrame,
  dragPointer,
  firePointer,
  installGeometry,
  slotCenter,
  type GeometryOptions,
  type InstalledGeometry,
} from "./helpers";

const LIST: GeometryOptions = { ids: ["a", "b", "c", "d"], columns: 1 };
const GRID: GeometryOptions = { ids: ["a", "b", "c", "d"], columns: 2, cellWidth: 160, cellHeight: 100 };

let geometry: InstalledGeometry;

const idsInDom = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>("[data-rewap-item]")].map(
    (element) => element.dataset.rewapItem ?? "",
  );

const itemOf = (container: HTMLElement, id: string): HTMLElement =>
  container.querySelector<HTMLElement>(`[data-rewap-item="${id}"]`) as HTMLElement;

const at = (point: { x: number; y: number }) => ({ clientX: point.x, clientY: point.y });

/** Installs the geometry a test needs, always mirroring the rendered order. */
const useGeometry = (options: GeometryOptions): void => {
  geometry.restore();
  geometry = installGeometry({ ...options, ids: () => idsInDom(document.body) });
};

beforeEach(() => {
  geometry = installGeometry({ ...LIST, ids: () => idsInDom(document.body) });
});

afterEach(() => {
  geometry.restore();
});

describe("reorder mode", () => {
  it("shifts the items in between instead of swapping", async () => {
    const { container } = render(
      <Layout mode="reorder">
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Item id="d">D</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, LIST),
      toPoint: slotCenter(2, LIST),
      release: false,
      steps: 6,
    });

    // "b" and "c" move up; "d" stays where it was.
    expect(idsInDom(container)).toEqual(["b", "c", "a", "d"]);

    await act(async () => {
      firePointer(window, "pointerup", at(slotCenter(2, LIST)));
    });
    await advanceFrame(20);
    expect(idsInDom(container)).toEqual(["b", "c", "a", "d"]);
  });

  it("animates the items that were displaced with a FLIP transform", async () => {
    const { container } = render(
      <Layout mode="reorder" motion={{ type: "spring", stiffness: 180, damping: 20, mass: 1 }}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, LIST),
      toPoint: slotCenter(1, LIST),
      release: false,
    });

    // "b" moved one cell up, so it is rendered one cell lower and springs back.
    const displaced = itemOf(container, "b");
    const offset = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(displaced.style.transform);
    expect(offset).toBeTruthy();
    expect(Number(offset?.[2])).toBeGreaterThan(0);
    expect(Number(offset?.[2])).toBeLessThanOrEqual(130.001);

    await act(async () => {
      firePointer(window, "pointerup", at(slotCenter(1, LIST)));
    });
    await advanceFrame(3);
    const mid = Number(
      /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(itemOf(container, "b").style.transform)?.[2],
    );
    expect(Math.abs(mid)).toBeLessThan(130);

    for (let frame = 0; frame < 400; frame += 1) {
      const value = Number(
        /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(itemOf(container, "b").style.transform)?.[2] ?? 0,
      );
      if (value === 0) break;
      await advanceFrame(2);
    }
    expect(itemOf(container, "b").style.transform).toBe("translate3d(0px, 0px, 0)");
  });

  it("moves an item programmatically and reports the change once", async () => {
    const onChange = vi.fn();
    let api: ReturnType<typeof useLayout> | null = null;
    const Probe = () => {
      api = useLayout();
      return null;
    };
    const { container } = render(
      <Layout mode="reorder" onChange={onChange}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Probe />
      </Layout>,
    );
    await waitFor(() => expect(api).not.toBeNull());

    await act(async () => {
      expect(api!.move("c", 0)).toBe(true);
    });
    await waitFor(() => expect(idsInDom(container)).toEqual(["c", "a", "b"]));
    expect(onChange).toHaveBeenCalledTimes(1);

    // Indices are clamped to the available slots instead of throwing…
    await act(async () => {
      expect(api!.move("c", 9)).toBe(true);
    });
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));
    expect(onChange).toHaveBeenCalledTimes(2);

    // …and a move that changes nothing reports that nothing happened.
    await act(async () => {
      expect(api!.move("c", 2)).toBe(false);
      expect(api!.move("nope", 1)).toBe(false);
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("keeps the item count stable through a chain of moves", async () => {
    const { container } = render(
      <Layout mode="reorder">
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Item id="d">D</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "d"),
      fromPoint: slotCenter(3, LIST),
      toPoint: slotCenter(0, LIST),
      steps: 6,
    });

    expect(idsInDom(container)).toEqual(["d", "a", "b", "c"]);
    expect(container.querySelectorAll("[data-rewap-item]")).toHaveLength(4);
  });
});

describe("grid mode", () => {
  it("places an item in the slot it overlaps", async () => {
    useGeometry(GRID);
    const { container } = render(
      <Layout mode="grid" columns={2}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Item id="d">D</Item>
      </Layout>,
    );
    expect(idsInDom(container)).toEqual(["a", "b", "c", "d"]);

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, GRID),
      toPoint: slotCenter(2, GRID),
      steps: 5,
    });

    // Grid placement uses the intersection strategy with reorder semantics:
    // "a" lands in the second row and the items above it move up.
    expect(idsInDom(container)).toEqual(["b", "c", "a", "d"]);
  });

  it("keeps the item in a slot it does not leave", async () => {
    useGeometry(GRID);
    const { container } = render(
      <Layout mode="grid" columns={2}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "b"),
      fromPoint: slotCenter(1, GRID),
      toPoint: { x: slotCenter(1, GRID).x + 12, y: slotCenter(1, GRID).y + 8 },
    });

    expect(idsInDom(container)).toEqual(["a", "b", "c"]);
  });

  it("exposes the grid columns to CSS through variables and attributes", () => {
    const { container } = render(
      <Layout mode="grid" columns={3} minColumnWidth={140} gap={16}>
        <Item id="a">A</Item>
      </Layout>,
    );
    const layout = container.querySelector<HTMLElement>("[data-rewap-layout]") as HTMLElement;
    expect(layout.style.getPropertyValue("--rw-columns")).toBe("3");
    expect(layout.style.getPropertyValue("--rw-min-column")).toBe("140px");
    expect(layout.style.getPropertyValue("--rw-gap")).toBe("16px");
    expect(layout.getAttribute("data-rw-columns")).toBe("3");
    expect(layout.dataset.mode).toBe("grid");
  });

  it("re-measures when the number of columns changes", async () => {
    const { container, rerender } = render(
      <Layout mode="grid" columns={1}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    geometry.layout({ ids: ["a", "b"] });
    rerender(
      <Layout mode="grid" columns={2}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );
    await act(async () => {
      await advanceFrame(2);
    });

    // The layout advertises the new column count, and the engine re-measures on
    // the next interaction instead of holding on to stale slots.
    const layout = container.querySelector<HTMLElement>("[data-rewap-layout]") as HTMLElement;
    expect(layout.style.getPropertyValue("--rw-columns")).toBe("2");

    useGeometry({ ...GRID, ids: ["a", "b"] });
    await act(async () => {
      firePointer(itemOf(container, "b"), "pointerdown", at(slotCenter(1, GRID)));
      firePointer(window, "pointermove", at(slotCenter(0, GRID)));
    });
    await advanceFrame(4);
    await act(async () => {
      firePointer(window, "pointercancel", at(slotCenter(0, GRID)));
    });
  });
});
