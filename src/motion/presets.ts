/**
 * Motion presets and configuration resolution.
 *
 * A motion value can be a preset name, a partial spring, a tween, or `null`/false
 * for "no animation". `resolveMotion` turns any of them into a concrete plan that
 * the animator can execute, taking `prefers-reduced-motion` into account.
 */

import {
  easeOutCubic,
  easeOutQuint,
  type Easing,
  resolveEasing,
} from "./easing";
import { defaultSpring, springDuration, type SpringConfig } from "./spring";

export type MotionName = "smooth" | "snappy" | "soft" | "instant";

export interface SpringMotion {
  type: "spring";
  stiffness?: number;
  damping?: number;
  mass?: number;
  velocity?: number;
  /** Root-mean-square unit for the spring, when the caller knows it up front. */
  distance?: number;
  /**
   * When `false`, this motion plays even if the user prefers reduced motion.
   * Defaults to `true`: reduced motion always wins.
   */
  respectReducedMotion?: boolean;
}

export interface TweenMotion {
  type: "tween";
  duration?: number;
  easing?: Parameters<typeof resolveEasing>[0];
}

export type MotionConfig = MotionName | SpringMotion | TweenMotion;

export type MotionValue = MotionConfig | null | false | undefined;

export interface MotionSpringPlan {
  kind: "spring";
  config: SpringConfig;
}

export interface MotionTweenPlan {
  kind: "tween";
  duration: number;
  easing: Easing;
}

export interface MotionInstantPlan {
  kind: "instant";
}

export type MotionPlan = MotionSpringPlan | MotionTweenPlan | MotionInstantPlan;

/** The four built-in presets. Exposed so consumers can read the exact numbers. */
export const motionPresets = {
  /** Balanced default: a short, slightly damped settle. */
  smooth: { type: "spring", stiffness: 320, damping: 32, mass: 1 },
  /** Fast and decisive, minimal overshoot — good for swap previews. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.9 },
  /** Gentle and slow, used for large travel distances and ghost placeholders. */
  soft: { type: "spring", stiffness: 180, damping: 26, mass: 1.1 },
  /** No animation at all. Gecko-fast and useful in tests. */
  instant: { type: "tween", duration: 0 },
} satisfies Record<MotionName, SpringMotion | TweenMotion>;

export const instantPlan: MotionInstantPlan = { kind: "instant" };

export interface MotionEnvironment {
  prefersReducedMotion?: boolean;
}

/**
 * Resolves a motion value into an executable plan.
 *
 * Reduced motion is respected unless the configuration opts out explicitly with
 * `respectReducedMotion: false`.
 */
export const resolveMotion = (
  motion: MotionValue,
  environment: MotionEnvironment = {},
): MotionPlan => {
  if (motion === null || motion === false) return instantPlan;

  if (typeof motion === "string") {
    const preset = motionPresets[motion];
    return resolveMotion(preset, environment);
  }

  if (motion === undefined) {
    const respectReduced = environment.prefersReducedMotion !== true;
    return respectReduced
      ? resolveMotion(motionPresets.smooth, environment)
      : instantPlan;
  }

  if (motion.type === "tween") {
    const duration = Math.max(0, motion.duration ?? 0.24);
    if (duration === 0) return instantPlan;
    return {
      kind: "tween",
      duration,
      easing: motion.easing ? resolveEasing(motion.easing) : easeOutCubic,
    };
  }

  const respectReduced = motion.respectReducedMotion !== false;
  if (respectReduced && environment.prefersReducedMotion) return instantPlan;

  return {
    kind: "spring",
    config: {
      stiffness: motion.stiffness ?? defaultSpring.stiffness,
      damping: motion.damping ?? defaultSpring.damping,
      mass: motion.mass ?? defaultSpring.mass,
      ...(motion.velocity !== undefined ? { velocity: motion.velocity } : {}),
    },
  };
};

/** Approximate duration of a plan, in seconds. `instant` is `0`. */
export const motionDuration = (plan: MotionPlan, distance = 1): number => {
  if (plan.kind === "instant") return 0;
  if (plan.kind === "tween") return plan.duration;
  return springDuration(plan.config, Math.max(1, distance), 0.001);
};

/** Human-readable label used by the docs and dev warnings. */
export const describeMotion = (plan: MotionPlan): string => {
  if (plan.kind === "instant") return "instant";
  if (plan.kind === "tween")
    return `tween(${Math.round(plan.duration * 1000)}ms)`;
  const { stiffness, damping, mass } = plan.config;
  return `spring(stiffness: ${stiffness}, damping: ${damping}, mass: ${mass})`;
};

/** Presets in a stable order, for documentation and pickers. */
export const motionNames: MotionName[] = [
  "smooth",
  "snappy",
  "soft",
  "instant",
];

/** A tween preset matching the `soft` spring's feel, for non-spring use cases. */
export const softTween: MotionTweenPlan = {
  kind: "tween",
  duration: 0.42,
  easing: easeOutQuint,
};
