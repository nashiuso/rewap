/**
 * `useLayout()` — imperative access to the nearest layout.
 *
 * Returns a stable object; the values inside it are re-read from the layout on
 * every render, so it is safe to call from event handlers, effects and children
 * without memoisation gymnastics.
 */

import { useLayoutContext, type LayoutContextValue } from "./context";
import type { ItemId, LayoutMode, Slot } from "../core/types";
import type { LayoutChangeEvent, SwapEvent } from "../core/types";

export interface LayoutController {
  /** Committed order. */
  ids: ItemId[];
  /** Order currently rendered, including a live drag preview. */
  renderIds: ItemId[];
  mode: LayoutMode;
  /** Measured slots in the current order. */
  slots: Slot[];
  /** Item being dragged, or `null`. */
  activeId: ItemId | null;
  isDragging: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Moves an item to an index, as if it had been dropped there. */
  move(id: ItemId, index: number): boolean;
  /** Exchanges two items. */
  swap(a: ItemId, b: ItemId): boolean;
  /** Starts a keyboard-style drag on an item (focus is moved for you). */
  grab(id: ItemId): boolean;
  /** Commits the active drag. */
  release(): void;
  /** Cancels the active drag. */
  cancel(): void;
  undo(): void;
  redo(): void;
  reset(): void;
  /** Announces a message through the layout's live region. */
  announce(message: string, priority?: "polite" | "assertive"): void;
  /** The DOM element rendering an item, if it is mounted. */
  element(id: ItemId): HTMLElement | null;
  /** Scrolls an item into view. */
  scrollIntoView(id: ItemId, options?: ScrollIntoViewOptions): void;
}

export type { LayoutChangeEvent, SwapEvent };

export const useLayout = (): LayoutController => {
  const context = useLayoutContext("useLayout()");
  return buildLayoutController(context);
};

/**
 * Builds the imperative surface from a layout context. Used by `useLayout()` and
 * `controllerRef`.
 *
 * NOTE(nashiuso): this is a snapshot, not a live view. `canUndo`, `ids` and
 * `slots` are read from the context at the moment it is built, because the whole
 * point is that a consumer can hold the object and call methods on it. The cost is
 * that a component *outside* the layout has to re-read the fields after React
 * commits — the alternative (getters over a mutable engine) would make the object
 * lie about identity and break memoised props downstream. It is documented rather
 * than changed; `useLayout()` inside the layout has the live values.
 */
export const buildLayoutController = (context: LayoutContextValue): LayoutController => {
  const slots = context.slots();
  const ids = context.renderIds;
  const positionOf = (id: ItemId) => ids.indexOf(id);

  return {
    ids: context.ids,
    renderIds: context.renderIds,
    mode: context.mode,
    slots: slots.map((candidate) => candidate.slot),
    activeId: context.snapshot.activeId,
    isDragging: context.snapshot.status === "dragging" || context.snapshot.status === "settling",
    canUndo: context.canUndo,
    canRedo: context.canRedo,
    move: (id, index) => context.moveItem(id, index),
    swap: (a, b) => {
      const indexA = positionOf(a);
      const indexB = positionOf(b);
      if (indexA === -1 || indexB === -1) return false;
      return context.moveItem(a, indexB);
    },
    grab: (id) => context.grab(id),
    release: () => context.controller.drop(),
    cancel: () => context.controller.cancel("cancel"),
    undo: () => context.undo(),
    redo: () => context.redo(),
    reset: () => context.reset(),
    announce: (message, priority) => context.announce(message, priority),
    element: (id) => context.registry.get(id)?.element ?? null,
    scrollIntoView: (id, options) => {
      const element = context.registry.get(id)?.element;
      element?.scrollIntoView?.({ block: "nearest", inline: "nearest", ...options });
    },
  };
};
