/**
 * `createRewap()` — the interaction engine without React.
 *
 * This is the same model the React bindings use: an order, a history of that
 * order, and an optional local persistence record. It exists because the engine
 * was never React-shaped in the first place — order operations, history and
 * storage are plain data — and because a headless instance is the honest way to
 * prove that. Vue, Svelte or a plain script can drive a layout with it; the React
 * package is a binding over this, not the other way around.
 *
 * What it deliberately does not do: measure, animate, render or detect
 * collisions. Those need a document, and this file must run on a server, in a
 * worker and in a test runner without one.
 *
 * ```ts
 * const layout = createRewap({ ids: ["a", "b", "c"], mode: "reorder" });
 * layout.subscribe(() => console.log(layout.ids()));
 * layout.move("c", 0);        // ["c", "a", "b"]
 * layout.undo();              // ["a", "b", "c"]
 * layout.destroy();
 * ```
 */

import {
  createPersistence,
  type Persistence,
  type PersistedLayout,
} from "./persistence";
import { idsEqual, moveId, reconcileIds, swapIds } from "./order";
import { createHistory, type History } from "./store";
import type { ItemId, LayoutChangeEvent, LayoutMode, SwapEvent } from "./types";
import type { StorageKind, StorageLike } from "./persistence";

/**
 * Storage configuration for the headless instance.
 *
 * Deliberately narrower than the React binding's: no `mode` field, because a
 * headless instance already knows its mode and does not need the stored record
 * to disagree with it.
 */
export interface RewapPersistenceConfig {
  key: string;
  storage?: StorageKind | StorageLike;
  enabled?: boolean;
}

export interface RewapOptions {
  /** Initial order. */
  ids?: readonly ItemId[];
  /** `swap` exchanges two items, `reorder` shifts a range, `grid` moves freely. */
  mode?: LayoutMode;
  /** Undo/redo. `true` (the default) keeps 50 steps. */
  history?: boolean | { enabled?: boolean; limit?: number };
  /** Reads a stored order on creation and writes on every change. Storage only. */
  persistence?: boolean | RewapPersistenceConfig;
  /** Called with the new order whenever it changes for any reason. */
  onChange?: (ids: ItemId[], event: LayoutChangeEvent) => void;
}

export interface RewapInstance {
  /** The current order. */
  ids(): ItemId[];
  mode(): LayoutMode;
  /** Called after every accepted change, and by `notify()`. */
  subscribe(listener: () => void): () => void;
  /** Moves an item to an index, following the mode. Returns `false` if nothing changed. */
  move(id: ItemId, index: number): boolean;
  /** Exchanges two items. Returns `false` if the ids are unknown or equal. */
  swap(a: ItemId, b: ItemId): boolean;
  /** Replaces the whole order, recording one history step. */
  setOrder(ids: readonly ItemId[], source?: LayoutChangeEvent["source"]): void;
  /** Adds ids that were not present and drops ids that are gone. Does not record history. */
  reconcile(ids: readonly ItemId[]): void;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): ItemId[] | null;
  redo(): ItemId[] | null;
  reset(): ItemId[];
  /** Clears stored data and detaches every listener. */
  destroy(): void;
}

const normalizeHistory = (
  value: RewapOptions["history"],
): { enabled: boolean; limit: number } => {
  if (value === false) return { enabled: false, limit: 50 };
  if (value === true || value === undefined)
    return { enabled: true, limit: 50 };
  return { enabled: value.enabled ?? true, limit: value.limit ?? 50 };
};

const normalizePersistence = (
  value: RewapOptions["persistence"],
): Persistence | null => {
  if (!value) return null;
  const config = value === true ? null : value;
  // A boolean `true` has no key to write under, so it can only read: there is no
  // storage key to invent and inventing one would collide between layouts.
  if (!config || !config.key) return null;
  return createPersistence({ key: config.key, storage: config.storage });
};

export const createRewap = (options: RewapOptions = {}): RewapInstance => {
  const mode = options.mode ?? "swap";
  const historyOptions = normalizeHistory(options.history);
  const persistence = normalizePersistence(options.persistence);
  const listeners = new Set<() => void>();

  const stored: PersistedLayout | null = persistence?.load() ?? null;
  const initial = stored
    ? reconcileIds(stored.ids, options.ids ?? []).ids
    : [...(options.ids ?? [])];

  let current: ItemId[] = initial;
  const history: History<ItemId[]> | null = historyOptions.enabled
    ? createHistory<ItemId[]>(initial, {
        limit: historyOptions.limit,
        equals: idsEqual,
      })
    : null;

  const isControlledByHistory = history !== null;
  let listening = true;

  const emit = (event: LayoutChangeEvent): void => {
    options.onChange?.([...current], event);
  };

  const commit = (
    next: ItemId[],
    event: LayoutChangeEvent,
    record = true,
  ): boolean => {
    if (idsEqual(current, next)) {
      emit(event);
      return false;
    }
    current = next;
    if (record && history) history.push(next);
    persistence?.save(next);
    emit(event);
    for (const listener of [...listeners]) listener();
    return true;
  };

  return {
    ids: () => [...current],
    mode: () => mode,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    move(id, index) {
      const from = current.indexOf(id);
      if (from === -1) return false;
      const bounded = Math.max(
        0,
        Math.min(current.length - 1, Math.floor(index)),
      );
      if (bounded === from) return false;
      const next = orderAfterMove(current, id, bounded, mode);
      const event: LayoutChangeEvent = {
        ids: next,
        source: "programmatic",
        swap: swapEventFor(id, from, bounded, mode),
      };
      return commit(next, event);
    },
    swap(a, b) {
      if (a === b) return false;
      if (!current.includes(a) || !current.includes(b)) return false;
      const next = swapIds(current, a, b);
      const from = current.indexOf(a);
      const to = current.indexOf(b);
      const event: LayoutChangeEvent = {
        ids: next,
        source: "programmatic",
        swap: swapEventFor(a, from, to, "swap"),
      };
      return commit(next, event);
    },
    setOrder(ids, source = "programmatic") {
      const next = [...ids];
      commit(next, { ids: next, source });
    },
    reconcile(ids) {
      const next = reconcileIds(current, ids).ids;
      if (idsEqual(current, next)) return;
      current = next;
      history?.replace(next);
      for (const listener of [...listeners]) listener();
    },
    canUndo: () => isControlledByHistory && (history?.canUndo() ?? false),
    canRedo: () => isControlledByHistory && (history?.canRedo() ?? false),
    undo() {
      const previous = history?.undo();
      if (!previous) return null;
      commit(previous, { ids: previous, source: "history" }, false);
      return [...previous];
    },
    redo() {
      const next = history?.redo();
      if (!next) return null;
      commit(next, { ids: next, source: "history" }, false);
      return [...next];
    },
    reset() {
      const first = history?.reset() ?? initial;
      commit(first, { ids: first, source: "history" }, false);
      return [...first];
    },
    destroy() {
      if (!listening) return;
      listening = false;
      listeners.clear();
    },
  };
};

/** The mode decides what "move to index" means; the shared helper is in `order.ts`. */
const orderAfterMove = (
  ids: readonly ItemId[],
  id: ItemId,
  to: number,
  mode: LayoutMode,
): ItemId[] =>
  mode === "swap" ? swapIds(ids, id, ids[to] ?? id) : moveId(ids, id, to);

/**
 * Slots do not exist here — there is no measurement in a headless instance — so
 * the event carries the indices it can honestly stand behind and leaves the
 * rectangles empty. The React binding fills these in from real geometry.
 */
const emptySlot = (index: number, column: number, row: number) => ({
  index,
  column,
  row,
  rect: { x: 0, y: 0, width: 0, height: 0 },
});

const swapEventFor = (
  item: ItemId,
  from: number,
  to: number,
  mode: LayoutMode,
): SwapEvent => ({
  item,
  previousSlot: emptySlot(from, from, 0),
  nextSlot: emptySlot(to, to, 0),
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  mode,
  source: "programmatic",
});
