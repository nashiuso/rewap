# Utilities

Browser hooks, each one honest about what it can and cannot read. They live in
`@nashiuso/rewap/utilities` and import nothing external.

```tsx
import { useViewport, useNetworkInfo } from "@nashiuso/rewap/utilities";
```

A rule applies to all of them: if the browser cannot answer, the hook says so. There
is no invented default, no `0` standing in for "unknown", and no polling a private
API that happens to work in one browser.

## useViewport

```tsx
const {
  width,
  height,
  visualHeight,
  orientation,
  breakpoint,
  isMobile,
  isDesktop,
  dpr,
  scrollX,
  scrollY,
} = useViewport({ trackScroll: true });
```

Reads the real viewport and the visual viewport. `visualHeight` shrinks when a mobile
keyboard opens, which is the number you want when positioning something at the bottom
of the screen. `breakpoint` is derived from the same thresholds as the docs
(`sm 480`, `md 768`, `lg 1024`, `xl 1440`) and can be overridden per call.

## useNetworkInfo / useConnection

```tsx
const network = useNetworkInfo();
// { online, effectiveType, type, downlink, downlinkMax, rtt, saveData, supported, quality }

const badge = useConnection();
// { online, quality, label: "Good", effectiveType, saveData, detailed }
```

`navigator.connection` is Chromium-only in practice. `supported` reports which fields
the current browser actually provides, so a UI can render "3g · 250 ms" where it is
available and "online" where it is not. `quality` is `offline | poor | fair | good |
unknown` — `unknown` when there is nothing to judge by, rather than guessing `good`.

## useBattery

```tsx
const {
  supported,
  loading,
  charging,
  level,
  chargingTime,
  dischargingTime,
  unsupportedReason,
} = useBattery();
```

Chromium-only. Elsewhere you get `supported: false` and a reason to show. `level` is
`0..1` or `null`.

## usePerformance

```tsx
const {
  fps,
  frameTime,
  longTasks,
  memory,
  navigation,
  hardwareConcurrency,
  deviceMemory,
  cpuTemperature,
} = usePerformance({ interval: 1000, measureFps: true });
```

Frame counting is real; `longTasks` needs `PerformanceObserver`; `memory` is
Chromium-only; navigation timings come from the performance timeline.

**`cpuTemperature` is always `{ supported: false, reason }`.** No browser exposes CPU
temperature to a page, and inventing a number would be worse than saying so.

> **Maintainer note**
> `frameTime` is derived from the frame count in the window rather than from the
> individual deltas. Close enough for a dashboard, and it avoids a second timer
> running just to be precise about a number nobody acts on.

## useKeyboardLayout

```tsx
const {
  platform,
  isMac,
  isWindows,
  isLinux,
  modifierKey,
  modifierSymbol,
  language,
  timeZone,
  modifiers,
  confidence,
} = useKeyboardLayout();
```

`modifierSymbol` is `⌘` or `Ctrl`, which is what you want on a shortcut hint.
`modifiers` tracks live shift/control/alt/meta state and resets on blur so nothing
gets stuck down.

**`layout` is always `null`.** A page can learn the platform, the language and the
modifier state; it cannot learn whether the user is on QWERTY, AZERTY or Dvorak. The
field is explicit so nobody assumes it is merely missing. `confidence` says how much
of the platform guess rests on modern signals (`userAgentData`) rather than the
deprecated `navigator.platform` string.

## useEmailVerification

```tsx
import { useEmailVerification } from "@nashiuso/rewap/utilities";
import { createSyntaxOnlyVerificationProvider } from "@nashiuso/rewap/providers";

const check = useEmailVerification(email, {
  provider: createSyntaxOnlyVerificationProvider(),
});
// { value, normalized, valid, local, remote, verify(), reset() }
```

Local checks run on every render and are offline: syntax, the shape of the domain,
disposable-domain detection and typo suggestions (`gmial.com` → `gmail.com`).
`local.valid` never implies the mailbox exists.

Remote verification happens only if you supply a provider, and only when you call
`verify()`. The returned outcome distinguishes `deliverable`, `undeliverable` and
`unsupported` — see [Providers](#providers).

## useWeather

```tsx
const weather = useWeather({
  source: "coordinates",
  coordinates: { latitude: 41.39, longitude: 2.17 },
  provider: createOpenMeteoProvider(),
  unit: "celsius",
  cache: { ttlMs: 600_000 },
});
```

Sources: `"coordinates"`, `"declared"`, `"ip"` (needs a location provider) and
`"geolocation"` (asks the browser, and says so). Without a provider the hook stops at
`status: "unsupported"` with a reason — it does not silently pick a public API.

Caching is local (`sessionStorage` by default, `"memory"` for the tab) and keyed by
provider, rounded coordinates and unit.

## Providers

Providers are how external information enters an application, and they only exist
because you wrote the endpoint down.

```tsx
import {
  createOpenMeteoProvider,
  createStaticWeatherProvider,
  createIpLocationProvider,
  createDeclaredLocationProvider,
  createBrowserGeolocationProvider,
  createHttpEmailVerificationProvider,
  createSyntaxOnlyVerificationProvider,
} from "@nashiuso/rewap/providers";
```

Every provider method returns a `ProviderOutcome<T>`:

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

`unsupported` and `error` are different states on purpose: "this browser cannot tell
you" and "the request failed" need different UI, and collapsing them loses
information the user needs.

Two rules the providers keep:

- **No default endpoint for IP location.** `createIpLocationProvider` requires it,
  because the request reveals the user's IP to whoever owns it.
- **Browser geolocation is opt-in per call.** `createBrowserGeolocationProvider()`
  wraps `navigator.geolocation`, including the permission states, and is never
  invoked by another provider.

Create providers once, outside the component, or memoise them: the hooks treat a new
object as a new provider, which is what you want when the endpoint changes.
