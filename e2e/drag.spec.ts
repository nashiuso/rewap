import { test, expect } from "@playwright/test";
import { dragItem, itemOrder } from "./support";

test.describe("pointer drag · swap mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Swap" })).toHaveClass(
      /pg-pill--active/,
    );
  });

  test("dragging one tile onto another exchanges their slots", async ({
    page,
  }) => {
    const before = await itemOrder(page);
    expect(before).toContain("weather");
    expect(before).toContain("network");

    await dragItem(page, "weather", "network");

    const after = await itemOrder(page);
    const weatherIndex = after.indexOf("weather");
    const networkIndex = after.indexOf("network");
    const beforeWeather = before.indexOf("weather");
    const beforeNetwork = before.indexOf("network");

    // In swap mode exactly two slots change: the dragged item lands where the
    // target was, and the target lands where the drag started.
    expect(weatherIndex).toBe(beforeNetwork);
    expect(networkIndex).toBe(beforeWeather);
  });

  test("reports the swap through onSwap", async ({ page }) => {
    await dragItem(page, "stats", "clock");
    await expect(page.getByText(/last swap: stats/)).toBeVisible();
  });
});
