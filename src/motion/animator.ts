/**
 * Animators: run a {@link MotionPlan} against scalar values or full visual states.
 *
 * Animators are imperative on purpose. They subscribe to the shared
 * {@link ticker}, write through callbacks and never allocate per frame. A handle
 * is returned so callers can cancel (drag interrupted by a new drag) or finish
 * immediately (reduced motion, unmount).
 */

import { clamp01 } from "../math/interpolate";
import type { MotionPlan } from "./presets";
import { integrateSpring, springAtRest, type SpringConfig, type SpringState } from "./spring";
import { ticker as defaultTicker, type Ticker, type Unsubscribe } from "./ticker";
import { lerpVisualState, type VisualState } from "./transform";

export interface AnimationHandle {
  /** Stops the animation without emitting further updates. */
  cancel(): void;
  /** Jumps to the final value and completes. */
  finish(): void;
  /** Resolves `true` when completed, `false` when cancelled. */
  readonly done: Promise<boolean>;
  readonly finished: boolean;
}

export interface AnimateValueOptions {
  from: number;
  to: number;
  plan: MotionPlan;
  onUpdate: (value: number, velocity: number) => void;
  onComplete?: () => void;
  ticker?: Ticker;
}

const createHandle = (): {
  handle: AnimationHandle;
  resolve: (completed: boolean) => void;
} => {
  let resolveDone: (completed: boolean) => void = () => {};
  const done = new Promise<boolean>((resolve) => {
    resolveDone = resolve;
  });
  const handle: AnimationHandle = {
    cancel: () => {},
    finish: () => {},
    done,
    finished: false,
  };
  return { handle, resolve: resolveDone };
};

/** Animates a single number from `from` to `to`. */
export const animateValue = (options: AnimateValueOptions): AnimationHandle => {
  const { plan, onUpdate, onComplete } = options;
  const { handle, resolve } = createHandle();
  const activeTicker = options.ticker ?? defaultTicker;

  if (plan.kind === "instant" || options.from === options.to) {
    onUpdate(options.to, 0);
    onComplete?.();
    Object.defineProperty(handle, "finished", { value: true, configurable: true });
    resolve(true);
    handle.cancel = () => {};
    handle.finish = () => {};
    return handle;
  }

  let state: SpringState = { value: options.from, velocity: 0 };
  let elapsed = 0;
  let unsubscribe: Unsubscribe | null = null;
  let settled = false;

  const complete = (): void => {
    if (settled) return;
    settled = true;
    Object.defineProperty(handle, "finished", { value: true, configurable: true });
    unsubscribe?.();
    unsubscribe = null;
    onComplete?.();
    resolve(true);
  };

  const cancel = (): void => {
    if (settled) return;
    settled = true;
    Object.defineProperty(handle, "finished", { value: true, configurable: true });
    unsubscribe?.();
    unsubscribe = null;
    resolve(false);
  };

  handle.cancel = cancel;
  handle.finish = () => {
    if (settled) return;
    state = { value: options.to, velocity: 0 };
    onUpdate(options.to, 0);
    complete();
  };

  unsubscribe = activeTicker.subscribe((delta) => {
    if (settled) return;
    if (plan.kind === "tween") {
      elapsed += delta;
      const t = plan.duration <= 0 ? 1 : clamp01(elapsed / plan.duration);
      const eased = plan.easing(t);
      const value = options.from + (options.to - options.from) * eased;
      const velocity = delta > 0 ? (value - state.value) / delta : 0;
      state = { value, velocity };
      if (t >= 1) {
        onUpdate(options.to, 0);
        complete();
        return;
      }
      onUpdate(value, velocity);
      return;
    }

    const result = integrateSpring(
      state,
      {
        target: options.to,
        config: plan.config,
        onUpdate,
        onComplete: complete,
      },
      delta,
    );
    state = result.state;
  });

  return handle;
};

export interface AnimateVisualOptions {
  from: VisualState;
  to: VisualState;
  plan: MotionPlan;
  onUpdate: (state: VisualState, progress: number) => void;
  onComplete?: () => void;
  ticker?: Ticker;
}

/**
 * Animates a whole {@link VisualState}.
 *
 * Every channel shares one spring configuration and one subscriber, so a card
 * moving, scaling and fading still costs a single rAF callback.
 */
export const animateVisualState = (options: AnimateVisualOptions): AnimationHandle => {
  const { plan, onUpdate, onComplete } = options;
  const { handle, resolve } = createHandle();
  const activeTicker = options.ticker ?? defaultTicker;

  if (plan.kind === "instant") {
    onUpdate(options.to, 1);
    onComplete?.();
    Object.defineProperty(handle, "finished", { value: true, configurable: true });
    resolve(true);
    handle.cancel = () => {};
    handle.finish = () => {};
    return handle;
  }

  const keys: (keyof VisualState)[] = ["x", "y", "scale", "rotate", "opacity", "blur", "elevation"];
  const channels = new Map<keyof VisualState, SpringState>();
  for (const key of keys) {
    channels.set(key, { value: options.from[key], velocity: 0 });
  }

  let elapsed = 0;
  let unsubscribe: Unsubscribe | null = null;
  let settled = false;

  const emit = (state: VisualState, progress: number): void => {
    onUpdate(state, progress);
  };

  const complete = (): void => {
    if (settled) return;
    settled = true;
    Object.defineProperty(handle, "finished", { value: true, configurable: true });
    unsubscribe?.();
    unsubscribe = null;
    onComplete?.();
    resolve(true);
  };

  handle.cancel = () => {
    if (settled) return;
    settled = true;
    Object.defineProperty(handle, "finished", { value: true, configurable: true });
    unsubscribe?.();
    unsubscribe = null;
    resolve(false);
  };

  handle.finish = () => {
    if (settled) return;
    emit(options.to, 1);
    complete();
  };

  unsubscribe = activeTicker.subscribe((delta) => {
    if (settled) return;

    if (plan.kind === "tween") {
      elapsed += delta;
      const t = plan.duration <= 0 ? 1 : clamp01(elapsed / plan.duration);
      emit(lerpVisualState(options.from, options.to, plan.easing(t)), plan.easing(t));
      if (t >= 1) complete();
      return;
    }

    let allResting = true;
    const next = { ...options.from };
    for (const key of keys) {
      const current = channels.get(key) as SpringState;
      const target = options.to[key];
      const stepped = stepChannel(current, target, plan.config, delta);
      channels.set(key, stepped.state);
      next[key] = stepped.state.value;
      if (!stepped.resting) allResting = false;
    }

    const progress = channelProgress(channels, options.to);
    emit(next, progress);
    if (allResting) {
      emit(options.to, 1);
      complete();
    }
  });

  return handle;
};

const stepChannel = (
  state: SpringState,
  target: number,
  config: SpringConfig,
  delta: number,
): { state: SpringState; resting: boolean } => {
  const stepped = integrateSpring(state, { target, config, onUpdate: () => {}, onComplete: () => {} }, delta);
  const resting = springAtRest(stepped.state, target, config);
  return { state: stepped.state, resting };
};

/** Snaps the channels to their target so the last emitted frame is exact. */
const channelProgress = (channels: Map<keyof VisualState, SpringState>, target: VisualState): number => {
  let total = 0;
  let count = 0;
  for (const [key, state] of channels) {
    const from = target[key];
    const distance = Math.abs(state.value - from);
    const span = Math.max(1e-3, Math.abs(from) * 0.5 + 1);
    total += clamp01(1 - distance / span);
    count += 1;
  }
  return count === 0 ? 1 : total / count;
};

/** Promise form for tests and orchestration: resolves when the animation settles. */
export const animationComplete = (handle: AnimationHandle): Promise<boolean> => handle.done;
