/**
 * The engine hook behind `<Layout>`.
 *
 * It owns everything that is not rendering: order state (controlled or
 * uncontrolled), history, persistence, lazy measurement, the drag controller and
 * the announcements. `Layout` itself only deals with DOM events and markup.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RefObject } from "react";

import { createAnnouncer, type Announcer } from "../accessibility";
import type { CollisionStrategy } from "../core/collision";
import {
  createDragController,
  type DragController,
  type DragSnapshot,
  type DropResult,
} from "../core/drag";
import type { KeyboardOptions } from "../core/keyboard";
import {
  createStaticGeometry,
  domGeometry,
  measureSlots,
  type GeometryProvider,
} from "../core/measure";
import { idsEqual, orderAfterDrop, reconcileIds } from "../core/order";
import {
  applyStoredOrder,
  createPersistence,
  type StorageKind,
  type StorageLike,
} from "../core/persistence";
import { createHistory, type History } from "../core/store";
import type {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  EffectsOptions,
  ItemId,
  LayoutChangeEvent,
  LayoutMode,
  SlotCandidate,
  SnapOptions,
  SwapEvent,
} from "../core/types";
import type { MotionValue } from "../motion/presets";
import { readTranslate } from "../motion/transform";
import { rect, sanitizeRect, translateRect, type Rect } from "../math/rect";
import type { ElementStateController } from "./elementState";
import type { ItemMeta } from "./context";

export interface LayoutItem<T = unknown> {
  id: ItemId;
  data?: T;
  columnSpan?: number;
  rowSpan?: number;
}

export type LayoutItemInput<T = unknown> = ItemId | LayoutItem<T>;

export const normalizeItems = <T>(
  input: readonly LayoutItemInput<T>[],
): { ids: ItemId[]; items: LayoutItem<T>[] } => {
  const ids: ItemId[] = [];
  const items: LayoutItem<T>[] = [];
  for (const entry of input) {
    if (typeof entry === "string") {
      ids.push(entry);
      items.push({ id: entry });
      continue;
    }
    ids.push(entry.id);
    items.push(entry);
  }
  return { ids, items };
};

export interface PersistenceConfig {
  key: string;
  storage?: StorageKind | StorageLike;
  enabled?: boolean;
}

export interface LayoutBoundsConfig {
  /** `"container"` (default), `"viewport"`, an element, a ref or an explicit rect. */
  value?:
    | "container"
    | "viewport"
    | null
    | HTMLElement
    | RefObject<HTMLElement | null>
    | Rect;
}

export interface EngineOptions<T> {
  mode: LayoutMode;
  items?: readonly LayoutItemInput<T>[];
  defaultItems?: readonly LayoutItemInput<T>[];
  childIds: ItemId[];
  onChange?: (items: LayoutItemInput<T>[], event: LayoutChangeEvent) => void;
  onSwap?: (event: SwapEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  collision?: CollisionStrategy;
  minCollisionScore?: number;
  snap?: SnapOptions;
  threshold?: number;
  motion: MotionValue;
  effects: EffectsOptions;
  historyEnabled: boolean;
  historyLimit: number;
  persistence?: PersistenceConfig | null;
  keyboard?: (KeyboardOptions & { enabled?: boolean }) | null;
  bounds?: LayoutBoundsConfig["value"];
  disabled: boolean;
  prefersReducedMotion: boolean;
  containerRef: RefObject<HTMLElement | null>;
  registry: Map<ItemId, ItemMeta>;
  nodes: Map<ItemId, ElementStateController>;
  /** Injected for tests: replaces `getBoundingClientRect`. */
  geometry?: GeometryProvider;
}

export interface Engine<T> {
  mode: LayoutMode;
  ids: ItemId[];
  renderIds: ItemId[];
  orderKey: string;
  registry: Map<ItemId, ItemMeta>;
  controller: DragController;
  snapshot: DragSnapshot;
  itemsById: Map<ItemId, LayoutItem<T>>;
  slots(): SlotCandidate[];
  invalidateSlots(): void;
  /** Measures immediately and clears the dirty flag. */
  measure(): SlotCandidate[];
  baseRects(): Map<ItemId, Rect>;
  containerRect(): Rect | null;
  prefersReducedMotion: boolean;
  effects: EffectsOptions;
  motion: MotionValue;
  disabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Number of undo steps currently held. */
  historyDepth: number;
  undo(): void;
  redo(): void;
  reset(): void;
  moveItem(id: ItemId, index: number): boolean;
  grab(id: ItemId): boolean;
  announce(message: string, priority?: "polite" | "assertive"): void;
  announcer(): Announcer | null;
  /** Commits an order produced outside the drag engine (drop, keyboard, programmatic). */
  applyOrder(next: ItemId[], event: LayoutChangeEvent, record?: boolean): void;
  /** Recomputes the rendered order for a live drag preview. */
  previewIds(): ItemId[];
}

export const useLayoutEngine = <T>(options: EngineOptions<T>): Engine<T> => {
  const {
    mode,
    childIds,
    disabled,
    effects,
    motion,
    prefersReducedMotion,
    registry,
    nodes,
    containerRef,
  } = options;

  const geometry = options.geometry ?? domGeometry;

  // ---------------------------------------------------------------- props refs
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ------------------------------------------------------------------- order
  const controlledItems = options.items;
  const normalizedControlled = useMemo(
    () => (controlledItems ? normalizeItems(controlledItems) : null),
    [controlledItems],
  );
  const normalizedDefaults = useMemo(
    () => (options.defaultItems ? normalizeItems(options.defaultItems) : null),
    [options.defaultItems],
  );

  const [uncontrolledIds, setUncontrolledIds] = useState<ItemId[]>(
    () => normalizedDefaults?.ids ?? [],
  );

  const reconcile = useCallback(() => {
    if (normalizedControlled) return;
    setUncontrolledIds((previous) => {
      const base = previous.length > 0 ? previous : childIds;
      const { ids } = reconcileIds(base, childIds);
      return idsEqual(previous, ids) ? previous : ids;
    });
  }, [childIds, normalizedControlled]);

  useEffect(() => {
    reconcile();
  }, [reconcile]);

  const ids = normalizedControlled ? normalizedControlled.ids : uncontrolledIds;
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const itemsById = useMemo(() => {
    const map = new Map<ItemId, LayoutItem<T>>();
    for (const item of normalizedControlled?.items ??
      normalizedDefaults?.items ??
      []) {
      map.set(item.id, item);
    }
    for (const id of childIds) if (!map.has(id)) map.set(id, { id });
    return map;
  }, [normalizedControlled, normalizedDefaults, childIds]);

  // ----------------------------------------------------------------- history
  //
  // Created on the first render that knows the order. The very first render
  // happens before the children have been reconciled, so `ids` is still empty
  // there — and a history seeded with that empty list makes the first undo of a
  // session (and `reset()`) blank the layout. Reported on 1.0.2, fun one.
  const historyRef = useRef<History<ItemId[]> | null>(null);
  if (historyRef.current === null && ids.length > 0) {
    historyRef.current = createHistory<ItemId[]>(ids, {
      limit: options.historyLimit,
      equals: idsEqual,
    });
  }
  const [, bumpHistory] = useReducer((value: number) => value + 1, 0);
  const history = historyRef.current;

  const persistenceRef = useRef(
    options.persistence &&
      options.persistence.enabled !== false &&
      options.persistence.key
      ? createPersistence({
          key: options.persistence.key,
          storage: options.persistence.storage,
          mode,
        })
      : null,
  );
  const hydratedRef = useRef(false);

  const persistenceConfig = options.persistence;
  useEffect(() => {
    const store = persistenceRef.current;
    if (!store || hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = store.load();
    if (!stored || normalizedControlled) return;
    const next = applyStoredOrder(
      stored.ids,
      childIds.length > 0 ? childIds : idsRef.current,
    );
    if (next.length === 0) return;
    setUncontrolledIds(next);
    historyRef.current?.replace(next);
    bumpHistory();
    // Runs once per mount; the storage key is stable for a given layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const store = persistenceRef.current;
    if (!store || !hydratedRef.current) return;
    if (ids.length === 0) return;
    // While the order is controlled the layout is not the owner of the state,
    // so writing would clobber whatever the application decided to keep. The
    // development warning in `dev.ts` says as much; this line is what makes the
    // warning true.
    if (normalizedControlled) return;
    store.save(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  // Support a changing persistence key without remounting the layout.
  useEffect(() => {
    if (!persistenceConfig?.key || persistenceConfig.enabled === false) {
      persistenceRef.current = null;
      return;
    }
    const current = persistenceRef.current;
    if (!current || current.key !== persistenceConfig.key) {
      persistenceRef.current = createPersistence({
        key: persistenceConfig.key,
        storage: persistenceConfig.storage,
        mode,
      });
      hydratedRef.current = false;
      const stored = persistenceRef.current.load();
      hydratedRef.current = true;
      if (stored && !normalizedControlled) {
        const next = applyStoredOrder(
          stored.ids,
          childIds.length > 0 ? childIds : idsRef.current,
        );
        if (next.length > 0) {
          setUncontrolledIds(next);
          historyRef.current?.replace(next);
          bumpHistory();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    persistenceConfig?.key,
    persistenceConfig?.storage,
    persistenceConfig?.enabled,
  ]);

  // --------------------------------------------------------------- measuring
  const slotsRef = useRef<SlotCandidate[]>([]);
  const rectsRef = useRef(new Map<ItemId, Rect>());
  const containerRectRef = useRef<Rect | null>(null);
  const dirtyRef = useRef(true);
  const renderIdsRef = useRef<ItemId[]>(ids);

  /** Base rectangle of an element: measured rect minus any transform we wrote. */
  const baseRectOf = useCallback(
    (element: HTMLElement): Rect => {
      const measured = sanitizeRect(geometry.measure(element));
      const translate = readTranslate(element);
      if (translate.x === 0 && translate.y === 0) return measured;
      return sanitizeRect(translateRect(measured, -translate.x, -translate.y));
    },
    [geometry],
  );

  const measure = useCallback((): SlotCandidate[] => {
    const order = renderIdsRef.current;
    const entries: { id: ItemId; element: HTMLElement | null }[] = [];
    const rects = new Map<ItemId, Rect>();
    for (const id of order) {
      const element = registry.get(id)?.element ?? null;
      if (!element || !element.isConnected) continue;
      const base = baseRectOf(element);
      if (base.width === 0 && base.height === 0) continue;
      rects.set(id, base);
      entries.push({ id, element });
    }
    rectsRef.current = rects;

    const container = containerRef.current;
    containerRectRef.current =
      container && container.isConnected ? geometry.measure(container) : null;

    // Slots are ordered by their rendered position, so `slots[index]` always
    // describes the box at that index — including while a preview is on screen.
    slotsRef.current = measureSlots(entries, {
      geometry: { ...geometry, measure: (el) => baseRectOf(el as HTMLElement) },
    });
    dirtyRef.current = false;
    return slotsRef.current;
  }, [baseRectOf, containerRef, geometry, registry]);

  const slots = useCallback((): SlotCandidate[] => {
    if (dirtyRef.current) return measure();
    return slotsRef.current;
  }, [measure]);

  const invalidateSlots = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // ------------------------------------------------------------------ bounds
  const boundsRef = useRef<() => Rect | null>(() => null);
  boundsRef.current = () => {
    const value = optionsRef.current.bounds;
    if (value === null) return null;
    if (value === undefined || value === "container") {
      const container = containerRef.current;
      return container ? geometry.measure(container) : null;
    }
    if (value === "viewport") return geometry.viewport();
    if (typeof value === "object" && "x" in value && "width" in value)
      return value as Rect;
    if (value instanceof HTMLElement) return geometry.measure(value);
    if (typeof value === "object" && value !== null && "current" in value) {
      const element = (value as RefObject<HTMLElement | null>).current;
      return element ? geometry.measure(element) : null;
    }
    return null;
  };

  // -------------------------------------------------------------- announcing
  const announcerRef = useRef<Announcer | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const announcer = createAnnouncer(document);
    announcerRef.current = announcer;
    return () => {
      announcer.destroy();
      announcerRef.current = null;
    };
  }, []);

  const announce = useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      announcerRef.current?.announce(message, priority);
    },
    [],
  );

  // --------------------------------------------------------------- order ops
  const emitChange = useCallback((next: ItemId[], event: LayoutChangeEvent) => {
    const onChange = optionsRef.current.onChange;
    if (!onChange) return;
    const input = optionsRef.current.items;
    const shapeIsObjects =
      input !== undefined && input.length > 0 && typeof input[0] !== "string";
    if (shapeIsObjects) {
      const map = new Map<ItemId, LayoutItem<T>>();
      for (const item of normalizeItems(input as readonly LayoutItemInput<T>[])
        .items)
        map.set(item.id, item);
      const payload = next.map(
        (id) => map.get(id) ?? { id },
      ) as LayoutItemInput<T>[];
      onChange(payload, event);
    } else {
      onChange(next as unknown as LayoutItemInput<T>[], event);
    }
  }, []);

  const applyOrder = useCallback(
    (next: ItemId[], event: LayoutChangeEvent, record = true) => {
      if (idsEqual(idsRef.current, next)) {
        emitChange(next, event);
        return;
      }
      if (normalizedControlled) {
        emitChange(next, event);
      } else {
        setUncontrolledIds(next);
        emitChange(next, event);
      }
      if (record && optionsRef.current.historyEnabled) {
        historyRef.current?.push(next);
        bumpHistory();
      }
    },
    [emitChange, normalizedControlled],
  );

  const undo = useCallback(() => {
    if (!optionsRef.current.historyEnabled) return;
    const previous = historyRef.current?.undo();
    bumpHistory();
    if (!previous) return;
    applyOrder(previous, { ids: previous, source: "history" }, false);
    announce(`Undo. ${previous.length} items.`, "polite");
  }, [announce, applyOrder]);

  const redo = useCallback(() => {
    if (!optionsRef.current.historyEnabled) return;
    const next = historyRef.current?.redo();
    bumpHistory();
    if (!next) return;
    applyOrder(next, { ids: next, source: "history" }, false);
    announce(`Redo. ${next.length} items.`, "polite");
  }, [announce, applyOrder]);

  const reset = useCallback(() => {
    const initial = historyRef.current?.reset() ?? [];
    bumpHistory();
    applyOrder(initial, { ids: initial, source: "history" }, false);
    announce("Layout reset.", "polite");
  }, [announce, applyOrder]);

  // The history is only told about the order when the layout commits one, so
  // everything that changes the ids without committing (reconciling the authored
  // children, hydrating from storage, a controlled update from the application)
  // is mirrored here. Without it the next undo would restore an order that is no
  // longer the one before it.
  useEffect(() => {
    const store = historyRef.current;
    if (!store || ids.length === 0) return;
    store.replace(ids);
  }, [ids]);

  // ------------------------------------------------------------- controller
  const onDropRef = useRef<(result: DropResult) => void>(() => {});
  /** Last destination announced during the current gesture, to avoid duplicates. */
  const lastSwapRef = useRef<SwapEvent | null>(null);
  onDropRef.current = (result) => {
    const event: LayoutChangeEvent = {
      ids: result.ids,
      swap: result.event,
      source: result.event.source,
    };
    applyOrder(result.ids, event);
    // A drop is only a "new" swap when the destination was not already reported,
    // which is the case for keyboard and programmatic moves.
    const reported = lastSwapRef.current;
    lastSwapRef.current = null;
    if (!result.changed) return;
    if (
      reported &&
      reported.item === result.event.item &&
      reported.nextSlot.index === result.event.nextSlot.index
    )
      return;
    optionsRef.current.onSwap?.(result.event);
  };

  const controller = useMemo(() => {
    return createDragController({
      mode,
      strategy: options.collision,
      minScore: options.minCollisionScore,
      snap: options.snap,
      threshold: options.threshold,
      keyboard: options.keyboard ?? undefined,
      getSlots: () => slots(),
      getOrder: () => idsRef.current,
      getElement: (id) => registry.get(id)?.element ?? null,
      getLabel: (id) => registry.get(id)?.label ?? null,
      geometry,
      bounds: () => boundsRef.current(),
      effects,
      prefersReducedMotion: () => optionsRef.current.prefersReducedMotion,
      motion: () => optionsRef.current.motion,
      onStart: (event) => {
        invalidateSlots();
        optionsRef.current.onDragStart?.(event);
      },
      onMove: (event) => {
        optionsRef.current.onDragMove?.({
          item: event.item,
          position: event.position,
          delta: event.delta,
          velocity: event.velocity,
          target: event.target,
          mode,
        });
      },
      onEnd: (event) => {
        invalidateSlots();
        optionsRef.current.onDragEnd?.(event);
      },
      onDestination: (event) => {
        // Every destination change is a swap the consumer can react to (style,
        // analytics, side effects), so it is reported as it happens.
        if (!event) return;
        lastSwapRef.current = event;
        optionsRef.current.onSwap?.(event);
      },
      onDrop: (result) => onDropRef.current(result),
      onAnnounce: (message, priority) => announce(message, priority),
      applyState: (id, element, state, previous) => {
        const node = nodes.get(id);
        if (node) {
          node.set(
            {
              x: state.x,
              y: state.y,
              scale: state.scale,
              rotate: state.rotate,
              opacity: state.opacity,
              blur: state.blur,
              elevation: state.elevation,
            },
            { round: true },
          );
          return;
        }
        // Fallback for elements registered by a custom item implementation.
        const translate = `translate3d(${Math.round(state.x * 100) / 100}px, ${Math.round(state.y * 100) / 100}px, 0)`;
        element.style.transform = translate;
        element.style.opacity = String(state.opacity);
        void previous;
      },
    });
    // The controller is recreated only when its structural configuration changes;
    // everything else is read through refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    geometry,
    options.collision,
    options.minCollisionScore,
    options.threshold,
    announce,
    effects,
    invalidateSlots,
    nodes,
    registry,
    slots,
  ]);

  useEffect(() => () => controller.destroy(), [controller]);

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  // ---------------------------------------------------------------- preview
  /**
   * The order currently on screen: the committed order, or the order the layout
   * would have if the drag were dropped right now.
   *
   * This must recompute whenever the committed order changes — including when the
   * parent swaps `items` — so the dependencies are the order and the drag
   * destination, never the store snapshot object itself.
   */
  // Destructured out of the snapshot so the memo depends on the three values it
  // actually reads rather than on the snapshot object, which is a new object on
  // every store notification.
  const {
    activeId: draggingId,
    destinationIndex: destination,
    startIndex: dragStartIndex,
  } = snapshot;

  const renderIds = useMemo(() => {
    const activeId = draggingId;
    const destinationIndex = destination;
    const startIndex = dragStartIndex;
    const base = ids;
    const next =
      !activeId || destinationIndex === null || destinationIndex === startIndex
        ? base
        : orderAfterDrop(
            base,
            activeId,
            startIndex,
            destinationIndex,
            mode === "swap" ? "swap" : "reorder",
          );
    renderIdsRef.current = next;
    return next;
  }, [ids, mode, draggingId, destination, dragStartIndex]);

  const previewIds = useCallback((): ItemId[] => renderIdsRef.current, []);

  useEffect(() => {
    invalidateSlots();
  }, [renderIds, invalidateSlots]);

  // --------------------------------------------------------------- commands
  const moveItem = useCallback(
    (id: ItemId, index: number): boolean => {
      const result = controller.moveItemTo(id, index, "programmatic");
      return result !== null;
    },
    [controller],
  );

  const grab = useCallback(
    (id: ItemId): boolean => {
      const element = registry.get(id)?.element ?? null;
      if (!element) return false;
      const started = controller.begin({
        id,
        element,
        source: "keyboard",
        immediate: true,
      });
      if (started) {
        invalidateSlots();
        element.focus({ preventScroll: true });
      }
      return started;
    },
    [controller, invalidateSlots, registry],
  );

  const orderKey = renderIds.join("\u0000");

  return {
    mode,
    ids,
    renderIds,
    orderKey,
    registry,
    controller,
    snapshot,
    itemsById,
    slots,
    invalidateSlots,
    measure,
    baseRects: () => rectsRef.current,
    containerRect: () => containerRectRef.current,
    prefersReducedMotion,
    effects,
    motion,
    disabled,
    canUndo: history?.canUndo() ?? false,
    canRedo: history?.canRedo() ?? false,
    historyDepth: history?.depth ?? 0,
    undo,
    redo,
    reset,
    moveItem,
    grab,
    announce,
    announcer: () => announcerRef.current,
    applyOrder,
    previewIds,
  };
};

/** A geometry provider that never measures the DOM — used by tests and SSR. */
export const staticGeometry = (rects: Map<Element, Rect>): GeometryProvider =>
  createStaticGeometry(rects, rect(0, 0, 1024, 768));
