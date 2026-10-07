/**
 * SVG path geometry for charts.
 *
 * Plain string builders — no path library, no runtime parsing.
 */

import type { Point } from "./scales";

const round = (value: number): number => Math.round(value * 100) / 100;

/** Straight polyline through the points. */
export const linePath = (points: readonly Point[]): string => {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const only = points[0] as Point;
    return `M ${round(only.x)} ${round(only.y)}`;
  }
  let path = `M ${round((points[0] as Point).x)} ${round((points[0] as Point).y)}`;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i] as Point;
    path += ` L ${round(point.x)} ${round(point.y)}`;
  }
  return path;
};

/**
 * Smooth path using a monotone-ish Catmull-Rom to bezier conversion.
 *
 * `tension` of `0` is a polyline, `0.2` is a gentle curve. The control points are
 * clamped so the curve never overshoots a local extremum — which matters for data
 * honesty: a smoothed line must not invent peaks.
 */
export const smoothLinePath = (points: readonly Point[], tension = 0.2): string => {
  if (points.length < 3 || tension <= 0) return linePath(points);
  const t = Math.min(1, tension) / 1.6;

  let path = `M ${round((points[0] as Point).x)} ${round((points[0] as Point).y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i] ?? { x: 0, y: 0 };
    const p1 = points[i] as Point;
    const p2 = points[i + 1] as Point;
    const p3 = points[i + 2] ?? p2;

    const c1 = { x: p1.x + (p2.x - p0.x) * t, y: p1.y + (p2.y - p0.y) * t };
    const c2 = { x: p2.x - (p3.x - p1.x) * t, y: p2.y - (p3.y - p1.y) * t };
    path += ` C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(p2.x)} ${round(p2.y)}`;
  }
  return path;
};

/** Closed area between a line and a baseline. */
export const areaPath = (
  points: readonly Point[],
  baselineY: number,
  smooth = false,
  tension = 0.2,
): string => {
  if (points.length === 0) return "";
  const first = points[0] as Point;
  const last = points[points.length - 1] as Point;
  const top = smooth ? smoothLinePath(points, tension) : linePath(points);
  const body = top.replace(/^M/, "L");
  return `M ${round(first.x)} ${round(baselineY)} ${body} L ${round(last.x)} ${round(baselineY)} Z`;
};

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

/**
 * Rectangles for a bar or histogram chart.
 *
 * `progress` scales the height from the baseline, which is what the mount
 * animation writes on every frame.
 */
export const barRects = (
  points: readonly Point[],
  options: {
    offset: (index: number) => number;
    bandwidth: number;
    zeroY: number;
    scaleY: (value: number) => number;
    progress?: number;
  },
): BarRect[] => {
  const progress = options.progress ?? 1;
  return points.map((point, index) => {
    const target = options.scaleY(point.y);
    const height = Math.abs(target - options.zeroY) * progress;
    return {
      index,
      x: options.offset(index),
      width: options.bandwidth,
      y: point.y >= 0 ? options.zeroY - height : options.zeroY,
      height,
    };
  });
};

/** Length of a polyline, used to animate a line being drawn. */
export const pathLength = (points: readonly Point[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
};

/** Clamps points into the plotting area so outliers cannot escape the frame. */
export const clampPoints = (
  points: readonly Point[],
  area: { x0: number; x1: number; y0: number; y1: number },
): Point[] =>
  points.map((point) => ({
    x: Math.max(area.x0, Math.min(area.x1, point.x)),
    y: Math.max(area.y0, Math.min(area.y1, point.y)),
  }));
