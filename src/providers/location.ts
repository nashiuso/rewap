/**
 * Location providers.
 *
 * Two sources are possible, and both require the developer to opt in:
 *
 * - {@link createIpLocationProvider} asks an endpoint *you* configure. IP
 *   geolocation is approximate (city level at best) and the request reveals your
 *   users' IP address to that endpoint, which is why the endpoint is mandatory.
 * - {@link createBrowserGeolocationProvider} uses `navigator.geolocation`, which
 *   asks the user for permission through the browser's own UI.
 *
 * {@link createDeclaredLocationProvider} is a third, offline option: the
 * application declares a location (a user's saved city, for example).
 */

import {
  fetchJson,
  providerError,
  providerSuccess,
  providerUnsupported,
  type IpLocationProvider,
  type ResolvedLocation,
  type GeolocationProvider,
} from "./contracts";

export interface IpLocationOptions {
  /** Endpoint to query. Required — the library never picks one for you. */
  endpoint: string;
  /** Maps the response body to a location. Defaults to a common flat shape. */
  parse?: (body: unknown) => {
    latitude: number;
    longitude: number;
    city?: string | null;
    country?: string | null;
  } | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

const defaultParse = (
  body: unknown,
): {
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
} | null => {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const latitude = Number(record.latitude ?? record.lat);
  const longitude = Number(record.longitude ?? record.lon ?? record.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const city = typeof record.city === "string" ? record.city : null;
  const country =
    typeof record.country === "string"
      ? record.country
      : typeof record.country_name === "string"
        ? record.country_name
        : null;
  return { latitude, longitude, city, country };
};

/**
 * IP-based location provider.
 *
 * ```ts
 * const location = createIpLocationProvider({
 *   endpoint: "https://ipapi.co/json/",
 * });
 * ```
 *
 * The default response parser understands a flat `{ latitude, longitude, city,
 * country }` shape. Pass `parse` for anything else.
 */
export const createIpLocationProvider = (
  options: IpLocationOptions,
): IpLocationProvider => {
  const parse = options.parse ?? defaultParse;
  return {
    name: "ip",
    endpoint: options.endpoint,
    async locate(signal?: AbortSignal) {
      if (!options.endpoint) {
        return providerUnsupported(
          "No IP geolocation endpoint was configured.",
        );
      }
      try {
        const response = await fetchJson(options.endpoint, {
          headers: options.headers,
          timeoutMs: options.timeoutMs ?? 8000,
          ...(signal ? { signal } : {}),
        });
        if (!response.ok) {
          return providerError(
            `The location endpoint responded with HTTP ${response.status}.`,
            {
              httpStatus: response.status,
              retryable: response.status >= 500,
            },
          );
        }
        const parsed = parse(response.data);
        if (!parsed) {
          return providerError(
            "The location endpoint returned an unexpected payload.",
            {
              retryable: false,
            },
          );
        }
        const location: ResolvedLocation = {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          city: parsed.city ?? null,
          country: parsed.country ?? null,
          accuracy: "coarse",
          source: "ip",
        };
        return providerSuccess(location, "ip");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return providerError("The location request was aborted.", {
            retryable: false,
          });
        }
        return providerError(
          error instanceof Error
            ? error.message
            : "The location request failed.",
        );
      }
    },
  };
};

export interface BrowserGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}

/**
 * Browser geolocation.
 *
 * Uses the platform API and therefore the platform's permission prompt. When the
 * API is missing or the permission is denied, the outcome is an explicit
 * `unsupported`/`error` result — never a fallback to an IP lookup.
 */
export const createBrowserGeolocationProvider = (
  options: BrowserGeolocationOptions = {},
): GeolocationProvider => ({
  name: "browser-geolocation",
  async locate(signal?: AbortSignal) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return providerUnsupported(
        "navigator.geolocation is not available (it requires a secure context).",
      );
    }
    const geolocation = navigator.geolocation;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (
        outcome:
          | ReturnType<typeof providerSuccess<ResolvedLocation>>
          | ReturnType<typeof providerError>
          | ReturnType<typeof providerUnsupported>,
      ) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        resolve(outcome);
      };
      const onAbort = () => {
        finish(
          providerError("The location request was aborted.", {
            retryable: false,
          }),
        );
      };
      signal?.addEventListener("abort", onAbort);

      geolocation.getCurrentPosition(
        (position) => {
          finish(
            providerSuccess(
              {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                city: null,
                country: null,
                accuracy: "precise",
                source: "browser-geolocation",
              },
              "browser-geolocation",
            ),
          );
        },
        (error) => {
          const messages: Record<number, string> = {
            1: "Location permission was denied.",
            2: "The device could not determine a position.",
            3: "The location request timed out.",
          };
          finish(
            providerError(
              messages[error.code] ?? "The location request failed.",
              {
                retryable: error.code !== 1,
              },
            ),
          );
        },
        {
          enableHighAccuracy: options.enableHighAccuracy ?? false,
          timeout: options.timeoutMs ?? 10000,
          maximumAge: options.maximumAgeMs ?? 0,
        },
      );
    });
  },
});

/**
 * Offline provider for an application-declared location.
 *
 * Nothing is requested and nothing is inferred: the values are exactly what the
 * application passed in.
 */
export const createDeclaredLocationProvider = (location: {
  latitude: number;
  longitude: number;
  city?: string | null;
  country?: string | null;
  label?: string;
}): GeolocationProvider => ({
  name: location.label ?? "declared",
  async locate() {
    return providerSuccess(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city ?? null,
        country: location.country ?? null,
        accuracy: "declared",
        source: location.label ?? "declared",
      },
      location.label ?? "declared",
    );
  },
});
