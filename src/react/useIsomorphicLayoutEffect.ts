/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * React warns when `useLayoutEffect` runs during server rendering, and every
 * user of this library that renders on a server would see that warning once per
 * component. The measurement and transform code below genuinely wants to run
 * before paint in the browser, so it keeps `useLayoutEffect` there and degrades to
 * `useEffect` where there is no document to measure.
 *
 * `typeof window` is read at module scope on purpose: it is a compile-time-style
 * check that no bundler can turn into a runtime access, and it is the only
 * environment probe in the React layer.
 */

import { useEffect, useLayoutEffect } from "react";

export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
