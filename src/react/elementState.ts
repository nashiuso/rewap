/**
 * Per-element visual state.
 *
 * Drag, FLIP and hover effects all want to move the same element. Instead of
 * letting three writers fight over `style.transform`, every write goes through a
 * small controller that owns the element's {@link VisualState}:
 *
 * - `set()` writes channels immediately (drag, at most once per frame);
 * - `animate()` springs channels toward a target (FLIP, hover lift, drop-back);
 * - whichever call is newer owns the channel, so the last intention wins without
 *   ever leaving a stale transform behind.
 *
 * Controllers live in a `WeakMap` keyed by element, so unmounted elements are
 * collected with their state.
 *
 * DECISION(nashiuso): this is the only place in the library allowed to write
 * `style.transform`. Drag, FLIP, the placeholder and the hover effects all need to
 * move the same element, and two writers on one transform produce a fight that is
 * impossible to debug from a screenshot.
 */

import { animateVisualState, type AnimationHandle } from "../motion/animator";
import type { MotionPlan } from "../motion/presets";
import { ticker as defaultTicker, type Ticker } from "../motion/ticker";
import {
  applyVisualState,
  createVisualState,
  identityVisualState,
  type VisualState,
  type TransformOptions,
} from "../motion/transform";

export interface ElementStateController {
  readonly element: HTMLElement;
  /** Current state (a copy; mutating it has no effect). */
  current(): VisualState;
  /** Applies a patch immediately and cancels animations for those channels. */
  set(patch: Partial<VisualState>, transformOptions?: TransformOptions): void;
  /** Springs the given channels toward a target. Returns the animation handle. */
  animate(
    patch: Partial<VisualState>,
    plan: MotionPlan,
    options?: { onComplete?: () => void; ticker?: Ticker },
  ): AnimationHandle;
  /** Animates back to the element's resting state. */
  reset(plan: MotionPlan): AnimationHandle;
  /** Cancels animations and clears every property this module wrote. */
  clear(): void;
  /** True while an animation is running. */
  get animating(): boolean;
}

const registry = new WeakMap<HTMLElement, ElementStateController>();

export const createElementState = (
  element: HTMLElement,
  options: TransformOptions = {},
  ticker: Ticker = defaultTicker,
): ElementStateController => {
  let state: VisualState = createVisualState();
  let applied: VisualState = createVisualState();
  let animation: AnimationHandle | null = null;
  let animating = false;

  const write = (next: VisualState): void => {
    state = next;
    applyVisualState(element, state, applied, options);
    applied = { ...state };
  };

  const cancelAnimation = (): void => {
    animation?.cancel();
    animation = null;
    animating = false;
  };

  return {
    element,
    current: () => ({ ...state }),
    set(patch, transformOptions) {
      cancelAnimation();
      const merged: VisualState = { ...state, ...patch };
      if (transformOptions) {
        applyVisualState(element, merged, applied, {
          ...options,
          ...transformOptions,
        });
      } else {
        applyVisualState(element, merged, applied, options);
      }
      state = merged;
      applied = { ...merged };
    },
    animate(patch, plan, animateOptions = {}) {
      cancelAnimation();
      const from = { ...state };
      const to: VisualState = { ...state, ...patch };
      if (plan.kind === "instant") {
        write(to);
        animateOptions.onComplete?.();
        animation = null;
        return {
          cancel: () => {},
          finish: () => {},
          done: Promise.resolve(true),
          finished: true,
        };
      }
      animating = true;
      animation = animateVisualState({
        from,
        to,
        plan,
        ticker: animateOptions.ticker ?? ticker,
        onUpdate: (next) => write(next),
        onComplete: () => {
          write(to);
          animating = false;
          animation = null;
          animateOptions.onComplete?.();
        },
      });
      return animation;
    },
    reset(plan) {
      return this.animate(identityVisualState, plan);
    },
    clear() {
      cancelAnimation();
      write(createVisualState());
      element.style.transform = "";
      element.style.opacity = "";
      element.style.filter = "";
      element.style.boxShadow = "";
      applied = createVisualState();
    },
    get animating() {
      return animating;
    },
  };
};

/** Returns (creating when needed) the controller for an element. */
export const elementStateFor = (
  element: HTMLElement,
  options: TransformOptions = {},
  ticker: Ticker = defaultTicker,
): ElementStateController => {
  const existing = registry.get(element);
  if (existing) return existing;
  const created = createElementState(element, options, ticker);
  registry.set(element, created);
  return created;
};

export const releaseElementState = (element: HTMLElement): void => {
  const existing = registry.get(element);
  existing?.clear();
  registry.delete(element);
};
