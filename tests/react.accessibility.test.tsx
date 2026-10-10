/**
 * Accessibility of the rendered layout, plus `prefers-reduced-motion`.
 *
 * The keyboard grammar itself is covered in `accessibility.test.ts` and the
 * interactions in `react.keyboard.test.tsx`. What is left is the markup: names,
 * roles, descriptions and what happens when the user asked for less motion.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Item } from "../src/react/Item";
import { Layout } from "../src/react/Layout";
import { usePrefersReducedMotion } from "../src/utilities/usePrefersReducedMotion";
import { ariaKeyShortcuts } from "../src/accessibility";
import {
  dragPointer,
  installGeometry,
  slotCenter,
  type InstalledGeometry,
} from "./helpers";

const idsInDom = (): string[] =>
  [...document.querySelectorAll<HTMLElement>("[data-rewap-item]")].map(
    (element) => element.dataset.rewapItem ?? "",
  );

// Item ids differ from test to test here, so the geometry follows the DOM order
// the way a browser would lay it out.
const CELLS = {
  ids: idsInDom,
  columns: 1,
  cellWidth: 200,
  cellHeight: 120,
  gap: 10,
};
let geometry: InstalledGeometry;

/** Replaces the matchMedia stub from `setup.ts` with a controllable one. */
const installMediaQuery = (matches: boolean) => {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const list = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: (
      _type: string,
      listener: (event: { matches: boolean }) => void,
    ) => listeners.add(listener),
    removeEventListener: (
      _type: string,
      listener: (event: { matches: boolean }) => void,
    ) => listeners.delete(listener),
    addListener: (listener: (event: { matches: boolean }) => void) =>
      listeners.add(listener),
    removeListener: (listener: (event: { matches: boolean }) => void) =>
      listeners.delete(listener),
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;

  const original = window.matchMedia;
  window.matchMedia = vi.fn(() => list) as unknown as typeof window.matchMedia;
  return {
    list,
    set(next: boolean) {
      (list as { matches: boolean }).matches = next;
      for (const listener of listeners) listener({ matches: next });
    },
    restore() {
      window.matchMedia = original;
    },
  };
};

beforeEach(() => {
  geometry = installGeometry(CELLS);
});

afterEach(() => {
  geometry.restore();
});

describe("item markup", () => {
  it("gives every item a name, a role and its instructions", async () => {
    render(
      <Layout label="Dashboard">
        <Item id="weather" label="Weather">
          content
        </Item>
        <Item id="notes">Unlabelled</Item>
      </Layout>,
    );

    const weather = screen.getByRole("listitem", { name: "Weather" });
    expect(weather.getAttribute("aria-roledescription")).toBe("draggable item");
    expect(weather.getAttribute("aria-keyshortcuts")).toBe(ariaKeyShortcuts);

    const description = weather.getAttribute("aria-describedby") as string;
    expect(description).toContain("-rw-help");
    expect(document.getElementById(description)?.textContent).toContain(
      "Press Space or Enter",
    );

    // `listitem` does not take its accessible name from its content, so an item
    // without a label has no name in the accessibility tree. The text is still
    // read out as part of the item, and announcements fall back to it — which is
    // what `label` is for when the content is not a good summary.
    const notes = screen.getAllByRole("listitem")[1] as HTMLElement;
    expect(notes.textContent).toContain("Unlabelled");

    await act(async () => {
      notes.focus();
      fireEvent.keyDown(notes, { key: " " });
    });
    await waitFor(() =>
      expect(
        document.querySelector('[data-rewap-announcer="assertive"]')
          ?.textContent,
      ).toContain("Unlabelled"),
    );
  });

  it("merges the caller's aria-describedby with its own help text", () => {
    render(
      <Layout>
        <Item id="a" aria-describedby="external-hint">
          A
        </Item>
      </Layout>,
    );

    const item = screen.getByRole("listitem");
    const described = (item.getAttribute("aria-describedby") as string).split(
      " ",
    );
    expect(described).toHaveLength(2);
    expect(described[0]).toBe("external-hint");
    expect(described[1]).toMatch(/-rw-help$/);
  });

  it("does not advertise shortcuts for items it cannot drag", () => {
    render(
      <Layout>
        <Item id="a" disabled>
          A
        </Item>
        <Item id="b" draggable={false}>
          B
        </Item>
        <Item id="c">C</Item>
      </Layout>,
    );

    const [a, b, c] = screen.getAllByRole("listitem");
    expect(a?.hasAttribute("aria-keyshortcuts")).toBe(false);
    expect(a?.hasAttribute("tabindex")).toBe(false);
    expect(b?.hasAttribute("aria-keyshortcuts")).toBe(false);
    expect(b?.hasAttribute("tabindex")).toBe(false);
    expect(c?.getAttribute("tabindex")).toBe("0");
  });

  it("marks the grabbed item for styling", async () => {
    const { container } = render(
      <Layout>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    await dragPointer({
      from: container.querySelector("[data-rewap-item='a']") as HTMLElement,
      fromPoint: slotCenter(0, CELLS),
      toPoint: { x: 100, y: 175 },
      release: false,
    });

    expect(
      container
        .querySelector("[data-rewap-item='a']")
        ?.hasAttribute("data-rewap-active"),
    ).toBe(true);
  });

  it("labels a handle button without stealing the item's name", () => {
    render(
      <Layout>
        <Item id="a" label="Card A">
          <Item.Handle label="Move card" />
          content
        </Item>
      </Layout>,
    );

    // The item is named by its `label`, the handle is a separate control.
    expect(screen.getByRole("listitem", { name: "Card A" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move card" })).toBeTruthy();
  });
});

describe("prefers-reduced-motion", () => {
  it("reports the preference and reacts to changes", async () => {
    const media = installMediaQuery(false);
    try {
      const seen: boolean[] = [];
      const Reader = () => {
        seen.push(usePrefersReducedMotion());
        return null;
      };
      render(<Reader />);
      expect(seen[seen.length - 1]).toBe(false);

      media.set(true);
      await waitFor(() => expect(seen[seen.length - 1]).toBe(true));
    } finally {
      media.restore();
    }
  });

  it("skips the animation when the user asked for less motion", async () => {
    const media = installMediaQuery(true);
    try {
      const { container } = render(
        <Layout motion="smooth">
          <Item id="a">A</Item>
          <Item id="b">B</Item>
        </Layout>,
      );

      // A drag is still possible — it just does not animate. The item follows the
      // pointer and the final transform is cleared instead of springing back.
      await dragPointer({
        from: container.querySelector("[data-rewap-item='a']") as HTMLElement,
        fromPoint: slotCenter(0, CELLS),
        toPoint: slotCenter(1, CELLS),
      });

      await waitFor(() =>
        expect(
          [...container.querySelectorAll("[data-rewap-item]")].map(
            (element) => (element as HTMLElement).dataset.rewapItem,
          ),
        ).toEqual(["b", "a"]),
      );

      for (const element of container.querySelectorAll<HTMLElement>(
        "[data-rewap-item]",
      )) {
        expect(
          element.style.transform === "" ||
            element.style.transform === "translate3d(0px, 0px, 0)",
        ).toBe(true);
      }
    } finally {
      media.restore();
    }
  });
});

describe("Item.Handle naming", () => {
  it("uses `label` when it is given", () => {
    const { container } = render(
      <Layout>
        <Item id="a" label="Row A">
          A
          <Item.Handle label="Reorder row A" />
        </Item>
      </Layout>,
    );

    const handle = container.querySelector("[data-rewap-handle]");
    expect(handle?.getAttribute("aria-label")).toBe("Reorder row A");
    expect(handle?.getAttribute("aria-hidden")).toBeNull();
  });

  it("honours an aria-label passed through instead of dropping it", () => {
    const { container } = render(
      <Layout>
        <Item id="a" label="Row A">
          A
          <Item.Handle aria-label="Move A" />
        </Item>
      </Layout>,
    );

    const handle = container.querySelector("[data-rewap-handle]");
    // Passing `aria-label` to a component that renders a button is an easy mistake
    // to make, and silently losing it is the worst possible answer to it.
    expect(handle?.getAttribute("aria-label")).toBe("Move A");
  });

  it("hides a decorative handle from assistive technology", () => {
    const { container } = render(
      <Layout>
        <Item id="a" label="Row A">
          A
          <Item.Handle />
        </Item>
      </Layout>,
    );

    const handle = container.querySelector("[data-rewap-handle]");
    expect(handle?.getAttribute("aria-hidden")).toBe("true");
    expect(handle?.getAttribute("aria-label")).toBeNull();
  });

  it("keeps the handle out of the tab order, because the item is the target", () => {
    const { container } = render(
      <Layout>
        <Item id="a" label="Row A">
          A
          <Item.Handle label="Reorder" />
        </Item>
      </Layout>,
    );

    expect(
      container.querySelector<HTMLElement>("[data-rewap-handle]")?.tabIndex,
    ).toBe(-1);
    expect(
      container.querySelector<HTMLElement>('[data-rewap-item="a"]')?.tabIndex,
    ).toBe(0);
  });
});
