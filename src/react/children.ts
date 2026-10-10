/**
 * Child handling.
 *
 * `<Layout>` renders its children; to reorder them it has to know which child is
 * which. Any child element carrying a string `id` prop is treated as an item, so
 * both `<Item id="a" />` and a custom wrapper around it work. Children without an
 * `id` keep their authored position and are simply left where they are.
 *
 * Item elements are re-keyed by their id (`cloneElement` with `key={id}`) so React
 * really moves the DOM nodes instead of re-rendering them positionally — that is
 * what preserves component state across a swap.
 */

import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import type { ItemId } from "../core/types";

const readId = (child: ReactNode): ItemId | null => {
  if (!isValidElement(child)) return null;
  const props = child.props as { id?: unknown };
  return typeof props.id === "string" && props.id.length > 0 ? props.id : null;
};

export interface ChildEntry {
  child: ReactNode;
  id: ItemId | null;
  /** Position in the authored child list. */
  index: number;
}

/**
 * Fragments are transparent: `<Layout>{items}</Layout>` renders exactly what
 * `<Layout>{item}{item}</Layout>` renders, so the two spellings behave the same
 * (including conditional groups and `.map()` results).
 */
const flattenChildren = (nodes: ReactNode, out: ReactNode[]): void => {
  // `Children.forEach` keeps the original elements (and their keys) intact,
  // unlike `Children.toArray`, which rewrites keys positionally.
  Children.forEach(nodes, (child) => {
    if (isValidElement(child) && child.type === Fragment) {
      flattenChildren((child.props as { children?: ReactNode }).children, out);
      return;
    }
    out.push(child);
  });
};

export const childEntries = (children: ReactNode): ChildEntry[] => {
  const flat: ReactNode[] = [];
  flattenChildren(children, flat);
  return flat.map((child, index) => ({ child, id: readId(child), index }));
};

/** Ids of the item children, in authored order, without duplicates. */
export const idsFromChildren = (children: ReactNode): ItemId[] => {
  const seen = new Set<ItemId>();
  const ids: ItemId[] = [];
  for (const entry of childEntries(children)) {
    if (entry.id !== null && !seen.has(entry.id)) {
      seen.add(entry.id);
      ids.push(entry.id);
    }
  }
  return ids;
};

/**
 * Renders children in `order`.
 *
 * Items fill the positions that items occupy in the authored tree, in the
 * requested order; non-item children stay exactly where they were authored.
 * Unknown or duplicated ids fall back to the authored position, so a layout can
 * never silently drop a child.
 */
export const orderChildren = (
  children: ReactNode,
  order: readonly ItemId[],
): ReactNode[] => {
  const entries = childEntries(children);
  if (entries.length === 0) return [];

  const byId = new Map<ItemId, ReactElement>();
  const duplicated = new Set<ItemId>();
  for (const entry of entries) {
    if (entry.id === null) continue;
    if (byId.has(entry.id)) {
      duplicated.add(entry.id);
      continue;
    }
    byId.set(entry.id, entry.child as ReactElement);
  }

  const sortedIds: ItemId[] = [];
  const placed = new Set<ItemId>();
  for (const id of order) {
    if (byId.has(id) && !placed.has(id)) {
      placed.add(id);
      sortedIds.push(id);
    }
  }
  for (const entry of entries) {
    if (entry.id === null || placed.has(entry.id) || duplicated.has(entry.id))
      continue;
    placed.add(entry.id);
    sortedIds.push(entry.id);
  }

  const result: ReactNode[] = entries.map((entry) => entry.child);
  const itemPositions = entries
    .map((entry, index) =>
      entry.id !== null && !duplicated.has(entry.id) ? index : -1,
    )
    .filter((index) => index >= 0);

  itemPositions.forEach((position, index) => {
    const id = sortedIds[index];
    if (id === undefined) return;
    const element = byId.get(id);
    if (!element) return;
    // Re-key by id so React moves the node instead of reconciling by position.
    result[position] =
      element.key === id ? element : cloneElement(element, { key: id });
  });

  return result.map((child, index) => {
    if (!isValidElement(child) || child.key !== null) return child;
    return cloneElement(child, { key: `rw-child-${index}` });
  });
};

/** True when every child that could be an item already has an id. */
export const allChildrenIdentified = (children: ReactNode): boolean =>
  childEntries(children).every((entry) => entry.id !== null);

/** Duplicate ids found in the child list; useful for development warnings. */
export const duplicateIds = (children: ReactNode): ItemId[] => {
  const seen = new Set<ItemId>();
  const duplicates = new Set<ItemId>();
  for (const entry of childEntries(children)) {
    if (entry.id === null) continue;
    if (seen.has(entry.id)) duplicates.add(entry.id);
    else seen.add(entry.id);
  }
  return [...duplicates];
};
