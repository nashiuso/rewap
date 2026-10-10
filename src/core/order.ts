/**
 * Pure order operations.
 *
 * The layout keeps its state as a flat list of ids. Every drag resolves to one
 * of the functions below, which makes the interactive behaviour trivial to test
 * without a DOM: swap a pair, move one item to an index, or apply a committed
 * order.
 */

import type { ItemId } from "./types";

/**
 * Exchanges the positions of two ids.
 * Returns a copy; the input is never mutated.
 */
export const swapIds = (
  ids: readonly ItemId[],
  a: ItemId,
  b: ItemId,
): ItemId[] => {
  const next = [...ids];
  const indexA = next.indexOf(a);
  const indexB = next.indexOf(b);
  if (indexA === -1 || indexB === -1 || indexA === indexB) return next;
  const valueA = next[indexA] as ItemId;
  next[indexA] = next[indexB] as ItemId;
  next[indexB] = valueA;
  return next;
};

const clampIndex = (index: number, length: number): number =>
  index < 0 ? 0 : index > length - 1 ? Math.max(0, length - 1) : index;

/** Moves `id` to `to`, shifting the items in between. */
export const moveId = (
  ids: readonly ItemId[],
  id: ItemId,
  to: number,
): ItemId[] => {
  const from = ids.indexOf(id);
  if (from === -1) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(clampIndex(to, next.length + 1), 0, id);
  return next;
};

/** Removes `id` from the list. */
export const removeId = (ids: readonly ItemId[], id: ItemId): ItemId[] => {
  const index = ids.indexOf(id);
  if (index === -1) return [...ids];
  const next = [...ids];
  next.splice(index, 1);
  return next;
};

/** Inserts `id` at `index` when it is not present yet. */
export const insertId = (
  ids: readonly ItemId[],
  id: ItemId,
  index: number,
): ItemId[] => {
  if (ids.includes(id)) return moveId(ids, id, index);
  const next = [...ids];
  next.splice(clampIndex(index, next.length + 1), 0, id);
  return next;
};

/** Inserts new ids after `after` (or at the start) and drops the removed ones. */
export const reconcileIds = (
  ids: readonly ItemId[],
  available: readonly ItemId[],
): { ids: ItemId[]; added: ItemId[]; removed: ItemId[] } => {
  const availableSet = new Set(available);
  const kept = ids.filter((id) => availableSet.has(id));
  const keptSet = new Set(kept);
  const added = available.filter((id) => !keptSet.has(id));
  return {
    ids: [...kept, ...added],
    added,
    removed: ids.filter((id) => !availableSet.has(id)),
  };
};

export const idsEqual = (
  a: readonly ItemId[],
  b: readonly ItemId[],
): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
};

/**
 * The order produced by dropping the item at `from` onto `to`.
 *
 * For `swap` mode the two ids exchange positions; for `reorder`/`grid` mode the
 * dragged id is inserted at the target index and everything in between shifts.
 * Both branches are expressed with the functions above so callers can reason
 * about them independently.
 */
export const orderAfterDrop = (
  ids: readonly ItemId[],
  id: ItemId,
  from: number,
  to: number,
  mode: "swap" | "reorder",
): ItemId[] => {
  if (from === to) return [...ids];
  if (mode === "swap") {
    const target = ids[to];
    if (target === undefined) return [...ids];
    return swapIds(ids, id, target);
  }
  return moveId(ids, id, to);
};

/**
 * Reading-order insertion index for a pointer position along one axis.
 *
 * Walks the slot centers and counts how many sit before the pointer.
 *
 * NOTE(nashiuso): legacy. This was how `projection` collision worked before 1.1.1,
 * and it is the reason the placeholder used to jump to the neighbour as soon as a
 * drag started — the dragged slot is in that list, so every insertion came out one
 * short. The projection strategy counts boundaries instead now (see
 * `core/collision.ts`). Kept because it is exported and used by consumers; it is
 * not called anywhere in the library. It leaves in 1.2, where a deprecation
 * warning will be attached to it for one release before it goes.
 */
export const insertionIndexFromProjection = (
  centers: readonly number[],
  value: number,
): number => {
  let index = 0;
  for (const center of centers) {
    if (value > center) index += 1;
    else break;
  }
  return index;
};

/** Evenly spaced slot centers for `count` items with the given spacing. */
export const projectedCenters = (
  count: number,
  origin: number,
  size: number,
  gap: number,
): number[] => {
  const centers: number[] = [];
  for (let i = 0; i < count; i += 1)
    centers.push(origin + i * (size + gap) + size / 2);
  return centers;
};
