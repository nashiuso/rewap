/**
 * Grid mathematics: column derivation, cell rectangles, auto-flow placement and
 * translation between flow index and cell coordinates.
 *
 * The `grid` mode and the `useViewport`-driven responsive layouts both rely on
 * this module, which is why it stays free of DOM access.
 */

import { clamp } from "./interpolate";
import { rect, type Rect } from "./rect";

export interface GridMetrics {
  /** Left edge of the grid in viewport coordinates. */
  x: number;
  /** Top edge of the grid in viewport coordinates. */
  y: number;
  /** Width of one column. */
  columnWidth: number;
  /** Height of one row. */
  rowHeight: number;
  /** Horizontal spacing between columns. */
  columnGap: number;
  /** Vertical spacing between rows. */
  rowGap: number;
  /** Number of columns. */
  columns: number;
}

export interface GridOptions {
  containerWidth: number;
  minColumnWidth: number;
  gap: number;
  /** Fixed number of columns; when omitted it is derived from the container width. */
  columns?: number;
  /** Maximum number of columns when deriving from the container width. */
  maxColumns?: number;
  rowHeight?: number;
}

/**
 * Derives a responsive column count from a container width.
 *
 * `columns` wins when provided; otherwise the largest column count that keeps
 * every column at least `minColumnWidth` wide is used (never below 1).
 */
export const deriveColumns = (options: GridOptions): number => {
  const { containerWidth, minColumnWidth, gap, columns, maxColumns } = options;
  if (columns !== undefined) return Math.max(1, Math.floor(columns));
  if (minColumnWidth <= 0) return 1;
  const derived = Math.floor((containerWidth + gap) / (minColumnWidth + gap));
  const bounded = Math.max(1, derived);
  return maxColumns === undefined
    ? bounded
    : Math.min(bounded, Math.max(1, maxColumns));
};

/** Column width for a fixed column count, so cells fill the container exactly. */
export const deriveColumnWidth = (
  containerWidth: number,
  columns: number,
  gap: number,
): number => {
  const count = Math.max(1, columns);
  return Math.max(0, (containerWidth - gap * (count - 1)) / count);
};

/** Cell rectangle for a `column`/`row` position inside a measured grid. */
export const gridCellRect = (
  metrics: GridMetrics,
  column: number,
  row: number,
  columnSpan = 1,
  rowSpan = 1,
): Rect => {
  const x = metrics.x + column * (metrics.columnWidth + metrics.columnGap);
  const y = metrics.y + row * (metrics.rowHeight + metrics.rowGap);
  const width =
    metrics.columnWidth * columnSpan +
    metrics.columnGap * Math.max(0, columnSpan - 1);
  const height =
    metrics.rowHeight * rowSpan + metrics.rowGap * Math.max(0, rowSpan - 1);
  return rect(x, y, width, height);
};

/** Rectangle of a flow index (row-major order), the inverse of {@link flowIndexFromCell}. */
export const gridCellRectFromIndex = (
  metrics: GridMetrics,
  index: number,
): Rect => {
  const column = index % metrics.columns;
  const row = Math.floor(index / metrics.columns);
  return gridCellRect(metrics, column, row);
};

/** Converts a `column`/`row` coordinate pair into a row-major flow index. */
export const flowIndexFromCell = (
  column: number,
  row: number,
  columns: number,
): number => row * Math.max(1, columns) + column;

/** Converts a flow index into `column`/`row` coordinates. */
export const cellFromFlowIndex = (
  index: number,
  columns: number,
): { column: number; row: number } => {
  const count = Math.max(1, columns);
  const safe = Math.max(0, index);
  return { column: safe % count, row: Math.floor(safe / count) };
};

/** Total row count needed to hold `items` items in `columns` columns. */
export const gridRowCount = (items: number, columns: number): number =>
  Math.ceil(Math.max(0, items) / Math.max(1, columns));

/**
 * Auto-flow placement for `items` cells with optional per-item spans.
 *
 * Placement is row-major and skipping is off (matching CSS `grid-auto-flow: row`),
 * so the result can be compared directly with the browser's own layout.
 */
export interface GridFlowItem {
  columnSpan?: number;
  rowSpan?: number;
}

export interface GridPlacement {
  index: number;
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
}

export const gridAutoFlow = (
  items: readonly GridFlowItem[],
  columns: number,
): GridPlacement[] => {
  const count = Math.max(1, columns);
  const placements: GridPlacement[] = [];
  const occupied = new Set<string>();
  let column = 0;
  let row = 0;

  const isFree = (
    c: number,
    r: number,
    columnSpan: number,
    rowSpan: number,
  ): boolean => {
    if (c + columnSpan > count) return false;
    for (let dc = 0; dc < columnSpan; dc += 1) {
      for (let dr = 0; dr < rowSpan; dr += 1) {
        if (occupied.has(`${c + dc}:${r + dr}`)) return false;
      }
    }
    return true;
  };

  items.forEach((item, index) => {
    const columnSpan = clamp(Math.floor(item.columnSpan ?? 1), 1, count);
    const rowSpan = Math.max(1, Math.floor(item.rowSpan ?? 1));
    let placed = false;
    while (!placed) {
      if (isFree(column, row, columnSpan, rowSpan)) {
        for (let dc = 0; dc < columnSpan; dc += 1) {
          for (let dr = 0; dr < rowSpan; dr += 1)
            occupied.add(`${column + dc}:${row + dr}`);
        }
        placements.push({ index, column, row, columnSpan, rowSpan });
        column += columnSpan;
        placed = true;
      } else {
        column += 1;
      }
      if (column >= count) {
        column = 0;
        row += 1;
      }
    }
  });

  return placements;
};

/** Nearest cell to a point, clamped to the grid bounds. */
export const gridCellAtPoint = (
  metrics: GridMetrics,
  x: number,
  y: number,
): { column: number; row: number } => {
  const columnStep = metrics.columnWidth + metrics.columnGap;
  const rowStep = metrics.rowHeight + metrics.rowGap;
  const column =
    columnStep <= 0
      ? 0
      : Math.round((x - metrics.x - metrics.columnWidth / 2) / columnStep);
  const row =
    rowStep <= 0
      ? 0
      : Math.round((y - metrics.y - metrics.rowHeight / 2) / rowStep);
  return {
    column: clamp(column, 0, Math.max(0, metrics.columns - 1)),
    row: Math.max(0, row),
  };
};

/** Distributes a total length into `count` gutters, including the outer ones. */
export const gapDistribution = (
  total: number,
  count: number,
  gap: number,
): { inner: number; gutter: number } => {
  if (count <= 1) return { inner: total, gutter: 0 };
  const gutter = Math.max(0, total - gap * (count - 1)) / count;
  return { inner: gutter, gutter: gap };
};
