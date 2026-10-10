/**
 * Accessibility helpers — the framework-agnostic half.
 *
 * These are small enough that they look trivial. They are also the pieces that
 * screen-reader users depend on, so they get their own file rather than living as
 * two assertions inside a component test.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ariaKeyShortcuts,
  createAnnouncer,
  describeDragState,
  directionFromKey,
  grabInstructions,
  isCancelKey,
  isGrabKey,
  isRedo,
  isUndo,
  keyboardActions,
} from "../src/accessibility";

const region = (priority: "polite" | "assertive"): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-rewap-announcer="${priority}"]`);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createAnnouncer", () => {
  it("creates the live region on demand", () => {
    const announcer = createAnnouncer(document);
    expect(announcer.element()).toBeNull();

    announcer.announce("Item grabbed");
    const polite = region("polite");
    expect(polite).toBeTruthy();
    expect(polite?.getAttribute("role")).toBe("status");
    expect(polite?.getAttribute("aria-live")).toBe("polite");
    expect(polite?.getAttribute("aria-atomic")).toBe("true");
    expect(polite?.textContent).toBe("Item grabbed");
  });

  it("keeps polite and assertive messages in separate nodes", () => {
    const announcer = createAnnouncer(document);
    announcer.announce("moved to position 2", "polite");
    announcer.announce("grabbed", "assertive");

    expect(region("polite")?.textContent).toBe("moved to position 2");
    expect(region("assertive")?.textContent).toBe("grabbed");
    expect(region("assertive")?.getAttribute("role")).toBe("alert");
  });

  it("re-announces the same message", async () => {
    const announcer = createAnnouncer(document);
    announcer.announce("Drag cancelled");
    const node = region("polite") as HTMLElement;

    // Screen readers ignore a write that does not change the text, so the node is
    // cleared and written again. Two mutations, not one: a plain assignment would
    // arrive as a single record. MutationObserver delivers on a microtask.
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((list) => records.push(...list));
    observer.observe(node, { childList: true });

    announcer.announce("Drag cancelled");
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer.disconnect();

    expect(records).toHaveLength(2);
    expect(records[0]?.removedNodes).toHaveLength(1);
    expect(records[0]?.addedNodes).toHaveLength(0);
    expect(node.textContent).toBe("Drag cancelled");
  });

  it("ignores empty messages and reuses a region that is still connected", () => {
    const announcer = createAnnouncer(document);
    announcer.announce("");
    expect(announcer.element()).toBeNull();

    announcer.announce("first");
    const node = region("polite");
    announcer.announce("second");
    expect(region("polite")).toBe(node);
  });

  it("removes both regions on destroy", () => {
    const announcer = createAnnouncer(document);
    announcer.announce("a", "polite");
    announcer.announce("b", "assertive");

    announcer.destroy();
    expect(region("polite")).toBeNull();
    expect(region("assertive")).toBeNull();
    expect(announcer.element()).toBeNull();
  });

  it("creates a fresh region when the previous one was removed from the DOM", () => {
    const announcer = createAnnouncer(document);
    announcer.announce("first");
    region("polite")?.remove();

    announcer.announce("second");
    expect(region("polite")?.textContent).toBe("second");
  });
});

describe("keyboard grammar", () => {
  it("maps arrow keys and list jumps to directions", () => {
    expect(directionFromKey("ArrowLeft")).toBe("left");
    expect(directionFromKey("ArrowRight")).toBe("right");
    expect(directionFromKey("ArrowUp")).toBe("up");
    expect(directionFromKey("ArrowDown")).toBe("down");
    expect(directionFromKey("Home")).toBe("first");
    expect(directionFromKey("End")).toBe("last");
    expect(directionFromKey("PageDown")).toBeNull();
  });

  it("recognises the grab and cancel keys, including legacy names", () => {
    expect(isGrabKey(" ")).toBe(true);
    expect(isGrabKey("Spacebar")).toBe(true);
    expect(isGrabKey("Enter")).toBe(true);
    expect(isGrabKey("Tab")).toBe(false);

    expect(isCancelKey("Escape")).toBe(true);
    expect(isCancelKey("Esc")).toBe(true);
    expect(isCancelKey("Backspace")).toBe(false);
  });

  it("treats Ctrl and Meta as the same modifier", () => {
    expect(isUndo({ key: "z", metaKey: true })).toBe(true);
    expect(isUndo({ key: "Z", ctrlKey: true })).toBe(true);
    expect(isUndo({ key: "z", metaKey: true, shiftKey: true })).toBe(false);
    expect(isUndo({ key: "z" })).toBe(false);

    expect(isRedo({ key: "z", metaKey: true, shiftKey: true })).toBe(true);
    expect(isRedo({ key: "y", ctrlKey: true })).toBe(true);
    expect(isRedo({ key: "z", metaKey: true })).toBe(false);
  });

  it("advertises the shortcuts it actually handles", () => {
    // The list is public documentation as much as code, so it is worth a guard:
    // a shortcut that is handled but not announced is invisible to assistive tech.
    for (const key of [
      "Space",
      "Enter",
      "Escape",
      "ArrowUp",
      "Home",
      "End",
      "Control+Z",
      "Meta+Z",
    ]) {
      expect(ariaKeyShortcuts).toContain(key);
    }
    expect(keyboardActions.map((action) => action.group)).toEqual([
      "grab",
      "move",
      "move",
      "move",
      "commit",
      "history",
      "history",
      "navigation",
    ]);
  });

  it("writes different instructions depending on the drag state", () => {
    expect(grabInstructions(false)).toContain("Press Space or Enter");
    expect(grabInstructions(true)).toContain("Grabbed");
    expect(grabInstructions(true)).toContain("Escape to cancel");
  });

  it("describes the item and its position", () => {
    expect(
      describeDragState({ label: "Card", index: 0, total: 3, grabbed: false }),
    ).toBe("Card, position 1 of 3");
    expect(
      describeDragState({
        label: "Card",
        index: 2,
        total: 3,
        grabbed: true,
        source: "keyboard",
      }),
    ).toBe("Card grabbed, position 3 of 3");
  });
});

describe("announcements reach the document", () => {
  it("does not touch the DOM until something is announced", () => {
    const spy = vi.spyOn(document.body, "appendChild");
    createAnnouncer(document);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
