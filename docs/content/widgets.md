# Widgets

Seven small panels in `@nashiuso/rewap/widgets`, built on the same hooks as the rest
of the library. They are cards for a dashboard, not an application framework.

```tsx
import {
  Widget,
  WidgetValue,
  WidgetRow,
  WidgetBar,
  WidgetState,
  WidgetNote,
  WidgetError,
} from "@nashiuso/rewap/widgets";
import "@nashiuso/rewap/widgets.css";
```

They are the one optional module with a stylesheet of its own, so an application that
does not use them never loads a byte of it.

## Primitives

```tsx
<Widget title="Traffic" meta="last 5 min">
  <WidgetValue value="12,480" unit="req" />
  <WidgetRow label="p95" value="48 ms" />
  <WidgetRows
    rows={[
      { label: "p50", value: "12 ms" },
      { label: "errors", value: "0.4%" },
    ]}
  />
  <WidgetBar value={0.72} label="Budget used" />
  <WidgetNote>Sampled every 30 s.</WidgetNote>
</Widget>
```

| Component                    | Renders                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| `Widget`                     | `<section class="rw-widget">` with `title` and `meta` in the header |
| `WidgetValue`                | a large readout with an optional `unit`                             |
| `WidgetRow` / `WidgetRows`   | label/value pairs                                                   |
| `WidgetBar`                  | `role="progressbar"` with `aria-valuenow`                           |
| `WidgetState`                | a status line; `state` drives `data-state` for styling              |
| `WidgetNote` / `WidgetError` | secondary text and the error line                                   |

There is no chart or table inside a widget: put a [`<Chart>`](charts.html) in the
body if you need one. Every widget accepts `className`, `style` and `as`.

## The widgets

| Widget              | Source                    | Notes                                                      |
| ------------------- | ------------------------- | ---------------------------------------------------------- |
| `ClockWidget`       | `Intl` + the device clock | `tickMs` (default `1000`); no network time                 |
| `StatsWidget`       | values you pass           | `mean`, `median`, `deviation`, `range` from the math layer |
| `NetworkWidget`     | `useNetworkInfo`          | shows which fields the browser does not provide            |
| `WeatherWidget`     | `useWeather`              | pass a provider; rounds to whole degrees                   |
| `ViewportWidget`    | `useViewport`             | width, height and the current breakpoint                   |
| `PerformanceWidget` | `usePerformance`          | fps, memory, long tasks                                    |
| `BatteryWidget`     | `useBattery`              | `meta="unsupported"` when there is no Battery API          |

```tsx
<Layout>
  <Item id="clock">
    <ClockWidget timeZone="Europe/Madrid" />
  </Item>
  <Item id="stats">
    <StatsWidget values={[2, 4, 4, 4, 5, 5, 7, 9]} />
  </Item>
  <Item id="network">
    <NetworkWidget />
  </Item>
  <Item id="battery">
    <BatteryWidget />
  </Item>
</Layout>
```

They are ordinary components and can be dragged around like anything else — the
dashboard on the [examples](examples.html) page is exactly this, with a stored order.

## Honesty rules

- **No invented values.** A browser that cannot report the battery level renders a
  battery widget that says so. `PerformanceWidget` never shows a CPU temperature.
- **No hidden requests.** `WeatherWidget` and `NetworkWidget` render a state, not a
  request: no provider, no call. `WeatherWidget` with no provider shows the reason.
- **No clock drift theatre.** `ClockWidget` reads `Intl` and the device clock, and it
  says which time zone in `meta`. It does not call a time server.

## Sizing

Widgets fill their slot and never set a fixed height, because the slot is what has
a size. Charts inside a widget need a height from you:

```tsx
<Widget title="Requests">
  <div style={{ height: 120 }}>
    <Chart type="sparkline" data={requests} height="100%" />
  </div>
</Widget>
```
