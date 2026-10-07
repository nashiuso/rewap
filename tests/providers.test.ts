/**
 * Providers: the adapters for anything the browser cannot answer locally.
 *
 * Every test stubs `fetch`, which is the point of the design — no request can
 * happen unless the application wrote the provider. The suite also checks that
 * failures come back as values (`unsupported` / `error`) rather than exceptions,
 * because the UI has to render them.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createBrowserGeolocationProvider,
  createDeclaredLocationProvider,
  createHttpEmailVerificationProvider,
  createIpLocationProvider,
  createOpenMeteoProvider,
  createStaticWeatherProvider,
  createSyntaxOnlyVerificationProvider,
  createUnsupportedWeatherProvider,
  fetchJson,
} from "../src/providers";

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

const stubFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) => {
  const spy = vi.fn(impl);
  vi.stubGlobal("fetch", spy);
  return spy;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchJson", () => {
  it("returns the status and the parsed body", async () => {
    stubFetch(async () => jsonResponse({ hello: "world" }, 201));
    const result = await fetchJson("https://example.test/api");
    expect(result).toEqual({ ok: true, status: 201, data: { hello: "world" } });
  });

  it("falls back to null when the body is not JSON", async () => {
    stubFetch(
      async () =>
        ({
          ok: false,
          status: 502,
          json: async () => {
            throw new SyntaxError("Unexpected token <");
          },
        }) as unknown as Response,
    );

    const result = await fetchJson("https://example.test/api");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.data).toBeNull();
  });

  it("aborts a request that outlives its timeout", async () => {
    vi.useFakeTimers();
    let sawSignal: AbortSignal | undefined;
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          sawSignal = init?.signal ?? undefined;
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    const request = fetchJson("https://example.test/slow", { timeoutMs: 50 });
    // The expectation is attached before the clock moves: the rejection happens
    // while the timers advance, and a handler attached afterwards is a tick late.
    const rejected = expect(request).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(60);
    await rejected;

    expect(sawSignal?.aborted).toBe(true);
  });

  it("reports a missing fetch instead of throwing something unreadable", async () => {
    vi.stubGlobal("fetch", undefined);
    await expect(fetchJson("https://example.test/api")).rejects.toThrow("fetch is not available");
  });
});

describe("weather providers", () => {
  it("maps an Open-Meteo response into the shared weather shape", async () => {
    const spy = stubFetch(async () =>
      jsonResponse({
        current: {
          time: "2026-10-07T09:00",
          temperature_2m: 21.4,
          apparent_temperature: 20.1,
          relative_humidity_2m: 63,
          wind_speed_10m: 12.5,
          weather_code: 3,
        },
        current_units: { temperature_2m: "°C" },
        timezone: "Europe/Madrid",
      }),
    );

    const provider = createOpenMeteoProvider();
    const outcome = await provider.fetchWeather({ latitude: 41.39, longitude: 2.17, unit: "celsius" });
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;

    expect(outcome.data.temperature).toBeCloseTo(21.4, 5);
    expect(outcome.data.condition).toBe("overcast");
    expect(outcome.data.humidity).toBe(63);
    expect(outcome.data.timezone).toBe("Europe/Madrid");
    expect(outcome.source).toBe("open-meteo");

    const url = new URL(spy.mock.calls[0]?.[0] as string);
    expect(url.searchParams.get("latitude")).toBe("41.39");
    expect(url.searchParams.get("longitude")).toBe("2.17");
    expect(url.searchParams.get("temperature_unit")).toBeNull();
  });

  it("asks for Fahrenheit when the caller uses Fahrenheit", async () => {
    const spy = stubFetch(async () => jsonResponse({ current: { temperature_2m: 70, weather_code: 0 } }));
    await createOpenMeteoProvider({ timeoutMs: 100 }).fetchWeather({
      latitude: 0,
      longitude: 0,
      unit: "fahrenheit",
    });

    const url = new URL(spy.mock.calls[0]?.[0] as string);
    expect(url.searchParams.get("temperature_unit")).toBe("fahrenheit");
    expect(url.searchParams.get("wind_speed_unit")).toBe("mph");
  });

  it("turns an HTTP failure into a retryable error, not an exception", async () => {
    stubFetch(async () => jsonResponse({ reason: "rate limited" }, 429));
    const outcome = await createOpenMeteoProvider().fetchWeather({
      latitude: 0,
      longitude: 0,
      unit: "celsius",
    });

    expect(outcome).toMatchObject({ status: "error", httpStatus: 429, retryable: true });
    if (outcome.status === "error") expect(outcome.message).toBe("rate limited");
  });

  it("reports a response without a temperature", async () => {
    stubFetch(async () => jsonResponse({ current: { weather_code: 1 } }));
    const outcome = await createOpenMeteoProvider().fetchWeather({
      latitude: 0,
      longitude: 0,
      unit: "celsius",
    });
    expect(outcome.status).toBe("error");
    if (outcome.status === "error") expect(outcome.retryable).toBe(true);
  });

  it("returns what it was given without touching the network", async () => {
    const spy = stubFetch(async () => jsonResponse({}));
    const provider = createStaticWeatherProvider({
      temperature: 18,
      condition: "clear",
      humidity: 40,
    });

    const outcome = await provider.fetchWeather({ latitude: 1, longitude: 2, unit: "celsius" });
    expect(outcome.status).toBe("success");
    if (outcome.status === "success") expect(outcome.data.temperature).toBe(18);
    expect(spy).not.toHaveBeenCalled();
  });

  it("can be marked unsupported with a reason to display", async () => {
    const provider = createUnsupportedWeatherProvider("Weather requires a configured provider.");
    const outcome = await provider.fetchWeather({ latitude: 0, longitude: 0, unit: "celsius" });
    expect(outcome).toEqual({
      status: "unsupported",
      reason: "Weather requires a configured provider.",
    });
  });
});

describe("location providers", () => {
  it("reads an IP endpoint through the default parser", async () => {
    stubFetch(async () => jsonResponse({ latitude: 41.3874, longitude: 2.1686, city: "Barcelona" }));
    const location = createIpLocationProvider({ endpoint: "https://example.test/json" });
    const outcome = await location.locate();

    expect(outcome.status).toBe("success");
    if (outcome.status === "success") {
      expect(outcome.data.latitude).toBeCloseTo(41.3874, 4);
      expect(outcome.data.city).toBe("Barcelona");
      expect(outcome.data.accuracy).toBe("coarse");
    }
  });

  it("accepts a custom parser and rejects an unusable body", async () => {
    stubFetch(async () => jsonResponse({ result: { lat: 1, lon: 2 } }));
    const location = createIpLocationProvider({
      endpoint: "https://example.test/json",
      parse: (body) => {
        const record = body as { result?: { lat: number; lon: number } };
        if (!record.result) return null;
        return { latitude: record.result.lat, longitude: record.result.lon };
      },
    });

    const outcome = await location.locate();
    expect(outcome.status).toBe("success");
    if (outcome.status === "success") expect(outcome.data.longitude).toBe(2);

    stubFetch(async () => jsonResponse({ nothing: true }));
    const failing = await createIpLocationProvider({ endpoint: "https://example.test/json" }).locate();
    expect(failing.status).toBe("error");
  });

  it("uses the geolocation API only through the explicit provider", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({
        coords: { latitude: 48.85, longitude: 2.35, accuracy: 25 },
      } as GeolocationPosition),
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    });

    const provider = createBrowserGeolocationProvider();
    const outcome = await provider.locate();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("success");
    if (outcome.status === "success") expect(outcome.data.accuracy).toBe("precise");
  });

  it("explains itself when the browser has no geolocation at all", async () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: undefined });
    const outcome = await createBrowserGeolocationProvider().locate();

    expect(outcome.status).toBe("unsupported");
    if (outcome.status === "unsupported") expect(outcome.reason).toContain("geolocation");
  });

  it("returns a declared location without any request", async () => {
    const spy = stubFetch(async () => jsonResponse({}));
    const outcome = await createDeclaredLocationProvider({
      latitude: 41.4,
      longitude: 2.2,
      label: "office",
    }).locate();

    expect(outcome.status).toBe("success");
    if (outcome.status === "success") {
      expect(outcome.data.source).toBe("office");
      expect(outcome.data.accuracy).toBe("declared");
    }
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("email verification providers", () => {
  it("posts to the application's own endpoint", async () => {
    const spy = stubFetch(async () => jsonResponse({ state: "deliverable", domain_has_mx: true }, 200));
    const provider = createHttpEmailVerificationProvider({ endpoint: "/api/verify-email" });
    const outcome = await provider.verify({ email: "someone@example.com" });

    expect(outcome.status).toBe("success");
    if (outcome.status === "success") {
      expect(outcome.data.deliverable).toBe(true);
      expect(outcome.data.domainHasMx).toBe(true);
    }

    const init = spy.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ email: "someone@example.com" });
  });

  it("can use GET with a custom parameter name", async () => {
    const spy = stubFetch(async () => jsonResponse({ deliverable: false }));
    await createHttpEmailVerificationProvider({
      endpoint: "https://example.test/verify",
      method: "GET",
      queryParam: "address",
    }).verify({ email: "someone@example.com" });

    const url = new URL(spy.mock.calls[0]?.[0] as string);
    expect(url.searchParams.get("address")).toBe("someone@example.com");
  });

  it("flags a server error as retryable and a 4xx as not", async () => {
    stubFetch(async () => jsonResponse({ message: "nope" }, 400));
    const rejected = await createHttpEmailVerificationProvider({
      endpoint: "https://example.test/verify",
    }).verify({ email: "someone@example.com" });
    expect(rejected).toMatchObject({ status: "error", retryable: false, httpStatus: 400 });

    stubFetch(async () => jsonResponse({ message: "later" }, 503));
    const retryable = await createHttpEmailVerificationProvider({
      endpoint: "https://example.test/verify",
    }).verify({ email: "someone@example.com" });
    expect(retryable).toMatchObject({ status: "error", retryable: true, httpStatus: 503 });
  });

  it("keeps the syntax-only provider honest about what it checked", async () => {
    const provider = createSyntaxOnlyVerificationProvider();
    expect(provider.endpoint).toBeNull();

    const outcome = await provider.verify({ email: "someone@example.com" });
    expect(outcome.status).toBe("success");
    if (outcome.status === "success") {
      expect(outcome.data.deliverable).toBe(true);
      expect(outcome.data.mailboxConfirmed).toBeNull();
      expect(outcome.data.message).toContain("nothing about the mailbox was checked");
    }

    const invalid = await provider.verify({ email: "not-an-email" });
    if (invalid.status === "success") expect(invalid.data.deliverable).toBe(false);
  });
});
