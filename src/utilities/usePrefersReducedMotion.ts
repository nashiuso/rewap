/**
 * `usePrefersReducedMotion()` — tracks the user's motion preference.
 *
 * The value starts as `false` during server rendering and the first client
 * render, then syncs in an effect. That keeps hydration deterministic while the
 * layout still honours the preference as soon as it can read `matchMedia`.
 */

import { useEffect, useState } from "react";

const query = "(prefers-reduced-motion: reduce)";

const readPreference = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
};

export const usePrefersReducedMotion = (): boolean => {
  const [prefersReduced, setPrefersReduced] = useState(readPreference);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setPrefersReduced(event.matches);
    setPrefersReduced(media.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    // Safari < 14
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  return prefersReduced;
};

/** Non-hook variant for use inside engine callbacks. */
export const prefersReducedMotion = (): boolean => readPreference();
