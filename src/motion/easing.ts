/**
 * Easing functions and a cubic-bezier factory.
 *
 * All easings are normalized: `f(0) === 0`, `f(1) === 1`, defined for `t` in `0..1`.
 */

export type Easing = (t: number) => number;

export const linear: Easing = (t) => t;

export const easeInQuad: Easing = (t) => t * t;
export const easeOutQuad: Easing = (t) => t * (2 - t);
export const easeInOutQuad: Easing = (t) =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export const easeInCubic: Easing = (t) => t * t * t;
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutQuint: Easing = (t) => 1 - Math.pow(1 - t, 5);

export const easeOutExpo: Easing = (t) =>
  t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);

export const easeInOutSine: Easing = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export const easeOutBack: Easing = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * CSS-compatible cubic bezier easing (`cubic-bezier(x1, y1, x2, y2)`).
 *
 * The curve is solved by Newton iteration with a bisection fallback, so it stays
 * monotonic for the control points CSS accepts.
 */
export const cubicBezier = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Easing => {
  if (x1 === y1 && x2 === y2) return linear;

  const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
  const b = (a1: number, a2: number) => 3 * a2 - 6 * a1;
  const c = (a1: number) => 3 * a1;

  const calc = (t: number, a1: number, a2: number) =>
    ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t;
  const slope = (t: number, a1: number, a2: number) =>
    3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1);

  const solve = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const current = calc(t, x1, x2) - x;
      if (Math.abs(current) < 1e-6) return t;
      const derivative = slope(t, x1, x2);
      if (Math.abs(derivative) < 1e-6) break;
      t -= current / derivative;
    }
    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 24; i += 1) {
      const current = calc(t, x1, x2);
      if (Math.abs(current - x) < 1e-7) return t;
      if (current < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  };

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return calc(solve(t), y1, y2);
  };
};

export const easings = {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeOutQuint,
  easeOutExpo,
  easeInOutSine,
  easeOutBack,
} satisfies Record<string, Easing>;

export type EasingName = keyof typeof easings;

/** Resolves an easing name, a `cubic-bezier` tuple, or a custom function. */
export const resolveEasing = (
  easing:
    | EasingName
    | readonly [number, number, number, number]
    | Easing = "easeOutCubic",
): Easing => {
  if (typeof easing === "function") return easing;
  if (typeof easing === "object" && easing !== null) {
    const [x1, y1, x2, y2] = easing;
    return cubicBezier(x1, y1, x2, y2);
  }
  return easings[easing] ?? easeOutCubic;
};
