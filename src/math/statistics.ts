/**
 * Descriptive statistics, computed locally.
 *
 * Every function is O(n) (except `mode` and `regression` which are O(n log n) and
 * O(n) respectively), ignores non-finite values and never mutates its input.
 */

/** Numbers that are finite; `NaN`, `Infinity` and non-numbers are dropped. */
export const finite = (values: readonly number[]): number[] =>
  values.filter((value) => typeof value === "number" && Number.isFinite(value));

export const mean = (values: readonly number[]): number => {
  const data = finite(values);
  if (data.length === 0) return Number.NaN;
  let total = 0;
  for (const value of data) total += value;
  return total / data.length;
};

export const median = (values: readonly number[]): number => {
  const data = finite(values).sort((a, b) => a - b);
  if (data.length === 0) return Number.NaN;
  const middle = Math.floor(data.length / 2);
  if (data.length % 2 === 1) return data[middle] ?? Number.NaN;
  const low = data[middle - 1] ?? Number.NaN;
  const high = data[middle] ?? Number.NaN;
  return (low + high) / 2;
};

export interface ModeResult {
  /** Modes in ascending order; several values can occur equally often. */
  values: number[];
  count: number;
}

/**
 * Most frequent value(s). Returns every mode, so `[1, 1, 2, 2]` yields `[1, 2]`.
 * Ties are reported in ascending order.
 */
export const mode = (values: readonly number[]): ModeResult => {
  const data = finite(values);
  if (data.length === 0) return { values: [], count: 0 };
  const counts = new Map<number, number>();
  let highest = 0;
  for (const value of data) {
    const next = (counts.get(value) ?? 0) + 1;
    counts.set(value, next);
    if (next > highest) highest = next;
  }
  const modes = [...counts.entries()]
    .filter(([, count]) => count === highest)
    .map(([value]) => value)
    .sort((a, b) => a - b);
  return { values: modes, count: highest };
};

/**
 * Sample variance (`ddof = 1` by default, matching most statistical packages).
 * Pass `0` for the population variance.
 */
// DECISION(nashiuso): sample variance (n - 1), not population variance. Card
// statistics are nearly always a sample of something larger, and the difference is
// the kind of thing that shows up as a support question rather than a bug report.
export const variance = (values: readonly number[], ddof = 1): number => {
  const data = finite(values);
  if (data.length === 0) return Number.NaN;
  const average = mean(data);
  let total = 0;
  for (const value of data) {
    const delta = value - average;
    total += delta * delta;
  }
  const denominator = data.length - ddof;
  if (denominator <= 0) return 0;
  return total / denominator;
};

export const standardDeviation = (values: readonly number[], ddof = 1): number =>
  Math.sqrt(variance(values, ddof));

/** Linear-interpolated percentile. `p` is `0..100`. */
export const percentile = (values: readonly number[], p: number): number => {
  const data = finite(values).sort((a, b) => a - b);
  if (data.length === 0) return Number.NaN;
  const clamped = p < 0 ? 0 : p > 100 ? 100 : p;
  if (data.length === 1) return data[0] ?? Number.NaN;
  const position = (clamped / 100) * (data.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = data[lower] ?? Number.NaN;
  const high = data[upper] ?? Number.NaN;
  if (lower === upper) return low;
  return low + (high - low) * (position - lower);
};

export const quantile = (values: readonly number[], q: number): number => percentile(values, q * 100);

export interface Range {
  min: number;
  max: number;
  span: number;
}

/** Min/max/span, ignoring non-finite values. */
export const extent = (values: readonly number[]): Range => {
  const data = finite(values);
  if (data.length === 0) return { min: Number.NaN, max: Number.NaN, span: Number.NaN };
  let min = data[0] ?? Number.NaN;
  let max = min;
  for (const value of data) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max, span: max - min };
};

export const interquartileRange = (values: readonly number[]): number =>
  percentile(values, 75) - percentile(values, 25);

/** Pearson correlation coefficient in `-1..1`, or `NaN` for degenerate input. */
export const correlation = (xs: readonly number[], ys: readonly number[]): number => {
  const length = Math.min(xs.length, ys.length);
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const xv = xs[i];
    const yv = ys[i];
    if (xv === undefined || yv === undefined) continue;
    if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
    x.push(xv);
    y.push(yv);
  }
  if (x.length < 2) return Number.NaN;
  const mx = mean(x);
  const my = mean(y);
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let i = 0; i < x.length; i += 1) {
    const dx = (x[i] ?? 0) - mx;
    const dy = (y[i] ?? 0) - my;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }
  const denominator = Math.sqrt(varianceX * varianceY);
  if (denominator === 0) return Number.NaN;
  return covariance / denominator;
};

export interface Regression {
  slope: number;
  intercept: number;
  /** Coefficient of determination, `0..1`. */
  r2: number;
  predict: (x: number) => number;
}

/** Ordinary least squares regression of `ys` on `xs`. */
export const regression = (xs: readonly number[], ys: readonly number[]): Regression => {
  const length = Math.min(xs.length, ys.length);
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const xv = xs[i];
    const yv = ys[i];
    if (xv === undefined || yv === undefined) continue;
    if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
    x.push(xv);
    y.push(yv);
  }
  if (x.length < 2) {
    const flat = y[0] ?? Number.NaN;
    return { slope: 0, intercept: flat, r2: Number.NaN, predict: () => flat };
  }
  const mx = mean(x);
  const my = mean(y);
  let covariance = 0;
  let varianceX = 0;
  for (let i = 0; i < x.length; i += 1) {
    const dx = (x[i] ?? 0) - mx;
    covariance += dx * ((y[i] ?? 0) - my);
    varianceX += dx * dx;
  }
  const slope = varianceX === 0 ? 0 : covariance / varianceX;
  const intercept = my - slope * mx;
  let residual = 0;
  let total = 0;
  for (let i = 0; i < x.length; i += 1) {
    const predicted = slope * (x[i] ?? 0) + intercept;
    const error = (y[i] ?? 0) - predicted;
    residual += error * error;
    const deviation = (y[i] ?? 0) - my;
    total += deviation * deviation;
  }
  const r2 = total === 0 ? 1 : 1 - residual / total;
  return { slope, intercept, r2, predict: (value: number) => slope * value + intercept };
};

/** Simple moving average with a trailing window. Returns `values.length` entries. */
export const movingAverage = (values: readonly number[], window: number): number[] => {
  const data = finite(values);
  const size = Math.max(1, Math.floor(window));
  const result: number[] = [];
  let total = 0;
  for (let i = 0; i < data.length; i += 1) {
    total += data[i] ?? 0;
    if (i >= size) total -= data[i - size] ?? 0;
    result.push(total / Math.min(i + 1, size));
  }
  return result;
};

/** Exponential moving average with smoothing factor `alpha` (`0..1`). */
export const movingAverageExponential = (values: readonly number[], alpha = 0.3): number[] => {
  const data = finite(values);
  const factor = Math.min(1, Math.max(0, alpha));
  const result: number[] = [];
  let previous = Number.NaN;
  for (const value of data) {
    previous = Number.isNaN(previous) ? value : previous + factor * (value - previous);
    result.push(previous);
  }
  return result;
};

/**
 * Histogram with a fixed bin count. Returns bin edges (length `bins + 1`) and counts.
 */
export interface Histogram {
  edges: number[];
  counts: number[];
  binWidth: number;
}

export const histogram = (values: readonly number[], bins = 10): Histogram => {
  const data = finite(values);
  const binCount = Math.max(1, Math.floor(bins));
  if (data.length === 0) return { edges: [], counts: [], binWidth: 0 };
  const { min, max } = extent(data);
  const safeMax = max === min ? min + 1 : max;
  const binWidth = (safeMax - min) / binCount;
  const edges: number[] = [];
  for (let i = 0; i <= binCount; i += 1) edges.push(min + binWidth * i);
  const counts = new Array<number>(binCount).fill(0);
  for (const value of data) {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor((value - min) / binWidth)));
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return { edges, counts, binWidth };
};

/**
 * Scales values into `0..1` using their min/max; constant input maps to `0.5`.
 *
 * Named `normalizeValues` to stay unambiguous next to the vector `normalize` in
 * `geometry.ts`.
 */
export const normalizeValues = (values: readonly number[]): number[] => {
  const { min, span } = extent(values);
  if (!Number.isFinite(min)) return [];
  if (span === 0) return finite(values).map(() => 0.5);
  return finite(values).map((value) => (value - min) / span);
};
