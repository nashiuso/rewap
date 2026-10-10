/**
 * `<ClockWidget>` — a clock that reads the device clock and formats it with
 * `Intl`, optionally in a specific time zone.
 *
 * No network time source is used. If you need authoritative time, fetch it from
 * your own backend and pass it in; the widget states that its source is the
 * device clock.
 */

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import {
  Widget,
  WidgetNote,
  WidgetRows,
  WidgetRow,
  WidgetValue,
} from "./Widget";

export interface ClockWidgetProps {
  title?: string;
  /** IANA time zone, e.g. `"Europe/Madrid"`. Defaults to the device's zone. */
  timeZone?: string;
  /** `"24h"` (default) or `"12h"`. */
  hourCycle?: "24h" | "12h";
  /** Show the date below the time. Defaults to `true`. */
  showDate?: boolean;
  /** Show the time zone identifier. Defaults to `true`. */
  showTimeZone?: boolean;
  /** Show seconds. Defaults to `true`. */
  showSeconds?: boolean;
  /** Re-render interval in milliseconds. Defaults to 1000 (or 15000 without seconds). */
  tickMs?: number;
  className?: string;
  style?: CSSProperties;
}

export const ClockWidget = ({
  title = "Clock",
  timeZone,
  hourCycle = "24h",
  showDate = true,
  showTimeZone = true,
  showSeconds = true,
  tickMs,
  className,
  style,
}: ClockWidgetProps) => {
  const [now, setNow] = useState(() => new Date());

  const interval = tickMs ?? (showSeconds ? 1000 : 15_000);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(timer);
  }, [interval]);

  const deviceZone = useMemo(
    () =>
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC",
    [],
  );
  const zone = timeZone ?? deviceZone;

  const time = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        ...(showSeconds ? { second: "2-digit" } : {}),
        hour12: hourCycle === "12h",
        timeZone: zone,
      }).format(now);
    } catch {
      return now.toLocaleTimeString();
    }
  }, [hourCycle, now, showSeconds, zone]);

  const date = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        timeZone: zone,
      }).format(now);
    } catch {
      return now.toDateString();
    }
  }, [now, zone]);

  const offset = useMemo(() => {
    try {
      const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value;
      return formatted ?? null;
    } catch {
      return null;
    }
  }, [now, zone]);

  return (
    <Widget
      title={title}
      className={className}
      style={style}
      meta={
        timeZone && timeZone !== deviceZone ? "override zone" : "device clock"
      }
    >
      <WidgetValue>{time}</WidgetValue>
      <WidgetRows>
        {showDate ? <WidgetRow label="Date" value={date} /> : null}
        {showTimeZone ? (
          <WidgetRow
            label="Time zone"
            value={`${zone}${offset ? ` (${offset})` : ""}`}
          />
        ) : null}
      </WidgetRows>
      <WidgetNote>
        Read from this device's clock — not synchronized with a time server.
      </WidgetNote>
    </Widget>
  );
};
