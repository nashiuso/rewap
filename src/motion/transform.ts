/**
 * Imperative transform writer.
 *
 * Drag interactions must not go through React state — that would re-render on
 * every pointer move. Instead the drag controller writes a compact visual state
 * directly onto the element and the motion engine animates it.
 *
 * The writer is deliberately tiny: one `transform` string, one `opacity`, one
 * `filter` and one `box-shadow`, all composed from a plain object. Layout stays
 * in CSS's hands; only compositor-friendly properties are touched.
 */

import { lerp } from "../math/interpolate";

export interface VisualState {
  /** Translation in pixels. */
  x: number;
  y: number;
  /** Uniform scale factor. */
  scale: number;
  /** Rotation in degrees. */
  rotate: number;
  /** `0..1` opacity. */
  opacity: number;
  /** Blur radius in pixels. */
  blur: number;
  /**
   * Abstract elevation, `0..1`. Mapped to a shadow by `shadowTemplate` so the
   * library never hardcodes a corporate-looking drop shadow.
   */
  elevation: number;
}

export const identityVisualState: VisualState = {
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  opacity: 1,
  blur: 0,
  elevation: 0,
};

export const createVisualState = (patch: Partial<VisualState> = {}): VisualState => ({
  ...identityVisualState,
  ...patch,
});

/** Interpolates two visual states — used by the animator between keyframes. */
export const lerpVisualState = (from: VisualState, to: VisualState, t: number): VisualState => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
  scale: lerp(from.scale, to.scale, t),
  rotate: lerp(from.rotate, to.rotate, t),
  opacity: lerp(from.opacity, to.opacity, t),
  blur: lerp(from.blur, to.blur, t),
  elevation: lerp(from.elevation, to.elevation, t),
});

export const visualStateEquals = (a: VisualState, b: VisualState): boolean =>
  a.x === b.x &&
  a.y === b.y &&
  a.scale === b.scale &&
  a.rotate === b.rotate &&
  a.opacity === b.opacity &&
  a.blur === b.blur &&
  a.elevation === b.elevation;

export type ShadowTemplate = (elevation: number) => string;

/**
 * Default shadow ramp: quiet, cool and monotonic. At rest it produces `none`,
 * so no shadow is painted until an effect asks for it.
 */
export const defaultShadowTemplate: ShadowTemplate = (elevation) => {
  if (elevation <= 0.001) return "none";
  const y = Math.round(4 + elevation * 14);
  const blur = Math.round(12 + elevation * 30);
  const alpha = Math.round((0.16 + elevation * 0.2) * 100) / 100;
  return `0 ${y}px ${blur}px rgba(7, 11, 18, ${alpha})`;
};

export interface TransformOptions {
  /** Rounds translate values to whole pixels. Enabled for drag to avoid text shimmer. */
  round?: boolean;
  /** Called for each property change; defaults to writing inline styles. */
  shadowTemplate?: ShadowTemplate;
  /** Extra vars or properties to keep in sync (e.g. `--rw-lift`). */
  variables?: (state: VisualState) => Record<string, string>;
}

const format = (value: number, round: boolean): string => {
  const n = round ? Math.round(value * 100) / 100 : Math.round(value * 1000) / 1000;
  return String(n);
};

/** Composes the `transform` string for a visual state. */
export const transformString = (state: VisualState, round = false): string => {
  const parts = [`translate3d(${format(state.x, round)}px, ${format(state.y, round)}px, 0)`];
  if (state.scale !== 1) parts.push(`scale(${format(state.scale, false)})`);
  if (state.rotate !== 0) parts.push(`rotate(${format(state.rotate, false)}deg)`);
  return parts.join(" ");
};

/**
 * Applies a visual state to an element.
 *
 * Writes are skipped when a value has not changed, which keeps style
 * invalidation minimal during long drags.
 */
export const applyVisualState = (
  element: HTMLElement,
  state: VisualState,
  previous: VisualState = identityVisualState,
  options: TransformOptions = {},
): void => {
  const style = element.style;
  const round = options.round ?? true;

  if (
    state.x !== previous.x ||
    state.y !== previous.y ||
    state.scale !== previous.scale ||
    state.rotate !== previous.rotate
  ) {
    style.transform = transformString(state, round);
  }

  if (state.opacity !== previous.opacity) style.opacity = format(state.opacity, false);
  if (state.blur !== previous.blur) {
    style.filter = state.blur > 0 ? `blur(${format(state.blur, false)}px)` : "";
  }
  if (state.elevation !== previous.elevation) {
    const template = options.shadowTemplate ?? defaultShadowTemplate;
    style.boxShadow = template(state.elevation);
  }
  if (options.variables) {
    const variables = options.variables(state);
    for (const [name, value] of Object.entries(variables)) {
      if (style.getPropertyValue(name) !== value) style.setProperty(name, value);
    }
  }
};

/** Resets every property written by {@link applyVisualState}. */
export const clearVisualState = (element: HTMLElement): void => {
  element.style.transform = "";
  element.style.opacity = "";
  element.style.filter = "";
  element.style.boxShadow = "";
};

/** Transform-only application, for children that must not be re-styled. */
export const applyTransform = (
  element: HTMLElement,
  state: Pick<VisualState, "x" | "y" | "scale" | "rotate">,
  round = true,
): void => {
  element.style.transform = transformString(createVisualState(state), round);
};

/** Reads back the translate component of an inline transform written by this module. */
export const readTranslate = (element: HTMLElement): { x: number; y: number } => {
  const match = /translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(element.style.transform);
  if (!match) return { x: 0, y: 0 };
  return { x: Number(match[1] ?? 0), y: Number(match[2] ?? 0) };
};
