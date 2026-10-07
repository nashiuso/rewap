/**
 * Point and vector geometry: distances, nearest-item queries, projection and
 * rotation. Used by collision detection, reorder projection and drag effects.
 */

import { rectCenter, type Point, type Rect } from "./rect";

export interface Vector {
  x: number;
  y: number;
}

export const point = (x: number, y: number): Point => ({ x, y });

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, factor: number): Point => ({ x: a.x * factor, y: a.y * factor });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const magnitude = (a: Point): number => Math.hypot(a.x, a.y);

export const normalize = (a: Point): Point => {
  const length = magnitude(a);
  if (length === 0) return { x: 0, y: 0 };
  return { x: a.x / length, y: a.y / length };
};

/** Euclidean distance between two points. */
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Squared distance — cheaper for comparisons where the square root is irrelevant. */
export const distanceSquared = (a: Point, b: Point): number =>
  (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

/** Distance between rectangle centers. */
export const centerDistance = (a: Rect, b: Rect): number => distance(rectCenter(a), rectCenter(b));

/** Distance from a point to the closest edge of a rectangle (0 when inside). */
export const distanceToRect = (p: Point, r: Rect): number => {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return Math.hypot(dx, dy);
};

export type DistanceMetric = (point: Point, rect: Rect) => number;

export const metrics = {
  /** Distance from the point to the rectangle's center. */
  center: (p: Point, r: Rect): number => distance(p, rectCenter(r)),
  /** Distance from the point to the nearest edge of the rectangle. */
  edge: (p: Point, r: Rect): number => distanceToRect(p, r),
  /** Chebyshev distance from the point to the rectangle's center. */
  centerChebyshev: (p: Point, r: Rect): number => {
    const c = rectCenter(r);
    return Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y));
  },
} satisfies Record<string, DistanceMetric>;

export interface RectEntry<T> {
  id: T;
  rect: Rect;
}

export interface NearestOptions<T> {
  metric?: DistanceMetric;
  /** Rejects candidates beyond this distance. */
  maxDistance?: number;
  /** Ignores these ids (for example, the item currently being dragged). */
  exclude?: readonly T[];
}

/** Returns the entry whose rectangle is closest to `p`, or `null` when nothing qualifies. */
export const nearest = <T>(
  entries: readonly RectEntry<T>[],
  p: Point,
  options: NearestOptions<T> = {},
): RectEntry<T> | null => {
  const measure = options.metric ?? metrics.center;
  const exclude = options.exclude;
  let best: RectEntry<T> | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    if (exclude !== undefined && exclude.includes(entry.id)) continue;
    const d = measure(p, entry.rect);
    if (d < bestDistance) {
      bestDistance = d;
      best = entry;
    }
  }
  if (best === null) return null;
  if (options.maxDistance !== undefined && bestDistance > options.maxDistance) return null;
  return best;
};

/** Projection of `p` onto the infinite line through `a` and `b`. */
export const projectPointOnLine = (p: Point, a: Point, b: Point): Point => {
  const ab = subtract(b, a);
  const lengthSquared = dot(ab, ab);
  if (lengthSquared === 0) return { ...a };
  const t = dot(subtract(p, a), ab) / lengthSquared;
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
};

/** Projection of `p` onto the segment `a`–`b`, clamped to the segment ends. */
export const projectPointOnSegment = (p: Point, a: Point, b: Point): Point => {
  const ab = subtract(b, a);
  const lengthSquared = dot(ab, ab);
  if (lengthSquared === 0) return { ...a };
  const t = Math.min(1, Math.max(0, dot(subtract(p, a), ab) / lengthSquared));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
};

export type Axis = "x" | "y";

/**
 * Signed projection of `p` onto the axis, relative to the origin `o`.
 * This is the 1-D primitive used to decide insertion order in `reorder` mode.
 */
export const projectOnAxis = (p: Point, o: Point, axis: Axis): number =>
  axis === "x" ? p.x - o.x : p.y - o.y;

/**
 * Normalized position of `p` along the `a`→`b` axis, clamped to `0..1`.
 * Used to interpolate between two candidate slots.
 */
export const projectRatio = (p: Point, a: Point, b: Point): number => {
  const ab = subtract(b, a);
  const lengthSquared = dot(ab, ab);
  if (lengthSquared === 0) return 0;
  const t = dot(subtract(p, a), ab) / lengthSquared;
  return Math.min(1, Math.max(0, t));
};

export const rotatePoint = (p: Point, origin: Point, radians: number): Point => {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
};

export const angle = (a: Point, b: Point): number => Math.atan2(b.y - a.y, b.x - a.x);
export const degrees = (radians: number): number => (radians * 180) / Math.PI;
export const radians = (deg: number): number => (deg * Math.PI) / 180;

/** One-dimensional overlap between the intervals [aStart, aEnd] and [bStart, bEnd]. */
export const intervalOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): number =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

/** True when two intervals overlap at all. */
export const intervalsIntersect = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  intervalOverlap(aStart, aEnd, bStart, bEnd) > 0;
