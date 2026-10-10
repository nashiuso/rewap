/**
 * `<Chart>` — a small, responsive, animated SVG chart.
 *
 * - locally rendered SVG: no charting dependency, no canvas tricks;
 * - responsive through `ResizeObserver`, so any container and any aspect works;
 * - animated with the library's own motion engine;
 * - accessible: an image role with a label *plus* a visually hidden data table, so
 *   the numbers are available to screen readers rather than only the shape.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { useIsomorphicLayoutEffect } from "../react/useIsomorphicLayoutEffect";

import { histogram as computeHistogram } from "../math/statistics";
import { animateValue, type AnimationHandle } from "../motion/animator";
import { resolveMotion, type MotionValue } from "../motion/presets";
import { ticker as defaultTicker } from "../motion/ticker";
import { usePrefersReducedMotion } from "../utilities/usePrefersReducedMotion";
import { areaPath, barRects, linePath, smoothLinePath } from "./paths";
import {
  bandScale,
  domainOf,
  linearScale,
  niceDomain,
  normalizeSeries,
  seriesToPoints,
  type Point,
} from "./scales";

export type ChartType =
  "line" | "area" | "bar" | "scatter" | "histogram" | "sparkline";

export interface ChartSeries {
  id?: string;
  label?: string;
  data: number[] | Point[];
}

export interface ChartProps {
  type: ChartType;
  /**
   * Accepted shapes:
   * - `number[]` — values against their index;
   * - `{ x, y }[]` — explicit points;
   * - `ChartSeries[]` — several series. Line, area and scatter draw all of them;
   *   bar, histogram and sparkline draw the first one.
   */
  data: number[] | Point[] | ChartSeries[];
  /** Height in pixels or any CSS length. Defaults to 180. */
  height?: number | string;
  /** Smooth the line and area curves. */
  smooth?: boolean;
  /** Curve tension used when `smooth` is set. */
  tension?: number;
  /** Histogram bin count. */
  bins?: number;
  showGrid?: boolean;
  showAxis?: boolean;
  /** Tick count on the value axis. */
  tickCount?: number;
  /** Explicit value domain, overriding the one derived from the data. */
  yDomain?: [number, number];
  formatX?: (value: number, index: number) => string;
  formatY?: (value: number) => string;
  /** Draws a guide line and a marker for one point. */
  highlightIndex?: number | null;
  /** Motion preset or configuration. */
  motion?: MotionValue;
  /** Accessible description. Defaults to an auto-generated summary. */
  ariaLabel?: string;
  /** Render the hidden data table for screen readers. Defaults to `true`. */
  accessibleTable?: boolean;
  padding?: Partial<{
    top: number;
    right: number;
    bottom: number;
    left: number;
  }>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const defaultPadding = { top: 10, right: 10, bottom: 22, left: 36 };

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000)
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(Math.abs(value) < 1 ? 2 : 1);
};

const describe = (type: ChartType, points: number, series: number): string =>
  `${type} chart with ${points} point${points === 1 ? "" : "s"}${series > 1 ? ` in ${series} series` : ""}`;

const polylineLength = (points: readonly Point[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
};

const isBandChart = (type: ChartType): boolean =>
  type === "bar" || type === "histogram";

const ChartImpl = (
  props: ChartProps,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) => {
  const {
    type,
    data,
    height = 180,
    smooth = false,
    tension = 0.2,
    bins = 12,
    showGrid = true,
    showAxis = true,
    tickCount = 4,
    yDomain,
    formatX,
    formatY,
    highlightIndex = null,
    motion = "smooth",
    ariaLabel,
    accessibleTable = true,
    padding,
    className,
    style,
    children,
  } = props;

  const prefersReducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const series = useMemo(() => normalizeSeries(data), [data]);
  const band = isBandChart(type);
  const sparkline = type === "sparkline";

  /** Histogram input stays a plain value list, so binning happens here. */
  const histogramPoints = useMemo(() => {
    if (type !== "histogram") return null;
    const values = (series[0]?.points ?? []).map((point) => point.y);
    const result = computeHistogram(values, bins);
    return result.counts.map((count, index) => ({
      x: ((result.edges[index] ?? 0) + (result.edges[index + 1] ?? 0)) / 2,
      y: count,
    }));
  }, [bins, series, type]);

  const drawnSeries = useMemo(() => {
    if (type === "histogram")
      return [{ id: "histogram", points: histogramPoints ?? [] }];
    if (band || sparkline) return series.slice(0, 1);
    return series;
  }, [band, histogramPoints, series, sparkline, type]);

  const allPoints = useMemo(
    () => drawnSeries.flatMap((entry) => entry.points),
    [drawnSeries],
  );

  const resolvedPadding = useMemo(
    () => ({
      top: padding?.top ?? (sparkline ? 2 : defaultPadding.top),
      right: padding?.right ?? (sparkline ? 2 : defaultPadding.right),
      bottom:
        padding?.bottom ?? (sparkline || !showAxis ? 2 : defaultPadding.bottom),
      left: padding?.left ?? (sparkline || !showAxis ? 2 : defaultPadding.left),
    }),
    [padding, showAxis, sparkline],
  );

  const layout = useMemo(() => {
    const w = Math.max(48, measuredWidth || 320);
    // NOTE(nashiuso): a CSS length is scaled by CSS, not by the viewBox, and
    // `parseFloat("12rem")` returning 12 used to give a 24px-tall chart. Only an
    // explicit px value is read here; anything else keeps the default height.
    const h =
      typeof height === "number"
        ? Math.max(24, height)
        : (() => {
            const pixels = /^\s*([\d.]+)px\s*$/.exec(String(height));
            return pixels ? Math.max(24, Number(pixels[1])) : 180;
          })();

    const x0 = resolvedPadding.left;
    const x1 = Math.max(x0 + 1, w - resolvedPadding.right);
    const y0 = resolvedPadding.top;
    const y1 = Math.max(y0 + 1, h - resolvedPadding.bottom);

    const domain = domainOf(allPoints, band);
    const yMin = yDomain
      ? yDomain[0]
      : band
        ? Math.min(0, domain.y[0])
        : domain.y[0];
    const yMax = yDomain ? yDomain[1] : domain.y[1];
    const nice = niceDomain([yMin, yMax], tickCount);
    const yScale = linearScale(nice, [y1, y0]);
    const zeroY = Math.max(y0, Math.min(y1, yScale(0)));

    const xScale = linearScale(domain.x, [x0, x1]);
    // The drawn series, not the input: a histogram draws bins, not raw values.
    const bandScaleForPrimary = bandScale(drawnSeries[0]?.points.length ?? 0, [
      x0,
      x1,
    ]);
    const xAt = (index: number): number =>
      band ? bandScaleForPrimary.center(index) : xScale(index);

    const perSeries = drawnSeries.map((entry, seriesIndex) => ({
      id: entry.id,
      seriesIndex,
      rounded: entry.points.map((point, index) => ({
        x: band ? bandScaleForPrimary.center(index) : xScale(point.x),
        y: yScale(point.y),
      })),
    }));

    const yTicks = showAxis && !sparkline ? yScale.ticks(tickCount) : [];
    const xTickIndices: number[] = [];
    const primaryCount = drawnSeries[0]?.points.length ?? 0;
    if (showAxis && !sparkline && primaryCount > 0) {
      const maxTicks = 5;
      const step = Math.max(1, Math.ceil(primaryCount / maxTicks));
      for (let i = 0; i < primaryCount; i += step) xTickIndices.push(i);
    }

    return {
      w,
      h,
      x0,
      x1,
      y0,
      y1,
      yScale,
      zeroY,
      band: bandScaleForPrimary,
      xAt,
      yTicks,
      xTickIndices,
      perSeries,
      domain,
    };
  }, [
    allPoints,
    band,
    drawnSeries,
    height,
    measuredWidth,
    resolvedPadding,
    showAxis,
    sparkline,
    tickCount,
    yDomain,
  ]);

  // ------------------------------------------------------------------ animation
  const primaryPathRef = useRef<(SVGPathElement | null)[]>([]);
  const areaPathRef = useRef<(SVGPathElement | null)[]>([]);
  const barRefs = useRef<(SVGRectElement | null)[]>([]);
  const pointRefs = useRef<(SVGCircleElement | null)[]>([]);
  const animationRef = useRef<AnimationHandle | null>(null);

  const plan = useMemo(
    () => resolveMotion(motion, { prefersReducedMotion }),
    [motion, prefersReducedMotion],
  );
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const typeRef = useRef(type);
  typeRef.current = type;
  const valuesRef = useRef<number[]>([]);
  valuesRef.current = (series[0]?.points ?? []).map((point) => point.y);

  const applyProgress = useCallback((progress: number) => {
    const current = layoutRef.current;
    const currentType = typeRef.current;

    current.perSeries.forEach((entry, index) => {
      const path = primaryPathRef.current[index];
      if (path && !isBandChart(currentType)) {
        const length = Math.max(
          1,
          typeof path.getTotalLength === "function"
            ? path.getTotalLength()
            : polylineLength(entry.rounded),
        );
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length * (1 - progress)}`;
      }
      const area = areaPathRef.current[index];
      if (area) area.style.opacity = String(progress);
    });

    const primary = current.perSeries[0];
    if (primary) {
      const values = valuesRef.current;
      for (let index = 0; index < barRefs.current.length; index += 1) {
        const rect = barRefs.current[index];
        const point = primary.rounded[index];
        const value = values[index] ?? 0;
        if (!rect || !point) continue;
        const fullHeight = Math.abs(point.y - current.zeroY);
        const height = fullHeight * progress;
        rect.setAttribute(
          "y",
          String(value >= 0 ? current.zeroY - height : current.zeroY),
        );
        rect.setAttribute("height", String(height));
      }
      for (let index = 0; index < pointRefs.current.length; index += 1) {
        const circle = pointRefs.current[index];
        if (circle) circle.style.opacity = String(progress);
      }
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    animationRef.current?.cancel();
    animationRef.current = null;
    if (allPoints.length === 0) {
      applyProgress(1);
      return;
    }
    if (plan.kind === "instant") {
      applyProgress(1);
      return;
    }
    applyProgress(0);
    animationRef.current = animateValue({
      from: 0,
      to: 1,
      plan,
      ticker: defaultTicker,
      onUpdate: (value) => applyProgress(value),
      onComplete: () => applyProgress(1),
    });
    return () => {
      animationRef.current?.cancel();
      animationRef.current = null;
    };
  }, [allPoints.length, applyProgress, plan, type]);

  // --------------------------------------------------------------------- sizing
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () =>
      setMeasuredWidth(element.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const assignRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef)
        (
          forwardedRef as React.MutableRefObject<HTMLDivElement | null>
        ).current = node;
    },
    [forwardedRef],
  );

  const description =
    ariaLabel ?? describe(type, series[0]?.points.length ?? 0, series.length);
  const hasData = allPoints.length > 0;
  const primaryPoints = series[0]?.points ?? [];

  return (
    <figure
      ref={assignRef}
      className={className ? `rw-chart ${className}` : "rw-chart"}
      role="img"
      aria-label={hasData ? description : `${description} (no data)`}
      style={{ height: typeof height === "number" ? height : height, ...style }}
    >
      <svg
        className="rw-chart__svg"
        width={layout.w}
        height={layout.h}
        viewBox={`0 0 ${layout.w} ${layout.h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {showGrid
          ? layout.yTicks.map((tick) => (
              <line
                key={`grid-${tick}`}
                className="rw-chart__grid"
                x1={layout.x0}
                x2={layout.x1}
                y1={layout.yScale(tick)}
                y2={layout.yScale(tick)}
              />
            ))
          : null}

        {layout.yTicks.map((tick) => (
          <text
            key={`y-${tick}`}
            className="rw-chart__tick-label"
            x={layout.x0 - 6}
            y={layout.yScale(tick)}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {(formatY ?? formatNumber)(tick)}
          </text>
        ))}

        {layout.xTickIndices.map((index) => {
          const point = drawnSeries[0]?.points[index];
          if (!point) return null;
          return (
            <text
              key={`x-${index}`}
              className="rw-chart__tick-label"
              x={layout.xAt(index)}
              y={layout.h - 6}
              textAnchor="middle"
            >
              {formatX ? formatX(point.x, index) : formatNumber(point.x)}
            </text>
          );
        })}

        {layout.yTicks.length > 0 ? (
          <line
            className="rw-chart__axis"
            x1={layout.x0}
            x2={layout.x1}
            y1={layout.y1}
            y2={layout.y1}
          />
        ) : null}

        {band && hasData
          ? barRects(drawnSeries[0]?.points ?? [], {
              offset: layout.band.offset,
              bandwidth: layout.band.bandwidth,
              zeroY: layout.zeroY,
              scaleY: (value) => layout.yScale(value),
              progress: 1,
            }).map((rect, index) => (
              <rect
                key={`bar-${index}`}
                ref={(node) => {
                  barRefs.current[index] = node;
                }}
                className={`rw-chart__bar${highlightIndex === index ? " rw-chart__bar--highlight" : ""}`}
                x={rect.x}
                width={rect.width}
                y={rect.y}
                height={rect.height}
                rx={1}
              />
            ))
          : null}

        {type === "area" && hasData
          ? layout.perSeries.map((entry, index) => (
              <path
                key={`area-${entry.id}-${index}`}
                ref={(node) => {
                  if (node) areaPathRef.current[index] = node;
                }}
                className="rw-chart__area"
                data-series={index}
                style={{
                  opacity: plan.kind === "instant" ? 1 : 0,
                  fill: `var(--rw-chart-series-${index}, var(--rw-accent))`,
                }}
                d={areaPath(entry.rounded, layout.y1, smooth, tension)}
              />
            ))
          : null}

        {(type === "line" || type === "area" || sparkline) && hasData
          ? layout.perSeries.map((entry, index) => (
              <path
                key={`line-${entry.id}-${index}`}
                ref={(node) => {
                  if (node) primaryPathRef.current[index] = node;
                }}
                className={sparkline ? "rw-chart__sparkline" : "rw-chart__line"}
                data-series={index}
                style={{
                  stroke: `var(--rw-chart-series-${index}, var(--rw-accent))`,
                }}
                d={
                  smooth
                    ? smoothLinePath(entry.rounded, tension)
                    : linePath(entry.rounded)
                }
              />
            ))
          : null}

        {type === "scatter" && hasData
          ? layout.perSeries.flatMap((entry, seriesIndex) =>
              entry.rounded.map((point, index) => (
                <circle
                  key={`point-${entry.id}-${index}`}
                  ref={(node) => {
                    pointRefs.current[seriesIndex * 1000 + index] = node;
                  }}
                  className="rw-chart__point"
                  cx={point.x}
                  cy={point.y}
                  r={2.5}
                  style={{
                    opacity: plan.kind === "instant" ? 1 : 0,
                    stroke: `var(--rw-chart-series-${seriesIndex}, var(--rw-accent))`,
                  }}
                />
              )),
            )
          : null}

        {highlightIndex !== null &&
        layout.perSeries[0]?.rounded[highlightIndex] ? (
          <>
            <line
              className="rw-chart__marker"
              x1={layout.perSeries[0].rounded[highlightIndex]?.x ?? 0}
              x2={layout.perSeries[0].rounded[highlightIndex]?.x ?? 0}
              y1={layout.y0}
              y2={layout.y1}
            />
            <circle
              className="rw-chart__point"
              cx={layout.perSeries[0].rounded[highlightIndex]?.x ?? 0}
              cy={layout.perSeries[0].rounded[highlightIndex]?.y ?? 0}
              r={3.5}
            />
          </>
        ) : null}

        {!hasData ? (
          <text
            className="rw-chart__empty"
            x={layout.w / 2}
            y={layout.h / 2}
            textAnchor="middle"
          >
            No data
          </text>
        ) : null}
      </svg>

      {children}

      {accessibleTable && hasData ? (
        <table className="rw-visually-hidden">
          <caption>{description}</caption>
          <thead>
            <tr>
              <th scope="col">x</th>
              <th scope="col">y</th>
            </tr>
          </thead>
          <tbody>
            {primaryPoints.map((point, index) => (
              <tr key={`row-${index}`}>
                <td>{(formatX ?? formatNumber)(point.x, index)}</td>
                <td>{(formatY ?? formatNumber)(point.y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </figure>
  );
};

/**
 * `<Chart>` — line, area, bar, scatter, histogram and sparkline charts.
 *
 * ```tsx
 * <Chart type="line" data={[4, 8, 6, 12]} height={120} />
 * ```
 */
export const Chart = forwardRef(ChartImpl) as (
  props: ChartProps & { ref?: ForwardedRef<HTMLDivElement> },
) => ReactElement | null;

export { seriesToPoints };
