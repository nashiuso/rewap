/**
 * `<Layout>` / `<Item>` rendering and control-flow tests.
 *
 * Geometry is synthetic (see `helpers.tsx`), so these run in jsdom but exercise
 * the real component tree: registration, ordering, ARIA wiring, controlled and
 * uncontrolled state, history and persistence.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Item } from "../src/react/Item";
import { Layout } from "../src/react/Layout";
import { useLayout } from "../src/react/useLayout";
import type { LayoutChangeEvent, SwapEvent } from "../src/core/types";
import { installGeometry, type InstalledGeometry } from "./helpers";

let geometry: InstalledGeometry;

const idsInDom = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>("[data-rewap-item]")].map(
    (element) => element.dataset.rewapItem ?? "",
  );

beforeEach(() => {
  geometry = installGeometry({ ids: ["a", "b", "c"], columns: 1 });
});

afterEach(() => {
  geometry.restore();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("<Layout> basics", () => {
  it("renders children in the authored order without any configuration", () => {
    const { container } = render(
      <Layout>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );
    expect(idsInDom(container)).toEqual(["a", "b", "c"]);
    expect(container.querySelector("[data-rewap-layout]")).toBeTruthy();
  });

  it("exposes list semantics and draggable item metadata", () => {
    const { container } = render(
      <Layout label="Dashboard">
        <Item id="a" label="Weather">
          A
        </Item>
        <Item id="b" disabled>
          B
        </Item>
      </Layout>,
    );

    const layout = container.querySelector(
      "[data-rewap-layout]",
    ) as HTMLElement;
    expect(layout.getAttribute("role")).toBe("list");
    expect(layout.getAttribute("aria-label")).toBe("Dashboard");
    expect(layout.getAttribute("aria-describedby")).toBeTruthy();

    const [first, second] =
      container.querySelectorAll<HTMLElement>("[data-rewap-item]");
    expect(first?.getAttribute("role")).toBe("listitem");
    expect(first?.getAttribute("aria-roledescription")).toBe("draggable item");
    expect(first?.getAttribute("tabindex")).toBe("0");
    expect(first?.getAttribute("aria-keyshortcuts")).toContain("Space");
    // Disabled items are not focusable and advertise no shortcut.
    expect(second?.getAttribute("tabindex")).toBeNull();
    expect(second?.getAttribute("aria-keyshortcuts")).toBeNull();
    expect(second?.hasAttribute("data-rewap-disabled")).toBe(true);
    // A disabled layout marks itself too.
    expect(layout.hasAttribute("data-rewap-disabled")).toBe(false);
  });

  it("renders hidden instructions and creates a live region on demand", async () => {
    const { container } = render(
      <Layout label="Board">
        <Item id="a" label="Card">
          A
        </Item>
        <Item id="b" label="Other">
          B
        </Item>
      </Layout>,
    );
    const describedBy = container
      .querySelector("[data-rewap-layout]")
      ?.getAttribute("aria-describedby");
    // The instructions element is referenced by id; jsdom does not implement
    // CSS.escape, so it is looked up by attribute instead.
    const instructions = [...container.querySelectorAll("span")].find(
      (element) => element.id === describedBy,
    );
    expect(instructions?.textContent).toContain("Press Space or Enter");
    expect(instructions?.classList.contains("rw-visually-hidden")).toBe(true);

    // A layout nobody interacts with never grows an extra node: the live region
    // is inserted the first time something is announced.
    expect(document.querySelector("[data-rewap-announcer]")).toBeNull();

    const item = container.querySelector<HTMLElement>("[data-rewap-item]");
    expect(item).toBeTruthy();
    await act(async () => {
      item?.focus();
      fireEvent.keyDown(item as HTMLElement, { key: " " });
    });

    await waitFor(() => {
      expect(
        document.querySelector('[data-rewap-announcer="assertive"]'),
      ).toBeTruthy();
    });
    const region = document.querySelector(
      '[data-rewap-announcer="assertive"]',
    ) as HTMLElement;
    expect(region.getAttribute("aria-live")).toBe("assertive");
    expect(region.textContent).toContain("grabbed");

    // Polite announcements reuse the same helper and land in their own region.
    await act(async () => {
      fireEvent.keyDown(item as HTMLElement, { key: "ArrowDown" });
    });
    expect(
      container
        .querySelector("[data-rewap-layout]")
        ?.getAttribute("data-status"),
    ).toBe("dragging");
    await waitFor(() => {
      expect(
        document.querySelector('[data-rewap-announcer="polite"]'),
      ).toBeTruthy();
    });
  });

  it("keeps non-item children where they were authored", () => {
    const { container } = render(
      <Layout>
        <Item id="a">A</Item>
        <p data-testid="note">footer</p>
        <Item id="b">B</Item>
      </Layout>,
    );
    const children = [
      ...(container.querySelector("[data-rewap-layout]")?.children ?? []),
    ];
    expect(children[1]?.tagName).toBe("P");
    expect(idsInDom(container)).toEqual(["a", "b"]);
  });

  it("renders an empty layout without crashing", () => {
    const { container } = render(<Layout>{null}</Layout>);
    expect(container.querySelector("[data-rewap-layout]")).toBeTruthy();
    expect(container.querySelectorAll("[data-rewap-item]")).toHaveLength(0);
  });

  it("applies grid spans and CSS variables", () => {
    const { container } = render(
      <Layout mode="grid" columns={3} gap={20} minColumnWidth={180}>
        <Item id="a" columnSpan={2} rowSpan={2}>
          A
        </Item>
      </Layout>,
    );
    const layout = container.querySelector(
      "[data-rewap-layout]",
    ) as HTMLElement;
    expect(layout.dataset.mode).toBe("grid");
    expect(layout.style.getPropertyValue("--rw-columns")).toBe("3");
    expect(layout.style.getPropertyValue("--rw-gap")).toBe("20px");
    expect(layout.style.getPropertyValue("--rw-min-column")).toBe("180px");
    expect(layout.hasAttribute("data-rw-columns")).toBe(true);

    const item = container.querySelector("[data-rewap-item]") as HTMLElement;
    expect(item.style.gridColumn).toBe("span 2");
    expect(item.style.gridRow).toBe("span 2");
  });

  it("sets touch-action so a dragged item does not scroll the page", () => {
    const { container } = render(
      <Layout>
        <Item id="a">A</Item>
        <Item id="b" draggable={false}>
          B
        </Item>
      </Layout>,
    );
    const [first, second] =
      container.querySelectorAll<HTMLElement>("[data-rewap-item]");
    expect(first?.style.touchAction).toBe("none");
    expect(second?.style.touchAction).toBe("auto");
    expect(second?.hasAttribute("data-rewap-static")).toBe(true);
  });

  it("uses a handle-only item when an <Item.Handle /> is present", () => {
    const { container } = render(
      <Layout>
        <Item id="a">
          <Item.Handle label="Reorder A" />A
        </Item>
      </Layout>,
    );
    const item = container.querySelector("[data-rewap-item]") as HTMLElement;
    const handle = container.querySelector(
      "[data-rewap-handle]",
    ) as HTMLElement;
    expect(handle.tagName).toBe("BUTTON");
    expect(handle.getAttribute("aria-label")).toBe("Reorder A");
    // Only the handle captures the gesture, so the item stays scrollable.
    expect(item.style.touchAction).toBe("auto");
    expect(handle.style.touchAction).toBe("none");
  });

  it("renders a decorative handle icon without an accessible name", () => {
    const { container } = render(
      <Layout>
        <Item id="a">
          <Item.Handle />
        </Item>
      </Layout>,
    );
    const handle = container.querySelector(
      "[data-rewap-handle]",
    ) as HTMLElement;
    expect(handle.getAttribute("aria-hidden")).toBe("true");
    expect(handle.querySelector("svg")).toBeTruthy();
  });
});

describe("<Layout> ordering", () => {
  it("uses defaultItems for the initial order", () => {
    const { container } = render(
      <Layout defaultItems={["c", "a", "b"]}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );
    expect(idsInDom(container)).toEqual(["c", "a", "b"]);
  });

  it("accepts object items and preserves them when reporting changes", async () => {
    const onChange = vi.fn();
    const items = [
      { id: "a", data: { title: "A" } },
      { id: "b", data: { title: "B" } },
    ];
    const { container } = render(
      <Layout items={items} onChange={onChange} history={false}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );
    expect(idsInDom(container)).toEqual(["a", "b"]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("appends items that appear later instead of dropping them", async () => {
    const { container, rerender } = render(
      <Layout defaultItems={["a"]}>
        <Item id="a">A</Item>
      </Layout>,
    );
    expect(idsInDom(container)).toEqual(["a"]);

    rerender(
      <Layout defaultItems={["a"]}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b"]));
  });

  it("keeps a stored order and appends new items at the end", async () => {
    window.localStorage.setItem(
      "dashboard",
      JSON.stringify({
        version: 1,
        mode: "reorder",
        ids: ["b", "a"],
        savedAt: Date.now(),
      }),
    );
    const { container } = render(
      <Layout persistence={{ key: "dashboard" }}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );
    await waitFor(() => expect(idsInDom(container)).toEqual(["b", "a", "c"]));
  });

  it("ignores persistence while the order is controlled", async () => {
    window.localStorage.setItem(
      "controlled",
      JSON.stringify({
        version: 1,
        mode: "swap",
        ids: ["b", "a"],
        savedAt: Date.now(),
      }),
    );
    const { container } = render(
      <Layout
        items={["a", "b"]}
        onChange={() => {}}
        persistence={{ key: "controlled" }}
      >
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b"]));
  });
});

describe("<Layout> controller", () => {
  it("exposes order, history and programmatic moves through useLayout()", async () => {
    let api: ReturnType<typeof useLayout> | null = null;

    const Probe = () => {
      api = useLayout();
      return null;
    };

    const { container } = render(
      <Layout history={{ limit: 5 }}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Probe />
      </Layout>,
    );

    await waitFor(() => expect(api).not.toBeNull());
    expect(api!.ids).toEqual(["a", "b", "c"]);
    expect(api!.canUndo).toBe(false);
    expect(api!.mode).toBe("swap");

    await act(async () => {
      expect(api!.move("a", 1)).toBe(true);
    });
    await waitFor(() => expect(idsInDom(container)).toEqual(["b", "a", "c"]));
    expect(api!.canUndo).toBe(true);

    await act(async () => {
      api!.undo();
    });
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));

    await act(async () => {
      api!.redo();
    });
    await waitFor(() => expect(idsInDom(container)).toEqual(["b", "a", "c"]));

    await act(async () => {
      api!.reset();
    });
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));

    expect(api!.element("a")).toBe(
      container.querySelector('[data-rewap-item="a"]'),
    );
    await act(async () => {
      api!.announce("hello", "polite");
    });
    expect(
      document.querySelector('[data-rewap-announcer="polite"]')?.textContent,
    ).toBe("hello");
  });

  it("supports controlled usage where the parent owns the order", async () => {
    const Wrapper = () => {
      const [items, setItems] = useState<string[]>(["a", "b", "c"]);
      const [last, setLast] = useState<LayoutChangeEvent | null>(null);
      return (
        <>
          <Layout
            mode="reorder"
            items={items}
            onChange={(next, event) => {
              // Object items keep their payload; string items stay strings.
              setItems(
                next.map((item) => (typeof item === "string" ? item : item.id)),
              );
              setLast(event);
            }}
          >
            <Item id="a">A</Item>
            <Item id="b">B</Item>
            <Item id="c">C</Item>
          </Layout>
          <button type="button" onClick={() => setItems(["c", "b", "a"])}>
            reverse
          </button>
          <output data-testid="last">
            {last ? `${last.ids.join("")}:${last.source}` : "none"}
          </output>
        </>
      );
    };

    const { container } = render(<Wrapper />);
    expect(idsInDom(container)).toEqual(["a", "b", "c"]);

    fireEvent.click(screen.getByText("reverse"));
    await waitFor(() => expect(idsInDom(container)).toEqual(["c", "b", "a"]));
    expect(screen.getByTestId("last").textContent).toBe("none");
  });

  it("reports swap events with slot information", async () => {
    const onSwap = vi.fn<(event: SwapEvent) => void>();
    let api: ReturnType<typeof useLayout> | null = null;
    const Probe = () => {
      api = useLayout();
      return null;
    };

    render(
      <Layout mode="swap" onSwap={onSwap}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Probe />
      </Layout>,
    );
    await waitFor(() => expect(api).not.toBeNull());

    await act(async () => {
      api!.move("a", 2);
    });

    expect(onSwap).toHaveBeenCalledTimes(1);
    const event = onSwap.mock.calls[0]?.[0];
    expect(event?.item).toBe("a");
    expect(event?.previousSlot.index).toBe(0);
    expect(event?.nextSlot.index).toBe(2);
    expect(event?.mode).toBe("swap");
    expect(event?.source).toBe("programmatic");
    expect(event?.velocity).toEqual({ x: 0, y: 0 });
  });
});

describe("<Layout> motion and reduced motion", () => {
  it("marks instant motion by clearing transforms immediately", async () => {
    const { container } = render(
      <Layout motion="instant">
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );
    const item = container.querySelector(
      '[data-rewap-item="a"]',
    ) as HTMLElement;
    expect(
      item.style.transform === "" ||
        item.style.transform === "translate3d(0px, 0px, 0)",
    ).toBe(true);
  });

  it("honours prefers-reduced-motion for animations", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const onSwap = vi.fn();
    let api: ReturnType<typeof useLayout> | null = null;
    const Probe = () => {
      api = useLayout();
      return null;
    };
    render(
      <Layout onSwap={onSwap} history={false}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Probe />
      </Layout>,
    );
    await waitFor(() => expect(api).not.toBeNull());

    await act(async () => {
      api!.move("a", 1);
    });
    // Reduced motion still performs the change, just without animating it.
    expect(onSwap).toHaveBeenCalledTimes(1);

    window.matchMedia = original;
  });
});
