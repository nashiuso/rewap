/**
 * `@nashiuso/rewap` — public entry point.
 *
 * ```tsx
 * import { Layout, Item, useLayout } from "@nashiuso/rewap";
 * ```
 *
 * Four components and a hook, plus the types you need to use them. That is on
 * purpose: the root stays small so it can stay stable. Everything else the
 * library can do lives behind a subpath and is pulled in only when you import it.
 *
 * ```
 * @nashiuso/rewap               Layout, Item, useLayout, createRewap
 * @nashiuso/rewap/react         the React bindings, including internals
 * @nashiuso/rewap/core          the framework-agnostic engine
 * @nashiuso/rewap/math          geometry, interpolation, statistics
 * @nashiuso/rewap/motion        springs, easings, the shared ticker
 * @nashiuso/rewap/accessibility announcements and keyboard grammar
 * @nashiuso/rewap/utilities     browser hooks (opt-in)
 * @nashiuso/rewap/providers     external data providers (opt-in, explicit endpoints)
 * @nashiuso/rewap/charts        SVG charts (opt-in)
 * @nashiuso/rewap/widgets       dashboard widgets (opt-in)
 * ```
 *
 * The package has no runtime network dependency: no module in it is fetched at
 * runtime, nothing is loaded from a CDN, and the stylesheets are local files. The
 * optional providers are the only code here that can reach the network, and only
 * when an application configures an endpoint and calls one.
 */

// React bindings
export { Layout, type LayoutProps } from "./react/Layout";
export {
  Item,
  ItemHandle,
  type ItemProps,
  type ItemHandleProps,
} from "./react/Item";
export { useLayout, type LayoutController } from "./react/useLayout";
export { type PlaceholderRenderInfo, type ItemMeta } from "./react/context";
export type { LayoutBounds } from "./react/Layout";
export type {
  LayoutBoundsConfig,
  LayoutItem,
  LayoutItemInput,
  PersistenceConfig,
} from "./react/useLayoutEngine";

// Framework-agnostic engine
export {
  createRewap,
  type RewapInstance,
  type RewapOptions,
} from "./core/rewap";

// Order and history helpers that applications genuinely need to keep working
// after a drag. The rest of the engine is in `@nashiuso/rewap/core`.
export { orderAfterDrop, reconcileIds, idsEqual } from "./core/order";
export {
  createPersistence,
  applyStoredOrder,
  memoryStorage,
  type Persistence,
  type PersistedLayout,
  type StorageKind,
  type StorageLike,
} from "./core/persistence";

// Types that appear in the public props and event payloads.
export type {
  ItemId,
  LayoutMode,
  PlaceholderStyle,
  InputSource,
  DropReason,
  Slot,
  SlotCandidate,
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  SwapEvent,
  LayoutChangeEvent,
  MoveVector,
  EffectsOptions,
  PhysicsOptions,
  SnapOptions,
} from "./core/types";
export type {
  CollisionStrategy,
  CollisionInput,
  CollisionResult,
} from "./core/collision";
export type { KeyboardOptions } from "./core/keyboard";
export type { GeometryProvider } from "./core/measure";
export type {
  MotionConfig,
  MotionName,
  MotionPlan,
  MotionValue,
  SpringMotion,
  TweenMotion,
} from "./motion/presets";
