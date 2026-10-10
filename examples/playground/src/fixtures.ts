/**
 * Deterministic local data for the playground.
 *
 * Nothing in here calls `fetch`. The built playground has to work from a
 * `file://` preview and from a static Pages deployment with no backend, so
 * anything that would normally hit a network goes through a fixture instead.
 */
import type {
  ProviderOutcome,
  WeatherData,
  WeatherProvider,
  WeatherRequest,
} from "@nashiuso/rewap/providers";

/** A `WeatherProvider` that returns a fixed reading instead of calling an API. */
export const createFixtureWeatherProvider = (
  data: WeatherData,
): WeatherProvider => ({
  name: "fixture",
  endpoint: null,
  async fetchWeather(
    _request: WeatherRequest,
  ): Promise<ProviderOutcome<WeatherData>> {
    return {
      status: "success",
      data,
      source: "fixture",
      fetchedAt: Date.now(),
    };
  },
});

export const barcelonaWeather: WeatherData = {
  temperature: 21,
  apparentTemperature: 20,
  condition: "mostly-clear",
  conditionCode: 1,
  unit: "celsius",
  humidity: 58,
  windSpeed: 14,
  observedAt: new Date().toISOString(),
  timezone: "Europe/Madrid",
};

/** Seven days of a made-up but plausible request-latency series, in ms. */
export const latencySeries = [
  182, 176, 190, 168, 171, 165, 158, 162, 149, 155, 147, 151, 140, 144,
];

/** A short, fixed activity log — the kind of thing a real dashboard renders. */
export const activityLog = [
  {
    id: "a1",
    label: "Deploy finished",
    detail: "main @ a8a1471",
    time: "2 min ago",
  },
  {
    id: "a2",
    label: "Issue closed",
    detail: "#214 flicker on drop",
    time: "17 min ago",
  },
  {
    id: "a3",
    label: "PR merged",
    detail: "fix: projection off by one",
    time: "41 min ago",
  },
  { id: "a4", label: "Test run", detail: "359 passed", time: "1 hr ago" },
];
