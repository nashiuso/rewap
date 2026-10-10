/**
 * Damped spring solver.
 *
 * Uses a semi-implicit Euler integrator with a fixed sub-step. Fixed sub-steps
 * keep the simulation stable and deterministic for high stiffness values, while
 * the reported state stays frame-rate independent (a 120 Hz screen and a 60 Hz
 * screen follow the same trajectory, just sampled more often).
 */

import { clamp } from "../math/interpolate";

export interface SpringConfig {
  /** Spring constant. Higher values pull harder toward the target. */
  stiffness: number;
  /** Damping coefficient. Higher values settle faster with less overshoot. */
  damping: number;
  /** Mass of the simulated body. Heavier values feel slower. */
  mass: number;
  /** Initial velocity in units per second. */
  velocity?: number;
}

export interface SpringState {
  value: number;
  velocity: number;
}

export interface SpringRestOptions {
  /** Distance to the target below which the spring may rest. */
  restDistance?: number;
  /** Absolute velocity below which the spring may rest. */
  restVelocity?: number;
}

export const defaultSpring: SpringConfig = {
  stiffness: 300,
  damping: 30,
  mass: 1,
};

/** Fixed integration sub-step (seconds). Independent of display refresh rate. */
export const FIXED_TIMESTEP = 1 / 240;
/** Safety cap so a background tab that wakes up cannot explode the simulation. */
export const MAX_FRAME_DELTA = 1 / 15;

export const DEFAULTS_REST: Required<SpringRestOptions> = {
  restDistance: 0.1,
  restVelocity: 0.1,
};

/** Damping coefficient at which the spring stops oscillating. */
export const criticalDamping = (stiffness: number, mass: number): number =>
  2 * Math.sqrt(Math.max(0, stiffness) * Math.max(0.0001, mass));

/** `damping / criticalDamping`: `< 1` underdamped, `1` critical, `> 1` overdamped. */
export const dampingRatio = (config: SpringConfig): number =>
  config.damping / criticalDamping(config.stiffness, config.mass);

/** Natural frequency in radians per second. */
export const angularFrequency = (config: SpringConfig): number =>
  Math.sqrt(Math.max(0, config.stiffness) / Math.max(0.0001, config.mass));

/** Acceleration for a spring displaced by `displacement` with velocity `velocity`. */
export const springAcceleration = (
  displacement: number,
  velocity: number,
  config: SpringConfig,
): number =>
  (-config.stiffness * displacement - config.damping * velocity) /
  Math.max(0.0001, config.mass);

/**
 * Advances a one-dimensional spring toward `target` by `delta` seconds.
 * `delta` is clamped internally and integrated with fixed sub-steps.
 */
export const stepSpring = (
  state: SpringState,
  target: number,
  config: SpringConfig,
  delta: number,
): SpringState => {
  const seconds = Math.min(Math.max(delta, 0), MAX_FRAME_DELTA);
  if (seconds === 0) return state;

  const steps = Math.max(1, Math.ceil(seconds / FIXED_TIMESTEP));
  const step = seconds / steps;

  let value = state.value;
  let velocity = state.velocity;

  for (let i = 0; i < steps; i += 1) {
    const acceleration = springAcceleration(value - target, velocity, config);
    velocity += acceleration * step;
    value += velocity * step;
  }

  return { value, velocity };
};

/** True when the spring is close enough to the target to stop animating. */
export const springAtRest = (
  state: SpringState,
  target: number,
  config?: SpringConfig,
  options: SpringRestOptions = {},
): boolean => {
  const restDistance = options.restDistance ?? DEFAULTS_REST.restDistance;
  const restVelocity = options.restVelocity ?? DEFAULTS_REST.restVelocity;
  if (Math.abs(state.value - target) > restDistance) return false;
  const velocityLimit = config ? Math.max(restVelocity, 0) : restVelocity;
  return Math.abs(state.velocity) <= velocityLimit;
};

/**
 * Analytic duration estimate for a spring: the time until the envelope of the
 * displacement decays below `tolerance` of its initial value, capped at `maxSeconds`.
 *
 * Used for prefers-reduced-motion accounting and for documentation tables — the
 * simulation itself always uses {@link stepSpring}.
 */
export const springDuration = (
  config: SpringConfig,
  initialDisplacement = 1,
  tolerance = 0.001,
  maxSeconds = 4,
): number => {
  if (initialDisplacement === 0) return 0;
  const zeta = dampingRatio(config);
  const omega = angularFrequency(config);
  if (omega === 0) return 0;
  if (zeta >= 1) {
    // Overdamped: dominated by the slower real pole.
    const root = Math.sqrt(zeta * zeta - 1);
    const slowPole = omega * (zeta - root);
    if (slowPole <= 0) return maxSeconds;
    return Math.min(
      maxSeconds,
      Math.log(initialDisplacement / tolerance) / slowPole,
    );
  }
  const decay = zeta * omega;
  if (decay <= 0) return maxSeconds;
  return Math.min(
    maxSeconds,
    Math.log(initialDisplacement / tolerance) / decay,
  );
};

/** Samples a spring trajectory on a fixed grid — handy for charts and tests. */
export const sampleSpring = (
  from: number,
  to: number,
  config: SpringConfig,
  duration: number,
  sampleRate = 120,
): number[] => {
  const samples: number[] = [];
  const step = 1 / sampleRate;
  let state: SpringState = { value: from, velocity: config.velocity ?? 0 };
  const frames = Math.max(1, Math.round(duration * sampleRate));
  for (let i = 0; i < frames; i += 1) {
    state = stepSpring(state, to, config, step);
    samples.push(state.value);
  }
  return samples;
};

export interface Spring1DOptions extends SpringRestOptions {
  target: number;
  config: SpringConfig;
  onUpdate: (value: number, velocity: number) => void;
  onComplete?: (value: number) => void;
}

/** Integrates a spring until rest using a caller-provided time source. */
export const integrateSpring = (
  state: SpringState,
  options: Spring1DOptions,
  delta: number,
): { state: SpringState; resting: boolean } => {
  const next = stepSpring(state, options.target, options.config, delta);
  const resting = springAtRest(next, options.target, options.config, options);
  const settled = resting ? { value: options.target, velocity: 0 } : next;
  if (resting) {
    options.onUpdate(options.target, 0);
    options.onComplete?.(options.target);
  } else {
    options.onUpdate(next.value, next.velocity);
  }
  return { state: settled, resting };
};

/** Clamp helper re-exported for simulation consumers. */
export const clampVelocity = (velocity: number, limit = 6000): number =>
  clamp(velocity, -limit, limit);
