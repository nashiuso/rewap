import { test, expect } from "@playwright/test";
import { itemOrder } from "./support";

// Runs on the "mobile" project only (see playwright.config.ts) — it needs a
// touch-capable context (`hasTouch: true`) or `page.touchscreen` throws.
test.describe("touch dragging", () => {
  test("a touch drag swaps two tiles on a phone-sized viewport", async ({
    page,
  }) => {
    await page.goto("/");

    const before = await itemOrder(page);
    const from = page.locator(`[data-rewap-item="${before[0]}"]`);
    const to = page.locator(`[data-rewap-item="${before[1]}"]`);
    const fromBox = await from.boundingBox();
    const toBox = await to.boundingBox();
    if (!fromBox || !toBox) throw new Error("could not measure tiles");

    const start = {
      x: fromBox.x + fromBox.width / 2,
      y: fromBox.y + fromBox.height / 2,
    };
    const end = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };

    // NOTE(nashiuso): this used to "seed" the gesture with two `touchscreen.tap()`
    // calls first. Each tap is a real zero-movement touch, which the engine reads
    // as a complete grab-and-drop on the tile and sends it into its settle
    // animation (`data-status="settling"`) — so by the time the dispatched
    // pointer sequence below ran, `elementFromPoint` at the start coordinate hit
    // the layout container (sitting above the mid-transition tile), not the
    // tile itself, and the drag below never found a `[data-rewap-item]` to grab.
    // Dropping the taps and going straight to the dispatched sequence fixes it.
    //
    // Playwright's touchscreen API has no drag primitive, so the gesture is
    // driven entirely through a dispatched pointer-event sequence, the same
    // events a real touch produces.
    await page.evaluate(
      ([sx, sy, ex, ey]) => {
        const target = document.elementFromPoint(sx, sy);
        if (!target) return;
        const fire = (type: string, x: number, y: number) =>
          target.dispatchEvent(
            new PointerEvent(type, {
              pointerId: 1,
              pointerType: "touch",
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
            }),
          );
        fire("pointerdown", sx, sy);
        const steps = 6;
        for (let i = 1; i <= steps; i += 1) {
          fire(
            "pointermove",
            sx + ((ex - sx) * i) / steps,
            sy + ((ey - sy) * i) / steps,
          );
        }
        fire("pointerup", ex, ey);
      },
      [start.x, start.y, end.x, end.y],
    );

    await expect.poll(async () => itemOrder(page)).not.toEqual(before);
  });

  test("the board stays usable at a phone viewport width", async ({ page }) => {
    await page.goto("/");
    const board = page.locator("[data-rewap-layout]");
    await expect(board).toBeVisible();
    const box = await board.boundingBox();
    expect(box?.width).toBeLessThanOrEqual((await page.viewportSize())!.width);
  });
});
