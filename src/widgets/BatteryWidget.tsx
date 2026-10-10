/**
 * `<BatteryWidget>` — battery level and charging state where the browser exposes it.
 *
 * Firefox and Safari do not implement the Battery Status API. When it is missing,
 * the widget says so; it never shows a placeholder percentage.
 */

import type { CSSProperties } from "react";

import { useBattery } from "../utilities/useBattery";
import {
  Widget,
  WidgetBar,
  WidgetNote,
  WidgetRows,
  WidgetRow,
  WidgetState,
  WidgetValue,
} from "./Widget";

export interface BatteryWidgetProps {
  title?: string;
  className?: string;
  style?: CSSProperties;
}

const formatDuration = (seconds: number | null): string => {
  if (seconds === null) return "—";
  if (!Number.isFinite(seconds)) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
};

export const BatteryWidget = ({
  title = "Battery",
  className,
  style,
}: BatteryWidgetProps) => {
  const battery = useBattery();

  if (!battery.supported) {
    return (
      <Widget
        title={title}
        className={className}
        style={style}
        meta="unsupported"
      >
        <WidgetState tone="caution">Not available</WidgetState>
        <WidgetNote>{battery.unsupportedReason}</WidgetNote>
      </Widget>
    );
  }

  const level = battery.level ?? 0;
  const tone = battery.charging
    ? "positive"
    : level > 0.4
      ? "accent"
      : level > 0.15
        ? "caution"
        : "negative";

  return (
    <Widget
      title={title}
      className={className}
      style={style}
      meta={
        battery.loading
          ? "loading"
          : battery.charging
            ? "charging"
            : "on battery"
      }
    >
      <WidgetValue unit="%">
        {battery.level === null ? "—" : Math.round(level * 100)}
      </WidgetValue>
      <WidgetBar value={level} tone={tone} label="Battery level" />
      <WidgetRows>
        <WidgetRow label="Charging" value={battery.charging ? "yes" : "no"} />
        <WidgetRow
          label="Time to full"
          value={formatDuration(battery.chargingTime)}
        />
        <WidgetRow
          label="Time remaining"
          value={formatDuration(battery.dischargingTime)}
        />
      </WidgetRows>
      <WidgetNote>
        Some browsers round the reported level (often to the nearest 5%) to
        limit fingerprinting.
      </WidgetNote>
    </Widget>
  );
};
