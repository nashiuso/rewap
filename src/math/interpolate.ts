/**
 * Scalar interpolation, clamping, remapping and snapping helpers.
 *
 * These are the numeric primitives shared by the motion engine, drag physics
 * and chart scales.
 */

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const clamp01 = (value: number): number => clamp(value, 0, 1);

/** Linear interpolation between `from` and `to`. `t` is not clamped on purpose. */
export const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * t;

/** Linear interpolation between two points. */
export const lerpPoint = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
): { x: number; y: number } => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
});

export const lerpRect = (
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
  t: number,
): { x: number; y: number; width: number; height: number } => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
  width: lerp(from.width, to.width, t),
  height: lerp(from.height, to.height, t),
});

/** Inverse of `lerp`: where does `value` sit between `from` and `to`? */
export const inverseLerp = (
  from: number,
  to: number,
  value: number,
): number => {
  if (from === to) return 0;
  return (value - from) / (to - from);
};

/** Maps `value` from one range to another, clamped to the destination range. */
export const remap = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => lerp(outMin, outMax, clamp01(inverseLerp(inMin, inMax, value)));

/** Hermite smoothstep easing on `0..1`. */
export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Smootherstep (Perlin's quintic) easing on `0..1`. */
export const smootherstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/**
 * Frame-rate independent exponential smoothing ("damp").
 *
 * `smoothing` is the fraction of the remaining distance left after one second:
 * `0.001` is very snappy, `0.3` is soft. Unlike `lerp(value, target, 0.1)`,
 * damping with `dt` behaves identically at 60 Hz and 144 Hz.
 */
export const damp = (
  value: number,
  target: number,
  smoothing: number,
  dt: number,
): number => {
  if (dt <= 0) return value;
  const factor = 1 - Math.pow(clamp01(smoothing), dt);
  return value + (target - value) * factor;
};

export const dampPoint = (
  value: { x: number; y: number },
  target: { x: number; y: number },
  smoothing: number,
  dt: number,
): { x: number; y: number } => ({
  x: damp(value.x, target.x, smoothing, dt),
  y: damp(value.y, target.y, smoothing, dt),
});

/** Rounds `value` to the nearest multiple of `step`. */
export const snapToStep = (value: number, step: number): number => {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
};

export interface SnapResult {
  value: number;
  index: number;
  distance: number;
}

/**
 * Snaps `value` to the closest target within `threshold`.
 * Returns the original value when nothing is close enough.
 */
export const snapToNearest = (
  value: number,
  targets: readonly number[],
  threshold = Number.POSITIVE_INFINITY,
): SnapResult => {
  let best: SnapResult = {
    value,
    index: -1,
    distance: Number.POSITIVE_INFINITY,
  };
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    if (target === undefined) continue;
    const d = Math.abs(target - value);
    if (d < best.distance) best = { value: target, index: i, distance: d };
  }
  if (best.index === -1 || best.distance > threshold)
    return { value, index: -1, distance: best.distance };
  return best;
};

/** Closest index in a sorted list of values (like a 1-D nearest-neighbour lookup). */
export const snapToNearestSorted = (
  value: number,
  sorted: readonly number[],
): { index: number; value: number } | null => {
  if (sorted.length === 0) return null;
  let low = 0;
  let high = sorted.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    const candidate = sorted[mid];
    if (candidate === undefined) break;
    if (candidate < value) low = mid + 1;
    else high = mid;
  }
  const current = sorted[low];
  if (current === undefined) return null;
  const previous = sorted[low - 1];
  if (
    previous !== undefined &&
    Math.abs(previous - value) <= Math.abs(current - value)
  ) {
    return { index: low - 1, value: previous };
  }
  return { index: low, value: current };
};

export const sum = (values: readonly number[]): number => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

/** Monotonic clock in milliseconds; `performance.now()` when available. */
export const now = (): number => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
};
