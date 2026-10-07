/**
 * `<PerformanceWidget>` — locally measured runtime performance, plus an explicit
 * statement about the hardware facts a browser cannot expose.
 *
 * The widget shows CPU temperature as *unavailable* with the reason, because
 * inventing a number there would be exactly the kind of fake data this library
 * refuses to ship.
 */

import type { CSSProperties } from "react";

import { usePerformance, type UsePerformanceOptions } from "../utilities/usePerformance";
import { Widget, WidgetBar, WidgetNote, WidgetRows, WidgetRow, WidgetState, WidgetValue } from "./Widget";

export interface PerformanceWidgetProps extends UsePerformanceOptions {
  title?: string;
  className?: string;
  style?: CSSProperties;
  /** Show the JavaScript heap row when the browser exposes `performance.memory`. */
  showMemory?: boolean;
}

const formatMs = (value: number): string =>
  value >= 100 ? `${Math.round(value)} ms` : `${value.toFixed(1)} ms`;

export const PerformanceWidget = ({
  title = "Performance",
  className,
  style,
  showMemory = true,
  ...performanceOptions
}: PerformanceWidgetProps) => {
  const performance = usePerformance(performanceOptions);
  const audio = performance.fps >= 55 ? "positive" : performance.fps >= 30 ? "caution" : "negative";

  return (
    <Widget
      title={title}
      className={className}
      style={style}
      meta={`measured over ${Math.round(performanceOptions.interval ?? 1000)} ms`}
    >
      <WidgetValue unit="fps">{performance.supported.fps ? performance.fps.toFixed(1) : "—"}</WidgetValue>
      <WidgetBar
        value={Math.min(1, performance.fps / 60)}
        tone={audio}
        label="Frames per second relative to 60"
      />
      <WidgetRows>
        <WidgetRow label="Frame time" value={`${performance.frameTime.toFixed(2)} ms`} />
        <WidgetRow
          label="Long tasks"
          value={performance.supported.longTasks ? String(performance.longTasks) : "not observable"}
          title="Tasks over 50 ms observed in the last window."
        />
        {showMemory ? (
          <WidgetRow
            label="JS heap"
            value={
              performance.memory
                ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} / ${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(0)} MB`
                : "not exposed"
            }
            title={
              performance.memory
                ? undefined
                : "performance.memory is a non-standard API available in Chromium browsers only."
            }
          />
        ) : null}
        {performance.navigation ? (
          <WidgetRow label="TTFB" value={formatMs(performance.navigation.ttfb)} />
        ) : null}
        {performance.hardwareConcurrency ? (
          <WidgetRow label="Logical cores" value={String(performance.hardwareConcurrency)} />
        ) : null}
        {performance.deviceMemory ? (
          <WidgetRow label="Device memory" value={`≥ ${performance.deviceMemory} GB`} />
        ) : null}
        <WidgetRow label="CPU temperature" value="unavailable" title={performance.cpuTemperature.reason} />
      </WidgetRows>
      <WidgetState tone="caution">
        {performance.cpuTemperature.supported ? "" : "Hardware sensors are not exposed to web pages"}
      </WidgetState>
      <WidgetNote>{performance.cpuTemperature.reason}</WidgetNote>
    </Widget>
  );
};
