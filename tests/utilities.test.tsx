/**
 * Utility hooks.
 *
 * Each of these wraps a browser API the libraries usually pretend is universal.
 * The tests stub the environments — a desktop browser with a connection, one
 * without, a browser with no battery API at all — because "what happens when the
 * API is missing" is the interesting half.
 */

import { act, render, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { breakpointOf, useViewport } from "../src/utilities/useViewport";
import { qualityFrom, useConnection, useNetworkInfo } from "../src/utilities/useNetworkInfo";
import { useBattery } from "../src/utilities/useBattery";
import { usePerformance } from "../src/utilities/usePerformance";
import { useKeyboardLayout } from "../src/utilities/useKeyboardLayout";
import { useWeather } from "../src/utilities/useWeather";
import { useEmailVerification } from "../src/utilities/useEmailVerification";
import { useMediaQuery } from "../src/utilities/useMediaQuery";
import { isDisposableDomain, levenshtein, suggestDomain, validateEmailLocal } from "../src/utilities/email";
import {
  createDeclaredLocationProvider,
  createStaticWeatherProvider,
  createSyntaxOnlyVerificationProvider,
  type EmailVerificationVerdict,
  type ProviderOutcome,
} from "../src/providers";

// Providers are stable objects in a real application — created once, outside the
// component — and the weather hook treats them as such: passing an inline object
// would re-run the fetch effect on every render. Declared at module scope here for
// the same reason the docs tell people to do it.
const staticWeather = createStaticWeatherProvider({
  temperature: 19.5,
  condition: "clear",
  humidity: 45,
});
const declaredLocation = createDeclaredLocationProvider({ latitude: 41.4, longitude: 2.2 });
const syntaxOnly = createSyntaxOnlyVerificationProvider();

const setWindowSize = (width: number, height: number): void => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
};

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

afterEach(() => {
  setWindowSize(1024, 768);
  vi.unstubAllGlobals();
});

// ------------------------------------------------------------------- viewport

describe("useViewport", () => {
  it("reads size, orientation and breakpoint", () => {
    setWindowSize(390, 844);
    const { result } = renderHook(() => useViewport());
    expect(result.current.width).toBe(390);
    expect(result.current.orientation).toBe("portrait");
    expect(result.current.breakpoint).toBe("xs");
    expect(result.current.isMobile).toBe(true);
  });

  it("follows a resize once the frame is painted", async () => {
    setWindowSize(500, 800);
    const { result } = renderHook(() => useViewport());
    expect(result.current.breakpoint).toBe("sm");

    act(() => {
      setWindowSize(1280, 900);
      window.dispatchEvent(new Event("resize"));
    });
    await act(async () => {
      await frame();
    });

    expect(result.current.width).toBe(1280);
    expect(result.current.breakpoint).toBe("lg");
    expect(result.current.isDesktop).toBe(true);
  });

  it("tracks scroll without a resize", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    const { result } = renderHook(() => useViewport());
    expect(result.current.scrollY).toBe(120);
  });

  it("maps widths to breakpoints", () => {
    expect(breakpointOf(320)).toBe("xs");
    expect(breakpointOf(480)).toBe("sm");
    expect(breakpointOf(1024)).toBe("lg");
    expect(breakpointOf(2000)).toBe("xl");
    // Custom thresholds replace the defaults wholesale.
    expect(breakpointOf(700, { sm: 600, md: 900, lg: 1200, xl: 1600 })).toBe("sm");
    expect(breakpointOf(950, { sm: 600, md: 900, lg: 1200, xl: 1600 })).toBe("md");
  });
});

// ---------------------------------------------------------------- connection

interface FakeConnection extends EventTarget {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

const stubConnection = (values: Partial<FakeConnection> = {}): FakeConnection => {
  const connection = Object.assign(new EventTarget(), {
    effectiveType: "4g",
    downlink: 10,
    rtt: 50,
    saveData: false,
    ...values,
  }) as FakeConnection;
  vi.stubGlobal("navigator", { ...navigator, onLine: true, connection });
  return connection;
};

describe("useNetworkInfo / useConnection", () => {
  it("reports what the browser actually exposes", () => {
    stubConnection({ effectiveType: "3g", rtt: 300 });
    const { result } = renderHook(() => useNetworkInfo());

    expect(result.current.online).toBe(true);
    expect(result.current.effectiveType).toBe("3g");
    expect(result.current.supported.effectiveType).toBe(true);
    expect(result.current.quality).toBe("fair");
  });

  it("says so when the browser exposes nothing", () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: true, connection: undefined });
    const { result } = renderHook(() => useNetworkInfo());

    expect(result.current.supported.connection).toBe(false);
    expect(result.current.effectiveType).toBeUndefined();
    expect(result.current.quality).toBe("unknown");
  });

  it("follows online and offline events", async () => {
    const connection = stubConnection();
    const { result } = renderHook(() => useNetworkInfo());
    expect(result.current.quality).toBe("good");

    await act(async () => {
      vi.stubGlobal("navigator", { ...navigator, onLine: false, connection });
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.online).toBe(false);
    expect(result.current.quality).toBe("offline");
  });

  it("summarises the connection for a badge", () => {
    stubConnection({ effectiveType: "4g", saveData: true });
    const { result } = renderHook(() => useConnection());

    expect(result.current.label).toBe("Good");
    expect(result.current.detailed).toBe(true);
    expect(result.current.saveData).toBe(true);
  });

  it("derives quality from the numbers", () => {
    expect(qualityFrom({ online: false })).toBe("offline");
    expect(qualityFrom({ online: true, effectiveType: "2g" })).toBe("poor");
    expect(qualityFrom({ online: true, effectiveType: "4g" })).toBe("good");
    expect(qualityFrom({ online: true })).toBe("unknown");
  });
});

// ------------------------------------------------------------------- battery

describe("useBattery", () => {
  it("explains that the API is unavailable instead of guessing a level", () => {
    vi.stubGlobal("navigator", { ...navigator, getBattery: undefined });
    const { result } = renderHook(() => useBattery());

    expect(result.current.supported).toBe(false);
    expect(result.current.level).toBeNull();
    expect(result.current.unsupportedReason).toContain("getBattery");
  });

  it("reports a level and follows changes", async () => {
    const manager = Object.assign(new EventTarget(), {
      charging: true,
      level: 0.62,
      chargingTime: 1800,
      dischargingTime: Infinity,
    });
    vi.stubGlobal("navigator", { ...navigator, getBattery: async () => manager });

    const { result } = renderHook(() => useBattery());
    await waitFor(() => expect(result.current.supported).toBe(true));
    await waitFor(() => expect(result.current.level).toBeCloseTo(0.62, 5));
    expect(result.current.charging).toBe(true);

    await act(async () => {
      Object.assign(manager, { charging: false, level: 0.4 });
      manager.dispatchEvent(new Event("levelchange"));
    });
    await waitFor(() => expect(result.current.level).toBeCloseTo(0.4, 5));
  });
});

// --------------------------------------------------------------- performance

describe("usePerformance", () => {
  it("counts frames and never invents a CPU temperature", async () => {
    const { result } = renderHook(() => usePerformance({ interval: 200 }));

    await act(async () => {
      await frame();
      await frame();
    });
    await waitFor(() => expect(result.current.frames).toBeGreaterThan(0));

    expect(result.current.cpuTemperature.supported).toBe(false);
    expect(result.current.cpuTemperature.reason).toContain("cannot read CPU temperature");
  });

  it("can skip the frame loop entirely", () => {
    const { result } = renderHook(() => usePerformance({ measureFps: false }));
    expect(result.current.fps).toBe(0);
    expect(result.current.supported.fps).toBe(typeof window.requestAnimationFrame === "function");
  });
});

// ------------------------------------------------------------------ keyboard

describe("useKeyboardLayout", () => {
  it("detects the platform and picks the matching shortcut symbol", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgentData: { platform: "macOS" },
      userAgent: "Mozilla/5.0 (Macintosh)",
      language: "en-GB",
      languages: ["en-GB", "es"],
    });

    const { result } = renderHook(() => useKeyboardLayout());
    expect(result.current.platform).toBe("macos");
    expect(result.current.isMac).toBe(true);
    expect(result.current.modifierSymbol).toBe("⌘");
    expect(result.current.language).toBe("en-GB");
    expect(result.current.confidence).toBe("high");
  });

  it("is explicit that the physical layout cannot be read", () => {
    const { result } = renderHook(() => useKeyboardLayout());
    expect(result.current.layout).toBeNull();
  });

  it("tracks modifiers and clears them on blur", async () => {
    const { result } = renderHook(() => useKeyboardLayout());
    expect(result.current.modifiers.shift).toBe(false);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }));
    });
    expect(result.current.modifiers.shift).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(result.current.modifiers.shift).toBe(false);
  });
});

// ------------------------------------------------------------------- weather

describe("useWeather", () => {
  it("takes the location from the provider the application chose", async () => {
    const { result } = renderHook(() =>
      useWeather({
        source: "ip",
        locationProvider: declaredLocation,
        provider: staticWeather,
        cache: { storage: "memory", key: "rewap:test:weather" },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    // The declared provider answers offline with exactly what it was given.
    expect(result.current.location?.latitude).toBeCloseTo(41.4, 4);
    expect(result.current.location?.source).toBe("declared");
  });

  it("stays idle and honest when no provider is configured", async () => {
    const { result } = renderHook(() =>
      useWeather({ source: "coordinates", coordinates: { latitude: 41.4, longitude: 2.2 } }),
    );

    await waitFor(() => expect(result.current.status).toBe("unsupported"));
    expect(result.current.unsupportedReason).toContain("No weather provider");
    expect(result.current.data).toBeNull();
  });

  it('explains why `source: "ip"` needs a provider', async () => {
    const { result } = renderHook(() => useWeather({ source: "ip", provider: staticWeather }));

    await waitFor(() => expect(result.current.status).toBe("unsupported"));
    expect(result.current.unsupportedReason).toContain("locationProvider");
  });

  it("loads through a provider without hitting the network", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("no network here")));
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = renderHook(() =>
      useWeather({
        source: "coordinates",
        coordinates: { latitude: 41.4, longitude: 2.2 },
        provider: staticWeather,
        // Inline cache options, on purpose: this shape used to make the hook
        // re-render forever.
        cache: { storage: "memory" },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.temperature).toBeCloseTo(19.5, 5);
    expect(result.current.location?.latitude).toBeCloseTo(41.4, 4);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not run at all when it is disabled", async () => {
    const { result } = renderHook(() =>
      useWeather({ enabled: false, coordinates: { latitude: 1, longitude: 2 }, provider: staticWeather }),
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.data).toBeNull();
  });
});

// --------------------------------------------------------------------- email

describe("email helpers", () => {
  it("validates locally without pretending to know the mailbox", () => {
    expect(validateEmailLocal("someone@example.com").valid).toBe(true);
    expect(validateEmailLocal("someone@example").valid).toBe(false);
    expect(validateEmailLocal("someone@@example.com").valid).toBe(false);
    // Whitespace is trimmed and the domain is normalised; the local part is kept
    // as typed, because it is case-sensitive in theory.
    expect(validateEmailLocal("  Someone@Example.COM ").normalized).toBe("Someone@example.com");
  });

  it("flags disposable domains and suggests typos", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("example.com")).toBe(false);
    expect(suggestDomain("gmial.com")).toBe("gmail.com");
    expect(suggestDomain("example.com")).toBeNull();
  });

  it("measures edit distance", () => {
    expect(levenshtein("gmail", "gmial")).toBe(2);
    expect(levenshtein("same", "same")).toBe(0);
  });
});

describe("useEmailVerification", () => {
  it("runs the local check and says nothing was verified remotely", () => {
    const { result } = renderHook(() => useEmailVerification("someone@example.com"));

    expect(result.current.local.valid).toBe(true);
    expect(result.current.remote.status).toBe("not-configured");
    expect(result.current.remote.unsupportedReason).toContain("No verification provider");
  });

  it("does not send an invalid address anywhere", async () => {
    const verify = vi.fn();
    const { result } = renderHook(() =>
      useEmailVerification("not-an-email", {
        provider: { name: "spy", endpoint: null, verify },
      }),
    );

    await act(async () => {
      await result.current.verify();
    });

    expect(verify).not.toHaveBeenCalled();
    expect(result.current.remote.message).toContain("local validation");
  });

  it("reports the result of an explicit verification", async () => {
    const { result } = renderHook(() =>
      useEmailVerification("someone@example.com", {
        provider: syntaxOnly,
      }),
    );

    const outcome: { current: ProviderOutcome<EmailVerificationVerdict> | null } = { current: null };
    await act(async () => {
      outcome.current = await result.current.verify();
    });

    expect(result.current.remote.status).toBe("verified");
    expect(result.current.remote.checkedAt).toBeTypeOf("number");
    expect(outcome.current?.status).toBe("success");
    if (outcome.current?.status === "success") expect(outcome.current.data.deliverable).toBe(true);
  });
});

// -------------------------------------------------------------- media query

describe("useMediaQuery", () => {
  it("returns the current match and follows changes", async () => {
    const listeners = new Set<(event: { matches: boolean }) => void>();
    const list = {
      matches: false,
      media: "(min-width: 900px)",
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) =>
        listeners.delete(listener),
      addListener: (listener: (event: { matches: boolean }) => void) => listeners.add(listener),
      removeListener: (listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => list),
    );

    const { result } = renderHook(() => useMediaQuery("(min-width: 900px)"));
    expect(result.current).toBe(false);

    await act(async () => {
      (list as { matches: boolean }).matches = true;
      for (const listener of listeners) listener({ matches: true });
    });
    expect(result.current).toBe(true);
  });
});

// ------------------------------------------------------------------ rendering

describe("hooks inside a component", () => {
  it("render without a wrapping provider", () => {
    const Reader = () => {
      const viewport = useViewport();
      const network = useConnection();
      return (
        <p>
          {viewport.width}x{viewport.height} {network.label}
        </p>
      );
    };

    const view = render(<Reader />);
    expect(view.container.textContent).toContain("1024x768");
  });
});
