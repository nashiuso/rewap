/**
 * Test helpers.
 *
 * The important one is {@link installGeometry}: jsdom reports every rectangle as
 * zero-sized, so the suite installs a synthetic layout. Elements are positioned
 * from their `data-rewap-item` id using a simple flow rule, which lets the engine
 * be exercised end to end — measurement, collision, FLIP, order changes — without
 * a real browser.
 */

import { act, render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";

import type { GeometryProvider } from "../src/core/measure";
import { rect, translateRect, type Rect } from "../src/math/rect";

export interface GeometryOptions {
  /**
   * Item ids in flow order. A function is re-evaluated on every measurement,
   * which lets a test mirror the DOM order the way a real browser would.
   */
  ids: readonly string[] | (() => readonly string[]);
  /** Column count. `1` produces a vertical list. */
  columns?: number;
  cellWidth?: number;
  cellHeight?: number;
  gap?: number;
  origin?: { x: number; y: number };
}

const ORIGIN = { x: 0, y: 100 };

/** Rect of a synthetic item cell. */
export const cellRect = (index: number, options: GeometryOptions): Rect => {
  const columns = options.columns ?? 1;
  const cellWidth = options.cellWidth ?? 200;
  const cellHeight = options.cellHeight ?? 120;
  const gap = options.gap ?? 10;
  const origin = options.origin ?? ORIGIN;
  const column = index % columns;
  const row = Math.floor(index / columns);
  return rect(
    origin.x + column * (cellWidth + gap),
    origin.y + row * (cellHeight + gap),
    cellWidth,
    cellHeight,
  );
};

export interface InstalledGeometry {
  provider: GeometryProvider;
  /** Current order, so tests can re-describe the layout after a reorder. */
  layout(options: {
    ids: readonly string[];
    index?: (id: string) => number;
  }): void;
  restore(): void;
}

/**
 * Installs a geometry provider on `Element.prototype.getBoundingClientRect`.
 *
 * An element is positioned by its `data-rewap-item` attribute when present, by
 * `data-rewap-layout` for the container, and by its inline transform otherwise —
 * which is exactly what the drag engine needs to see.
 */
export const installGeometry = (
  options: GeometryOptions,
): InstalledGeometry => {
  const original = Element.prototype.getBoundingClientRect;
  let current = options;

  const idsNow = (): readonly string[] =>
    typeof current.ids === "function" ? current.ids() : current.ids;

  const rectsFor = (element: Element): Rect => {
    const ids = idsNow();
    const id = (element as HTMLElement).dataset?.rewapItem;
    if (id) {
      const index = ids.indexOf(id);
      if (index === -1) return rect(0, 0, 0, 0);
      const base = cellRect(index, current);
      const transform = (element as HTMLElement).style?.transform ?? "";
      const match = /translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(
        transform,
      );
      if (!match) return base;
      return translateRect(base, Number(match[1] ?? 0), Number(match[2] ?? 0));
    }
    if ((element as HTMLElement).dataset?.rewapLayout !== undefined) {
      const columns = current.columns ?? 1;
      const rows = Math.ceil(ids.length / columns);
      const cellWidth = current.cellWidth ?? 200;
      const cellHeight = current.cellHeight ?? 120;
      const gap = current.gap ?? 10;
      const origin = current.origin ?? ORIGIN;
      return rect(
        origin.x - gap,
        origin.y - gap,
        columns * cellWidth + (columns + 1) * gap,
        rows * cellHeight + (rows + 1) * gap,
      );
    }
    // Anything that is not part of the synthetic layout measures as zero-sized,
    // exactly like an unlaid-out element in a real browser.
    return rect(0, 0, 0, 0);
  };

  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    configurable: true,
    writable: true,
    value(this: Element) {
      return rectsFor(this);
    },
  });

  const provider: GeometryProvider = {
    measure: (element) => rectsFor(element),
    viewport: () => rect(0, 0, 1024, 768),
  };

  return {
    provider,
    layout(next) {
      current = { ...current, ids: next.ids };
    },
    restore() {
      Object.defineProperty(Element.prototype, "getBoundingClientRect", {
        configurable: true,
        writable: true,
        value: original,
      });
    },
  };
};

/** Renders inside `act` and lets layout effects settle. */
export const renderLayout = async (ui: ReactElement): Promise<RenderResult> => {
  let result!: RenderResult;
  await act(async () => {
    result = render(ui);
  });
  return result;
};

/** Runs a frame of the shared ticker, then flushes React. */
export const advanceFrame = async (steps = 1, deltaMs = 16): Promise<void> => {
  const { ticker } = await import("../src/motion/ticker");
  for (let step = 0; step < steps; step += 1) {
    await act(async () => {
      ticker.tick(performance.now() + (step + 1) * deltaMs);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

export interface PointerLike {
  pointerId?: number;
  clientX: number;
  clientY: number;
  button?: number;
  pointerType?: string;
}

/** Dispatches a pointer event with the fields the engine reads. */
export const pointerEvent = (type: string, init: PointerLike): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  // `timeStamp` is getter-only on Event, so it has to be defined, not assigned.
  Object.defineProperty(event, "timeStamp", {
    value: performance.now(),
    configurable: true,
  });
  Object.assign(event, {
    pointerId: init.pointerId ?? 1,
    clientX: init.clientX,
    clientY: init.clientY,
    button: init.button ?? 0,
    buttons: 1,
    pointerType: init.pointerType ?? "mouse",
    isPrimary: true,
  });
  return event;
};

export const firePointer = (
  target: Element | Window,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  init: PointerLike,
): void => {
  target.dispatchEvent(pointerEvent(type, init));
};

/** Center of the synthetic cell at `index`. */
export const slotCenter = (
  index: number,
  options: GeometryOptions,
): { x: number; y: number } => {
  const cell = cellRect(index, options);
  return { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 };
};

export interface DragPointerOptions {
  /** Element the pointer goes down on. */
  from: Element;
  fromPoint: { x: number; y: number };
  toPoint: { x: number; y: number };
  /** Number of intermediate moves. */
  steps?: number;
  framesPerStep?: number;
  pointerType?: string;
  /** Set to false to leave the gesture open (assertions during the drag). */
  release?: boolean;
  button?: number;
}

/**
 * Drives a full pointer drag: down on `from`, interpolated moves on `window`
 * (which is where the layout listens once a gesture is in flight), then up.
 */
export const dragPointer = async (
  options: DragPointerOptions,
): Promise<void> => {
  const {
    from,
    fromPoint,
    toPoint,
    steps = 4,
    framesPerStep = 2,
    pointerType = "mouse",
    release = true,
    button = 0,
  } = options;

  await act(async () => {
    firePointer(from, "pointerdown", {
      clientX: fromPoint.x,
      clientY: fromPoint.y,
      pointerType,
      button,
    });
  });

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    await act(async () => {
      firePointer(window, "pointermove", {
        clientX: fromPoint.x + (toPoint.x - fromPoint.x) * t,
        clientY: fromPoint.y + (toPoint.y - fromPoint.y) * t,
        pointerType,
      });
    });
    await advanceFrame(framesPerStep);
  }

  if (release) {
    await act(async () => {
      firePointer(window, "pointerup", {
        clientX: toPoint.x,
        clientY: toPoint.y,
        pointerType,
      });
    });
    await advanceFrame(20);
  }
};

export const keyEvent = (
  type: "keydown" | "keyup",
  init: {
    key: string;
    shiftKey?: boolean;
    metaKey?: boolean;
    ctrlKey?: boolean;
  },
): Event => {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key: init.key,
    shiftKey: init.shiftKey ?? false,
    metaKey: init.metaKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
  });
  return event;
};
