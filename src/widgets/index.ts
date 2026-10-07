/**
 * `@nashiuso/rewap/widgets` — optional, ready-made widgets.
 *
 * Each widget is a thin shell around a hook from `@nashiuso/rewap/utilities`, so
 * an application can use the hook directly and build its own markup when the
 * default layout does not fit.
 */

export { WeatherWidget, type WeatherWidgetProps } from "./WeatherWidget";
export { NetworkWidget, type NetworkWidgetProps } from "./NetworkWidget";
export { StatsWidget, type StatsWidgetProps } from "./StatsWidget";
export { ClockWidget, type ClockWidgetProps } from "./ClockWidget";
export { ViewportWidget, type ViewportWidgetProps } from "./ViewportWidget";
export { PerformanceWidget, type PerformanceWidgetProps } from "./PerformanceWidget";
export { BatteryWidget, type BatteryWidgetProps } from "./BatteryWidget";
export {
  Widget,
  WidgetValue,
  WidgetRow,
  WidgetRows,
  WidgetState,
  WidgetBar,
  WidgetNote,
  WidgetError,
  type WidgetProps,
  type WidgetValueProps,
  type WidgetRowProps,
  type WidgetStateProps,
  type WidgetBarProps,
  type WidgetTone,
} from "./Widget";
