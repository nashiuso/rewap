/**
 * History: undo, redo, reset and the depth counter.
 *
 * The important case is the one that used to be wrong: undoing after a session
 * that started from authored children, where the history was seeded before the
 * children existed. See `useLayoutEngine` — the history is now created on the
 * first render that knows the order.
 */

import { act, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Item } from "../src/react/Item";
import { Layout } from "../src/react/Layout";
import { useLayout, type LayoutController } from "../src/react/useLayout";
import {
  dragPointer,
  installGeometry,
  slotCenter,
  type InstalledGeometry,
} from "./helpers";

const CELLS = {
  ids: ["a", "b", "c", "d"],
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

const apiRef: { current: LayoutController | null } = { current: null };

const Probe = () => {
  apiRef.current = useLayout();
  return null;
};

beforeEach(() => {
  geometry = installGeometry(CELLS);
});

afterEach(() => {
  geometry.restore();
  apiRef.current = null;
});

const Board = ({
  children,
  history,
}: {
  children?: ReactNode;
  history?: boolean | { limit?: number };
}) => (
  <Layout {...(history !== undefined ? { history } : {})}>
    <Probe />
    {children ?? (
      <>
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
        <Item id="d">D</Item>
      </>
    )}
  </Layout>
);

describe("undo and redo", () => {
  it("walks back through several steps", async () => {
    const { container } = render(<Board />);
    await waitFor(() =>
      expect(apiRef.current?.ids).toEqual(["a", "b", "c", "d"]),
    );

    // `move()` follows the layout mode: in `swap` it exchanges the two items
    // rather than shifting the range in between.
    await act(async () => {
      apiRef.current?.move("a", 3);
    });
    await waitFor(() =>
      expect(idsInDom(container)).toEqual(["d", "b", "c", "a"]),
    );

    await act(async () => {
      apiRef.current?.move("b", 3);
    });
    await waitFor(() =>
      expect(idsInDom(container)).toEqual(["d", "a", "c", "b"]),
    );
    expect(apiRef.current?.canRedo).toBe(false);

    await act(async () => {
      apiRef.current?.undo();
    });
    await waitFor(() =>
      expect(idsInDom(container)).toEqual(["d", "b", "c", "a"]),
    );

    await act(async () => {
      apiRef.current?.undo();
    });
    await waitFor(() =>
      expect(idsInDom(container)).toEqual(["a", "b", "c", "d"]),
    );
    expect(apiRef.current?.canUndo).toBe(false);

    await act(async () => {
      apiRef.current?.redo();
      apiRef.current?.redo();
    });
    await waitFor(() =>
      expect(idsInDom(container)).toEqual(["d", "a", "c", "b"]),
    );
  });

  it("drops the redo trail when a new move arrives", async () => {
    const { container } = render(<Board />);
    await waitFor(() =>
      expect(apiRef.current?.ids).toEqual(["a", "b", "c", "d"]),
    );

    await act(async () => {
      apiRef.current?.move("a", 2);
    });
    await act(async () => {
      apiRef.current?.undo();
    });
    await waitFor(() => expect(apiRef.current?.canRedo).toBe(true));

    await act(async () => {
      apiRef.current?.move("d", 0);
    });
    expect(apiRef.current?.canRedo).toBe(false);
    expect(idsInDom(container)).toEqual(["d", "b", "c", "a"]);
  });

  it("keeps at most `limit` steps", async () => {
    render(<Board history={{ limit: 2 }} />);
    await waitFor(() =>
      expect(apiRef.current?.ids).toEqual(["a", "b", "c", "d"]),
    );

    for (const [id, index] of [
      ["a", 1],
      ["a", 2],
      ["a", 3],
    ] as const) {
      await act(async () => {
        apiRef.current?.move(id, index);
      });
    }

    expect(apiRef.current?.ids).toEqual(["b", "c", "d", "a"]);
    await act(async () => {
      apiRef.current?.undo();
    });
    // Only the last two states are kept; the first move is already gone.
    expect(apiRef.current?.ids).toEqual(["b", "c", "a", "d"]);
    await act(async () => {
      apiRef.current?.undo();
    });
    expect(apiRef.current?.ids).toEqual(["b", "a", "c", "d"]);
    expect(apiRef.current?.canUndo).toBe(false);
  });

  it("restores the order the layout started with", async () => {
    const { container } = render(
      <Layout>
        <Probe />
        <Item id="a">A</Item>
        <Item id="b">B</Item>
        <Item id="c">C</Item>
      </Layout>,
    );
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));

    await dragPointer({
      from: container.querySelector("[data-rewap-item='a']") as HTMLElement,
      fromPoint: slotCenter(0, CELLS),
      toPoint: slotCenter(2, CELLS),
    });
    await waitFor(() => expect(idsInDom(container)).toEqual(["c", "b", "a"]));

    // This is the case that used to blank the layout: the history had been
    // seeded with the empty order from the first render.
    await act(async () => {
      apiRef.current?.undo();
    });
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));
    expect(apiRef.current?.ids).toEqual(["a", "b", "c"]);

    await act(async () => {
      apiRef.current?.move("c", 0);
    });
    await act(async () => {
      apiRef.current?.reset();
    });
    await waitFor(() => expect(idsInDom(container)).toEqual(["a", "b", "c"]));
  });

  it("counts undos and redos on the history depth", async () => {
    render(<Board />);
    await waitFor(() =>
      expect(apiRef.current?.ids).toEqual(["a", "b", "c", "d"]),
    );

    await act(async () => {
      apiRef.current?.swap("a", "c");
    });
    expect(apiRef.current?.canUndo).toBe(true);
    expect(apiRef.current?.canRedo).toBe(false);

    await act(async () => {
      apiRef.current?.undo();
    });
    expect(apiRef.current?.canUndo).toBe(false);
    expect(apiRef.current?.canRedo).toBe(true);

    await act(async () => {
      apiRef.current?.reset();
    });
    expect(apiRef.current?.canUndo).toBe(false);
    expect(apiRef.current?.canRedo).toBe(false);
  });

  it("does nothing when history is turned off", async () => {
    const { container } = render(<Board history={false} />);
    await waitFor(() =>
      expect(apiRef.current?.ids).toEqual(["a", "b", "c", "d"]),
    );

    await act(async () => {
      apiRef.current?.move("a", 2);
    });
    await waitFor(() =>
      expect(idsInDom(container)).toEqual(["c", "b", "a", "d"]),
    );

    await act(async () => {
      apiRef.current?.undo();
    });
    expect(idsInDom(container)).toEqual(["c", "b", "a", "d"]);
    expect(apiRef.current?.canUndo).toBe(false);

    // `history={false}` also stops the keyboard shortcut, which shares the path.
    fireEvent.keyDown(
      container.querySelector("[data-rewap-layout]") as HTMLElement,
      {
        key: "z",
        metaKey: true,
      },
    );
    expect(idsInDom(container)).toEqual(["c", "b", "a", "d"]);
  });

  it("announces undo and redo through the live region", async () => {
    render(<Board />);
    await waitFor(() =>
      expect(apiRef.current?.ids).toEqual(["a", "b", "c", "d"]),
    );

    await act(async () => {
      apiRef.current?.move("a", 1);
    });
    await act(async () => {
      apiRef.current?.undo();
    });
    await waitFor(() =>
      expect(
        document.querySelector('[data-rewap-announcer="polite"]')?.textContent,
      ).toContain("Undo"),
    );

    await act(async () => {
      apiRef.current?.redo();
    });
    await waitFor(() =>
      expect(
        document.querySelector('[data-rewap-announcer="polite"]')?.textContent,
      ).toContain("Redo"),
    );
  });
});
