/**
 * `useWeather(options)` — weather for a location, through explicit providers.
 *
 * The hook never contacts the network on its own:
 *
 * - `source: "coordinates"` (default) uses the coordinates you pass;
 * - `source: "declared"` uses a provider you create (a saved city, for example);
 * - `source: "geolocation"` uses the browser's own permission prompt;
 * - `source: "ip"` requires an IP-location provider with an endpoint you chose.
 *
 * Weather data itself always comes from a {@link WeatherProvider}, so if none is
 * configured the hook reports `status: "unsupported"` with the reason instead of
 * inventing a temperature.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type GeolocationProvider,
  type IpLocationProvider,
  type ResolvedLocation,
  type TemperatureUnit,
  type WeatherData,
  type WeatherProvider,
} from "../providers/contracts";
import {
  resolveStorage,
  type StorageKind,
  type StorageLike,
} from "../core/persistence";

export type WeatherStatus =
  "idle" | "unsupported" | "locating" | "loading" | "success" | "error";

export interface WeatherCacheOptions {
  /** Time to live in milliseconds. Defaults to 10 minutes. */
  ttlMs?: number;
  /** Where to cache. Defaults to `sessionStorage`; `"memory"` keeps it in the tab. */
  storage?: "memory" | "localStorage" | "sessionStorage" | StorageLike;
  key?: string;
}

export interface UseWeatherOptions {
  /** Where the coordinates come from. */
  source?: "coordinates" | "geolocation" | "ip" | "declared";
  /** Coordinates for `source: "coordinates"`. */
  coordinates?: { latitude: number; longitude: number };
  /** Required for `source: "ip"`; never defaulted, because it reveals the user's IP. */
  locationProvider?: IpLocationProvider | GeolocationProvider;
  /** Required to fetch weather data from anywhere. */
  provider?: WeatherProvider;
  unit?: TemperatureUnit;
  /** Refresh interval in milliseconds; `0` disables it. */
  refreshIntervalMs?: number;
  /** Local caching. Set to `false` to always fetch. */
  cache?: WeatherCacheOptions | false;
  /** Set to `false` to keep the hook idle. */
  enabled?: boolean;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

export interface WeatherState {
  status: WeatherStatus;
  data: WeatherData | null;
  location: ResolvedLocation | null;
  error: string | null;
  /** Why the hook cannot produce data, when it cannot. */
  unsupportedReason: string | null;
  /** Browser geolocation permission, where it can be read. */
  permission: "unknown" | "granted" | "denied" | "prompt";
  /** True when the value came from the local cache. */
  cached: boolean;
  fetchedAt: number | null;
  refresh(): void;
}

interface CacheRecord {
  data: WeatherData;
  location: ResolvedLocation;
  fetchedAt: number;
}

const memoryCache = new Map<string, CacheRecord>();

const cacheKeyFor = (
  provider: WeatherProvider,
  keyPrefix: string,
  unit: TemperatureUnit,
  location: ResolvedLocation,
): string =>
  [
    keyPrefix,
    provider.name,
    location.latitude.toFixed(3),
    location.longitude.toFixed(3),
    unit,
  ].join(":");

const readCache = (
  key: string,
  storage: StorageLike | null,
  ttlMs: number,
): CacheRecord | null => {
  const fromMemory = memoryCache.get(key);
  if (fromMemory && Date.now() - fromMemory.fetchedAt < ttlMs)
    return fromMemory;
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheRecord;
    if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt >= ttlMs)
      return null;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (
  key: string,
  record: CacheRecord,
  storage: StorageLike | null,
): void => {
  memoryCache.set(key, record);
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(record));
  } catch {
    // Storage may be full or disabled; the memory cache still applies.
  }
};

const readPermission = async (): Promise<WeatherState["permission"]> => {
  if (typeof navigator === "undefined" || !navigator.permissions?.query)
    return "unknown";
  try {
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    return status.state as WeatherState["permission"];
  } catch {
    return "unknown";
  }
};

export const useWeather = (options: UseWeatherOptions = {}): WeatherState => {
  const {
    source = "coordinates",
    coordinates,
    locationProvider,
    provider,
    unit = "celsius",
    refreshIntervalMs = 0,
    cache = {},
    enabled = true,
    timeoutMs = 8000,
  } = options;

  // NOTE(nashiuso): the cache options are almost always written inline
  // (`cache={{ ttlMs: 60_000 }}`), so the memo below depends on the *values*, not
  // on the object. Depending on the object created a new storage on every render,
  // which re-ran the fetch effect through its `storage` dependency and kept the
  // component rendering until the tab ran out of memory. Found the hard way.
  const cacheEnabled = cache !== false;
  const storageOption = cacheEnabled
    ? ((cache as WeatherCacheOptions).storage ?? "sessionStorage")
    : null;
  const customStorage =
    storageOption !== null && typeof storageOption === "object"
      ? storageOption
      : null;
  const storageKind: StorageKind = customStorage
    ? "sessionStorage"
    : ((storageOption as StorageKind | null) ?? "sessionStorage");

  const storage = useMemo<StorageLike | null>(() => {
    if (!cacheEnabled) return null;
    if (customStorage) return customStorage;
    return resolveStorage(storageKind);
  }, [cacheEnabled, customStorage, storageKind]);

  const ttlMs = cache === false ? 0 : (cache.ttlMs ?? 10 * 60 * 1000);
  const cacheKeyPrefix =
    cache === false ? "rewap:weather" : (cache.key ?? "rewap:weather");

  const [state, setState] = useState<WeatherState>(() => ({
    status: enabled ? "idle" : "idle",
    data: null,
    location: null,
    error: null,
    unsupportedReason: null,
    permission: "unknown",
    cached: false,
    fetchedAt: null,
    refresh: () => {},
  }));

  const abortRef = useRef<AbortController | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;

    // Configuration problems are reported, not worked around.
    if (!provider) {
      setState((previous) => ({
        ...previous,
        status: "unsupported",
        error: null,
        unsupportedReason:
          "No weather provider is configured. Create one with createOpenMeteoProvider() or pass your own from @nashiuso/rewap/providers.",
      }));
      return;
    }
    if (source === "ip" && !locationProvider) {
      setState((previous) => ({
        ...previous,
        status: "unsupported",
        unsupportedReason:
          'source: "ip" requires locationProvider: createIpLocationProvider({ endpoint }) so the request goes somewhere you chose.',
      }));
      return;
    }
    if (source === "coordinates" && !coordinates) {
      setState((previous) => ({
        ...previous,
        status: "unsupported",
        unsupportedReason:
          'source: "coordinates" requires a coordinates object.',
      }));
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const run = async () => {
      let location: ResolvedLocation | null = null;

      if (source === "coordinates") {
        const coords = coordinates as { latitude: number; longitude: number };
        location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          city: null,
          country: null,
          accuracy: "declared",
          source: "coordinates",
        };
      } else {
        setState((previous) => ({
          ...previous,
          status: "locating",
          unsupportedReason: null,
        }));
        setState((previous) => ({
          ...previous,
          permission: previous.permission,
        }));
        void readPermission().then((permission) => {
          if (controller.signal.aborted) return;
          setState((previous) => ({ ...previous, permission }));
        });
        const outcome = await locationProvider!.locate(controller.signal);
        if (controller.signal.aborted) return;
        if (outcome.status !== "success") {
          setState((previous) => ({
            ...previous,
            status: outcome.status === "unsupported" ? "unsupported" : "error",
            error: outcome.status === "error" ? outcome.message : null,
            unsupportedReason:
              outcome.status === "unsupported" ? outcome.reason : null,
          }));
          return;
        }
        location = outcome.data;
      }

      const key = cacheKeyFor(provider, cacheKeyPrefix, unit, location);
      const cached = ttlMs > 0 ? readCache(key, storage, ttlMs) : null;
      if (cached) {
        setState((previous) => ({
          ...previous,
          status: "success",
          data: cached.data,
          location: cached.location,
          error: null,
          unsupportedReason: null,
          cached: true,
          fetchedAt: cached.fetchedAt,
        }));
        return;
      }

      setState((previous) => ({
        ...previous,
        status: "loading",
        location,
        error: null,
        unsupportedReason: null,
      }));

      const outcome = await provider.fetchWeather({
        latitude: location.latitude,
        longitude: location.longitude,
        unit,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      if (outcome.status === "success") {
        const record: CacheRecord = {
          data: outcome.data,
          location,
          fetchedAt: outcome.fetchedAt,
        };
        if (ttlMs > 0) writeCache(key, record, storage);
        setState((previous) => ({
          ...previous,
          status: "success",
          data: outcome.data,
          location: record.location,
          error: null,
          unsupportedReason: null,
          cached: false,
          fetchedAt: outcome.fetchedAt,
        }));
        return;
      }

      setState((previous) => ({
        ...previous,
        status: outcome.status === "unsupported" ? "unsupported" : "error",
        error: outcome.status === "error" ? outcome.message : null,
        unsupportedReason:
          outcome.status === "unsupported" ? outcome.reason : null,
      }));
    };

    void run();

    return () => {
      controller.abort();
    };
    // `options` is intentionally not a dependency: the individual fields below are
    // what actually change, and re-running on every render would refetch forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    nonce,
    provider,
    source,
    coordinates?.latitude,
    coordinates?.longitude,
    locationProvider,
    unit,
    storage,
    ttlMs,
    cacheKeyPrefix,
    timeoutMs,
  ]);

  useEffect(() => {
    if (!enabled || refreshIntervalMs <= 0) return;
    const timer = setInterval(refresh, Math.max(30_000, refreshIntervalMs));
    return () => clearInterval(timer);
  }, [enabled, refresh, refreshIntervalMs]);

  return { ...state, refresh };
};
