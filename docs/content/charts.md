# Charts

Optional, local SVG charts in `@nashiuso/rewap/charts`.

```tsx
import { Chart } from "@nashiuso/rewap/charts";
import "@nashiuso/rewap/charts.css";

<Chart type="line" data={[12, 18, 15, 24, 31]} height={180} ariaLabel="Revenue by week" />;
```

No charting dependency, no canvas, no data fetching. The path maths and the scales
are in the same package as the rest of the math layer, so they can be used directly.

## Types

| `type`      | Data shape                             | Draws                                |
| ----------- | -------------------------------------- | ------------------------------------ |
| `line`      | `number[]`, `Point[]`, `ChartSeries[]` | one path per series                  |
| `area`      | same                                   | a filled path back to the baseline   |
| `bar`       | `number[]` or the first series         | one rect per value, anchored at zero |
| `scatter`   | `Point[]`, one circle per point        | all series                           |
| `histogram` | `number[]`                             | binned counts, `bins` prop           |
| `sparkline` | `number[]`                             | a small line with no axes or padding |

```tsx
<Chart type="bar" data={[3, 8, 5]} bins={12} />                        // bins ignored for bars
<Chart type="histogram" data={latencies} bins={16} />                  // bins used here
<Chart type="line" data={[{ id: "a", data: [1, 2] }, { id: "b", data: [3, 4] }]} />
```

## Props

| Prop                   | Default                                        | Notes                                                 |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `height`               | `180`                                          | Number of pixels, or a CSS length (see below)         |
| `smooth`, `tension`    | `false`, `0.2`                                 | Curved line and area paths                            |
| `showGrid`, `showAxis` | `true`                                         | Grid lines and tick labels                            |
| `tickCount`            | `4`                                            | Value-axis ticks                                      |
| `yDomain`              | derived                                        | Force a range, e.g. `[0, 100]` for a percentage       |
| `formatX`, `formatY`   | numeric                                        | Tick formatters                                       |
| `highlightIndex`       | `null`                                         | Guide line and marker for one point                   |
| `motion`               | `"smooth"`                                     | Any motion value from the [motion](motion.html) layer |
| `ariaLabel`            | generated                                      | e.g. "line chart with 5 points"                       |
| `accessibleTable`      | `true`                                         | Hidden table of the underlying values                 |
| `padding`              | `{ top: 10, right: 10, bottom: 22, left: 36 }` | Plot insets                                           |

## Responsive by measurement

The chart measures its container with `ResizeObserver` and redraws; it never assumes
a width. A `height` number is a pixel count for the drawing; any other CSS length
(`"12rem"`, `"40vh"`) sizes the figure and leaves the drawing at its default, because
a viewBox is not a stylesheet.

```tsx
<div style={{ height: 240 }}>
  <Chart type="area" data={series} height="100%" />
</div>
```

## Animation

A chart animates in when its data changes: lines draw themselves, areas fade,
bars grow from the baseline, scatter points fade. The intro uses the same motion
plans as everything else, so `prefers-reduced-motion` skips it entirely and
`motion="instant"` disables it for a page.

## Using the pieces

The scales and path builders are exported for charts the component does not cover:

```ts
import {
  bandScale,
  linearScale,
  niceDomain,
  linePath,
  areaPath,
  barRects,
  pathLength,
} from "@nashiuso/rewap/charts";
```

`pathLength()` measures a polyline, which is how the draw-in animation knows what
`stroke-dasharray` to use. `clampPoints()` keeps outliers inside the plot area
instead of letting a single spike flatten everything else.

> **Maintainer note**
> This module is deliberately not a visualisation library. If you need zooming,
> brushing, tooltips on hover or ten thousand points, use a real charting package —
> `recharts` or `visx` will do things this never will, and mixing them is fine.
> This exists for the small line behind a dashboard number.
