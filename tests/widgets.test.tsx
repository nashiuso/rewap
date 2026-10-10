/**
 * Widgets.
 *
 * These are thin shells around the hooks, so the suite concentrates on the two
 * things a shell can get wrong: rendering an honest state when the browser cannot
 * answer, and the markup the shell primitives promise (progressbars, rows, meta).
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BatteryWidget,
  ClockWidget,
  NetworkWidget,
  PerformanceWidget,
  StatsWidget,
  ViewportWidget,
  WeatherWidget,
  Widget,
  WidgetBar,
  WidgetRow,
  WidgetRows,
  WidgetState,
  WidgetValue,
} from "../src/widgets";
import { createStaticWeatherProvider } from "../src/providers";

const staticWeather = createStaticWeatherProvider({
  temperature: 17,
  condition: "clear",
  humidity: 55,
  windSpeed: 8,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("widget primitives", () => {
  it("renders a titled section with optional meta", () => {
    const { container } = render(
      <Widget title="Weather" meta="12:04">
        <WidgetValue unit="°C">17</WidgetValue>
      </Widget>,
    );

    const section = container.querySelector(
      "[data-rewap-widget]",
    ) as HTMLElement;
    expect(section.tagName).toBe("SECTION");
    expect(screen.getByRole("heading", { name: "Weather" })).toBeTruthy();
    expect(screen.getByText("12:04")).toBeTruthy();
    expect(container.querySelector(".rw-widget__unit")?.textContent).toBe("°C");
  });

  it("can render as an article", () => {
    const { container } = render(
      <Widget title="Stats" as="article">
        <span>body</span>
      </Widget>,
    );
    expect(
      (container.querySelector("[data-rewap-widget]") as HTMLElement).tagName,
    ).toBe("ARTICLE");
  });

  it("exposes a bar as a progressbar", () => {
    render(<WidgetBar value={0.42} label="Battery" />);
    const bar = screen.getByRole("progressbar", { name: "Battery" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.querySelector(".rw-widget__bar-fill")).toBeTruthy();
  });

  it("clamps a bar value instead of overflowing its track", () => {
    render(
      <>
        <WidgetBar value={3} label="over" />
        <WidgetBar value={-1} label="under" />
      </>,
    );
    expect(
      screen
        .getByRole("progressbar", { name: "over" })
        .getAttribute("aria-valuenow"),
    ).toBe("100");
    expect(
      screen
        .getByRole("progressbar", { name: "under" })
        .getAttribute("aria-valuenow"),
    ).toBe("0");
  });

  it("lays out rows with labels and values", () => {
    const { container } = render(
      <WidgetRows>
        <WidgetRow
          label="Median"
          value="12.0"
          title="Half the values are below this"
        />
      </WidgetRows>,
    );
    const row = container.querySelector(".rw-widget__row") as HTMLElement;
    expect(row.title).toBe("Half the values are below this");
    expect(row.querySelector(".rw-widget__row-label")?.textContent).toBe(
      "Median",
    );
    expect(row.querySelector(".rw-widget__row-value")?.textContent).toBe(
      "12.0",
    );
  });

  it("marks a state with a tone", () => {
    const { container } = render(
      <WidgetState tone="caution">Not available</WidgetState>,
    );
    expect(
      container.querySelector(".rw-widget__dot")?.getAttribute("data-state"),
    ).toBe("caution");
    expect(container.textContent).toContain("Not available");
  });
});

describe("<StatsWidget>", () => {
  it("summarises the values it was given", () => {
    const { container } = render(
      <StatsWidget values={[2, 4, 4, 4, 5, 5, 7, 9]} unit="ms" />,
    );

    expect(container.querySelector(".rw-widget__value")?.textContent).toBe(
      "5.00ms",
    );
    expect(container.querySelector(".rw-widget__meta")?.textContent).toBe(
      "n = 8",
    );
    expect(container.textContent).toContain("4.50"); // median
    expect(container.textContent).toContain("± 2.14"); // sample deviation
    expect(container.textContent).toContain("2.00 … 9.00");
    expect(container.querySelector(".rw-chart__sparkline")).toBeTruthy();
  });

  it("ignores non-finite values and says so when there is nothing left", () => {
    const { container } = render(
      <StatsWidget
        values={[Number.NaN, Number.POSITIVE_INFINITY]}
        sparkline={false}
      />,
    );
    expect(container.querySelector(".rw-widget__meta")?.textContent).toBe(
      "n = 0",
    );
    expect(container.textContent).toContain("No finite values were provided.");
    expect(container.querySelector(".rw-chart__sparkline")).toBeNull();
  });

  it("uses a moving average for the sparkline when asked", () => {
    render(
      <StatsWidget
        values={[1, 2, 3, 4, 5]}
        movingAverageWindow={3}
        precision={0}
      />,
    );
    expect(screen.getByText(/ma 3/)).toBeTruthy();
  });
});

describe("<NetworkWidget>", () => {
  it("reports what the browser exposes", () => {
    const connection = Object.assign(new EventTarget(), {
      effectiveType: "3g",
      rtt: 250,
      downlink: 1.2,
    });
    vi.stubGlobal("navigator", { ...navigator, onLine: true, connection });

    const { container } = render(<NetworkWidget />);
    expect(container.textContent).toContain("fair connection");
    expect(container.textContent).toContain("3g");
    expect(container.textContent).toContain("250");
  });

  it("explains a missing Network Information API", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      onLine: true,
      connection: undefined,
    });
    const { container } = render(<NetworkWidget />);

    expect(container.textContent).toContain("unknown connection");
    expect(container.textContent).toMatch(
      /Network Information API is not implemented/i,
    );
    // Every unavailable row says so instead of rendering an empty value.
    expect(container.textContent).toContain("not available in this browser");
  });
});

describe("<WeatherWidget>", () => {
  it("renders the observation from the configured provider", async () => {
    render(
      <WeatherWidget
        provider={staticWeather}
        source="coordinates"
        coordinates={{ latitude: 41.4, longitude: 2.2 }}
        cache={false}
      />,
    );

    // The widget rounds to whole degrees; the unit is rendered separately.
    await waitFor(() => expect(screen.getByText("17")).toBeTruthy());
    expect(screen.getByText("Clear")).toBeTruthy();
    expect(screen.getByText("55%")).toBeTruthy();
  });

  it("explains that it is not configured rather than showing a made-up temperature", () => {
    const { container } = render(<WeatherWidget />);
    expect(container.textContent).toContain("Not configured");
    expect(container.textContent).toMatch(/provider/i);
    expect(container.querySelector(".rw-widget__value")).toBeNull();
  });
});

describe("<ClockWidget>", () => {
  it("formats the device clock and names its source", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T09:15:30Z"));

    const { container } = render(<ClockWidget timeZone="UTC" />);
    expect(container.textContent).toContain("09:15:30");
    expect(container.textContent).toContain("UTC");
    expect(container.textContent).toMatch(/device clock/i);

    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
  });
});

describe("<ViewportWidget>", () => {
  it("reports the current viewport", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });

    const { container } = render(<ViewportWidget />);
    expect(container.querySelector(".rw-widget__value")?.textContent).toBe(
      "390px",
    );
    expect(container.querySelector(".rw-widget__meta")?.textContent).toBe("xs");
    expect(container.textContent).toContain("portrait");
  });
});

describe("<PerformanceWidget>", () => {
  it("shows frames and admits that it cannot read CPU temperature", () => {
    const { container } = render(<PerformanceWidget interval={200} />);
    expect(container.textContent).toMatch(/cannot read CPU temperature/i);
    expect(container.textContent).toMatch(/Frame time/i);
  });
});

describe("<BatteryWidget>", () => {
  it("says the API is missing instead of inventing a level", () => {
    vi.stubGlobal("navigator", { ...navigator, getBattery: undefined });
    const { container } = render(<BatteryWidget />);

    expect(container.querySelector(".rw-widget__meta")?.textContent).toBe(
      "unsupported",
    );
    expect(container.textContent).toContain("Not available");
  });

  it("renders a level once the browser answers", async () => {
    const manager = Object.assign(new EventTarget(), {
      charging: false,
      level: 0.31,
      chargingTime: Infinity,
      dischargingTime: 5400,
    });
    vi.stubGlobal("navigator", {
      ...navigator,
      getBattery: async () => manager,
    });

    render(<BatteryWidget />);
    await waitFor(() =>
      expect(
        screen.getByRole("progressbar").getAttribute("aria-valuenow"),
      ).toBe("31"),
    );
  });
});
