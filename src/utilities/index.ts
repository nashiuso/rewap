/**
 * `@nashiuso/rewap/utilities` — browser hooks, each honest about its limits.
 *
 * Importing this entry point performs no network access. Hooks that could need
 * external information (weather) require a provider from
 * `@nashiuso/rewap/providers`; without one they report `unsupported`.
 */

export {
  usePrefersReducedMotion,
  prefersReducedMotion,
} from "./usePrefersReducedMotion";
export { useMediaQuery, mediaQueries } from "./useMediaQuery";
export {
  useViewport,
  breakpointOf,
  type ViewportState,
  type ViewportOptions,
  type Breakpoint,
  type Orientation,
} from "./useViewport";
export {
  useNetworkInfo,
  useConnection,
  qualityFrom,
  type NetworkInfo,
  type ConnectionSummary,
  type ConnectionQuality,
  type EffectiveType,
} from "./useNetworkInfo";
export {
  useKeyboardLayout,
  type KeyboardLayoutInfo,
  type ModifierState,
  type Platform,
} from "./useKeyboardLayout";
export { useBattery, type BatteryState } from "./useBattery";
export {
  usePerformance,
  type PerformanceState,
  type UsePerformanceOptions,
  type MemoryInfo,
  type NavigationTimings,
} from "./usePerformance";
export {
  useEmailVerification,
  type EmailVerificationResult,
  type EmailVerificationStatus,
  type RemoteVerificationState,
  type UseEmailVerificationOptions,
} from "./useEmailVerification";
export {
  validateEmailLocal,
  suggestDomain,
  levenshtein,
  isDisposableDomain,
  disposableDomains,
  popularDomains,
  type LocalEmailCheck,
  type EmailCheck,
  type CheckSeverity,
} from "./email";
export {
  useWeather,
  type WeatherState,
  type WeatherStatus,
  type UseWeatherOptions,
  type WeatherCacheOptions,
} from "./useWeather";
