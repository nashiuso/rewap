/**
 * Swap semantics: what a drag previews, what it commits, and what the events say.
 */

import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LayoutChangeEvent, SwapEvent } from "../src/core/types";
import { Item } from "../src/react/Item";
import { Layout } from "../src/react/Layout";
import { useLayout } from "../src/react/useLayout";
import {
  dragPointer,
  firePointer,
  installGeometry,
  slotCenter,
  type GeometryOptions,
  type InstalledGeometry,
} from "./helpers";

const CELLS: GeometryOptions = {
  ids: ["a", "b", "c", "d"],
  columns: 2,
  cellWidth: 200,
  cellHeight: 120,
};

let geometry: InstalledGeometry;

const idsInDom = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>("[data-rewap-item]")].map(
    (element) => element.dataset.rewapItem ?? "",
  );

const itemOf = (container: HTMLElement, id: string): HTMLElement =>
  container.querySelector<HTMLElement>(`[data-rewap-item="${id}"]`) as HTMLElement;

const at = (point: { x: number; y: number }) => ({ clientX: point.x, clientY: point.y });

const advance = async (steps = 6): Promise<void> => {
  const { advanceFrame } = await import("./helpers");
  await advanceFrame(steps);
};

beforeEach(() => {
  geometry = installGeometry({
    ...CELLS,
    ids: () => idsInDom(document.body),
  });
});

afterEach(() => {
  geometry.restore();
});

describe("swap mode", () => {
  it("previews a single swap from the original order", async () => {
    const { container } = render(
      <Layout mode="swap">
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Item id="d">D</Item>
      </Layout>,
    );
    expect(idsInDom(container)).toEqual(["a", "b", "c", "d"]);

    // Row-major grid: index 0 is top-left, index 3 bottom-right.
    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(3, CELLS),
      release: false,
    });

    // "a" and "d" trade places; everything else stays put.
    expect(idsInDom(container)).toEqual(["d", "b", "c", "a"]);

    await act(async () => {
      firePointer(window, "pointerup", at(slotCenter(3, CELLS)));
    });
    await advance();
    expect(idsInDom(container)).toEqual(["d", "b", "c", "a"]);
  });

  it("reports each destination change with slot information", async () => {
    const events: SwapEvent[] = [];
    const { container } = render(
      <Layout mode="swap" onSwap={(event) => events.push(event)}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Item id="d">D</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(1, CELLS),
      release: false,
    });
    await act(async () => {
      firePointer(window, "pointermove", at(slotCenter(2, CELLS)));
    });
    await advance(2);
    await act(async () => {
      firePointer(window, "pointerup", at(slotCenter(2, CELLS)));
    });
    await advance();

    expect(events.length).toBeGreaterThanOrEqual(2);
    const first = events[0] as SwapEvent;
    expect(first.item).toBe("a");
    expect(first.previousSlot.index).toBe(0);
    expect(first.nextSlot.index).toBe(1);
    expect(first.mode).toBe("swap");
    expect(first.source).toBe("mouse");

    const latest = events[events.length - 1] as SwapEvent;
    expect(latest.nextSlot.index).toBe(2);
    expect(latest.nextSlot.row).toBe(1);
    expect(Number.isFinite(latest.velocity.x)).toBe(true);
    expect(Number.isFinite(latest.position.y)).toBe(true);
  });

  it("swaps two items programmatically through useLayout()", async () => {
    let api: ReturnType<typeof useLayout> | null = null;
    const Probe = () => {
      api = useLayout();
      return null;
    };
    const onChange = vi.fn<(items: unknown[], event: LayoutChangeEvent) => void>();
    const { container } = render(
      <Layout items={undefined} onChange={onChange}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Probe />
      </Layout>,
    );
    await waitFor(() => expect(api).not.toBeNull());

    await act(async () => {
      expect(api!.swap("a", "c")).toBe(true);
    });
    await waitFor(() => expect(idsInDom(container)).toEqual(["c", "b", "a"]));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[1].source).toBe("programmatic");

    await act(async () => {
      expect(api!.swap("a", "missing")).toBe(false);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("only swaps when the drop is over another slot", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Layout mode="swap" onChange={onChange}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: { x: slotCenter(0, CELLS).x + 20, y: slotCenter(0, CELLS).y + 10 },
    });

    expect(idsInDom(container)).toEqual(["a", "b"]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("honours a custom collision strategy", async () => {
    const { container } = render(
      <Layout mode="swap" collision="center">
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(1, CELLS),
    });

    expect(idsInDom(container)).toEqual(["b", "a"]);
  });

  it("ignores slots below minCollisionScore", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Layout mode="swap" collision="intersection" minCollisionScore={0.99} onChange={onChange}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: itemOf(container, "a"),
      fromPoint: slotCenter(0, CELLS),
      toPoint: { x: slotCenter(1, CELLS).x, y: slotCenter(1, CELLS).y - 70 },
      steps: 3,
    });

    // Barely overlapping: not enough to be accepted as a destination.
    expect(idsInDom(container)).toEqual(["a", "b"]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
