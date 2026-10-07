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
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// --------------------------------------------------------------- pointer capture
if (typeof Element !== "undefined") {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function setPointerCapture() {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function releasePointerCapture() {};
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
