// @vitest-environment node
/**
 * Server rendering.
 *
 * The library ships to React applications, and a growing share of those render on
 * a server first. Three things have to hold for that to work, and this suite is
 * the check for all three:
 *
 * 1. importing an entry point must not touch the DOM (no `window` at module scope);
 * 2. rendering must not touch it either — no `ResizeObserver`, no `matchMedia`, no
 *    `localStorage`;
 * 3. the markup has to be worth something: items, labels and ARIA wiring present,
 *    so the page is not a blank div until hydration.
 *
 * A React warning during any of it fails the suite: a library that renders on a
 * server while complaining about it has not finished the job.
 */

import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Item, Layout } from "../src/index";
import { Chart } from "../src/charts/Chart";
import { BatteryWidget } from "../src/widgets/BatteryWidget";
import { ClockWidget } from "../src/widgets/ClockWidget";
import { NetworkWidget } from "../src/widgets/NetworkWidget";
import { PerformanceWidget } from "../src/widgets/PerformanceWidget";
import { ViewportWidget } from "../src/widgets/ViewportWidget";
import { createStaticWeatherProvider } from "../src/providers/weather";

const weather = createStaticWeatherProvider({
  temperature: 21,
  condition: "clear",
  timezone: "Europe/Madrid",
});

describe("server rendering", () => {
  let errors: string[];

  beforeEach(() => {
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has no DOM to render into", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("imports every entry point without a document", async () => {
    const entries = [
      "../src/index",
      "../src/core/index",
      "../src/react/index",
      "../src/math/index",
      "../src/motion/index",
      "../src/accessibility/index",
      "../src/utilities/index",
      "../src/providers/index",
      "../src/charts/index",
      "../src/widgets/index",
    ];

    for (const entry of entries) {
      const module = await import(entry);
      expect(Object.keys(module).length).toBeGreaterThan(0);
    }
  });

  it("renders a layout with its items, labels and roles", () => {
    const html = renderToString(
      <Layout mode="reorder" label="Dashboard panels" gap={12}>
        <Item id="revenue" label="Revenue">
          Revenue
        </Item>
        <Item id="traffic" label="Traffic">
          Traffic
        </Item>
        <Item id="orders" disabled label="Orders">
          Orders
        </Item>
      </Layout>,
    );

    expect(html).toContain("data-rewap-layout");
    expect(html).toContain('data-mode="reorder"');
    expect(html).toContain('aria-label="Dashboard panels"');
    expect(html).toContain('data-rewap-item="revenue"');
    expect(html).toContain('aria-roledescription="draggable item"');
    expect(html).toContain("aria-keyshortcuts");
    expect(html).toContain("--rw-gap:12px");
    expect(errors).toEqual([]);
  });

  it("renders charts and widgets, which read the browser only in effects", () => {
    const html = renderToString(
      <div>
        <Chart type="line" data={[1, 4, 2, 8]} ariaLabel="Spark" />
        <ClockWidget timeZone="Europe/Madrid" />
        <NetworkWidget />
        <ViewportWidget />
        <PerformanceWidget />
        <BatteryWidget />
      </div>,
    );

    expect(html).toContain('class="rw-chart__svg"');
    expect(html).toContain('aria-label="Spark"');
    expect(html).toContain("<path");
    expect(html).toContain("rw-widget");
    // The battery widget has no API to read on a server, and says so rather than
    // rendering a bar at some invented level.
    expect(html).toContain("unsupported");
    expect(errors).toEqual([]);
  });

  it("generates an accessible label when none is given", () => {
    const html = renderToString(<Chart type="line" data={[1, 4, 2, 8]} />);
    expect(html).toContain("line chart with 4 points");
    expect(errors).toEqual([]);
  });

  it("never reaches for a location or a network on its own", () => {
    // The static provider is the only weather source used in this suite, and it is
    // built from a literal: a server render must not resolve coordinates, ask for a
    // permission or pick an IP service by itself.
    expect(weather.name).toBe("static");
    expect(weather.endpoint).toBeNull();
    expect(errors).toEqual([]);
  });

  it("renders the same markup twice, so hydration has something stable to match", () => {
    const tree = (
      <Layout label="Stable">
        <Item id="a">A</Item>
        <Item id="b">B</Item>
      </Layout>
    );
    expect(renderToString(tree)).toBe(renderToString(tree));
    expect(errors).toEqual([]);
  });
});
