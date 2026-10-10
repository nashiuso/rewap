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
    expect(before).toContain("one");
    expect(before).toContain("three");

    await dragItem(page, "one", "three");

    const after = await itemOrder(page);
    const oneIndex = after.indexOf("one");
    const threeIndex = after.indexOf("three");
    const beforeOne = before.indexOf("one");
    const beforeThree = before.indexOf("three");

    // In swap mode exactly two slots change: the dragged item lands where the
    // target was, and the target lands where the drag started.
    expect(oneIndex).toBe(beforeThree);
    expect(threeIndex).toBe(beforeOne);
  });

  test("reports the swap through onSwap", async ({ page }) => {
    await dragItem(page, "two", "four");
    await expect(page.getByText(/last swap: two/)).toBeVisible();
  });
});
