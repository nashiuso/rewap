import { test, expect } from "@playwright/test";
import { itemOrder, waitForMeasurement } from "./support";

test.describe("keyboard dragging", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("playground/");
  });

  test("Space grabs, arrow keys move, Space drops", async ({ page }) => {
    await waitForMeasurement(page);
    const before = await itemOrder(page);
    const firstId = before[0]!;
    const first = page.locator(`[data-rewap-item="${firstId}"]`);
    await first.scrollIntoViewIfNeeded();
    await first.focus();

    // Grab with Space.
    await page.keyboard.press("Space");
    await expect(first).toHaveAttribute("data-rewap-active", "");

    // Move down (swaps with the item below in swap mode).
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(50);

    // Drop with Enter.
    await page.keyboard.press("Enter");

    const after = await itemOrder(page);
    expect(after).not.toEqual(before);
    // The moved item should now be in the second slot.
    expect(after[1]).toBe(firstId);
  });

  test("Escape cancels the grab and restores the original order", async ({
    page,
  }) => {
    await waitForMeasurement(page);
    const before = await itemOrder(page);
    const firstId = before[0]!;
    const first = page.locator(`[data-rewap-item="${firstId}"]`);
    await first.scrollIntoViewIfNeeded();
    await first.focus();

    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");

    const after = await itemOrder(page);
    expect(after).toEqual(before);
  });
});
