/**
 * Local persistence.
 *
 * Orders are stored in `localStorage`, `sessionStorage` or any object that
 * implements `Storage`. Nothing is ever sent to a server: when storage is
 * unavailable (private mode, disabled cookies, server rendering) the helpers
 * degrade to in-memory no-ops instead of throwing.
 */

import type { ItemId, LayoutMode } from "./types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageKind = "localStorage" | "sessionStorage" | "memory";

export const memoryStorage = (): StorageLike => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
};

export const resolveStorage = (kind: StorageKind = "localStorage"): StorageLike => {
  if (kind === "memory") return memoryStorage();
  if (typeof window === "undefined") return memoryStorage();
  try {
    const storage = kind === "sessionStorage" ? window.sessionStorage : window.localStorage;
    // Access alone can throw in restricted contexts; probe with a write.
    const probe = "__rewap_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return memoryStorage();
  }
};

/** The serialized layout state. `version` guards against format changes. */
export interface PersistedLayout {
  version: 1;
  mode: LayoutMode;
  ids: ItemId[];
  /** Epoch milliseconds of the last write; informational. */
  savedAt: number;
}

export interface PersistenceOptions {
  key: string;
  storage?: StorageKind | StorageLike;
  mode?: LayoutMode;
}

export interface Persistence {
  load(): PersistedLayout | null;
  save(ids: readonly ItemId[]): void;
  clear(): void;
  readonly key: string;
  readonly kind: StorageKind;
}

const isStorageLike = (value: unknown): value is StorageLike =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as StorageLike).getItem === "function" &&
  typeof (value as StorageLike).setItem === "function";

const isPersistedLayout = (value: unknown): value is PersistedLayout => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PersistedLayout>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.ids) &&
    candidate.ids.every((id) => typeof id === "string")
  );
};

export const createPersistence = (options: PersistenceOptions): Persistence => {
  const kind: StorageKind = isStorageLike(options.storage) ? "memory" : (options.storage ?? "localStorage");
  const storage = isStorageLike(options.storage) ? options.storage : resolveStorage(kind);

  return {
    key: options.key,
    kind,
    load() {
      try {
        const raw = storage.getItem(options.key);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isPersistedLayout(parsed)) return null;
        return parsed;
      } catch {
        // Corrupt or unreadable payloads are ignored, never fatal.
        return null;
      }
    },
    save(ids) {
      try {
        const payload: PersistedLayout = {
          version: 1,
          mode: options.mode ?? "swap",
          ids: [...ids],
          savedAt: Date.now(),
        };
        storage.setItem(options.key, JSON.stringify(payload));
      } catch {
        // Quota exceeded or storage disabled: the layout keeps working in memory.
      }
    },
    clear() {
      try {
        storage.removeItem(options.key);
      } catch {
        // ignored on purpose
      }
    },
  };
};

/**
 * Applies a stored order to a live order, dropping unknown ids and appending new
 * ones at the end so a stored layout never hides items the developer added later.
 */
export const applyStoredOrder = (stored: readonly ItemId[], available: readonly ItemId[]): ItemId[] => {
  const availableSet = new Set(available);
  const kept = stored.filter((id) => availableSet.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...available.filter((id) => !keptSet.has(id))];
};
