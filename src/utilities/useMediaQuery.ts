/**
 * `useMediaQuery(query)` — subscribes to a media query.
 *
 * Returns `false` while rendering on the server and on the first client render,
 * then syncs in an effect so hydration stays deterministic.
 */

import { useEffect, useState } from "react";

const read = (query: string): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
};

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => read(query));

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, [query]);

  return matches;
};

/** Supported media query helpers, so call sites cannot drift from the tokens. */
export const mediaQueries = {
  reducedMotion: "(prefers-reduced-motion: reduce)",
  dark: "(prefers-color-scheme: dark)",
  light: "(prefers-color-scheme: light)",
  hover: "(hover: hover)",
  touch: "(hover: none) and (pointer: coarse)",
  contrastMore: "(prefers-contrast: more)",
} as const;
