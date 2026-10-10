/**
 * Weather providers.
 *
 * Two implementations ship with the library:
 *
 * - {@link createOpenMeteoProvider} talks to the public Open-Meteo API. The
 *   endpoint is a parameter with a documented default, so the request is always
 *   something the developer can see and change.
 * - {@link createStaticWeatherProvider} returns values you pass in. It performs
 *   no network access at all and exists for tests, documentation and offline
 *   demos.
 */

import {
  fetchJson,
  providerError,
  providerSuccess,
  providerUnsupported,
  type WeatherCondition,
  type WeatherData,
  type WeatherProvider,
  type WeatherRequest,
} from "./contracts";

/**
 * WMO weather interpretation codes, as used by Open-Meteo.
 * https://open-meteo.com/en/docs
 */
export const conditionFromWmoCode = (code: number | null): WeatherCondition => {
  if (code === null) return "unknown";
  if (code === 0) return "clear";
  if (code === 1) return "mostly-clear";
  if (code === 2) return "cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 65) return "rain";
  if (code === 66 || code === 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunderstorm";
  return "unknown";
};

export interface OpenMeteoOptions {
  /** Base URL of the forecast endpoint. */
  baseUrl?: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  current_units?: { temperature_2m?: string };
  timezone?: string;
  error?: boolean;
  reason?: string;
}

/**
 * Open-Meteo provider. Free, no API key, no tracking parameters beyond the
 * coordinates you pass.
 *
 * ```ts
 * const weather = createOpenMeteoProvider();
 * ```
 */
export const createOpenMeteoProvider = (
  options: OpenMeteoOptions = {},
): WeatherProvider => {
  const baseUrl = options.baseUrl ?? "https://api.open-meteo.com/v1/forecast";
  const timeoutMs = options.timeoutMs ?? 8000;

  return {
    name: "open-meteo",
    endpoint: baseUrl,
    async fetchWeather(request: WeatherRequest) {
      const url = new URL(baseUrl);
      url.searchParams.set("latitude", String(request.latitude));
      url.searchParams.set("longitude", String(request.longitude));
      url.searchParams.set(
        "current",
        "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
      );
      if (request.unit === "fahrenheit") {
        url.searchParams.set("temperature_unit", "fahrenheit");
        url.searchParams.set("wind_speed_unit", "mph");
      }
      url.searchParams.set("timezone", "auto");

      try {
        const response = await fetchJson(url.toString(), {
          timeoutMs,
          ...(request.signal ? { signal: request.signal } : {}),
        });

        if (!response.ok) {
          const reason =
            typeof response.data === "object" && response.data !== null
              ? ((response.data as { reason?: string }).reason ?? null)
              : null;
          return providerError(
            reason ?? `Open-Meteo responded with HTTP ${response.status}.`,
            {
              httpStatus: response.status,
              retryable: response.status >= 500 || response.status === 429,
            },
          );
        }

        const payload = response.data as OpenMeteoResponse | null;
        const current = payload?.current;
        if (
          !payload ||
          !current ||
          typeof current.temperature_2m !== "number"
        ) {
          return providerError("Open-Meteo returned no current observation.", {
            retryable: true,
          });
        }

        const data: WeatherData = {
          temperature: current.temperature_2m,
          apparentTemperature:
            typeof current.apparent_temperature === "number"
              ? current.apparent_temperature
              : null,
          condition: conditionFromWmoCode(
            typeof current.weather_code === "number"
              ? current.weather_code
              : null,
          ),
          conditionCode:
            typeof current.weather_code === "number"
              ? current.weather_code
              : null,
          unit: request.unit,
          humidity:
            typeof current.relative_humidity_2m === "number"
              ? current.relative_humidity_2m
              : null,
          windSpeed:
            typeof current.wind_speed_10m === "number"
              ? current.wind_speed_10m
              : null,
          observedAt: current.time ?? null,
          timezone: payload.timezone ?? null,
        };

        return providerSuccess(data, "open-meteo");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return providerError("The weather request was aborted.", {
            retryable: false,
          });
        }
        return providerError(
          error instanceof Error
            ? error.message
            : "The weather request failed.",
          {
            retryable: true,
          },
        );
      }
    },
  };
};

/**
 * Offline provider: returns exactly the values you give it.
 *
 * Use it in tests, in Storybook, in documentation screenshots or on a demo page
 * that must not make network requests. It never contacts anything.
 */
export const createStaticWeatherProvider = (
  data: Partial<WeatherData> & { temperature: number },
  options: { name?: string } = {},
): WeatherProvider => ({
  name: options.name ?? "static",
  endpoint: null,
  async fetchWeather(request: WeatherRequest) {
    return providerSuccess(
      {
        temperature: data.temperature,
        apparentTemperature: data.apparentTemperature ?? null,
        condition: data.condition ?? "unknown",
        conditionCode: data.conditionCode ?? null,
        unit: data.unit ?? request.unit,
        humidity: data.humidity ?? null,
        windSpeed: data.windSpeed ?? null,
        observedAt: data.observedAt ?? null,
        timezone: data.timezone ?? null,
      },
      "static",
    );
  },
});

/** Provider that always reports "unsupported" — useful to model a disabled feature. */
export const createUnsupportedWeatherProvider = (
  reason: string,
): WeatherProvider => ({
  name: "unsupported",
  endpoint: null,
  async fetchWeather() {
    return providerUnsupported(reason);
  },
});

/** Convert a temperature between units. Local arithmetic, no rounding surprises. */
export const convertTemperature = (
  value: number,
  from: "celsius" | "fahrenheit",
  to: "celsius" | "fahrenheit",
): number => {
  if (from === to) return value;
  return from === "celsius" ? value * 1.8 + 32 : (value - 32) / 1.8;
};

/** `21°C` / `70°F`, with the degree symbol and unit letter. */
export const formatTemperature = (
  value: number,
  unit: "celsius" | "fahrenheit",
): string => `${Math.round(value)}\u00b0${unit === "celsius" ? "C" : "F"}`;
