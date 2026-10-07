/**
 * Responsive behaviour: the engine is not allowed to assume a fixed size.
 *
 * jsdom does not lay anything out, so these tests change the synthetic geometry
 * and then fire the `ResizeObserver` callback the layout installed on its items
 * — the same path a real browser takes after a breakpoint change.
 *
 * Worth knowing when reading the assertions: a resize only marks the slots
 * dirty. They are measured again on the next render (or at the start of a drag),
 * and `useLayout()` returns a snapshot of the last render, so the tests below ask
 * the layout to render again before looking at `api.slots`.
 */

import { act, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Item } from "../src/react/Item";
import { Layout } from "../src/react/Layout";
import { useLayout, type LayoutController } from "../src/react/useLayout";
import { dragPointer, installGeometry, slotCenter, type InstalledGeometry } from "./helpers";

const LIST = { ids: ["a", "b", "c"], columns: 1, cellWidth: 200, cellHeight: 120, gap: 10 };
const ROW = { ...LIST, columns: 3 };
const TALL = { ...LIST, cellWidth: 320, cellHeight: 90, gap: 8 };

// ----------------------------------------------------------------- the observer
type ObserverCallback = (entries: unknown[]) => void;

const NativeResizeObserver = globalThis.ResizeObserver;
const observers: RecordingResizeObserver[] = [];

class RecordingResizeObserver implements ResizeObserver {
  readonly observed = new Set<Element>();
  private readonly callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }
  observe(element: Element): void {
    this.observed.add(element);
  }
  unobserve(element: Element): void {
    this.observed.delete(element);
  }
  disconnect(): void {
    this.observed.clear();
  }
  notify(): void {
    this.callback([]);
  }
}

const notifyResize = async (): Promise<void> => {
  await act(async () => {
    for (const observer of observers) observer.notify();
  });
};

// --------------------------------------------------------------------- harness
interface ProbeHandle {
  api: LayoutController;
  render(): void;
}

const Probe = ({ handle }: { handle: { current: ProbeHandle | null } }) => {
  const api = useLayout();
  const [, setTick] = useState(0);
  // Stands in for "the application rendered again after the viewport changed".
  handle.current = { api, render: () => setTick((tick) => tick + 1) };
  return null;
};

const rerender = async (handle: { current: ProbeHandle | null }): Promise<void> => {
  await act(async () => {
    handle.current?.render();
  });
};

let geometry: InstalledGeometry;

beforeEach(() => {
  observers.length = 0;
  globalThis.ResizeObserver = RecordingResizeObserver as unknown as typeof ResizeObserver;
  geometry = installGeometry(LIST);
});

afterEach(() => {
  geometry.restore();
  globalThis.ResizeObserver = NativeResizeObserver;
});

const items = (
  <>
    <Item id="a">A</Item>
    <Item id="b">B</Item>
    <Item id="c">C</Item>
  </>
);

describe("responsive layouts", () => {
  it("re-measures its slots when an item changes size", async () => {
    const handle: { current: ProbeHandle | null } = { current: null };
    render(
      <Layout>
        <Probe handle={handle} />
        {items}
      </Layout>,
    );

    await waitFor(() => expect(handle.current?.api.slots).toHaveLength(3));
    expect(handle.current?.api.slots.map((slot) => Math.round(slot.rect.y))).toEqual([100, 230, 360]);

    // Same list, taller cells.
    const taller = installGeometry(TALL);
    try {
      await notifyResize();
      await rerender(handle);
      expect(handle.current?.api.slots[2]?.rect.y).toBeCloseTo(100 + 2 * 98, 5);
    } finally {
      taller.restore();
    }

    // …and back again, which is the case that used to leave the old rectangles
    // behind until the next pointer down.
    await notifyResize();
    await rerender(handle);
    expect(handle.current?.api.slots[2]?.rect.y).toBeCloseTo(360, 5);
  });

  it("drops into the slot that is under the pointer after a breakpoint change", async () => {
    const { container } = render(<Layout>{items}</Layout>);
    const nodeOf = (id: string): HTMLElement =>
      container.querySelector<HTMLElement>(`[data-rewap-item="${id}"]`) as HTMLElement;

    const row = installGeometry(ROW);
    try {
      await notifyResize();

      await dragPointer({
        from: nodeOf("a"),
        fromPoint: slotCenter(0, ROW),
        toPoint: slotCenter(2, ROW),
      });

      const order = [...container.querySelectorAll("[data-rewap-item]")].map(
        (element) => (element as HTMLElement).dataset.rewapItem,
      );
      // `swap` in a row: the first item exchanges with the third.
      expect(order).toEqual(["c", "b", "a"]);
    } finally {
      row.restore();
    }
  });

  it("keeps working when nothing is measurable yet", async () => {
    const hidden = installGeometry({ ...LIST, cellWidth: 0, cellHeight: 0 });
    const handle: { current: ProbeHandle | null } = { current: null };
    try {
      render(
        <Layout>
          <Probe handle={handle} />
          <Item id="a">A</Item>
          <Item id="b">B</Item>
        </Layout>,
      );
      await waitFor(() => expect(handle.current?.api.ids).toEqual(["a", "b"]));
      await notifyResize();
      await rerender(handle);
      // Zero-sized elements are skipped rather than turned into degenerate slots.
      expect(handle.current?.api.slots).toHaveLength(0);
      expect(handle.current?.api.renderIds).toEqual(["a", "b"]);
    } finally {
      hidden.restore();
    }
  });

  it("watches every item through a single observer", async () => {
    const { container } = render(<Layout>{items}</Layout>);

    await waitFor(() => expect(observers).toHaveLength(1));
    const observer = observers[0] as RecordingResizeObserver;
    expect(observer.observed.size).toBe(3);
    for (const id of ["a", "b", "c"]) {
      expect(observer.observed.has(container.querySelector(`[data-rewap-item="${id}"]`) as Element)).toBe(
        true,
      );
    }
  });

  it("unmounts without a resize callback throwing", async () => {
    const view = render(<Layout>{items}</Layout>);
    await waitFor(() => expect(observers).toHaveLength(1));
    const observer = observers[0] as RecordingResizeObserver;

    view.unmount();
    expect(() => observer.notify()).not.toThrow();
  });
});
