# Statistics

A small statistics module, local and dependency-free, in
`@nashiuso/rewap/math`. It exists because dashboards need means and percentiles, and
pulling in a full statistics package for eight functions was not worth it.

```ts
import {
  mean,
  median,
  mode,
  variance,
  standardDeviation,
  percentile,
  quantile,
  extent,
  interquartileRange,
  correlation,
  regression,
  movingAverage,
  movingAverageExponential,
  histogram,
  normalizeValues,
} from "@nashiuso/rewap/math";
```

## Summary

| Function                                  | Returns                                | Notes                                                    |
| ----------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| `mean(values)`                            | `number`                               | Ignores non-finite values                                |
| `median(values)`                          | `number`                               | Sorts a copy; interpolates between the two middle values |
| `mode(values)`                            | `{ values, count }`                    | Empty `values` when nothing repeats                      |
| `variance(values, ddof?)`                 | `number`                               | **Sample variance by default** (`ddof = 1`)              |
| `standardDeviation(values, ddof?)`        | `number`                               | Sample deviation by default                              |
| `percentile(values, p)`                   | `number`                               | Nearest-rank with linear interpolation                   |
| `quantile(values, q)`                     | `number`                               | `q` in `0..1`                                            |
| `extent(values)`                          | `{ min, max }`                         | `Infinity`/`-Infinity` when there is nothing to measure  |
| `interquartileRange(values)`              | `number`                               | `Q3 - Q1`                                                |
| `correlation(xs, ys)`                     | `number`                               | Pearson, `-1..1`, `NaN` for a constant series            |
| `regression(xs, ys)`                      | `{ slope, intercept, r2, predict(x) }` | Least squares; `r2` is 0 when undefined                  |
| `movingAverage(values, window)`           | `number[]`                             | Trailing window, shorter than the input near the start   |
| `movingAverageExponential(values, alpha)` | `number[]`                             | Alpha smoothing, `0.3` by default                        |
| `histogram(values, bins)`                 | `{ edges, counts, binWidth }`          | Used by the chart module                                 |
| `normalizeValues(values)`                 | `number[]`                             | Scales to `0..1`; a constant series maps to `0.5`        |

Every function filters non-finite input first. `[1, NaN, 3]` behaves like `[1, 3]`
rather than returning `NaN` for everything, which is what you want when the numbers
come from a form.

## Sample or population?

`variance` and `standardDeviation` use `n - 1`, the sample estimator, by default.
Card statistics are almost always describing a sample of something larger, and the
difference between the two is small until it is not.

```ts
variance(values); // sample (ddof = 1)
variance(values, 0); // population
```

## Example

```ts
import { correlation, movingAverage, percentile, regression } from "@nashiuso/rewap/math";

const latencies = [42, 38, 51, 47, 39, 44, 62, 41];

percentile(latencies, 95); // 62
movingAverage(latencies, 3); // [42, 40, 43.67, …]
correlation(hours, latencies); // e.g. -0.41

const fit = regression(hours, latencies);
fit.slope; // ms per hour
fit.predict(10);
```

Every one of these is covered by `tests/math.statistics.test.ts` — including the
degenerate cases (empty input, a single value, a constant series), which are where
naive implementations return `NaN` and take a chart down with them.
