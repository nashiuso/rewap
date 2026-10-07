/**
 * Rectangle primitives and rectangle relation queries.
 *
 * All functions are pure, allocation-light and dependency-free. Rectangles use
 * `{ x, y, width, height }` in CSS pixel space (origin top-left, y grows down),
 * which matches `DOMRect` and `getBoundingClientRect()`.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Edges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

export const rectRight = (r: Rect): number => r.x + r.width;
export const rectBottom = (r: Rect): number => r.y + r.height;

export const rectCenter = (r: Rect): Point => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});

export const rectArea = (r: Rect): number => Math.max(0, r.width) * Math.max(0, r.height);

/** Anything that can be read as a rectangle: a DOMRect, a DOMRectReadOnly or a plain `Rect`. */
export interface DOMRectLike {
  width: number;
  height: number;
  left?: number;
  top?: number;
  x?: number;
  y?: number;
}

/**
 * Builds a rect from any DOMRect-like object.
 *
 * `DOMRect` exposes both `left`/`top` and `x`/`y`; a plain {@link Rect} exposes
 * only the latter, so both spellings are accepted and missing values fall back
 * to zero.
 */
export const rectFromDOMRect = (r: DOMRectLike): Rect =>
  sanitizeRect(rect(r.left ?? r.x ?? 0, r.top ?? r.y ?? 0, r.width, r.height));

/**
 * Replaces non-finite components with `0`.
 *
 * A measurement taken from a detached or unlaid-out element can come back as
 * `NaN`; letting that value travel into the drag maths turns every later
 * comparison into `false` and can keep a component re-rendering forever. Zero
 * is the honest answer for "not measurable", so it is applied at the boundary.
 */
export const sanitizeRect = (r: Rect): Rect => {
  if (Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.width) && Number.isFinite(r.height)) {
    return r;
  }
  const finite = (value: number): number => (Number.isFinite(value) ? value : 0);
  return rect(finite(r.x), finite(r.y), finite(r.width), finite(r.height));
};

export const rectFromPoints = (a: Point, b: Point): Rect =>
  rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));

export const translateRect = (r: Rect, dx: number, dy: number): Rect =>
  rect(r.x + dx, r.y + dy, r.width, r.height);

export const inflateRect = (r: Rect, amount: number): Rect =>
  rect(r.x - amount, r.y - amount, r.width + amount * 2, r.height + amount * 2);

export const insetRect = (r: Rect, edges: Partial<Edges>): Rect => {
  const top = edges.top ?? 0;
  const right = edges.right ?? 0;
  const bottom = edges.bottom ?? 0;
  const left = edges.left ?? 0;
  return rect(
    r.x + left,
    r.y + top,
    Math.max(0, r.width - left - right),
    Math.max(0, r.height - top - bottom),
  );
};

/** Clamps `r` inside `bounds` without resizing it (when it fits). */
export const clampRect = (bounds: Rect, r: Rect): Rect => {
  const maxX = Math.max(bounds.x, rectRight(bounds) - r.width);
  const maxY = Math.max(bounds.y, rectBottom(bounds) - r.height);
  return rect(clamp01Number(r.x, bounds.x, maxX), clamp01Number(r.y, bounds.y, maxY), r.width, r.height);
};

const clamp01Number = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const rectContainsPoint = (r: Rect, p: Point): boolean =>
  p.x >= r.x && p.x <= rectRight(r) && p.y >= r.y && p.y <= rectBottom(r);

export const rectContainsRect = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  rectRight(inner) <= rectRight(outer) &&
  rectBottom(inner) <= rectBottom(outer);

export const rectIntersects = (a: Rect, b: Rect): boolean =>
  a.x < rectRight(b) && rectRight(a) > b.x && a.y < rectBottom(b) && rectBottom(a) > b.y;

/** Area of the intersection, or `0` when the rectangles do not overlap. */
export const rectOverlapArea = (a: Rect, b: Rect): number => {
  const w = Math.min(rectRight(a), rectRight(b)) - Math.max(a.x, b.x);
  const h = Math.min(rectBottom(a), rectBottom(b)) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return w * h;
};

/** Intersection area divided by the smaller rectangle's area — `0..1`. */
export const rectOverlapRatio = (a: Rect, b: Rect): number => {
  const smaller = Math.min(rectArea(a), rectArea(b));
  if (smaller <= 0) return 0;
  return rectOverlapArea(a, b) / smaller;
};

/** Intersection rectangle, or `null` when the rectangles do not overlap. */
export const rectIntersection = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(rectRight(a), rectRight(b));
  const bottom = Math.min(rectBottom(a), rectBottom(b));
  if (right <= x || bottom <= y) return null;
  return rect(x, y, right - x, bottom - y);
};

export const rectUnion = (rects: readonly Rect[]): Rect | null => {
  const first = rects[0];
  if (!first) return null;
  let minX = first.x;
  let minY = first.y;
  let maxX = rectRight(first);
  let maxY = rectBottom(first);
  for (let i = 1; i < rects.length; i += 1) {
    const r = rects[i];
    if (!r) continue;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, rectRight(r));
    maxY = Math.max(maxY, rectBottom(r));
  }
  return rect(minX, minY, maxX - minX, maxY - minY);
};

/** Shortest translation that removes the overlap between `a` and `b`. */
export const rectEscapeVector = (a: Rect, b: Rect): Point => {
  const overlap = rectIntersection(a, b);
  if (!overlap) return { x: 0, y: 0 };
  const dx = overlap.x + overlap.width / 2 - rectCenter(a).x;
  const dy = overlap.y + overlap.height / 2 - rectCenter(a).y;
  if (Math.abs(dx) < Math.abs(dy)) {
    return { x: dx > 0 ? overlap.width + dx : -overlap.width + dx, y: 0 };
  }
  return { x: 0, y: dy > 0 ? overlap.height + dy : -overlap.height + dy };
};

/** Aspect-ratio aware scale that fits `inner` inside `outer`. */
export const fitScale = (inner: Size, outer: Size): number => {
  if (inner.width <= 0 || inner.height <= 0) return 1;
  return Math.min(outer.width / inner.width, outer.height / inner.height);
};
