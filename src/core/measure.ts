/**
 * Measurement: turning DOM elements into slots.
 *
 * The layout never assumes a fixed cell size or a fixed column count. It measures
 * the real rectangles of its items, clusters them into columns and rows, and
 * derives flow indices from that clustering. This is what makes the library work
 * with CSS Grid, fl=flexbox, masonry-style columns or plain inline-blocks.
 *
 * Geometry access goes through a {@link GeometryProvider} so the drag engine can
 * be exercised in tests with synthetic rectangles.
 */

import type { Point, Rect } from "../math/rect";
import { rectFromDOMRect } from "../math/rect";
import type { ItemId, Slot, SlotCandidate } from "./types";

export interface GeometryProvider {
  /** Viewport-relative rectangle of an element. */
  measure(element: Element): Rect;
  /** Viewport rectangle, used when no explicit container bounds are given. */
  viewport(): Rect;
}

/** Default provider: `getBoundingClientRect` based (client coordinates). */
export const domGeometry: GeometryProvider = {
  measure(element) {
    const domRect = element.getBoundingClientRect();
    return rectFromDOMRect(domRect);
  },
  viewport() {
    if (typeof window === "undefined") return { x: 0, y: 0, width: 0, height: 0 };
    return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  },
};

/** Fixed geometry, keyed by element. Useful for tests and server-side rendering. */
export const createStaticGeometry = (
  rects: Map<Element, Rect> | ((element: Element) => Rect | null),
  viewportRect?: Rect,
): GeometryProvider => ({
  measure(element) {
    const found = typeof rects === "function" ? rects(element) : rects.get(element);
    return found ?? { x: 0, y: 0, width: 0, height: 0 };
  },
  viewport() {
    return viewportRect ?? { x: 0, y: 0, width: 1024, height: 768 };
  },
});

export interface ClusterOptions {
  /** Coordinates closer than this are treated as the same line. */
  tolerance?: number;
}

/**
 * Groups rectangles into column and row lines.
 *
 * Returns the line coordinates plus, for each input rectangle, its column and row
 * indices. Rectangles are expected in reading order.
 */
export const clusterLines = (
  rects: readonly Rect[],
  options: ClusterOptions = {},
): { columns: number[]; rows: number[]; placement: { column: number; row: number }[] } => {
  const tolerance = options.tolerance ?? 1;
  const columns: number[] = [];
  const rows: number[] = [];

  const lineIndex = (lines: number[], value: number): number => {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line === undefined) continue;
      if (Math.abs(line - value) <= tolerance) return i;
    }
    // Insert keeping the list sorted so index order matches visual order.
    let insertAt = lines.length;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line !== undefined && value < line) {
        insertAt = i;
        break;
      }
    }
    lines.splice(insertAt, 0, value);
    return insertAt;
  };

  const placement = rects.map((rect) => ({
    column: lineIndex(columns, rect.x),
    row: lineIndex(rows, rect.y),
  }));

  return { columns, rows, placement };
};

export interface MeasureEntry {
  id: ItemId;
  element: HTMLElement | null;
}

export interface MeasureOptions {
  geometry?: GeometryProvider;
  /** Falls back to flow order when clustering is not meaningful (single row/column). */
  forceSingleRow?: boolean;
  forceSingleColumn?: boolean;
}

/**
 * Measures a set of elements into slot candidates in reading order.
 *
 * Elements that are not rendered (or measure as zero-size) are skipped, so
 * conditional items never produce phantom slots.
 */
export const measureSlots = (
  entries: readonly MeasureEntry[],
  options: MeasureOptions = {},
): SlotCandidate[] => {
  const geometry = options.geometry ?? domGeometry;
  const measured: { id: ItemId; rect: Rect }[] = [];

  for (const entry of entries) {
    if (!entry.element) continue;
    const rect = geometry.measure(entry.element);
    if (rect.width === 0 && rect.height === 0) continue;
    measured.push({ id: entry.id, rect });
  }

  if (measured.length === 0) return [];

  const { placement } = clusterLines(measured.map((entry) => entry.rect));

  return measured.map((entry, index) => {
    const position = placement[index] ?? { column: 0, row: index };
    const column = options.forceSingleColumn ? 0 : position.column;
    const row = options.forceSingleRow ? 0 : position.row;
    const slot: Slot = {
      index,
      column,
      row,
      rect: entry.rect,
    };
    return {
      id: entry.id,
      index,
      rect: entry.rect,
      slot: {
        ...slot,
        column: options.forceSingleColumn ? 0 : column,
        row: options.forceSingleRow ? 0 : row,
      },
    };
  });
};

/** Finds the candidate owning a slot index, or `null`. */
export const candidateAtIndex = (candidates: readonly SlotCandidate[], index: number): SlotCandidate | null =>
  candidates.find((candidate) => candidate.index === index) ?? null;

/** Finds a candidate by item id, or `null`. */
export const candidateForId = (candidates: readonly SlotCandidate[], id: ItemId): SlotCandidate | null =>
  candidates.find((candidate) => candidate.id === id) ?? null;

/** Rows of candidates, ordered by row then column. */
export const candidatesByRow = (candidates: readonly SlotCandidate[]): SlotCandidate[][] => {
  const rows = new Map<number, SlotCandidate[]>();
  for (const candidate of candidates) {
    const row = rows.get(candidate.slot.row);
    if (row) row.push(candidate);
    else rows.set(candidate.slot.row, [candidate]);
  }
  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row.sort((a, b) => a.slot.column - b.slot.column));
};

/** Offset between a drag origin and the current visual translation. */
export const translateFromOrigin = (origin: Point, current: Point): Point => ({
  x: current.x - origin.x,
  y: current.y - origin.y,
});
