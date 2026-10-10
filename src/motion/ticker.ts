/**
 * A single `requestAnimationFrame` loop shared by every animation in the library.
 *
 * One ticker instead of one loop per element keeps the library predictable on
 * low-end devices: subscribers are stored in a set, iterated without allocation,
 * and the loop stops itself as soon as the last subscriber unsubscribes.
 *
 * The ticker degrades gracefully: when `requestAnimationFrame` is unavailable
 * (older test environments, SSR-safe code paths) it falls back to a timer.
 */

import { now } from "../math/interpolate";

export type TickerCallback = (delta: number, timestamp: number) => void;

export interface Unsubscribe {
  (): void;
}

export interface Ticker {
  subscribe(callback: TickerCallback): Unsubscribe;
  readonly size: number;
  readonly running: boolean;
  /** Advances the loop manually — used by tests with fake clocks. */
  tick(timestamp?: number): void;
  start(): void;
  stop(): void;
}

const raf: ((callback: (time: number) => void) => number) | null =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame.bind(globalThis)
    : null;

const caf: ((handle: number) => void) | null =
  typeof cancelAnimationFrame === "function"
    ? cancelAnimationFrame.bind(globalThis)
    : null;

export const createTicker = (
  options: { fallbackInterval?: number } = {},
): Ticker => {
  const callbacks = new Set<TickerCallback>();
  const interval = options.fallbackInterval ?? 16;
  let handle: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = 0;

  const notify = (timestamp: number): void => {
    const delta = last === 0 ? 0 : (timestamp - last) / 1000;
    last = timestamp;
    // Copy-free iteration: callbacks may unsubscribe during the loop, which the
    // Set iterator handles safely.
    for (const callback of callbacks) callback(delta, timestamp);
  };

  const frame = (timestamp: number): void => {
    handle = null;
    if (callbacks.size === 0) {
      stop();
      return;
    }
    notify(timestamp);
    schedule();
  };

  const schedule = (): void => {
    if (callbacks.size === 0) return;
    if (raf) {
      if (handle === null) handle = raf(frame);
      return;
    }
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      frame(now());
    }, interval);
  };

  const start = (): void => {
    if (handle !== null || timer !== null || callbacks.size === 0) return;
    last = 0;
    schedule();
  };

  const stop = (): void => {
    if (handle !== null && caf) caf(handle);
    handle = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    last = 0;
  };

  return {
    subscribe(callback) {
      callbacks.add(callback);
      start();
      return () => {
        callbacks.delete(callback);
        if (callbacks.size === 0) stop();
      };
    },
    get size() {
      return callbacks.size;
    },
    get running() {
      return handle !== null || timer !== null;
    },
    tick(timestamp = now()) {
      notify(timestamp);
    },
    start,
    stop,
  };
};

/** Process-wide ticker used by the layout animations. */
export const ticker = createTicker();
