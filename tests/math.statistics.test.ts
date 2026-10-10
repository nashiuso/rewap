import { describe, expect, it } from "vitest";

import {
  correlation,
  extent,
  finite,
  histogram,
  interquartileRange,
  mean,
  median,
  mode,
  movingAverage,
  movingAverageExponential,
  normalizeValues,
  percentile,
  quantile,
  regression,
  standardDeviation,
  variance,
} from "../src/math/statistics";

describe("math/statistics", () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9];

  it("filters non-finite values", () => {
    expect(finite([1, Number.NaN, 2, Number.POSITIVE_INFINITY, 3])).toEqual([
      1, 2, 3,
    ]);
    expect(mean([Number.NaN])).toBeNaN();
  });

  it("computes central tendency", () => {
    expect(mean(values)).toBe(5);
    expect(median(values)).toBe(4.5);
    expect(median([1, 3, 5])).toBe(3);
    expect(mode(values)).toEqual({ values: [4], count: 3 });
    expect(mode([1, 1, 2, 2])).toEqual({ values: [1, 2], count: 2 });
    expect(mode([])).toEqual({ values: [], count: 0 });
  });

  it("computes spread", () => {
    // ddof = 1 by default, matching most statistics packages.
    expect(variance([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(4.571428571, 6);
    expect(variance([2, 4, 4, 4, 5, 5, 7, 9], 0)).toBe(4);
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(
      2.138089935,
      6,
    );
    expect(extent([3, -1, 9])).toEqual({ min: -1, max: 9, span: 10 });
    expect(extent([]).min).toBeNaN();
    expect(interquartileRange([1, 2, 3, 4, 5])).toBe(2);
  });

  it("computes percentiles with interpolation", () => {
    expect(percentile([1, 2, 3, 4], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4], 100)).toBe(4);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], -10)).toBe(1);
    expect(percentile([], 50)).toBeNaN();
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(percentile([42], 90)).toBe(42);
  });

  it("computes correlation", () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6);
    expect(correlation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 6);
    expect(correlation([1, 2, 3], [5, 5, 5])).toBeNaN();
    expect(correlation([1], [1])).toBeNaN();
  });

  it("fits a least squares regression", () => {
    const fit = regression([1, 2, 3, 4], [3, 5, 7, 9]);
    expect(fit.slope).toBeCloseTo(2, 6);
    expect(fit.intercept).toBeCloseTo(1, 6);
    expect(fit.r2).toBeCloseTo(1, 6);
    expect(fit.predict(5)).toBeCloseTo(11, 6);

    const flat = regression([1, 2], [4, 4]);
    expect(flat.slope).toBe(0);
    expect(flat.r2).toBeCloseTo(1, 6);

    const none = regression([], []);
    expect(none.slope).toBe(0);
    expect(none.r2).toBeNaN();
  });

  it("smooths with moving averages", () => {
    expect(movingAverage([1, 2, 3, 4, 5], 2)).toEqual([1, 1.5, 2.5, 3.5, 4.5]);
    const exponential = movingAverageExponential([0, 10, 10, 10], 0.5);
    expect(exponential[0]).toBe(0);
    expect(exponential[1]).toBe(5);
    expect(exponential[2]).toBe(7.5);
  });

  it("bins values into a histogram", () => {
    const result = histogram([1, 2, 3, 4], 2);
    expect(result.counts).toEqual([2, 2]);
    expect(result.binWidth).toBeCloseTo(1.5, 6);
    expect(result.edges).toHaveLength(3);

    const constant = histogram([5, 5, 5], 2);
    expect(constant.counts.reduce((a, b) => a + b, 0)).toBe(3);
    expect(histogram([], 2).counts).toEqual([]);
    expect(histogram([1, 100], 1).counts).toEqual([2]);
  });

  it("scales values into 0..1", () => {
    expect(normalizeValues([0, 5, 10])).toEqual([0, 0.5, 1]);
    expect(normalizeValues([3, 3])).toEqual([0.5, 0.5]);
    expect(normalizeValues([])).toEqual([]);
  });
});
