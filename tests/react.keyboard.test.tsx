/**
 * Keyboard dragging: grab, move, commit, cancel, boundaries and history.
 *
 * Every expectation here was verified against the running layout; the comments
 * spell out which semantics are in play (swap exchanges two slots, reorder
 * shifts the range in between).
 */

import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DragEndEvent, SwapEvent } from "../src/core/types";
import { Item } from "../src/react/Item";
import { Layout } from "../src/react/Layout";
import { useLayout } from "../src/react/useLayout";
import { advanceFrame, installGeometry, type GeometryOptions, type InstalledGeometry } from "./helpers";

const LIST: GeometryOptions = { ids: ["a", "b", "c"], columns: 1 };

let geometry: InstalledGeometry;

const idsInDom = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>("[data-rewap-item]")].map(
    (element) => element.dataset.rewapItem ?? "",
  );

const itemOf = (container: HTMLElement, id: string): HTMLElement =>
  container.querySelector<HTMLElement>(`[data-rewap-item="${id}"]`) as HTMLElement;

const rootOf = (container: HTMLElement): HTMLElement =>
  container.querySelector<HTMLElement>("[data-rewap-layout]") as HTMLElement;

const press = async (target: Element, key: string, init: Record<string, unknown> = {}): Promise<void> => {
  await act(async () => {
    fireEvent.keyDown(target, { key, ...init });
  });
};

const items = (
  <>
    <Item id="a">A</Item>
    <Item id="b">B</Item>
    <Item id="c">C</Item>
    <Item id="d">D</Item>
  </>
);

beforeEach(() => {
  geometry = installGeometry({ ...LIST, ids: () => idsInDom(document.body) });
});

afterEach(() => {
  geometry.restore();
});

describe("keyboard dragging", () => {
  it("grabs with Space, moves with the arrows and drops with Enter", async () => {
    const onSwap = vi.fn<(event: SwapEvent) => void>();
    const onChange = vi.fn();
    const { container } = render(
      <Layout onSwap={onSwap} onChange={onChange}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );

    const item = itemOf(container, "a");
    await press(item, " ");
    expect(rootOf(container).dataset.status).toBe("dragging");
    expect(item.hasAttribute("data-rewap-active")).toBe(true);

    await press(item, "ArrowDown");
    expect(idsInDom(container)).toEqual(["b", "a", "c"]);
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onSwap.mock.calls[0]?.[0]).toMatchObject({ item: "a", source: "keyboard" });

    await press(item, "Enter");
    await waitFor(() => expect(rootOf(container).dataset.status).toBe("idle"));
    expect(idsInDom(container)).toEqual(["b", "a", "c"]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[1]).toMatchObject({ source: "keyboard", ids: ["b", "a", "c"] });
  });

  it("moves three slots with Shift and jumps to the ends with Home and End", async () => {
    const { container } = render(<Layout mode="reorder">{items}</Layout>);
    const item = itemOf(container, "a");

    const history: string[] = [];
    const record = () => history.push(idsInDom(container).join(","));

    await press(item, " ");
    record();
    await press(item, "ArrowDown", { shiftKey: true });
    record();
    // Reorder semantics: the items in between shift up.
    await press(item, "End");
    record();
    await press(item, "Home");
    record();
    expect(history).toEqual(["a,b,c,d", "b,c,d,a", "b,c,d,a", "a,b,c,d"]);
    expect(idsInDom(container)).toEqual(["a", "b", "c", "d"]);

    await press(item, "Enter");
    await waitFor(() => expect(rootOf(container).dataset.status).toBe("idle"));
    expect(idsInDom(container)).toEqual(["a", "b", "c", "d"]);
  });

  it("swaps with the item N slots away in swap mode", async () => {
    const { container } = render(<Layout mode="swap">{items}</Layout>);
    const item = itemOf(container, "a");

    await press(item, " ");
    await press(item, "ArrowDown", { shiftKey: true });
    // Swap semantics: "a" and the item three slots away trade places.
    expect(idsInDom(container)).toEqual(["d", "b", "c", "a"]);

    await press(item, "Home");
    expect(idsInDom(container)).toEqual(["a", "b", "c", "d"]);

    await press(item, "Escape");
    await advanceFrame(40);
  });

  it("respects the configured step sizes", async () => {
    const { container } = render(
      <Layout mode="reorder" keyboard={{ step: 3, largeStep: 3 }}>
        {items}
      </Layout>,
    );
    const item = itemOf(container, "a");
    await press(item, " ");
    await press(item, "ArrowDown");
    expect(idsInDom(container)).toEqual(["b", "c", "d", "a"]);
    await press(item, "Escape");
    await advanceFrame(40);
  });

  it("cancels with Escape and restores the original order", async () => {
    const onDragEnd = vi.fn<(event: DragEndEvent) => void>();
    const { container } = render(
      <Layout onDragEnd={onDragEnd}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );
    const item = itemOf(container, "a");

    await press(item, " ");
    await press(item, "ArrowDown");
    expect(idsInDom(container)).toEqual(["b", "a", "c"]);

    await press(item, "Escape");
    await advanceFrame(60);
    expect(idsInDom(container)).toEqual(["a", "b", "c"]);
    expect(onDragEnd.mock.calls[0]?.[0]).toMatchObject({
      item: "a",
      cancelled: true,
      reason: "escape",
      source: "keyboard",
    });
  });

  it("refuses to move past the ends", async () => {
    const onSwap = vi.fn();
    const { container } = render(
      <Layout onSwap={onSwap}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );
    const item = itemOf(container, "a");
    await press(item, " ");
    await press(item, "ArrowUp");
    expect(idsInDom(container)).toEqual(["a", "b"]);
    expect(onSwap).not.toHaveBeenCalled();
    await press(item, "Escape");
    await advanceFrame(40);
  });

  it("moves focus with the arrows when nothing is grabbed", async () => {
    const { container } = render(
      <Layout>
        <Item id="a" label="A">
          A
        </Item>
        <Item id="b" label="B">
          B
        </Item>
        <Item id="c" label="C">
          C
        </Item>
      </Layout>,
    );
    const first = itemOf(container, "a");
    const second = itemOf(container, "b");

    first.focus();
    await press(first, "ArrowDown");
    expect(document.activeElement).toBe(second);

    await press(second, "ArrowUp");
    expect(document.activeElement).toBe(first);

    await press(first, "End");
    expect(document.activeElement).toBe(itemOf(container, "c"));
    await press(itemOf(container, "c"), "Home");
    expect(document.activeElement).toBe(first);
    // Moving focus around never reorders anything.
    expect(idsInDom(container)).toEqual(["a", "b", "c"]);
  });

  it("keeps focus on the grabbed item while it moves", async () => {
    const { container } = render(
      <Layout>
        <Item id="a" label="A">
          A
        </Item>
        <Item id="b" label="B">
          B
        </Item>
      </Layout>,
    );
    const item = itemOf(container, "a");
    item.focus();
    await press(item, " ");
    await press(item, "ArrowDown");
    expect(idsInDom(container)).toEqual(["b", "a"]);
    expect(document.activeElement).toBe(itemOf(container, "a"));
    await press(item, "Escape");
    await advanceFrame(40);
  });

  it("undoes and redoes with the platform shortcut", async () => {
    let api: ReturnType<typeof useLayout> | null = null;
    const Probe = () => {
      api = useLayout();
      return null;
    };
    const { container } = render(
      <Layout history={{ limit: 10 }}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Probe />
      </Layout>,
    );
    await waitFor(() => expect(api).not.toBeNull());

    const item = itemOf(container, "a");
    await press(item, " ");
    await press(item, "ArrowDown");
    await press(item, "Enter");
    await waitFor(() => expect(idsInDom(container)).toEqual(["b", "a", "c"]));

    await press(item, "z", { metaKey: true });
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));

    await press(item, "z", { metaKey: true, shiftKey: true });
    await waitFor(() => expect(idsInDom(container)).toEqual(["b", "a", "c"]));

    // Ctrl+Z works on every platform, and Ctrl+Y redoes on Windows.
    await press(item, "z", { ctrlKey: true });
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));
    await press(item, "y", { ctrlKey: true });
    await waitFor(() => expect(idsInDom(container)).toEqual(["b", "a", "c"]));
  });

  it("does nothing when keyboard interaction is disabled", async () => {
    const onSwap = vi.fn();
    const { container } = render(
      <Layout keyboard={false} onSwap={onSwap}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );
    const item = itemOf(container, "a");
    await press(item, " ");
    await press(item, "ArrowDown");
    expect(rootOf(container).dataset.status).toBe("idle");
    expect(idsInDom(container)).toEqual(["a", "b"]);
    expect(onSwap).not.toHaveBeenCalled();
  });

  it("ignores shortcuts on disabled items", async () => {
    const { container } = render(
      <Layout>
        <Item id="a" disabled>
          A
        </Item>
        <Item id="b">B</Item>
      </Layout>,
    );
    await press(itemOf(container, "a"), " ");
    expect(rootOf(container).dataset.status).toBe("idle");
  });

  it("starts a keyboard drag through the controller", async () => {
    let api: ReturnType<typeof useLayout> | null = null;
    const Probe = () => {
      api = useLayout();
      return null;
    };
    const { container } = render(
      <Layout>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Probe />
      </Layout>,
    );
    await waitFor(() => expect(api).not.toBeNull());

    await act(async () => {
      expect(api!.grab("a")).toBe(true);
    });
    expect(rootOf(container).dataset.status).toBe("dragging");
    expect(document.activeElement).toBe(itemOf(container, "a"));

    await act(async () => {
      api!.release();
    });
    await waitFor(() => expect(rootOf(container).dataset.status).toBe("idle"));
  });

  it("announces keyboard moves through the live region", async () => {
    const { container } = render(
      <Layout>
        <Item id="a" label="Card A">
          A
        </Item>
        <Item id="b" label="Card B">
          B
        </Item>
      </Layout>,
    );
    const item = itemOf(container, "a");
    await press(item, " ");
    await press(item, "ArrowDown");

    const polite = document.querySelector('[data-rewap-announcer="polite"]');
    const assertive = document.querySelector('[data-rewap-announcer="assertive"]');
    expect(assertive?.textContent).toContain("grabbed");
    expect(polite?.textContent).toContain("moved to position 2");

    await press(item, "Escape");
    await advanceFrame(40);
  });
});
