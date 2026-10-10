# Providers

Everything in `@nashiuso/rewap/providers` is an adapter for data this library cannot
produce itself: weather, an approximate location, e-mail deliverability. Nothing here
runs on its own. A provider that is never configured is never called, and no request
is ever made on your behalf.

```tsx
import {
  createOpenMeteoProvider,
  createStaticWeatherProvider,
  createDeclaredLocationProvider,
  createBrowserGeolocationProvider,
  createIpLocationProvider,
  createHttpEmailVerifier,
  createSyntaxEmailVerifier,
} from "@nashiuso/rewap/providers";
```

The rule the module is built around: **if the data would need the network, the
application says so explicitly, and the application supplies the endpoint.** There is
no default weather API, no "just works" geolocation and no hidden telemetry.

## The outcome shape

Every provider call returns the same three-state value, so a widget never has to guess
what happened:

```ts
type ProviderOutcome<T> =
  | {
      status: "success";
      data: T;
      source: string;
      fetchedAt: number;
      cached?: boolean;
    }
  | { status: "unsupported"; reason: string }
  | {
      status: "error";
      message: string;
      retryable: boolean;
      httpStatus?: number;
    };
```

`unsupported` means the environment cannot answer — a browser without a Battery Status
API, or a hook with no provider configured. `error` means something was attempted and
failed, with `retryable: false` for a 4xx that will fail again.

## Weather

```tsx
const weather = createOpenMeteoProvider({
  endpoint: "https://api.open-meteo.com/v1/forecast", // your endpoint, your policy
});

<WeatherWidget
  provider={weather}
  locationProvider={barcelona}
  unit="celsius"
/>;
```

| Provider                      | Network | Notes                                                     |
| ----------------------------- | ------- | --------------------------------------------------------- |
| `createOpenMeteoProvider`     | yes     | Open-Meteo's JSON shape; asks for the endpoint explicitly |
| `createStaticWeatherProvider` | no      | the values you pass; for tests, docs and offline demos    |

`useWeather()` has four coordinate sources and no default:

| `source`      | Where the coordinates come from                                       |
| ------------- | --------------------------------------------------------------------- |
| `coordinates` | the `coordinates` you pass; the only source with no prompt or request |
| `declared`    | `createDeclaredLocationProvider({ latitude, longitude, city })`       |
| `geolocation` | the browser's own permission prompt, through `navigator.geolocation`  |
| `ip`          | an IP-location provider whose endpoint you configured                 |

`source: "ip"` never invents a default endpoint, because asking a third party where
the user is reveals their IP address. `source: "geolocation"` never runs without the
browser prompt the user expects. If a provider is missing entirely, the hook reports
`unsupported` with a reason instead of a made-up temperature.

## Location

| Provider                           | Accuracy   | Notes                                                          |
| ---------------------------------- | ---------- | -------------------------------------------------------------- |
| `createDeclaredLocationProvider`   | `declared` | offline; exactly what the application passed in                |
| `createBrowserGeolocationProvider` | `precise`  | uses the browser prompt; no polling, no watching               |
| `createIpLocationProvider`         | `coarse`   | endpoint required; city-level at best, never claimed otherwise |

## E-mail verification

```tsx
const verify = createSyntaxEmailVerifier(); // offline, no network, no endpoint
const remote = createHttpEmailVerifier({
  endpoint: "https://your-service/verify",
});
```

The syntax checker answers "is this shaped like an e-mail address" and says nothing
about deliverability. The HTTP verifier posts to an endpoint you own, treats a 4xx as
`retryable: false`, and surfaces the status. `useEmailVerification()` picks one through
the `provider` option; without a provider it stays local.

## Caching

`useWeather()` caches through the storage you give it, or not at all:

```tsx
useWeather({
  provider: weather,
  coordinates: { latitude: 41.39, longitude: 2.17 },
  cache: {
    storage: "sessionStorage",
    key: "weather:bcn",
    ttlMs: 10 * 60 * 1000,
  },
});
```

`cache: false` fetches every time. A cache entry carries the source and the time it
was fetched, and an expired entry is discarded rather than served stale.

## Testing

`createStaticWeatherProvider` and `createDeclaredLocationProvider` exist so a demo or a
test can run the whole widget without a network. `tests/providers.test.ts` uses them to
cover the success, unsupported and error paths, including the `retryable` flag on a
4xx response.
