/**
 * Chart scales.
 *
 * Small, explicit predecessors of a full scale library: a linear scale with
 * `invert` and "nice" ticks, a band scale for categories, and helpers for deriving
 * domains from data. They are pure functions, so charts stay testable.
 */

export interface LinearScale {
  (value: number): number;
  domain: [number, number];
  range: [number, number];
  invert(pixel: number): number;
  ticks(count?: number): number[];
}

/** Rounds a range to human-friendly endpoints (1, 2, 5 × 10ⁿ). */
export const niceDomain = (domain: [number, number], count = 5): [number, number] => {
  let [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    return [min - pad, max + pad];
  }
  if (min > max) [min, max] = [max, min];

  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const error = span / count / step;
  const factor = error >= 7.5 ? 10 : error >= 3.5 ? 5 : error >= 1.5 ? 2 : 1;
  const niceStep = factor * step;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  return [Number(niceMin.toPrecision(12)), Number(niceMax.toPrecision(12))];
};

/** Evenly spaced "nice" tick values covering `domain`. */
export const niceTicks = (domain: [number, number], count = 5): number[] => {
  const [min, max] = niceDomain(domain, count);
  const span = max - min;
  if (span === 0) return [min];
  const step = span / Math.max(1, count);
  const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
  const error = step / magnitude;
  const factor = error >= 7.5 ? 10 : error >= 3.5 ? 5 : error >= 1.5 ? 2 : 1;
  const niceStep = factor * magnitude;
  const ticks: number[] = [];
  const start = Math.ceil(min / niceStep) * niceStep;
  for (let value = start; value <= max + niceStep / 1000; value += niceStep) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
};

/** Linear mapping from a data domain to a pixel range. */
export const linearScale = (domain: [number, number], range: [number, number]): LinearScale => {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;

  const scale = ((value: number): number => {
    if (span === 0) return (r0 + r1) / 2;
    return r0 + ((value - d0) / span) * (r1 - r0);
  }) as LinearScale;

  scale.domain = [d0, d1];
  scale.range = [r0, r1];
  scale.invert = (pixel: number) => {
    if (r1 === r0) return d0;
    return d0 + ((pixel - r0) / (r1 - r0)) * span;
  };
  scale.ticks = (count = 5) => niceTicks([d0, d1], count);
  return scale;
};

export interface BandScale {
  step: number;
  bandwidth: number;
  offset(index: number): number;
  center(index: number): number;
}

/** Category scale with padding, used by bar charts and histograms. */
export const bandScale = (count: number, range: [number, number], padding = 0.24): BandScale => {
  const [r0, r1] = range;
  const width = r1 - r0;
  const safeCount = Math.max(1, count);
  const step = width / safeCount;
  const safePadding = Math.min(0.9, Math.max(0, padding));
  const bandwidth = step * (1 - safePadding);
  const offset = (index: number) => r0 + step * index + (step - bandwidth) / 2;
  return {
    step,
    bandwidth,
    offset,
    center: (index: number) => offset(index) + bandwidth / 2,
  };
};

export interface Point {
  x: number;
  y: number;
}

export interface ChartDomain {
  x: [number, number];
  y: [number, number];
}

/** Data domain of a point list, padded when the values are constant. */
export const domainOf = (points: readonly Point[], includeZero = false): ChartDomain => {
  if (points.length === 0) return { x: [0, 1], y: [0, 1] };
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  if (includeZero) {
    minY = Math.min(0, minY);
    maxY = Math.max(0, maxY);
  }
  if (minY === maxY) {
    const pad = Math.abs(minY) * 0.1 || 1;
    minY -= pad;
    maxY += pad;
  }
  return { x: [minX, maxX], y: [minY, maxY] };
};

/** Converts a bare number list into `{ x: index, y: value }` points. */
export const seriesToPoints = (values: readonly number[]): Point[] =>
  values.map((value, index) => ({ x: index, y: value }));

/** Normalizes the accepted `data` shapes into a list of series. */
export const normalizeSeries = (data: unknown): { id: string; points: Point[] }[] => {
  if (!Array.isArray(data) || data.length === 0) return [];
  const first = data[0];

  if (typeof first === "number") {
    return [{ id: "series-0", points: seriesToPoints(data as number[]) }];
  }

  if (typeof first === "object" && first !== null && "data" in (first as Record<string, unknown>)) {
    return (data as { id?: string; label?: string; data: number[] | Point[] }[]).map((series, index) => ({
      id: series.id ?? series.label ?? `series-${index}`,
      points:
        series.data.length > 0 && typeof series.data[0] === "number"
          ? seriesToPoints(series.data as number[])
          : (series.data as Point[]),
    }));
  }

  return [{ id: "series-0", points: data as Point[] }];
};
