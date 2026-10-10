/**
 * `@nashiuso/rewap/charts` — optional, lightweight charts.
 *
 * Kept out of the core entry point so applications that only need drag and swap
 * never pay for it. No network access, no canvas, no charting dependency.
 */

export {
  Chart,
  type ChartProps,
  type ChartType,
  type ChartSeries,
} from "./Chart";
export {
  linearScale,
  bandScale,
  niceDomain,
  niceTicks,
  domainOf,
  normalizeSeries,
  seriesToPoints,
  type LinearScale,
  type BandScale,
  type Point,
  type ChartDomain,
} from "./scales";
export {
  linePath,
  smoothLinePath,
  areaPath,
  barRects,
  pathLength,
  clampPoints,
  type BarRect,
} from "./paths";
