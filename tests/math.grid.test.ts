import { describe, expect, it } from "vitest";

import {
  cellFromFlowIndex,
  deriveColumnWidth,
  deriveColumns,
  gapDistribution,
  gridAutoFlow,
  gridCellAtPoint,
  gridCellRect,
  gridCellRectFromIndex,
  gridRowCount,
  flowIndexFromCell,
} from "../src/math/grid";
import { rect } from "../src/math/rect";

const metrics = {
  x: 0,
  y: 0,
  columnWidth: 100,
  rowHeight: 50,
  columnGap: 10,
  rowGap: 10,
  columns: 3,
};

describe("math/grid", () => {
  it("derives columns from the container width", () => {
    expect(deriveColumns({ containerWidth: 640, minColumnWidth: 200, gap: 10 })).toBe(3);
    expect(deriveColumns({ containerWidth: 100, minColumnWidth: 200, gap: 10 })).toBe(1);
    expect(deriveColumns({ containerWidth: 640, minColumnWidth: 200, gap: 10, columns: 2 })).toBe(2);
    expect(deriveColumns({ containerWidth: 2000, minColumnWidth: 200, gap: 0, maxColumns: 4 })).toBe(4);
    expect(deriveColumns({ containerWidth: 640, minColumnWidth: 0, gap: 10 })).toBe(1);
  });

  it("derives a column width that fills the container", () => {
    expect(deriveColumnWidth(620, 3, 10)).toBeCloseTo(200, 6);
    expect(deriveColumnWidth(300, 1, 10)).toBe(300);
    expect(deriveColumnWidth(100, 0, 10)).toBe(100);
  });

  it("computes cell rectangles, including spans", () => {
    expect(gridCellRect(metrics, 0, 0)).toEqual(rect(0, 0, 100, 50));
    expect(gridCellRect(metrics, 2, 1)).toEqual(rect(220, 60, 100, 50));
    expect(gridCellRect(metrics, 0, 0, 2)).toEqual(rect(0, 0, 210, 50));
    expect(gridCellRect(metrics, 0, 0, 1, 2)).toEqual(rect(0, 0, 100, 110));
  });

  it("maps between flow index and cell coordinates", () => {
    expect(gridCellRectFromIndex(metrics, 4)).toEqual(rect(110, 60, 100, 50));
    expect(flowIndexFromCell(1, 2, 3)).toBe(7);
    expect(cellFromFlowIndex(7, 3)).toEqual({ column: 1, row: 2 });
    expect(cellFromFlowIndex(7, 0)).toEqual({ column: 0, row: 7 });
    expect(gridRowCount(7, 3)).toBe(3);
    expect(gridRowCount(0, 3)).toBe(0);
  });

  it("auto-flows items row-major with spans", () => {
    const placements = gridAutoFlow([{}, { columnSpan: 2 }, {}, {}, {}], 3);
    expect(placements[0]).toEqual({ index: 0, column: 0, row: 0, columnSpan: 1, rowSpan: 1 });
    // The 2-wide item still fits in the two remaining columns of row 0.
    expect(placements[1]).toEqual({ index: 1, column: 1, row: 0, columnSpan: 2, rowSpan: 1 });
    // Placement is sparse, like CSS `grid-auto-flow: row`: the cursor moves
    // forward and never backtracks into a gap.
    expect(placements[2]).toEqual({ index: 2, column: 0, row: 1, columnSpan: 1, rowSpan: 1 });
    expect(placements[3]).toEqual({ index: 3, column: 1, row: 1, columnSpan: 1, rowSpan: 1 });
    expect(placements[4]).toEqual({ index: 4, column: 2, row: 1, columnSpan: 1, rowSpan: 1 });
  });

  it("clamps spans to the column count", () => {
    const placements = gridAutoFlow([{ columnSpan: 9 }], 3);
    expect(placements[0]?.columnSpan).toBe(3);
  });

  it("places rows for tall items", () => {
    const placements = gridAutoFlow([{ rowSpan: 2 }, {}, {}], 2);
    expect(placements[0]).toEqual({ index: 0, column: 0, row: 0, columnSpan: 1, rowSpan: 2 });
    expect(placements[1]).toEqual({ index: 1, column: 1, row: 0, columnSpan: 1, rowSpan: 1 });
    // The cursor has already advanced past the tall item's column, so the third
    // item lands beside it rather than skipping to the next free row.
    expect(placements[2]).toEqual({ index: 2, column: 1, row: 1, columnSpan: 1, rowSpan: 1 });
  });

  it("finds the cell under a point", () => {
    expect(gridCellAtPoint(metrics, 55, 25)).toEqual({ column: 0, row: 0 });
    expect(gridCellAtPoint(metrics, 165, 25)).toEqual({ column: 1, row: 0 });
    expect(gridCellAtPoint(metrics, -100, -100)).toEqual({ column: 0, row: 0 });
    expect(gridCellAtPoint(metrics, 5000, 5000).column).toBe(2);
  });

  it("distributes gutters", () => {
    expect(gapDistribution(100, 1, 10)).toEqual({ inner: 100, gutter: 0 });
    expect(gapDistribution(320, 4, 10).gutter).toBe(10);
  });
});
