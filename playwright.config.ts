/**
 * Browser tests.
 *
 * jsdom has no layout: every rectangle is zero, `elementFromPoint` lies, and
 * `PointerEvent` arrives without the browser's own gesture handling in front of it.
 * The tests in `tests/` work around that with injected geometry, which is fine for
 * the engine but proves nothing about a real pointer. These tests do the opposite:
 * a real Chromium, a real mouse, the real layout.
 *
 * The web server is the assembled site, served at /rewap/ to mirror production.
 *
 * NOTE on the touch project: the "mobile" tests use Playwright's phone device
 * profile (Pixel 7, hasTouch: true). The drag test dispatches synthetic
 * `PointerEvent` instances with `pointerType: "touch"` via `page.evaluate()`.
 * Playwright's `Touchscreen` API offers tap and tap-hold but has no drag
 * primitive, so multi-step touch drags must be synthesised at the event level.
 * This exercises the library's pointer-event pipeline with touch coordinates on
 * a touch-capable context — which is closer to a real gesture than a mouse test
 * — but it is not a complete native touch gesture: the browser's own touch
 * interception, hit-testing, and scroll-negotiation layer is bypassed.
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
    baseURL: `${BASE_URL}/rewap/`,
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
    // Build the site first, then serve it. The preview server uses PORT from
    // the environment to pick its listen port.
    command: `node scripts/site/build.mjs && PORT=${PORT} node scripts/site/preview.mjs`,
    url: `${BASE_URL}/rewap/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
  },
});
