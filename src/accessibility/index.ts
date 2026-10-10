/**
 * Accessibility helpers.
 *
 * Two things live here, both framework-agnostic:
 *
 * 1. {@link createAnnouncer} — an ARIA live region that exists exactly as long as
 *    it is needed and is inserted into the DOM on demand, so an application that
 *    never drags anything never grows an extra node.
 * 2. Keyboard grammar shared by the React bindings: which key does what, and how
 *    to describe it in `aria-keyshortcuts` and in screen-reader instructions.
 */

import type { Direction } from "../core/keyboard";
import type { InputSource } from "../core/types";

export type AnnouncementPriority = "polite" | "assertive";

export interface Announcer {
  announce(message: string, priority?: AnnouncementPriority): void;
  /** Removes the live region from the DOM. */
  destroy(): void;
  /** The live region element, if it currently exists. */
  element(): HTMLElement | null;
}

const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: "0",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: "0",
} as const;

/**
 * Creates (or reuses) a live region on `document.body`.
 *
 * Messages are written into different nodes for `polite` and `assertive` so a
 * polite message is never swallowed by an assertive one that arrives right after.
 */
export const createAnnouncer = (doc: Document = document): Announcer => {
  let polite: HTMLElement | null = null;
  let assertive: HTMLElement | null = null;

  const ensure = (priority: AnnouncementPriority): HTMLElement => {
    const existing = priority === "polite" ? polite : assertive;
    if (existing && existing.isConnected) return existing;
    const node = doc.createElement("div");
    node.setAttribute("role", priority === "assertive" ? "alert" : "status");
    node.setAttribute("aria-live", priority);
    node.setAttribute("aria-atomic", "true");
    node.setAttribute("data-rewap-announcer", priority);
    Object.assign(node.style, visuallyHidden);
    doc.body.appendChild(node);
    if (priority === "polite") polite = node;
    else assertive = node;
    return node;
  };

  return {
    announce(message, priority = "polite") {
      if (!message) return;
      const node = ensure(priority);
      // Clearing first guarantees a change event even when the message repeats.
      node.textContent = "";
      node.textContent = message;
    },
    destroy() {
      polite?.remove();
      assertive?.remove();
      polite = null;
      assertive = null;
    },
    element() {
      return polite ?? assertive;
    },
  };
};

/** Keyboard interaction grammar, kept in one place so docs and code cannot drift. */
export interface KeyboardAction {
  keys: string[];
  description: string;
  group: "grab" | "move" | "commit" | "history" | "navigation";
}

export const keyboardActions: KeyboardAction[] = [
  {
    keys: ["Space", "Enter"],
    description: "Grab or release the focused item",
    group: "grab",
  },
  {
    keys: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"],
    description: "Move the grabbed item",
    group: "move",
  },
  {
    keys: ["Shift", "+", "Arrow"],
    description: "Move several slots at once",
    group: "move",
  },
  {
    keys: ["Home", "End"],
    description: "Move to the first or last slot",
    group: "move",
  },
  {
    keys: ["Escape"],
    description: "Cancel the drag and return the item",
    group: "commit",
  },
  {
    keys: ["Mod", "+", "Z"],
    description: "Undo the last layout change",
    group: "history",
  },
  {
    keys: ["Mod", "+", "Shift", "+", "Z"],
    description: "Redo the last undone change",
    group: "history",
  },
  {
    keys: ["Tab"],
    description: "Move focus between items",
    group: "navigation",
  },
];

/** `aria-keyshortcuts` value advertised on draggable items. */
export const ariaKeyShortcuts =
  "Space Enter Escape ArrowUp ArrowDown ArrowLeft ArrowRight Home End Control+Z Meta+Z";

export const directionFromKey = (key: string): Direction | null => {
  switch (key) {
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
};

export const isGrabKey = (key: string): boolean =>
  key === " " || key === "Spacebar" || key === "Enter";

export const isCancelKey = (key: string): boolean =>
  key === "Escape" || key === "Esc";

/**
 * The three facts an undo/redo shortcut needs. Both a native `KeyboardEvent` and
 * React's synthetic event satisfy this shape, so the helpers work wherever a key
 * press is handled.
 */
export interface KeyModifiers {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}

/** True when the event carries the platform's undo/redo modifier. */
export const isUndo = (event: KeyModifiers): boolean =>
  Boolean(
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z",
  );

export const isRedo = (event: KeyModifiers): boolean =>
  Boolean(
    (event.metaKey || event.ctrlKey) &&
    ((event.shiftKey && event.key.toLowerCase() === "z") ||
      event.key.toLowerCase() === "y"),
  );

/** Wording used in the item's `aria-describedby` help text. */
export const grabInstructions = (grabbed: boolean): string =>
  grabbed
    ? "Grabbed. Use the arrow keys to move, Space or Enter to drop, Escape to cancel."
    : "Press Space or Enter to grab this item, then use the arrow keys to move it.";

export interface DragStateDescriptionOptions {
  label: string;
  index: number;
  total: number;
  grabbed: boolean;
  source?: InputSource | null;
}

/** Sentence describing the current drag state, announced politely on changes. */
export const describeDragState = (
  options: DragStateDescriptionOptions,
): string => {
  const position = `position ${options.index + 1} of ${options.total}`;
  if (!options.grabbed) return `${options.label}, ${position}`;
  if (options.source === "keyboard")
    return `${options.label} grabbed, ${position}`;
  return `${options.label} grabbed, ${position}`;
};
