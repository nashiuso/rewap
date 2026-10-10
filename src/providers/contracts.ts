/**
 * Provider contracts.
 *
 * Anything that needs information the browser cannot produce locally — weather,
 * IP geolocation, server-side email verification — is modelled as an explicit
 * provider. Providers are created by the application, so:
 *
 * - no request is ever made without the developer writing the code that makes it;
 * - the endpoint is visible in the application's own source;
 * - a provider that cannot work returns `status: "unsupported"` with a reason,
 *   which the UI can display honestly.
 */

export interface ProviderSuccess<T> {
  status: "success";
  data: T;
  /** The provider that produced the value, for display and debugging. */
  source: string;
  /** Epoch milliseconds. */
  fetchedAt: number;
  /** True when the value came from a local cache rather than the network. */
  cached?: boolean;
}

export interface ProviderUnsupported {
  status: "unsupported";
  /** Plain-language explanation, safe to render in a UI. */
  reason: string;
}

export interface ProviderError {
  status: "error";
  message: string;
  retryable: boolean;
  /** HTTP status when the failure came from a request. */
  httpStatus?: number;
}

export type ProviderOutcome<T> =
  ProviderSuccess<T> | ProviderUnsupported | ProviderError;

export const providerSuccess = <T>(
  data: T,
  source: string,
  cached = false,
): ProviderSuccess<T> => ({
  status: "success",
  data,
  source,
  fetchedAt: Date.now(),
  cached,
});

export const providerUnsupported = (reason: string): ProviderUnsupported => ({
  status: "unsupported",
  reason,
});

export const providerError = (
  message: string,
  options: { retryable?: boolean; httpStatus?: number } = {},
): ProviderError => ({
  status: "error",
  message,
  retryable: options.retryable ?? true,
  ...(options.httpStatus !== undefined
    ? { httpStatus: options.httpStatus }
    : {}),
});

// ------------------------------------------------------------------- weather

export type TemperatureUnit = "celsius" | "fahrenheit";

export interface WeatherData {
  /** Air temperature in the requested unit. */
  temperature: number;
  /** Feels-like temperature in the requested unit. */
  apparentTemperature: number | null;
  /** Normalized condition, e.g. `"clear"`, `"rain"`, `"snow"`. */
  condition: WeatherCondition;
  /** The provider's raw condition code (WMO code for Open-Meteo). */
  conditionCode: number | null;
  unit: TemperatureUnit;
  humidity: number | null;
  windSpeed: number | null;
  /** ISO timestamp reported by the provider. */
  observedAt: string | null;
  timezone: string | null;
}

export type WeatherCondition =
  | "clear"
  | "mostly-clear"
  | "cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "showers"
  | "snow"
  | "thunderstorm"
  | "unknown";

export interface WeatherRequest {
  latitude: number;
  longitude: number;
  unit: TemperatureUnit;
  signal?: AbortSignal;
}

export interface WeatherProvider {
  readonly name: string;
  /** Endpoint this provider contacts; `null` for local/offline providers. */
  readonly endpoint: string | null;
  fetchWeather(request: WeatherRequest): Promise<ProviderOutcome<WeatherData>>;
}

// ---------------------------------------------------------------- geolocation

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  /** City name when the source provides one; `null` for raw coordinates. */
  city: string | null;
  country: string | null;
  /** How the location was obtained. */
  accuracy: "coarse" | "precise" | "declared";
  source: string;
}

export interface IpLocationProvider {
  readonly name: string;
  /** The endpoint contacted to resolve the IP. Never optional: it is the point. */
  readonly endpoint: string;
  locate(signal?: AbortSignal): Promise<ProviderOutcome<ResolvedLocation>>;
}

export interface GeolocationProvider {
  readonly name: string;
  locate(signal?: AbortSignal): Promise<ProviderOutcome<ResolvedLocation>>;
}

// ---------------------------------------------------------- email verification

export interface EmailVerificationVerdict {
  /** `true` when the provider considers the address deliverable. */
  deliverable: boolean;
  /** Provider-specific status, e.g. `"deliverable"`, `"undeliverable"`, `"risky"`. */
  state: string;
  /** Domain-level check result when available. */
  domainHasMx: boolean | null;
  /** Whether the mailbox itself was confirmed (most providers cannot do this). */
  mailboxConfirmed: boolean | null;
  /** Human-readable note, safe to render. */
  message: string | null;
}

export interface EmailVerificationRequest {
  email: string;
  signal?: AbortSignal;
}

export interface EmailVerificationProvider {
  readonly name: string;
  readonly endpoint: string | null;
  verify(
    request: EmailVerificationRequest,
  ): Promise<ProviderOutcome<EmailVerificationVerdict>>;
}

/** Narrow helper: fetch with a timeout and JSON parsing, shared by providers. */
export const fetchJson = async (
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; data: unknown }> => {
  const { timeoutMs = 8000, signal, ...rest } = init;
  if (typeof fetch !== "function") {
    throw new Error("fetch is not available in this environment.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(url, { ...rest, signal: controller.signal });
    const data: unknown = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
};
