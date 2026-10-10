/**
 * Browser tests.
 *
 * jsdom has no layout: every rectangle is zero, `elementFromPoint` lies, and
 * `PointerEvent` arrives without the browser's own gesture handling in front of it.
 * The tests in `tests/` work around that with injected geometry, which is fine for
 * the engine but proves nothing about a real pointer. These tests do the opposite:
 * a real Chromium, a real mouse, the real layout.
 *
 * The web server is the examples app, built once and served as static files, so a
 * failing test is a failing page rather than a failing dev server.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = 4178;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // The mobile specs drive a touch screen, so they run on the phone project
    // only: `page.touchscreen` throws on a context without `hasTouch`.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile|touch/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile|touch/,
    },
  ],
  webServer: {
    command: `npm run examples:build && npx vite preview --config examples/playground/vite.config.ts --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
  },
});
