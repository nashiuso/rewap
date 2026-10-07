/**
 * `usePerformance()` — locally measured performance signals.
 *
 * Everything here is measured in the page: frame rate from `requestAnimationFrame`,
 * long tasks from `PerformanceObserver`, heap usage from the (non-standard)
 * `performance.memory`, and navigation timings from the Navigation Timing API.
 *
 * It deliberately does **not** report CPU temperature, GPU load or fan speed.
 * Browsers expose no such data; the `cpuTemperature` field states that limitation
 * explicitly instead of inventing a number.
 */

import { useEffect, useRef, useState } from "react";
import { now } from "../math/interpolate";

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usageRatio: number;
}

export interface NavigationTimings {
  ttfb: number;
  domInteractive: number;
  domContentLoaded: number;
  load: number;
}

export interface PerformanceState {
  supported: {
    fps: boolean;
    longTasks: boolean;
    memory: boolean;
    navigation: boolean;
  };
  /** Frames per second over the last sampling window. */
  fps: number;
  /** Mean frame time in milliseconds over the last window. */
  frameTime: number;
  /** Frames counted in the last window. */
  frames: number;
  /** Long tasks (> 50 ms) counted in the last window. */
  longTasks: number;
  memory?: MemoryInfo;
  navigation?: NavigationTimings;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  /** Structural hardware facts that are not observable from a web page. */
  cpuTemperature: { supported: false; reason: string };
}

export interface UsePerformanceOptions {
  /** Sampling window in milliseconds. Defaults to 1000. */
  interval?: number;
  /** Set to `false` to skip the frame loop entirely. */
  measureFps?: boolean;
}

const windowOf = (): Window | null => (typeof window === "undefined" ? null : window);

const readMemory = (): MemoryInfo | undefined => {
  const performance_ = windowOf()?.performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  };
  const memory = performance_?.memory;
  if (!memory || !Number.isFinite(memory.jsHeapSizeLimit) || memory.jsHeapSizeLimit <= 0) return undefined;
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    usageRatio: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
  };
};

const readNavigation = (): NavigationTimings | undefined => {
  const win = windowOf();
  if (!win || typeof win.performance?.getEntriesByType !== "function") return undefined;
  const [entry] = win.performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  if (!entry) return undefined;
  return {
    ttfb: Math.max(0, entry.responseStart - entry.requestStart),
    domInteractive: Math.max(0, entry.domInteractive - entry.startTime),
    domContentLoaded: Math.max(0, entry.domContentLoadedEventEnd - entry.startTime),
    load: Math.max(0, entry.loadEventEnd - entry.startTime),
  };
};

/**
 * NOTE(nashiuso): `frameTime` is derived from the frame count in the sampling
 * window rather than from the individual deltas. It is close enough for a dashboard
 * and it does not need a second timer running just to be precise about a number
 * nobody acts on.
 */
export const usePerformance = (options: UsePerformanceOptions = {}): PerformanceState => {
  const interval = Math.max(200, options.interval ?? 1000);
  const measureFps = options.measureFps ?? true;
  const [state, setState] = useState<PerformanceState>(() => ({
    supported: {
      fps: typeof requestAnimationFrame === "function",
      longTasks: typeof PerformanceObserver === "function",
      memory: readMemory() !== undefined,
      navigation: readNavigation() !== undefined,
    },
    fps: 0,
    frameTime: 0,
    frames: 0,
    longTasks: 0,
    ...(readMemory() ? { memory: readMemory() } : {}),
    ...(readNavigation() ? { navigation: readNavigation() } : {}),
    ...(typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? { hardwareConcurrency: navigator.hardwareConcurrency }
      : {}),
    ...(typeof navigator !== "undefined" && (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      ? { deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory }
      : {}),
    cpuTemperature: {
      supported: false,
      reason:
        "Web pages cannot read CPU temperature: no browser exposes it. Pass a local bridge value instead.",
    },
  }));

  const framesRef = useRef(0);
  const longTasksRef = useRef(0);

  useEffect(() => {
    const win = windowOf();
    if (!win) return;
    let frameHandle: number | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let last = now();

    const loop = () => {
      framesRef.current += 1;
      last = now();
      void last;
      frameHandle = win.requestAnimationFrame(loop);
    };

    if (measureFps && typeof win.requestAnimationFrame === "function") {
      frameHandle = win.requestAnimationFrame(loop);
    }

    let observer: PerformanceObserver | null = null;
    if (typeof PerformanceObserver === "function") {
      try {
        observer = new PerformanceObserver((list) => {
          longTasksRef.current += list.getEntries().length;
        });
        observer.observe({ entryTypes: ["longtask"] });
      } catch {
        observer = null;
      }
    }

    const sample = () => {
      const frames = framesRef.current;
      framesRef.current = 0;
      const longTasks = longTasksRef.current;
      longTasksRef.current = 0;
      const seconds = interval / 1000;
      setState((previous) => ({
        ...previous,
        supported: { ...previous.supported, longTasks: observer !== null },
        fps: frames === 0 ? 0 : Math.round((frames / seconds) * 10) / 10,
        frameTime: frames === 0 ? 0 : Math.round(((1000 * seconds) / frames) * 100) / 100,
        frames,
        longTasks,
        ...(readMemory() ? { memory: readMemory() } : {}),
        ...(readNavigation() ? { navigation: readNavigation() } : {}),
      }));
    };

    timer = setInterval(sample, interval);

    return () => {
      if (frameHandle !== null) win.cancelAnimationFrame(frameHandle);
      if (timer !== null) clearInterval(timer);
      observer?.disconnect();
    };
  }, [interval, measureFps]);

  return state;
};
