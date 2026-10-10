/**
 * `useViewport()` — the current viewport, kept in sync with resizes, rotations,
 * on-screen keyboard changes (via `visualViewport`) and scrolling.
 *
 * Layouts in this library never assume fixed dimensions; this hook is the same
 * information they use, exposed for widgets and dashboards.
 */

import { useEffect, useRef, useState } from "react";

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl";
export type Orientation = "portrait" | "landscape";

export interface ViewportState {
  width: number;
  height: number;
  /** Height of the visual viewport, which shrinks when a keyboard is open. */
  visualHeight: number;
  dpr: number;
  orientation: Orientation;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  scrollX: number;
  scrollY: number;
}

export interface ViewportOptions {
  /** Breakpoint thresholds in CSS pixels. */
  breakpoints?: { sm: number; md: number; lg: number; xl: number };
  /** Re-read on scroll. Defaults to `true`. */
  trackScroll?: boolean;
}

const defaultBreakpoints = { sm: 480, md: 768, lg: 1024, xl: 1440 };

export const breakpointOf = (
  width: number,
  breakpoints: ViewportOptions["breakpoints"] = defaultBreakpoints,
): Breakpoint => {
  const thresholds = { ...defaultBreakpoints, ...breakpoints };
  if (width >= thresholds.xl) return "xl";
  if (width >= thresholds.lg) return "lg";
  if (width >= thresholds.md) return "md";
  if (width >= thresholds.sm) return "sm";
  return "xs";
};

const readViewport = (): ViewportState => {
  if (typeof window === "undefined") {
    return {
      width: 0,
      height: 0,
      visualHeight: 0,
      dpr: 1,
      orientation: "landscape",
      breakpoint: "lg",
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      scrollX: 0,
      scrollY: 0,
    };
  }
  const width = window.innerWidth || 0;
  const height = window.innerHeight || 0;
  const visualHeight = window.visualViewport?.height ?? height;
  const breakpoint = breakpointOf(width);
  return {
    width,
    height,
    visualHeight,
    dpr: window.devicePixelRatio || 1,
    orientation: width >= height ? "landscape" : "portrait",
    breakpoint,
    isMobile: breakpoint === "xs" || breakpoint === "sm",
    isTablet: breakpoint === "md",
    isDesktop: breakpoint === "lg" || breakpoint === "xl",
    scrollX: window.scrollX ?? window.pageXOffset ?? 0,
    scrollY: window.scrollY ?? window.pageYOffset ?? 0,
  };
};

export const useViewport = (options: ViewportOptions = {}): ViewportState => {
  const [viewport, setViewport] = useState<ViewportState>(readViewport);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const trackScroll = options.trackScroll ?? true;

    const update = () => {
      frameRef.current = null;
      setViewport(readViewport());
    };

    const schedule = () => {
      if (frameRef.current !== null) return;
      if (typeof requestAnimationFrame === "function") {
        frameRef.current = requestAnimationFrame(update);
      } else {
        update();
      }
    };

    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    if (trackScroll)
      window.addEventListener("scroll", schedule, { passive: true });
    const visual = window.visualViewport;
    visual?.addEventListener("resize", schedule);
    visual?.addEventListener("scroll", schedule);

    update();

    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      if (trackScroll) window.removeEventListener("scroll", schedule);
      visual?.removeEventListener("resize", schedule);
      visual?.removeEventListener("scroll", schedule);
      if (
        frameRef.current !== null &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [options.trackScroll]);

  return viewport;
};
