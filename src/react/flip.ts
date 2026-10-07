/**
 * FLIP animation.
 *
 * First–Last–Invert–Play: measure, change the DOM, invert the difference with a
 * transform and animate that transform back to zero. This is what makes a swap
 * feel physical without the layout engine having to know any physics.
 *
 * The helper writes transforms imperatively (never through React state), so a
 * reorder with fifty items still costs one React commit and fifty cheap style
 * writes.
 */

import type { MotionPlan } from "../motion/presets";
import type { Ticker } from "../motion/ticker";
import type { Rect } from "../math/rect";
import { elementStateFor } from "./elementState";

export interface FlipOptions {
  plan: MotionPlan;
  ticker?: Ticker;
  /** Movement below this many pixels is ignored. */
  threshold?: number;
}

/**
 * Animates an element from its previous position to its current one.
 *
 * `previous` and `next` are viewport rectangles measured before and after the DOM
 * changed; only the delta is used, so scroll offsets cancel out.
 *
 * The animation goes through the element's {@link ElementStateController}, which
 * is the single writer of transforms: a FLIP that overlaps with a hover lift or a
 * drag therefore composes instead of overwriting. Returns a cancel function, or
 * `null` when there was nothing to animate.
 */
export const playFlip = (
  element: HTMLElement,
  previous: Rect,
  next: Rect,
  options: FlipOptions,
): (() => void) | null => {
  const dx = previous.x - next.x;
  const dy = previous.y - next.y;
  const threshold = options.threshold ?? 0.5;
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;

  const node = elementStateFor(element);

  // Instant motion still has to end at the resting state, otherwise the element
  // would keep the offset of a previous animation.
  if (options.plan.kind === "instant") {
    node.set({ x: 0, y: 0 });
    return null;
  }

  node.set({ x: dx, y: dy });
  const handle = node.animate({ x: 0, y: 0 }, options.plan, { ticker: options.ticker });
  return () => handle.cancel();
};

/** Size difference between two rects, used to animate scale during FLIP. */
export const flipScale = (previous: Rect, next: Rect): { x: number; y: number } => {
  if (previous.width === 0 || previous.height === 0) return { x: 1, y: 1 };
  return { x: next.width / previous.width, y: next.height / previous.height };
};

/** True when a rectangle moved or resized by more than `threshold` pixels. */
export const rectChanged = (a: Rect | undefined, b: Rect, threshold = 0.5): boolean => {
  if (!a) return true;
  return (
    Math.abs(a.x - b.x) > threshold ||
    Math.abs(a.y - b.y) > threshold ||
    Math.abs(a.width - b.width) > threshold ||
    Math.abs(a.height - b.height) > threshold
  );
};

/** Joins an id list into a stable key for change detection. */
export const orderKey = (ids: readonly string[]): string => ids.join("\u0000");
