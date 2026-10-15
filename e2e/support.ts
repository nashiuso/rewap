import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

/** Current left-to-right order of items in a Rewap layout, by `id`. */
export async function itemOrder(
  page: Page,
  layout: Locator = page.locator("[data-rewap-layout]"),
): Promise<string[]> {
  return layout
    .locator("[data-rewap-item]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-rewap-item") ?? ""),
    );
}

/**
 * Waits for the layout engine to measure items after hydration.
 *
 * SSR renders items with `data-rewap-index="-1"` because no measurement has
 * happened yet. After hydration the engine assigns real indices. Drags must
 * not start until that measurement is complete.
 */
export async function waitForMeasurement(page: Page): Promise<void> {
  // Wait until at least one item has a non-negative index — the layout
  // engine sets these as soon as it measures the DOM.
  await expect(
    page
      .locator(
        "[data-rewap-item][data-rewap-index]:not([data-rewap-index='-1'])",
      )
      .first(),
  ).toBeAttached({ timeout: 10_000 });
}

/** Drags one item onto another with a real, multi-step pointer path. */
export async function dragItem(
  page: Page,
  fromId: string,
  toId: string,
): Promise<void> {
  await waitForMeasurement(page);

  const from = page.locator(`[data-rewap-item="${fromId}"]`);
  const to = page.locator(`[data-rewap-item="${toId}"]`);
  // The playground may sit below the fold in the documentation layout.
  // Scroll both items into view before measuring.
  await from.scrollIntoViewIfNeeded();
  await to.scrollIntoViewIfNeeded();
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox)
    throw new Error(`could not measure ${fromId} or ${toId}`);

  const start = {
    x: fromBox.x + fromBox.width / 2,
    y: fromBox.y + fromBox.height / 2,
  };
  const end = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // A handful of intermediate steps: past the 4px threshold, and close enough
  // to a real gesture that collision detection sees the pointer travel.
  const steps = 8;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      start.x + ((end.x - start.x) * i) / steps,
      start.y + ((end.y - start.y) * i) / steps,
    );
  }
  await page.mouse.up();
}
