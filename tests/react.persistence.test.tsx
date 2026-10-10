/**
 * Persistence in the React layer.
 *
 * The storage module itself is covered by `core.persistence.test.ts`. What is
 * worth testing here is the interaction with React: when the layout hydrates,
 * when it writes, and what happens when the order is controlled by the
 * application (in which case the layout must not fight it).
 */

import { fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Item } from "../src/react/Item";
import { Layout } from "../src/react/Layout";
import { memoryStorage, type PersistedLayout } from "../src/core/persistence";
import {
  dragPointer,
  installGeometry,
  slotCenter,
  type InstalledGeometry,
} from "./helpers";

const CELLS = {
  ids: ["a", "b", "c"],
  columns: 1,
  cellWidth: 200,
  cellHeight: 120,
  gap: 10,
};
const KEY = "rewap:test";

let geometry: InstalledGeometry;

const idsInDom = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>("[data-rewap-item]")].map(
    (element) => element.dataset.rewapItem ?? "",
  );

const write = (
  storage: Storage,
  ids: string[],
  mode: "swap" | "reorder" = "swap",
): void => {
  storage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      mode,
      ids,
      savedAt: Date.now(),
    } satisfies PersistedLayout),
  );
};

beforeEach(() => {
  geometry = installGeometry(CELLS);
});

afterEach(() => {
  geometry.restore();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const Board = ({ storage }: { storage?: Storage }) => (
  <Layout persistence={{ key: KEY, ...(storage ? { storage } : {}) }}>
    <Item id="a">A</Item>
    <Item id="b">B</Item>
    <Item id="c">C</Item>
  </Layout>
);

describe("persistence", () => {
  it("restores the stored order on mount", async () => {
    write(window.localStorage, ["c", "b", "a"]);
    const { container } = render(<Board />);

    await waitFor(() => expect(idsInDom(container)).toEqual(["c", "b", "a"]));
  });

  it("ignores stored ids that no longer exist", async () => {
    write(window.localStorage, ["c", "gone", "a"]);
    const { container } = render(<Board />);

    await waitFor(() => expect(idsInDom(container)).toEqual(["c", "a", "b"]));
  });

  it("writes the order after a drag", async () => {
    const { container } = render(<Board />);
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));

    await dragPointer({
      from: container.querySelector("[data-rewap-item='a']") as HTMLElement,
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(1, CELLS),
    });

    await waitFor(() => {
      const raw = window.localStorage.getItem(KEY);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw as string).ids).toEqual(["b", "a", "c"]);
    });
  });

  it("writes the order after an undo", async () => {
    const { container } = render(<Board />);
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));

    await dragPointer({
      from: container.querySelector("[data-rewap-item='a']") as HTMLElement,
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(1, CELLS),
    });

    // Undo is driven through the keyboard so the test does not need a ref. The
    // shortcut is handled by the layout element, so it has to be dispatched from
    // inside it (React listens at the root, not on `document`).
    fireEvent.keyDown(
      container.querySelector("[data-rewap-layout]") as HTMLElement,
      {
        key: "z",
        metaKey: true,
      },
    );

    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));
    await waitFor(() =>
      expect(
        JSON.parse(window.localStorage.getItem(KEY) as string).ids,
      ).toEqual(["a", "b", "c"]),
    );
  });

  it("accepts a custom storage object", async () => {
    const storage = memoryStorage();
    write(storage as unknown as Storage, ["b", "a", "c"]);
    const { container } = render(
      <Board storage={storage as unknown as Storage} />,
    );

    await waitFor(() => expect(idsInDom(container)).toEqual(["b", "a", "c"]));
  });

  it("stays quiet when it is disabled", async () => {
    const { container } = render(
      <Layout persistence={{ key: KEY, enabled: false }}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>,
    );

    expect(idsInDom(container)).toEqual(["a", "b"]);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("does not overwrite stored data while the layout is controlled", async () => {
    write(window.localStorage, ["c", "b", "a"]);
    const onChange = vi.fn();

    const Controlled = () => {
      const [ids, setIds] = useState(["a", "b", "c"]);
      return (
        <Layout
          items={ids.map((id) => ({ id }))}
          onChange={(next) => {
            const order = next.map((item) =>
              typeof item === "string" ? item : item.id,
            );
            onChange(order);
            setIds(order);
          }}
          persistence={{ key: KEY }}
        >
          <Item id="a">A</Item>
          <Item id="b">B</Item>
          <Item id="c">C</Item>
        </Layout>
      );
    };

    const { container } = render(<Controlled />);

    // The controlled order wins over the stored one, and nothing is reported to
    // the application while it hydrates.
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));
    expect(onChange).not.toHaveBeenCalled();

    // The stored record is left alone: the application owns the order, so a
    // write here would clobber whatever it decided to keep.
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(KEY) as string).ids;
      expect(stored).toEqual(["c", "b", "a"]);
    });
  });

  it("re-hydrates when the key changes", async () => {
    window.localStorage.setItem(
      "rewap:other",
      JSON.stringify({
        version: 1,
        mode: "swap",
        ids: ["b", "c", "a"],
        savedAt: 0,
      }),
    );

    const TwoKeys = ({ keyName }: { keyName: string }) => (
      <Layout persistence={{ key: keyName }}>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>
    );

    const view = render(<TwoKeys keyName={KEY} />);
    await waitFor(() =>
      expect(idsInDom(view.container)).toEqual(["a", "b", "c"]),
    );

    view.rerender(<TwoKeys keyName="rewap:other" />);
    await waitFor(() =>
      expect(idsInDom(view.container)).toEqual(["b", "c", "a"]),
    );
  });
});
