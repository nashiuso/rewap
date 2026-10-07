/**
 * The optional chart entry point.
 *
 * jsdom has no layout engine and no SVG geometry (`getTotalLength` does not
 * exist), so the suite checks the parts that do not depend on either: the DOM
 * contract, the accessible table, the scales and the guards for degenerate data.
 * The drawing itself is verified in the browser tests under `e2e/`.
 */

import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Chart } from "../src/charts/Chart";
import {
  bandScale,
  domainOf,
  linearScale,
  niceDomain,
  normalizeSeries,
  seriesToPoints,
} from "../src/charts/scales";
import { areaPath, barRects, clampPoints, linePath, smoothLinePath } from "../src/charts/paths";

const NativeResizeObserver = globalThis.ResizeObserver;

class SizingObserver implements ResizeObserver {
  static callbacks: ((entries: unknown[]) => void)[] = [];
  constructor(callback: (entries: unknown[]) => void) {
    SizingObserver.callbacks.push(callback);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  SizingObserver.callbacks = [];
  globalThis.ResizeObserver = SizingObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = NativeResizeObserver;
});

const chartOf = (container: HTMLElement): HTMLElement =>
  container.querySelector<HTMLElement>(".rw-chart") as HTMLElement;

describe("scales", () => {
  it("maps a domain onto a range", () => {
    const scale = linearScale([0, 10], [0, 100]);
    expect(scale(0)).toBe(0);
    expect(scale(10)).toBe(100);
    expect(scale(5)).toBe(50);
    // Values outside the domain are extrapolated, not clamped: the chart clamps
    // before drawing instead, so scales stay usable for inverted ranges.
    expect(scale(-5)).toBe(-50);
    expect(scale(50)).toBe(500);
    expect(scale.invert(50)).toBe(5);
  });

  it("survives a flat domain", () => {
    const scale = linearScale([5, 5], [0, 100]);
    expect(scale(5)).toBe(50);
  });

  it("lays bands out with padding between them", () => {
    const band = bandScale(4, [0, 400]);
    expect(band.step).toBeCloseTo(100, 5);
    // A quarter of each step is padding, so bars never touch.
    expect(band.bandwidth).toBeCloseTo(76, 5);
    expect(band.center(0)).toBeCloseTo(50, 5);
    expect(band.center(3)).toBeCloseTo(350, 5);
    expect(band.offset(1)).toBeCloseTo(112, 5);

    const tight = bandScale(4, [0, 400], 0);
    expect(tight.bandwidth).toBeCloseTo(100, 5);
  });

  it("derives and rounds a domain", () => {
    const domain = domainOf([
      { x: 2, y: 4 },
      { x: 8, y: 11 },
    ]);
    expect(domain.x).toEqual([2, 8]);
    expect(domain.y).toEqual([4, 11]);

    const nice = niceDomain([3, 97], 4);
    expect(nice[0]).toBeLessThanOrEqual(3);
    expect(nice[1]).toBeGreaterThanOrEqual(97);
  });

  it("normalises the three accepted data shapes", () => {
    expect(normalizeSeries([1, 2, 3])[0]?.points).toHaveLength(3);
    expect(normalizeSeries([{ x: 1, y: 2 }])[0]?.points[0]).toEqual({ x: 1, y: 2 });
    expect(
      normalizeSeries([
        { id: "a", data: [1, 2] },
        { id: "b", data: [3] },
      ]),
    ).toHaveLength(2);
    expect(seriesToPoints([4, 5])).toEqual([
      { x: 0, y: 4 },
      { x: 1, y: 5 },
    ]);
  });
});

describe("paths", () => {
  const points = [
    { x: 0, y: 10 },
    { x: 10, y: 0 },
    { x: 20, y: 10 },
  ];

  it("builds a polyline with a move and two lines", () => {
    const path = linePath(points);
    expect(path.startsWith("M 0 10")).toBe(true);
    expect(path.match(/L/g)).toHaveLength(2);
  });

  it("returns an empty path for no points", () => {
    expect(linePath([])).toBe("");
    expect(areaPath([], 0)).toBe("");
    expect(smoothLinePath([])).toBe("");
  });

  it("closes the area back to the baseline", () => {
    const path = areaPath(points, 20);
    expect(path.endsWith("Z")).toBe(true);
    expect(path).toContain("L 20 20");
  });

  it("uses curves when asked to smooth and stays finite", () => {
    const path = smoothLinePath(points, 0.25);
    expect(path).toContain("C");
    expect(path).not.toContain("NaN");
  });

  it("turns values into bars anchored at zero", () => {
    const bars = barRects(
      [
        { x: 0, y: 10 },
        { x: 1, y: -5 },
      ],
      {
        offset: (index) => index * 10,
        bandwidth: 8,
        zeroY: 30,
        scaleY: (value) => 30 - value,
        progress: 1,
      },
    );

    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ index: 0, x: 0, width: 8, y: 20 });
    expect(bars[0]?.height).toBeCloseTo(10, 5);
    // A negative value hangs below the zero line rather than flipping the bar.
    expect(bars[1]).toMatchObject({ y: 30 });
    expect(bars[1]?.height).toBeCloseTo(5, 5);

    // Animated bars grow from the baseline.
    const [growing] = barRects([{ x: 0, y: 10 }], {
      offset: () => 0,
      bandwidth: 8,
      zeroY: 30,
      scaleY: (value) => 30 - value,
      progress: 0.5,
    });
    expect(growing?.height).toBeCloseTo(5, 5);
  });

  it("keeps outliers inside the plotting area", () => {
    const clamped = clampPoints(
      [
        { x: -40, y: 10 },
        { x: 5, y: 900 },
      ],
      { x0: 0, x1: 20, y0: 0, y1: 100 },
    );
    expect(clamped).toEqual([
      { x: 0, y: 10 },
      { x: 5, y: 100 },
    ]);
  });
});

describe("<Chart>", () => {
  it("renders the requested chart type", () => {
    const { container, rerender } = render(<Chart type="line" data={[1, 4, 2, 6]} />);
    expect(container.querySelectorAll(".rw-chart__line")).toHaveLength(1);

    rerender(<Chart type="bar" data={[1, 4, 2, 6]} />);
    expect(container.querySelectorAll(".rw-chart__bar")).toHaveLength(4);

    rerender(
      <Chart
        type="scatter"
        data={[
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ]}
      />,
    );
    expect(container.querySelectorAll(".rw-chart__point")).toHaveLength(2);

    rerender(<Chart type="histogram" data={[1, 1, 2, 3, 5, 8, 13]} bins={3} />);
    expect(container.querySelectorAll(".rw-chart__bar")).toHaveLength(3);

    rerender(<Chart type="sparkline" data={[1, 2, 3]} />);
    expect(container.querySelectorAll(".rw-chart__sparkline")).toHaveLength(1);
  });

  it("exposes the data to assistive technology", () => {
    const { container } = render(<Chart type="line" data={[3, 5, 8]} ariaLabel="Weekly signups" />);

    const figure = chartOf(container);
    expect(figure.getAttribute("role")).toBe("img");
    expect(figure.getAttribute("aria-label")).toBe("Weekly signups");
    expect(figure.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

    const table = figure.querySelector("table");
    expect(table?.querySelector("caption")?.textContent).toBe("Weekly signups");
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(table?.querySelector("tbody tr td:last-child")?.textContent).toBe("3");
  });

  it("describes itself when no label is given", () => {
    const { container } = render(<Chart type="area" data={[1, 2, 3]} />);
    expect(chartOf(container).getAttribute("aria-label")).toBe("area chart with 3 points");
  });

  it("can drop the hidden table", () => {
    const { container } = render(<Chart type="line" data={[1, 2]} accessibleTable={false} />);
    expect(container.querySelector("table")).toBeNull();
  });

  it("says so when there is nothing to draw", () => {
    const { container } = render(<Chart type="line" data={[]} ariaLabel="Empty" />);
    expect(container.querySelector(".rw-chart__empty")?.textContent).toBe("No data");
    expect(chartOf(container).getAttribute("aria-label")).toBe("Empty (no data)");
    expect(container.querySelector("table")).toBeNull();
  });

  it("draws several series for line charts but only the first for bars", () => {
    const series = [
      { id: "a", data: [1, 2, 3] },
      { id: "b", data: [3, 2, 1] },
    ];

    const { container, rerender } = render(<Chart type="line" data={series} />);
    expect(container.querySelectorAll(".rw-chart__line")).toHaveLength(2);
    // The hidden table follows the first series, which is what it is labelled for.
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);

    rerender(<Chart type="bar" data={series} />);
    expect(container.querySelectorAll(".rw-chart__bar")).toHaveLength(3);
  });

  it("formats ticks and highlights a point", () => {
    const { container } = render(
      <Chart
        type="line"
        data={[10, 20, 30]}
        showGrid={false}
        highlightIndex={1}
        formatY={(value) => `${value}°`}
        formatX={(_value, index) => `d${index + 1}`}
      />,
    );

    expect(container.querySelectorAll(".rw-chart__grid")).toHaveLength(0);
    expect(container.querySelector(".rw-chart__marker")).toBeTruthy();
    expect(container.textContent).toContain("d1");
    expect(container.textContent).toContain("°");
  });

  it("measures its container and redraws when it changes", async () => {
    const { container } = render(<Chart type="line" data={[1, 2, 3]} />);
    const svg = () => container.querySelector("svg") as SVGSVGElement;

    await waitFor(() => expect(SizingObserver.callbacks.length).toBeGreaterThan(0));
    // Without a layout jsdom reports a zero-width box, so the chart falls back to
    // its default width.
    expect(svg().getAttribute("width")).toBe("320");

    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 640, height: 200, x: 0, y: 0 } as DOMRect);

    try {
      await waitFor(() => {
        for (const callback of SizingObserver.callbacks) callback([]);
        expect(svg().getAttribute("width")).toBe("640");
      });
    } finally {
      rect.mockRestore();
    }
  });

  it("understands a pixel height, and leaves other CSS lengths to CSS", () => {
    const { container, rerender } = render(<Chart type="line" data={[1, 2]} height={240} />);
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("240");

    rerender(<Chart type="line" data={[1, 2]} height="180px" />);
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("180");

    // A relative length is applied to the figure by the browser; the drawing keeps
    // its default height. Reading `12` out of "12rem" used to produce a 24px chart.
    rerender(<Chart type="line" data={[1, 2]} height="12rem" />);
    expect(chartOf(container).style.height).toBe("12rem");
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("180");
  });

  it("does not animate when the user prefers reduced motion", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    try {
      const { container } = render(<Chart type="area" data={[1, 2, 3]} />);
      expect((container.querySelector(".rw-chart__area") as SVGPathElement).style.opacity).toBe("1");
    } finally {
      window.matchMedia = original;
    }
  });
});
