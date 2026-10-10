/**
 * Type-level tests for the public API.
 *
 * These are not run by Vitest: `npm run test:types` compiles this file with
 * `tsc --noEmit`. A line that should not compile carries `@ts-expect-error`, which
 * `tsc` treats as an error when the line turns out to be fine — so the file fails
 * in both directions, which is the point.
 *
 * Only the public surface is exercised here: the root entry point and the subpaths
 * a consumer is documented to import from.
 */

import type { ReactNode } from "react";

import { createRewap, Item, Layout, useLayout } from "@nashiuso/rewap";
import type {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  LayoutChangeEvent,
  LayoutMode,
  MotionValue,
  SwapEvent,
} from "@nashiuso/rewap";
import { createDragController } from "@nashiuso/rewap/core";
import { resolveCollision } from "@nashiuso/rewap/core";
import { rect } from "@nashiuso/rewap/math";
import { resolveMotion } from "@nashiuso/rewap/motion";
import { useViewport } from "@nashiuso/rewap/utilities";
import { createStaticWeatherProvider } from "@nashiuso/rewap/providers";
import { Chart } from "@nashiuso/rewap/charts";
import { StatsWidget } from "@nashiuso/rewap/widgets";

// --------------------------------------------------------------------- Layout

const panel: ReactNode = <Item id="one">One</Item>;

const layout = (
  <Layout
    mode="reorder"
    gap={12}
    columns={3}
    placeholder="outline"
    renderPlaceholder={({ item, slot }) => `${item} at ${slot.index}`}
    motion={{ type: "spring", stiffness: 320, damping: 32 }}
    effects={{ hover: "lift", drag: "magnetic", velocityRotation: true }}
    history={{ enabled: true, limit: 50 }}
    persistence={{ key: "board", storage: "localStorage" }}
    keyboard={{ step: 1, largeStep: 3 }}
    snap={{ enabled: true, threshold: 40 }}
    threshold={4}
    label="Board"
    onSwap={(event: SwapEvent) => void event.nextSlot.index}
    onDragStart={(event: DragStartEvent) => void event.source}
    onDragMove={(event: DragMoveEvent) => void event.velocity.x}
    onDragEnd={(event: DragEndEvent) => void event.cancelled}
    onChange={(items, event: LayoutChangeEvent) => void [items, event.ids]}
  >
    {panel}
  </Layout>
);

void layout;

// Mode is a union, not a string.
const badMode: LayoutMode = "swap";
void badMode;
// @ts-expect-error — "sortable" is not a layout mode.
const notMode: LayoutMode = "sortable";
void notMode;

// @ts-expect-error — `mode` is restricted to the three documented values.
void (<Layout mode="sorted" />);

// A motion preset name is accepted where a plan is.
const preset: MotionValue = "snappy";
void preset;
// @ts-expect-error — "bouncy" is not a preset.
const notPreset: MotionValue = "bouncy";
void notPreset;

// ----------------------------------------------------------------------- Item

const item = (
  <Item
    id="two"
    draggable
    label="Two"
    columnSpan={2}
    rowSpan={1}
    effects={{ drag: "tilt" }}
  >
    <Item.Handle aria-label="Move" />
    Two
  </Item>
);
void item;

// @ts-expect-error — `id` is required and there is no default.
void (<Item>Two</Item>);

// ------------------------------------------------------------------ useLayout

const useApi = (): Record<string, unknown> => {
  const layout = useLayout();
  const ids: string[] = layout.ids;
  const slots = layout.slots.map((slot) => slot.rect.width);
  const moved: boolean = layout.move("one", 2);
  const swapped: boolean = layout.swap("one", "two");
  layout.grab("one");
  layout.release();
  layout.cancel();
  layout.undo();
  layout.redo();
  layout.reset();
  layout.announce("saved", "polite");
  const element: HTMLElement | null = layout.element("one");
  return { ids, slots, moved, swapped, element };
};
void useApi;

// ------------------------------------------------------------------ createRewap

const headless = createRewap({
  ids: ["a", "b"],
  mode: "reorder",
  history: { limit: 10 },
});
const order: string[] = headless.ids();
const unsubscribe: () => void = headless.subscribe(() => {});
unsubscribe();
void order;

// @ts-expect-error — a headless instance has no DOM element accessor.
headless.element("a");

// ------------------------------------------------------------ subpath surfaces

const collision = resolveCollision(
  {
    activeRect: rect(0, 0, 10, 10),
    pointer: { x: 5, y: 5 },
    candidates: [],
    axis: "y",
  },
  { strategy: "pointer", minScore: 0, exclude: "one" },
);
void collision;

const plan = resolveMotion("smooth", { prefersReducedMotion: false });
void plan.kind;

const controller = createDragController({
  mode: "reorder",
  getOrder: () => ["a", "b"],
  getSlots: () => [],
});
void controller.moveItemTo("a", 1);
// @ts-expect-error — `getOrder` is required; the controller has no default order.
createDragController({ mode: "reorder" });

const useViewportProbe = () => useViewport({ trackScroll: false });
void useViewportProbe;

const weather = createStaticWeatherProvider({ temperature: 21 });
void weather.name;

const chart = <Chart type="histogram" data={[1, 2, 3]} bins={12} showGrid />;
void chart;
// @ts-expect-error — "pie" is not one of the chart types.
void (<Chart type="pie" data={[1]} />);

const widget = <StatsWidget values={[1, 2, 3]} unit="ms" sparkline />;
void widget;
// @ts-expect-error — `values` is required.
void (<StatsWidget />);

// Event payloads carry the fields the documentation promises.
type SwapShape = Pick<
  SwapEvent,
  "item" | "previousSlot" | "nextSlot" | "position" | "velocity"
>;
const check: SwapShape = {
  item: "one",
  previousSlot: { index: 0, column: 0, row: 0, rect: rect(0, 0, 1, 1) },
  nextSlot: { index: 1, column: 1, row: 0, rect: rect(1, 0, 1, 1) },
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
};
void check;
