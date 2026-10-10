/**
 * `<Layout>` — the root of a rewap layout.
 *
 * The component is deliberately thin: it turns DOM events into engine calls,
 * renders children in the engine's order and draws the placeholder. Everything
 * stateful (order, history, persistence, measurement, collision) lives in
 * {@link useLayoutEngine}, and every transform write goes through the element
 * state controller rather than React state — dragging fifty items costs zero
 * React renders.
 *
 * The root element is a `<div>` by default (`as` changes that). It carries
 * `data-rewap-layout`, `data-mode`, `data-status` and `data-rewap-dragging`,
 * exposes the custom properties `--rw-columns`, `--rw-min-column` and `--rw-gap`,
 * and renders the visually hidden instructions element referenced by
 * `aria-describedby`.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect";
import type {
  CSSProperties,
  ElementType,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  Ref,
  RefObject,
} from "react";

import { grabInstructions, isRedo, isUndo } from "../accessibility";
import type { CollisionStrategy } from "../core/collision";
import type { KeyboardOptions } from "../core/keyboard";
import type { GeometryProvider } from "../core/measure";
import type {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  DropReason,
  EffectsOptions,
  InputSource,
  ItemId,
  ItemMotion,
  LayoutChangeEvent,
  LayoutMode,
  PlaceholderStyle,
  Slot,
  SnapOptions,
  SwapEvent,
} from "../core/types";
import { rect, rectFromDOMRect, sanitizeRect, type Rect } from "../math/rect";
import { resolveMotion } from "../motion/presets";
import { readTranslate } from "../motion/transform";
import { idsFromChildren, orderChildren } from "./children";
import {
  LayoutContext,
  type ItemMeta,
  type LayoutContextValue,
  type PlaceholderRenderInfo,
} from "./context";
import {
  warnDuplicateIds,
  warnItemsWithoutChildren,
  warnPersistenceControlled,
} from "./dev";
import { elementStateFor, type ElementStateController } from "./elementState";
import { playFlip, rectChanged } from "./flip";
import { buildLayoutController, type LayoutController } from "./useLayout";
import {
  useLayoutEngine,
  type LayoutItemInput,
  type PersistenceConfig,
} from "./useLayoutEngine";

/** Drag boundary: `"container"` (default), `"viewport"`, `null`, an element, a ref or a rect. */
export type LayoutBounds =
  | "container"
  | "viewport"
  | null
  | HTMLElement
  | Rect
  | RefObject<HTMLElement | null>;

export interface LayoutProps<T = unknown> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  | "children"
  | "onChange"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop"
> {
  children?: ReactNode;
  /** `swap` exchanges two items, `reorder` shifts a range, `grid` places freely. */
  mode?: LayoutMode;
  /** Controlled order; pair it with `onChange`. */
  items?: readonly LayoutItemInput<T>[];
  /** Uncontrolled initial order, layered over the authored child order. */
  defaultItems?: readonly LayoutItemInput<T>[];
  onChange?: (items: LayoutItemInput<T>[], event: LayoutChangeEvent) => void;
  /** Fired every time the destination changes during a drag or a programmatic move. */
  onSwap?: (event: SwapEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  collision?: CollisionStrategy;
  /** Minimum collision score (0–1) before a slot is accepted. */
  minCollisionScore?: number;
  snap?: SnapOptions;
  /** Pointer travel, in pixels, before a drag starts. */
  threshold?: number;
  motion?: ItemMotion;
  /** Motion used by the placeholder only; defaults to `motion`. */
  placeholderMotion?: ItemMotion;
  placeholder?: PlaceholderStyle;
  renderPlaceholder?: (info: PlaceholderRenderInfo) => ReactNode;
  effects?: EffectsOptions;
  /**
   * Undo/redo for the order. On by default; pass `false` to disable or
   * `{ limit }` to change how many steps are kept.
   */
  history?: boolean | { enabled?: boolean; limit?: number };
  /** Persists the order in a local storage of your choice. Never touches the network. */
  persistence?: boolean | PersistenceConfig;
  /** Keyboard dragging. On by default; `false` disables it entirely. */
  keyboard?: boolean | (KeyboardOptions & { enabled?: boolean });
  bounds?: LayoutBounds;
  disabled?: boolean;
  as?: ElementType;
  /** Column count; sets `--rw-columns` and `data-rw-columns`. */
  columns?: number | string;
  /** Minimum column width for auto-fit layouts; sets `--rw-min-column`. */
  minColumnWidth?: number | string;
  /** Gap between slots; sets `--rw-gap`. */
  gap?: number | string;
  /** Accessible name of the list. */
  label?: string;
  containerRef?: Ref<HTMLDivElement>;
  /** Imperative handle with the same surface as `useLayout()`. */
  controllerRef?: Ref<LayoutController>;
  /** Replaces `getBoundingClientRect` measurement (tests, virtualised lists). */
  geometry?: GeometryProvider;
}

const asPx = (value: number | string | undefined): string | undefined =>
  value === undefined
    ? undefined
    : typeof value === "number"
      ? `${value}px`
      : value;

/** Interactive descendants keep their own gestures. */
const interactiveSelector =
  "button, a, input, select, textarea, [role='button'], [contenteditable='true']";

const nearestLayout = (element: Element | null): Element | null =>
  element?.closest("[data-rewap-layout]") ?? null;

const sourceFromPointer = (pointerType: string): InputSource => {
  if (pointerType === "touch") return "touch";
  if (pointerType === "mouse") return "mouse";
  return "pointer";
};

const sameRect = (a: Rect | null, b: Rect | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
};

const assignRef = <T,>(ref: Ref<T> | undefined, value: T | null): void => {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else (ref as { current: T | null }).current = value;
};

const prefersReducedMotionNow = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const LayoutImpl = (
  props: LayoutProps<unknown>,
  forwardedRef: Ref<HTMLDivElement>,
) => {
  const {
    children,
    mode = "swap",
    items,
    defaultItems,
    onChange,
    onSwap,
    onDragStart,
    onDragMove,
    onDragEnd,
    collision,
    minCollisionScore,
    snap,
    threshold,
    motion = "smooth",
    placeholderMotion,
    placeholder = "auto",
    renderPlaceholder,
    effects,
    history,
    persistence,
    keyboard,
    bounds,
    disabled = false,
    as: Component = "div",
    columns,
    minColumnWidth,
    gap,
    label,
    containerRef: containerRefProp,
    controllerRef,
    geometry,
    className,
    style,
    onKeyDown,
    onPointerDown,
    onClickCapture,
    ...rest
  } = props;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const registryRef = useRef<Map<ItemId, ItemMeta> | null>(null);
  registryRef.current ??= new Map<ItemId, ItemMeta>();
  const registry = registryRef.current;
  const nodesRef = useRef<Map<ItemId, ElementStateController> | null>(null);
  nodesRef.current ??= new Map<ItemId, ElementStateController>();
  const nodes = nodesRef.current;
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [focusId, setFocusId] = useState<ItemId | null>(null);
  const [placeholderBox, setPlaceholderBox] = useState<Rect | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    prefersReducedMotionNow,
  );

  const rawId = useId();
  const instructionsId = `rw-instructions-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // --------------------------------------------------------------- preferences
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  // -------------------------------------------------------------------- config
  const childIds = useMemo(() => idsFromChildren(children), [children]);
  const resolvedEffects = useMemo<EffectsOptions>(
    () => effects ?? {},
    [effects],
  );
  const historyEnabled = !(
    history === false ||
    (typeof history === "object" && history.enabled === false)
  );
  const historyLimit =
    typeof history === "object" && typeof history.limit === "number"
      ? history.limit
      : 50;
  const persistenceConfig = useMemo<PersistenceConfig | null>(() => {
    if (!persistence || persistence === true) return null;
    return persistence.enabled === false ? null : persistence;
  }, [persistence]);
  const keyboardConfig = useMemo<KeyboardOptions | null>(() => {
    if (keyboard === false) return null;
    if (keyboard === true || keyboard === undefined) return {};
    const { enabled, ...options } = keyboard;
    return enabled === false ? null : options;
  }, [keyboard]);
  const plan = useMemo(
    () => resolveMotion(motion, { prefersReducedMotion }),
    [motion, prefersReducedMotion],
  );
  const placeholderPlan = useMemo(
    () => resolveMotion(placeholderMotion ?? motion, { prefersReducedMotion }),
    [motion, placeholderMotion, prefersReducedMotion],
  );

  const engine = useLayoutEngine<unknown>({
    mode,
    items,
    defaultItems,
    childIds,
    onChange,
    onSwap,
    onDragStart,
    onDragMove,
    onDragEnd,
    collision,
    minCollisionScore,
    snap,
    threshold,
    motion,
    effects: resolvedEffects,
    historyEnabled,
    historyLimit,
    persistence: persistenceConfig,
    keyboard: keyboardConfig,
    bounds,
    disabled,
    prefersReducedMotion,
    containerRef: rootRef,
    registry,
    nodes,
    geometry,
  });

  const { snapshot, renderIds, orderKey, controller, ids } = engine;
  // The controller instance is recreated when structural options change; the
  // imperative gesture listeners always talk to the current one.
  const liveController = useRef(controller);
  liveController.current = controller;

  // ------------------------------------------------------------------ registry
  const invalidateAll = useCallback(() => {
    engine.invalidateSlots();
  }, [engine]);

  const registerItem = useCallback<LayoutContextValue["registerItem"]>(
    (id, meta) => {
      registry.set(id, { id, ...meta });
      engine.invalidateSlots();
      const element = meta.element;
      if (element && typeof ResizeObserver === "function") {
        resizeObserverRef.current ??= new ResizeObserver(() => invalidateAll());
        resizeObserverRef.current.observe(element);
      }
      return () => {
        const current = registry.get(id)?.element ?? null;
        if (current) {
          resizeObserverRef.current?.unobserve(current);
          const node = nodes.get(id);
          if (node) {
            node.clear();
            nodes.delete(id);
          }
        }
        registry.delete(id);
        engine.invalidateSlots();
      };
    },
    [engine, invalidateAll, nodes, registry],
  );

  const updateItem = useCallback<LayoutContextValue["updateItem"]>(
    (id, patch) => {
      const current = registry.get(id);
      if (!current) return;
      registry.set(id, { ...current, ...patch });
      engine.invalidateSlots();
    },
    [engine, registry],
  );

  const announce = useCallback<LayoutContextValue["announce"]>(
    (message, priority) => engine.announce(message, priority),
    [engine],
  );

  // ----------------------------------------------------------------- measuring
  const baseRectOf = useCallback(
    (element: HTMLElement): Rect => {
      const measured = sanitizeRect(
        geometry
          ? geometry.measure(element)
          : rectFromDOMRect(element.getBoundingClientRect()),
      );
      const translate = readTranslate(element);
      if (translate.x === 0 && translate.y === 0) return measured;
      return sanitizeRect(
        rect(
          measured.x - translate.x,
          measured.y - translate.y,
          measured.width,
          measured.height,
        ),
      );
    },
    [geometry],
  );

  // -------------------------------------------- flip, rebase and the placeholder
  const rectsRef = useRef(new Map<ItemId, Rect>());
  const orderKeyRef = useRef("");
  const placeholderRectRef = useRef<Rect | null>(null);

  // Runs after every commit on purpose: FLIP has to compare the DOM before and
  // after a change, and the placeholder follows the destination slot. Both
  // branches are cheap and every `setState` here bails out when nothing moved —
  // which is what keeps this from scheduling a render per commit.
  useIsomorphicLayoutEffect(() => {
    const container = rootRef.current;
    if (!container) return;

    const orderChanged = orderKeyRef.current !== orderKey;
    const activeId = snapshot.activeId;
    const dragActive = snapshot.status !== "idle";

    if (orderChanged || dragActive) {
      const rects = new Map<ItemId, Rect>();
      for (const id of renderIds) {
        const element = registry.get(id)?.element ?? null;
        if (!element || !element.isConnected) continue;
        rects.set(id, baseRectOf(element));
      }

      if (orderChanged) {
        const previousRects = rectsRef.current;
        for (const [id, next] of rects) {
          if (id === activeId) continue;
          const previous = previousRects.get(id);
          if (!previous || !rectChanged(previous, next)) continue;
          const element = registry.get(id)?.element ?? null;
          if (!element) continue;
          playFlip(element, previous, next, { plan });
        }
        // The dragged element keeps its own transform while the others animate.
        controller.rebase(rects);
        rectsRef.current = rects;
        orderKeyRef.current = orderKey;
      }

      if (dragActive) {
        // Slots are re-measured here rather than in the render pass: this is the
        // first moment the DOM reflects the change that caused the commit.
        engine.invalidateSlots();
        const candidates = engine.measure();
        const index = snapshot.destinationIndex;
        const candidate =
          index === null
            ? undefined
            : candidates.find((entry) => entry.index === index);
        const containerRect = geometry
          ? geometry.measure(container)
          : rectFromDOMRect(container.getBoundingClientRect());
        const target =
          candidate?.slot.rect ?? (activeId ? rects.get(activeId) : undefined);
        if (target) {
          const box = sanitizeRect(
            rect(
              target.x - containerRect.x,
              target.y - containerRect.y,
              target.width,
              target.height,
            ),
          );
          setPlaceholderBox((previous) =>
            sameRect(previous, box) ? previous : box,
          );
        } else {
          setPlaceholderBox((previous) =>
            previous === null ? previous : null,
          );
        }
      } else {
        setPlaceholderBox((previous) => (previous === null ? previous : null));
      }
    }
  });

  // The placeholder glides between slots instead of jumping.
  useEffect(() => {
    const element = placeholderRef.current;
    if (!element || !placeholderBox) return;
    const node = elementStateFor(element);
    const previous = placeholderRectRef.current;
    if (previous) {
      node.set({
        x: previous.x - placeholderBox.x,
        y: previous.y - placeholderBox.y,
      });
    } else {
      node.set({ x: 0, y: 0, opacity: 0, scale: 0.98 });
    }
    node.animate({ x: 0, y: 0, opacity: 1, scale: 1 }, placeholderPlan);
    placeholderRectRef.current = placeholderBox;
  }, [placeholderBox, placeholderPlan]);

  useEffect(() => {
    if (!placeholderBox) placeholderRectRef.current = null;
  }, [placeholderBox]);

  // ------------------------------------------------------------------ gestures
  const gestureRef = useRef<{
    pointerId: number | null;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const assignContainer = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      assignRef(forwardedRef, node);
      assignRef(containerRefProp, node);
    },
    [containerRefProp, forwardedRef],
  );

  const startGesture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): boolean => {
      const container = rootRef.current;
      if (!container || disabled || snapshot.status !== "idle") return false;
      if (event.pointerType === "mouse" && event.button !== 0) return false;

      const target = event.target as HTMLElement | null;
      const itemElement =
        target?.closest<HTMLElement>("[data-rewap-item]") ?? null;
      if (!itemElement || nearestLayout(itemElement) !== container)
        return false;

      const id = itemElement.dataset.rewapItem;
      if (!id) return false;
      const meta = registry.get(id);
      if (!meta || !meta.draggable || meta.disabled) return false;

      const handle =
        target?.closest<HTMLElement>("[data-rewap-handle]") ?? null;
      if (meta.handleOnly && !handle) return false;
      // Interactive children keep their own behaviour unless a handle started it.
      if (!handle && target?.closest(interactiveSelector)) return false;

      engine.invalidateSlots();
      const started = controller.begin({
        id,
        element: itemElement,
        pointer: { x: event.clientX, y: event.clientY },
        source: sourceFromPointer(event.pointerType),
      });
      if (!started) return false;

      suppressClickRef.current = false;
      gestureRef.current = {
        pointerId: typeof event.pointerId === "number" ? event.pointerId : null,
        moved: false,
      };
      attachGestureListenersRef.current();
      setFocusId(null);
      return true;
    },
    [controller, disabled, engine, registry, snapshot.status],
  );

  /**
   * `attachGestureListeners` is defined below this point (it needs `endGesture`,
   * which needs the gesture state this file sets up first), so the callback above
   * reaches it through a ref. Listing it in a dependency array would be a temporal
   * dead zone error during render; this is the honest way around the cycle.
   */
  const attachGestureListenersRef = useRef<() => void>(() => {});

  const gestureListeners = useRef<(() => void) | null>(null);

  const endGesture = useCallback(
    (commit: boolean, reason: DropReason = "cancel"): void => {
      const detach = gestureListeners.current;
      gestureListeners.current = null;
      detach?.();
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (!gesture) return;
      // A drag that moved must not also fire a click on the item underneath. The
      // flag is consumed by that click, or reset by the next pointer down.
      if (gesture.moved) suppressClickRef.current = true;
      if (commit) liveController.current.drop();
      else liveController.current.cancel(reason);
    },
    [],
  );

  /**
   * Listening on `window` rather than on the container keeps the drag alive when
   * the pointer leaves the layout (or the window), and attaching the listeners
   * inside the `pointerdown` handler means a move that arrives before React
   * re-renders is still delivered to the engine.
   */
  const attachGestureListeners = useCallback((): void => {
    if (gestureListeners.current) return;
    const gestureOf = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return false;
      if (gesture.pointerId !== null && event.pointerId !== gesture.pointerId)
        return false;
      return true;
    };
    const move = (event: PointerEvent) => {
      if (!gestureOf(event)) return;
      const gesture = gestureRef.current as { moved: boolean };
      gesture.moved = true;
      liveController.current.move(
        { x: event.clientX, y: event.clientY },
        event.timeStamp,
      );
    };
    const up = (event: PointerEvent) => {
      if (!gestureOf(event)) return;
      endGesture(true);
    };
    const cancel = (event: PointerEvent) => {
      if (!gestureOf(event)) return;
      endGesture(false, "cancel");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !gestureRef.current) return;
      endGesture(false, "escape");
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", escape);
    gestureListeners.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", escape);
    };
  }, [endGesture]);

  attachGestureListenersRef.current = attachGestureListeners;

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      onPointerDown?.(event);
      if (event.defaultPrevented) return;
      startGesture(event);
    },
    [onPointerDown, startGesture],
  );

  const handleClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      onClickCapture?.(event);
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    [onClickCapture],
  );

  // ------------------------------------------------------------------ keyboard
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || disabled) return;
      if (isUndo(event)) {
        event.preventDefault();
        engine.undo();
        return;
      }
      if (isRedo(event)) {
        event.preventDefault();
        engine.redo();
      }
    },
    [disabled, engine, onKeyDown],
  );

  // ------------------------------------------------------------------- dev aid
  useEffect(() => {
    warnDuplicateIds(renderIds);
    warnItemsWithoutChildren(items !== undefined, renderIds.length);
    warnPersistenceControlled(persistenceConfig !== null, items !== undefined);
  }, [items, persistenceConfig, renderIds]);

  // ----------------------------------------------------------- context value
  const destination = useMemo((): PlaceholderRenderInfo | null => {
    const item = snapshot.activeId;
    if (!item) return null;
    const index = snapshot.destinationIndex;
    const candidate =
      index === null
        ? undefined
        : engine.slots().find((entry) => entry.index === index);
    if (candidate) return { item, slot: candidate.slot, mode };
    if (!placeholderBox) return null;
    const slot: Slot = {
      index: index ?? 0,
      column: 0,
      row: 0,
      rect: placeholderBox,
    };
    return { item, slot, mode };
  }, [
    engine,
    mode,
    placeholderBox,
    snapshot.activeId,
    snapshot.destinationIndex,
  ]);

  const contextValue = useMemo<LayoutContextValue>(
    () => ({
      mode,
      ids,
      renderIds,
      controller,
      snapshot,
      registry,
      registerItem,
      updateItem,
      slots: () => engine.slots(),
      motion,
      effects: resolvedEffects,
      placeholder,
      ...(renderPlaceholder ? { renderPlaceholder } : {}),
      prefersReducedMotion,
      disabled,
      keyboardEnabled: keyboardConfig !== null,
      announce,
      announcer: engine.announcer(),
      isActive: (id: ItemId) => snapshot.activeId === id,
      focusId,
      setFocusId,
      canUndo: engine.canUndo,
      canRedo: engine.canRedo,
      historyDepth: engine.historyDepth,
      undo: engine.undo,
      redo: engine.redo,
      reset: engine.reset,
      moveItem: engine.moveItem,
      grab: engine.grab,
    }),
    [
      announce,
      controller,
      disabled,
      engine,
      focusId,
      ids,
      keyboardConfig,
      mode,
      motion,
      placeholder,
      prefersReducedMotion,
      registerItem,
      renderIds,
      renderPlaceholder,
      resolvedEffects,
      registry,
      snapshot,
      updateItem,
    ],
  );

  // --------------------------------------------------------------- controller
  const controllerHandle = useMemo(
    () => buildLayoutController(contextValue),
    [contextValue],
  );

  useEffect(() => {
    assignRef(controllerRef, controllerHandle);
    return () => assignRef(controllerRef, null);
  }, [controllerHandle, controllerRef]);

  useEffect(() => {
    if (snapshot.status !== "idle" || !gestureListeners.current) return;
    gestureListeners.current();
    gestureListeners.current = null;
    gestureRef.current = null;
  }, [snapshot.status]);

  useEffect(
    () => () => {
      gestureListeners.current?.();
      gestureListeners.current = null;
      gestureRef.current = null;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      for (const node of nodes.values()) node.clear();
      nodes.clear();
      registry.clear();
    },
    [nodes, registry],
  );

  // -------------------------------------------------------------------- render
  const dragging = snapshot.status !== "idle";
  const ordered = useMemo(
    () => orderChildren(children, renderIds),
    [children, renderIds],
  );

  const resolvedStyle = {
    position: "relative",
    ...(columns !== undefined ? { "--rw-columns": String(columns) } : {}),
    ...(minColumnWidth !== undefined
      ? { "--rw-min-column": asPx(minColumnWidth) }
      : {}),
    ...(gap !== undefined ? { "--rw-gap": asPx(gap) } : {}),
    ...style,
  } as CSSProperties;

  return (
    <LayoutContext.Provider value={contextValue}>
      <Component
        {...rest}
        ref={assignContainer}
        className={className ? `rw-layout ${className}` : "rw-layout"}
        data-rewap-layout=""
        data-mode={mode}
        data-status={snapshot.status}
        {...(dragging ? { "data-rewap-dragging": "" } : {})}
        {...(disabled ? { "data-rewap-disabled": "" } : {})}
        {...(columns !== undefined
          ? { "data-rw-columns": String(columns) }
          : {})}
        {...(placeholder !== "none" ? { "data-placeholder": placeholder } : {})}
        role={rest.role ?? "list"}
        aria-label={label ?? rest["aria-label"]}
        aria-describedby={instructionsId}
        style={resolvedStyle}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
        onKeyDown={handleKeyDown}
      >
        {ordered}
        <span className="rw-visually-hidden" id={instructionsId}>
          {grabInstructions(false)}
        </span>
        {placeholder !== "none" && placeholderBox && destination ? (
          <div
            ref={placeholderRef}
            className="rw-placeholder"
            data-rewap-placeholder=""
            data-style={placeholder}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: placeholderBox.x,
              top: placeholderBox.y,
              width: placeholderBox.width,
              height: placeholderBox.height,
              margin: 0,
              pointerEvents: "none",
            }}
          >
            {renderPlaceholder?.(destination)}
          </div>
        ) : null}
      </Component>
    </LayoutContext.Provider>
  );
};

/**
 * The layout component. Generic in the item payload type, so a controlled
 * `items={[{ id, data }]}` keeps its `data` type through `onChange`.
 */
export const Layout = forwardRef(LayoutImpl) as unknown as <T = unknown>(
  props: LayoutProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReturnType<typeof LayoutImpl>;
