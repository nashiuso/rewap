/**
 * A minimal external store.
 *
 * The React bindings read layout state through `useSyncExternalStore`, which
 * requires a stable `getSnapshot` and a synchronous subscribe function. This
 * store provides exactly that, with batched notifications so a commit during a
 * layout effect cannot tear.
 */

export interface Store<T> {
  get(): T;
  set(value: T | ((previous: T) => T)): void;
  subscribe(listener: () => void): () => void;
  /** Listeners are notified on the next microtask instead of synchronously. */
  transact(update: () => void): void;
}

export interface StoreOptions<T> {
  /** Skip notification when the new value equals the previous one. */
  equals?: (a: T, b: T) => boolean;
}

export const createStore = <T>(initial: T, options: StoreOptions<T> = {}): Store<T> => {
  let value = initial;
  const listeners = new Set<() => void>();
  const equals = options.equals ?? Object.is;
  let depth = 0;
  let pending = false;

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const schedule = (): void => {
    if (depth > 0) {
      pending = true;
      return;
    }
    notify();
  };

  return {
    get: () => value,
    set(update) {
      const next = typeof update === "function" ? (update as (previous: T) => T)(value) : update;
      if (equals(value, next)) return;
      value = next;
      schedule();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    transact(update) {
      depth += 1;
      try {
        update();
      } finally {
        depth -= 1;
        if (depth === 0 && pending) {
          pending = false;
          notify();
        }
      }
    },
  };
};

/**
 * A store that keeps a history of its values.
 *
 * `push` records a new value (truncating the redo stack), `undo`/`redo` move
 * through the timeline and `reset` returns to the initial value. The history
 * limit drops the oldest entries first.
 */
export interface History<T> {
  present(): T;
  push(value: T): void;
  /** Replaces the current value without adding a history entry. */
  replace(value: T): void;
  undo(): T | undefined;
  redo(): T | undefined;
  reset(): T;
  canUndo(): boolean;
  canRedo(): boolean;
  readonly depth: number;
  readonly limit: number;
  clear(value?: T): void;
}

export interface HistoryOptions<T> {
  limit?: number;
  equals?: (a: T, b: T) => boolean;
}

export const createHistory = <T>(initial: T, options: HistoryOptions<T> = {}): History<T> => {
  const limit = Math.max(1, Math.floor(options.limit ?? 50));
  const equals = options.equals ?? Object.is;
  let start = initial;
  let past: T[] = [];
  let future: T[] = [];
  let current = initial;

  return {
    present: () => current,
    push(value) {
      if (equals(value, current)) return;
      past.push(current);
      if (past.length > limit) past = past.slice(past.length - limit);
      current = value;
      future = [];
    },
    replace(value) {
      current = value;
    },
    undo() {
      const previous = past.pop();
      if (previous === undefined) return undefined;
      future.push(current);
      if (future.length > limit) future = future.slice(future.length - limit);
      current = previous;
      return current;
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return undefined;
      past.push(current);
      if (past.length > limit) past = past.slice(past.length - limit);
      current = next;
      return current;
    },
    reset() {
      if (!equals(current, start)) {
        past.push(current);
        if (past.length > limit) past = past.slice(past.length - limit);
      }
      future = [];
      current = start;
      return current;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    get depth() {
      return past.length;
    },
    get limit() {
      return limit;
    },
    clear(value = start) {
      start = value;
      past = [];
      future = [];
      current = value;
    },
  };
};
