/**
 * React context shared by `Layout`, `Item` and the hooks.
 *
 * The context is intentionally small: it exposes the engine (no React state) and
 * a handful of stable callbacks. Item registration is kept in a ref-based
 * registry so registering an item never re-renders the layout.
 */

import { createContext, useContext } from "react";

import type { DragController, DragSnapshot } from "../core/drag";
import type { SlotCandidate } from "../core/types";
import type { EffectsOptions, ItemId, LayoutMode, PlaceholderStyle, Slot } from "../core/types";
import type { MotionValue } from "../motion/presets";
import type { Announcer } from "../accessibility";

export interface PlaceholderRenderInfo {
  item: ItemId;
  slot: Slot;
  mode: LayoutMode;
}

export interface ItemMeta {
  id: ItemId;
  label: string;
  element: HTMLElement | null;
  handleOnly: boolean;
  draggable: boolean;
  disabled: boolean;
}

export interface LayoutContextValue {
  mode: LayoutMode;
  /** Current committed order. */
  ids: ItemId[];
  /** Order rendered right now, including any live drag preview. */
  renderIds: ItemId[];
  controller: DragController;
  snapshot: DragSnapshot;
  /** Item id → meta, kept in a ref for O(1) lookups. */
  registry: Map<ItemId, ItemMeta>;
  registerItem(id: ItemId, meta: Omit<ItemMeta, "id">): () => void;
  updateItem(id: ItemId, patch: Partial<Omit<ItemMeta, "id">>): void;
  /** Measured slots, refreshed lazily by the layout. */
  slots(): SlotCandidate[];
  motion: MotionValue;
  effects: EffectsOptions;
  placeholder: PlaceholderStyle;
  renderPlaceholder?: (info: PlaceholderRenderInfo) => React.ReactNode;
  prefersReducedMotion: boolean;
  disabled: boolean;
  /** False when `keyboard={false}`: item-level shortcuts stay inert. */
  keyboardEnabled: boolean;
  announce(message: string, priority?: "polite" | "assertive"): void;
  announcer: Announcer | null;
  /** True while `id` is the active drag or the item being moved programmatically. */
  isActive(id: ItemId): boolean;
  /** Marks an item as the keyboard target so it can be visually highlighted. */
  focusId: ItemId | null;
  setFocusId(id: ItemId | null): void;
  /** History state, surfaced through `useLayout()`. */
  canUndo: boolean;
  canRedo: boolean;
  historyDepth: number;
  undo(): void;
  redo(): void;
  reset(): void;
  /** Moves an item to an index as if it had been dropped there. */
  moveItem(id: ItemId, index: number): boolean;
  /** Starts a keyboard drag on an item. */
  grab(id: ItemId): boolean;
}

export const LayoutContext = createContext<LayoutContextValue | null>(null);

export const useLayoutContext = (component = "useLayout"): LayoutContextValue => {
  const value = useContext(LayoutContext);
  if (!value) {
    throw new Error(`[@nashiuso/rewap] ${component} must be used inside a <Layout> component.`);
  }
  return value;
};

/**
 * Whether a `<Layout>` is mounted above this component.
 *
 * Named like a hook because it is one: it calls `useContext`, and a function that
 * does that cannot be called conditionally no matter what it is named.
 */
export const useHasLayoutContext = (): boolean => useContext(LayoutContext) !== null;
