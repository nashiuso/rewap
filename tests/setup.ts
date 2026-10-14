// Node 26 Web Storage polyfill
// Node 25+ defines a global `localStorage` accessor that returns `undefined`
// unless the process was started with --localstorage-file. Vitest's jsdom
// environment refuses to overwrite keys the runtime already defines, so in
// the jsdom environment that stub shadows jsdom's real Storage and every
// `localStorage.getItem(...)` throws "Cannot read properties of undefined".
// Install a real in-memory Storage when the global resolves to nothing,
// before any test module reads it. Guarded so Node < 26 and any future
// runtime that provides a working Storage keep jsdom's own implementation.
if (typeof (globalThis as any).localStorage === "undefined") {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(String(k)) ?? null,
    setItem: (k: string, v: string) => void store.set(String(k), String(v)),
    removeItem: (k: string) => void store.delete(String(k)),
    clear: () => store.clear(),
  };
  for (const target of [globalThis, (globalThis as any).window].filter(
    Boolean,
  )) {
    Object.defineProperty(target, "localStorage", {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}

/**
 * Test environment.
 *
 * jsdom implements neither layout, nor `ResizeObserver`, nor pointer capture, so
 * the tests supply exactly those pieces. Everything else — events, focus, DOM
 * mutation — is the real thing.
 */

import { afterEach, vi } from "vitest";

// --------------------------------------------------------------------- matchMedia
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// ----------------------------------------------------------------- ResizeObserver
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

// --------------------------------------------------------------- pointer capture
if (typeof Element !== "undefined") {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function setPointerCapture() {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture =
      function releasePointerCapture() {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function hasPointerCapture() {
      return false;
    };
  }
}

// ------------------------------------------------------------------------ cleanup
// `@testing-library/react` is imported lazily: the SSR suite runs in the node
// environment, where there is no document to clean up and simply importing the
// testing library would be a lie about what is available.
afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
  vi.useRealTimers();
});

// Silence the library's development warnings unless a test asserts on them.
vi.spyOn(console, "warn").mockImplementation(() => {});
