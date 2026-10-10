import { test, expect } from "@playwright/test";
import { itemOrder } from "./support";

test.describe("keyboard dragging", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Space grabs, arrow keys move, Space drops", async ({ page }) => {
    const before = await itemOrder(page);
    const first = page.locator("[data-rewap-item]").first();
    await first.focus();

    await page.keyboard.press("Space");
    await expect(first).toHaveAttribute("data-rewap-active", "");

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");

    await expect(first).not.toHaveAttribute("data-rewap-active", "");
    const after = await itemOrder(page);
    expect(after).not.toEqual(before);
  });

  test("Escape cancels the grab and restores the original order", async ({
    page,
  }) => {
    const before = await itemOrder(page);
    const first = page.locator("[data-rewap-item]").first();
    await first.focus();

    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");

    const after = await itemOrder(page);
    expect(after).toEqual(before);
  });
});
