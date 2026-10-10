/**
 * `<StatsWidget>` — descriptive statistics with an inline sparkline.
 *
 * The statistics come from `@nashiuso/rewap/math` and are computed locally. The
 * sparkline is drawn here, without importing the charts entry point, so using the
 * stats widget does not pull in the charting code.
 */

import { useMemo } from "react";
import type { CSSProperties } from "react";

import {
  extent,
  mean,
  median,
  movingAverage,
  standardDeviation,
} from "../math/statistics";
import {
  Widget,
  WidgetNote,
  WidgetRows,
  WidgetRow,
  WidgetValue,
} from "./Widget";

export interface StatsWidgetProps {
  title?: string;
  /** Values to summarize. Non-finite entries are ignored. */
  values: readonly number[];
  unit?: string;
  /** Decimal places for the reported values. Defaults to `2`. */
  precision?: number;
  /** Draw a sparkline of the values. Defaults to `true`. */
  sparkline?: boolean;
  /** Renders a trailing moving average instead of the raw series. */
  movingAverageWindow?: number;
  className?: string;
  style?: CSSProperties;
}

const sparklinePath = (
  values: readonly number[],
  width: number,
  height: number,
): string => {
  if (values.length < 2) return "";
  const { min, span } = extent(values);
  const safeSpan = span === 0 ? 1 : span;
  const step = width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / safeSpan) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

const Sparkline = ({ values }: { values: readonly number[] }) => {
  const path = useMemo(() => sparklinePath(values, 100, 24), [values]);
  if (!path) return null;
  return (
    <svg
      className="rw-chart__svg"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      height={28}
      aria-hidden="true"
      focusable="false"
    >
      <path className="rw-chart__sparkline" d={path} />
    </svg>
  );
};

export const StatsWidget = ({
  title = "Statistics",
  values,
  unit,
  precision = 2,
  sparkline = true,
  movingAverageWindow,
  className,
  style,
}: StatsWidgetProps) => {
  const series = useMemo(
    () =>
      movingAverageWindow
        ? movingAverage(values, movingAverageWindow)
        : [...values],
    [movingAverageWindow, values],
  );

  const summary = useMemo(
    () => ({
      mean: mean(values),
      median: median(values),
      deviation: standardDeviation(values),
      extent: extent(values),
      count: values.filter((value) => Number.isFinite(value)).length,
    }),
    [values],
  );

  const format = (value: number): string =>
    Number.isFinite(value) ? value.toFixed(precision) : "—";

  return (
    <Widget
      title={title}
      className={className}
      style={style}
      meta={`n = ${summary.count}${movingAverageWindow ? ` · ma ${movingAverageWindow}` : ""}`}
    >
      <WidgetValue unit={unit}>{format(summary.mean)}</WidgetValue>
      {sparkline && series.length > 1 ? <Sparkline values={series} /> : null}
      <WidgetRows>
        <WidgetRow label="Median" value={format(summary.median)} />
        <WidgetRow
          label="Std. deviation"
          value={`± ${format(summary.deviation)}`}
        />
        <WidgetRow
          label="Range"
          value={
            Number.isFinite(summary.extent.min)
              ? `${format(summary.extent.min)} … ${format(summary.extent.max)}`
              : "—"
          }
        />
      </WidgetRows>
      {summary.count === 0 ? (
        <WidgetNote>No finite values were provided.</WidgetNote>
      ) : null}
    </Widget>
  );
};
