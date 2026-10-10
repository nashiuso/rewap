import type { Page, Locator } from "@playwright/test";

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

/** Drags one item onto another with a real, multi-step pointer path. */
export async function dragItem(
  page: Page,
  fromId: string,
  toId: string,
): Promise<void> {
  const from = page.locator(`[data-rewap-item="${fromId}"]`);
  const to = page.locator(`[data-rewap-item="${toId}"]`);
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
