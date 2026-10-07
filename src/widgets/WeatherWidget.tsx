/**
 * `<WeatherWidget>` — current conditions from a weather provider you configure.
 *
 * With no provider it renders an explicit "not configured" state instead of a
 * fabricated temperature, which is the honest behaviour for a library that must
 * not call external services behind your back.
 */

import type { CSSProperties } from "react";

import { useWeather, type UseWeatherOptions } from "../utilities/useWeather";
import { Widget, WidgetNote, WidgetRows, WidgetRow, WidgetState, WidgetValue, WidgetError } from "./Widget";

export interface WeatherWidgetProps extends UseWeatherOptions {
  title?: string;
  className?: string;
  style?: CSSProperties;
  /** Show the resolved location line. Defaults to `true`. */
  showLocation?: boolean;
}

const conditionLabels: Record<string, string> = {
  clear: "Clear",
  "mostly-clear": "Mostly clear",
  cloudy: "Cloudy",
  overcast: "Overcast",
  fog: "Fog",
  drizzle: "Drizzle",
  rain: "Rain",
  showers: "Showers",
  snow: "Snow",
  thunderstorm: "Thunderstorm",
  unknown: "Unknown",
};

const formatTime = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

export const WeatherWidget = ({
  title = "Weather",
  className,
  style,
  showLocation = true,
  ...weatherOptions
}: WeatherWidgetProps) => {
  const weather = useWeather(weatherOptions);
  const unitLabel = weather.data?.unit === "fahrenheit" ? "°F" : "°C";
  const locationLine = weather.location
    ? [weather.location.city, weather.location.country].filter(Boolean).join(", ") ||
      `${weather.location.latitude.toFixed(2)}, ${weather.location.longitude.toFixed(2)}`
    : null;

  return (
    <Widget
      title={title}
      className={className}
      style={style}
      meta={
        weather.data
          ? `observed ${formatTime(weather.data.observedAt)}${weather.cached ? " · cached" : ""}`
          : weather.status
      }
    >
      {weather.status === "unsupported" ? (
        <>
          <WidgetState tone="caution">Not configured</WidgetState>
          <WidgetNote>{weather.unsupportedReason}</WidgetNote>
        </>
      ) : null}

      {weather.status === "error" ? (
        <WidgetError>{weather.error ?? "The weather request failed."}</WidgetError>
      ) : null}

      {weather.status === "locating" || weather.status === "loading" || weather.status === "idle" ? (
        <WidgetState tone="accent">
          {weather.status === "locating" ? "Resolving location…" : "Loading…"}
        </WidgetState>
      ) : null}

      {weather.data ? (
        <>
          <WidgetValue unit={unitLabel}>{Math.round(weather.data.temperature)}</WidgetValue>
          <WidgetRows>
            <WidgetRow
              label="Condition"
              value={conditionLabels[weather.data.condition] ?? weather.data.condition}
            />
            {weather.data.apparentTemperature !== null ? (
              <WidgetRow
                label="Feels like"
                value={`${Math.round(weather.data.apparentTemperature)}${unitLabel}`}
              />
            ) : null}
            {weather.data.humidity !== null ? (
              <WidgetRow label="Humidity" value={`${weather.data.humidity}%`} />
            ) : null}
            {weather.data.windSpeed !== null ? (
              <WidgetRow
                label="Wind"
                value={`${Math.round(weather.data.windSpeed)} ${weather.data.unit === "fahrenheit" ? "mph" : "km/h"}`}
              />
            ) : null}
            {showLocation && locationLine ? (
              <WidgetRow
                label={weather.location?.accuracy === "coarse" ? "Approx. location" : "Location"}
                value={locationLine}
                title={
                  weather.location?.accuracy === "coarse" ? "IP-based location is approximate." : undefined
                }
              />
            ) : null}
          </WidgetRows>
        </>
      ) : null}
    </Widget>
  );
};
