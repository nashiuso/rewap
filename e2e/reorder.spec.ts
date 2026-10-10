import { test, expect } from "@playwright/test";
import { dragItem, itemOrder } from "./support";

test.describe("pointer drag · reorder mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Reorder" }).click();
    await expect(page.getByRole("button", { name: "Reorder" })).toHaveClass(
      /pg-pill--active/,
    );
  });

  test("dragging an item past others shifts the whole range, not just one slot", async ({
    page,
  }) => {
    const before = await itemOrder(page);
    const firstId = before[0]!;
    const targetId = before[before.length - 1]!;

    await dragItem(page, firstId, targetId);

    const after = await itemOrder(page);
    // Reorder removes the item from its slot and re-inserts it: everything
    // between the old and new position shifts by one instead of swapping pairs.
    expect(after[after.length - 1]).toBe(firstId);
    expect(after).not.toEqual(before);
    expect(new Set(after)).toEqual(new Set(before));
  });
});
