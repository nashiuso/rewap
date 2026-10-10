import { test, expect } from "@playwright/test";
import { dragItem, itemOrder } from "./support";

test.use({ reducedMotion: "reduce" });

test.describe("prefers-reduced-motion: reduce", () => {
  test("dragging still works, and settles immediately instead of tweening", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    const before = await itemOrder(page);

    await dragItem(page, before[0]!, before[1]!);

    const after = await itemOrder(page);
    expect(after).not.toEqual(before);

    // The engine runs motion through a shared rAF loop, not CSS transitions, so
    // "collapsed to one step" shows up as the moved tile's transform settling
    // back to its resting value well under one normal animation duration (the
    // library's own `smooth` preset is ~200ms).
    const moved = page.locator(`[data-rewap-item="${after[1]}"]`);
    await page.waitForTimeout(40);
    const transform = await moved.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);

    expect(errors).toEqual([]);
  });
});
