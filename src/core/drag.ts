/**
 * The drag engine.
 *
 * A single input-agnostic controller drives pointer, mouse, touch and keyboard
 * drags. It owns:
 *
 * - the drag session (what is being dragged, from where, and where it would land);
 * - collision resolution (delegated to a strategy from `collision.ts`);
 * - the physics loop (pointer velocity sampling, magnetic lag, snapping);
 * - the visual state written imperatively onto the dragged element.
 *
 * It deliberately does **not** own the item order: dropping produces a
 * {@link DropResult} and the consumer decides what to do with it. That keeps the
 * engine usable from React, from plain JavaScript and from tests.
 */

import { clamp, damp, now } from "../math/interpolate";
import { clampRect, rectCenter, translateRect, type Point, type Rect } from "../math/rect";
import { resolveMotion, type MotionPlan, type MotionValue } from "../motion/presets";
import type { Ticker, Unsubscribe } from "../motion/ticker";
import { ticker as defaultTicker } from "../motion/ticker";
import {
  applyVisualState,
  createVisualState,
  visualStateEquals,
  type VisualState,
} from "../motion/transform";
import { resolveCollision, type CollisionResult, type CollisionStrategy } from "./collision";
import { resolveTargetIndex, type Direction, type KeyboardOptions } from "./keyboard";
import { domGeometry, type GeometryProvider } from "./measure";
import { orderAfterDrop } from "./order";
import { createStore, type Store } from "./store";
import type {
  DragEffects,
  DragEndEvent,
  DragStartEvent,
  DropReason,
  InputSource,
  ItemId,
  LayoutMode,
  MoveVector,
  PhysicsOptions,
  Slot,
  SlotCandidate,
  SnapOptions,
  SwapEvent,
} from "./types";
import { createVelocityTracker } from "./velocity";

export interface DragSnapshot {
  status: "idle" | "dragging" | "settling";
  /** Item currently being dragged, or `null`. */
  activeId: ItemId | null;
  source: InputSource | null;
  startIndex: number;
  /** Slot index the item would land on, or `null` when there is no destination. */
  destinationIndex: number | null;
  /** Number of items in the layout at the time of the snapshot. */
  itemCount: number;
}

export interface DropResult {
  id: ItemId;
  fromIndex: number;
  toIndex: number;
  /** Order after the drop, computed from the order at drop time. */
  ids: ItemId[];
  changed: boolean;
  event: SwapEvent;
  /** Present for keyboard/programmatic moves, absent for pointer drags. */
  pointer: Point | null;
}

export interface BeginDragInput {
  id: ItemId;
  element: HTMLElement;
  /** Pointer position in client coordinates; omit for keyboard drags. */
  pointer?: Point;
  source?: InputSource;
  /** Bypasses the drag threshold, used by keyboard and programmatic drags. */
  immediate?: boolean;
}

export interface DragControllerOptions {
  mode: LayoutMode;
  /** Collision strategy; defaults are mode-specific and documented below. */
  strategy?: CollisionStrategy;
  minScore?: number;
  /** Measured slots, resolved lazily so the caller can cache measurements. */
  getSlots: () => SlotCandidate[];
  /** Item order, resolved lazily. */
  getOrder: () => readonly ItemId[];
  getElement?: (id: ItemId) => HTMLElement | null;
  /** Accessible label for an item, used in live-region announcements. */
  getLabel?: (id: ItemId) => string | null;
  geometry?: GeometryProvider;
  /** Drag must stay inside this rectangle (viewport coordinates). */
  bounds?: () => Rect | null;
  velocity?: PhysicsOptions;
  snap?: SnapOptions;
  keyboard?: KeyboardOptions;
  /** Pixels the pointer must travel before a drag starts. */
  threshold?: number;
  ticker?: Ticker;
  prefersReducedMotion?: () => boolean;
  motion?: () => MotionValue;
  effects?: DragEffects;
  onStart?: (event: DragStartEvent) => void;
  onMove?: (event: {
    item: ItemId;
    position: Point;
    delta: Point;
    velocity: Point;
    target: Slot | null;
  }) => void;
  /** Fires when the destination changes, including when it becomes `null`. */
  onDestination?: (event: SwapEvent | null, previous: Slot | null) => void;
  onEnd?: (event: DragEndEvent) => void;
  /** Called on drop with the resulting order; the consumer commits it. */
  onDrop?: (result: DropResult) => void;
  onAnnounce?: (message: string, priority: "polite" | "assertive") => void;
  /**
   * Writes the dragged element's visual state. The React bindings route this
   * through the per-element state controller so drag, FLIP and effects compose.
   */
  applyState?: (id: ItemId, element: HTMLElement, state: VisualState, previous: VisualState) => void;
}

interface Session {
  id: ItemId;
  source: InputSource;
  mode: LayoutMode;
  startIndex: number;
  startSlot: SlotCandidate;
  element: HTMLElement;
  /** Pointer position when the drag started. */
  grab: Point;
  /** Pointer position at grab, relative to the element's top-left corner. */
  grabOffset: Point;
  pointer: Point;
  /** Base (untransformed) rect of the element; rebased when the DOM moves. */
  baseRect: Rect;
  visual: VisualState;
  desired: VisualState;
  applied: VisualState;
  origin: Rect;
  destinationIndex: number | null;
  destinationSlot: Slot | null;
  started: boolean;
  /** True once the pointer travelled past the threshold. */
  passedThreshold: boolean;
  moved: boolean;
  lastMoveAt: number;
  plan: MotionPlan;
}

const defaultStrategies: Record<LayoutMode, CollisionStrategy> = {
  swap: "pointer",
  reorder: "projection",
  grid: "intersection",
};

const defaultThreshold = 4;

export interface DragController {
  subscribe(listener: () => void): Unsubscribe;
  getSnapshot(): DragSnapshot;
  /** Starts a drag (or arms it, when a threshold applies). */
  begin(input: BeginDragInput): boolean;
  move(pointer: Point, timestamp?: number): void;
  drop(reason?: DropReason): void;
  cancel(reason?: DropReason): void;
  /** Keyboard/programmatic move of the active item. */
  moveInDirection(direction: Direction, options?: { large?: boolean; source?: InputSource }): boolean;
  moveToIndex(index: number, options?: { source?: InputSource }): boolean;
  /** Moves an item without starting a drag session. */
  moveItemTo(id: ItemId, index: number, source?: InputSource): DropResult | null;
  /** Re-applies the base rectangle after the DOM changed under a drag. */
  rebase(rects: Map<ItemId, Rect>): void;
  /** Animates the active element back to rest and closes the session. */
  settle(): void;
  /** True while a session exists (dragging or settling). */
  isActive(): boolean;
  activeId(): ItemId | null;
  /** Current visual offset of the active element, in pixels. */
  activeOffset(): Point;
  /** Measured slots as last resolved. */
  slots(): SlotCandidate[];
  destroy(): void;
}

export const createDragController = (options: DragControllerOptions): DragController => {
  const mode = options.mode;
  const strategy = options.strategy ?? defaultStrategies[mode];
  const geometry = options.geometry ?? domGeometry;
  const activeTicker = options.ticker ?? defaultTicker;
  const threshold = options.threshold ?? defaultThreshold;
  const tracker = createVelocityTracker(options.velocity);
  const keyboardOptions = options.keyboard;
  const snapEnabled = options.snap?.enabled ?? true;
  const snapThreshold = options.snap?.threshold ?? 18;
  const prefersReduced = () => options.prefersReducedMotion?.() ?? false;
  const planFor = (): MotionPlan =>
    resolveMotion(options.motion?.(), { prefersReducedMotion: prefersReduced() });

  const snapshotStore: Store<DragSnapshot> = createStore<DragSnapshot>({
    status: "idle",
    activeId: null,
    source: null,
    startIndex: -1,
    destinationIndex: null,
    itemCount: 0,
  });

  let session: Session | null = null;
  let slotsCache: SlotCandidate[] = [];
  let slotsCacheStamp = -1;
  let unsubscribeTicker: Unsubscribe | null = null;
  let settleHandle: Unsubscribe | null = null;

  const slotsNow = (): SlotCandidate[] => {
    const stamp = slotsCacheStamp;
    if (stamp === -1) {
      slotsCache = options.getSlots();
      slotsCacheStamp = now();
    }
    return slotsCache;
  };

  const invalidateSlots = (): void => {
    slotsCacheStamp = -1;
  };

  const publish = (patch: Partial<DragSnapshot>): void => {
    const current = snapshotStore.get();
    const next: DragSnapshot = {
      status: patch.status ?? current.status,
      activeId: patch.activeId !== undefined ? patch.activeId : current.activeId,
      source: patch.source !== undefined ? patch.source : current.source,
      startIndex: patch.startIndex ?? current.startIndex,
      destinationIndex:
        patch.destinationIndex !== undefined ? patch.destinationIndex : current.destinationIndex,
      itemCount: patch.itemCount ?? current.itemCount,
    };
    if (
      next.status === current.status &&
      next.activeId === current.activeId &&
      next.source === current.source &&
      next.startIndex === current.startIndex &&
      next.destinationIndex === current.destinationIndex &&
      next.itemCount === current.itemCount
    ) {
      return;
    }
    snapshotStore.set(next);
  };

  const axisFor = (): "x" | "y" => {
    const slots = slotsNow();
    if (slots.length <= 1) return "x";
    const firstRow = slots[0]?.slot.row;
    const singleRow = slots.every((candidate) => candidate.slot.row === firstRow);
    return singleRow ? "x" : "y";
  };

  const slotFor = (index: number | null): Slot | null => {
    if (index === null) return null;
    return slotsNow().find((candidate) => candidate.index === index)?.slot ?? null;
  };

  const writeState = (element: HTMLElement, next: VisualState, previous: VisualState): void => {
    if (options.applyState) options.applyState(session?.id ?? "", element, next, previous);
    else applyVisualState(element, next, previous, { round: true });
  };

  const apply = (active: Session): void => {
    if (visualStateEquals(active.visual, active.applied)) return;
    const previous = active.applied;
    writeState(active.element, active.visual, previous);
    active.applied = { ...active.visual };
  };

  const computeDesired = (active: Session): VisualState => {
    const effects: DragEffects = options.effects ?? {};
    const origin = active.baseRect;
    const localX = active.pointer.x - active.grabOffset.x - origin.x;
    const localY = active.pointer.y - active.grabOffset.y - origin.y;

    let x = localX;
    let y = localY;

    if (snapEnabled && active.destinationSlot) {
      const idealX = active.destinationSlot.rect.x - origin.x;
      const idealY = active.destinationSlot.rect.y - origin.y;
      const distance = Math.hypot(idealX - x, idealY - y);
      if (distance < snapThreshold) {
        const pull = 0.35 * (1 - distance / Math.max(1, snapThreshold));
        x += (idealX - x) * pull;
        y += (idealY - y) * pull;
      }
    }

    const boundsValue = options.bounds?.() ?? null;
    if (boundsValue) {
      const dragged = translateRect(origin, x, y);
      const clamped = clampRect(boundsValue, dragged);
      x = clamped.x - origin.x;
      y = clamped.y - origin.y;
    }

    const rotation = effects.velocityRotation
      ? clamp(
          tracker.value().x *
            (typeof effects.velocityRotation === "number" ? effects.velocityRotation * 0.01 : 0.01),
          -8,
          8,
        )
      : 0;

    const tilt = effects.drag === "tilt" ? clamp((x - 0) * 0.02, -6, 6) : 0;

    return createVisualState({
      x,
      y,
      scale: effects.dragScale ?? 1.02,
      rotate: rotation + tilt,
      opacity: 1,
      blur: 0,
      elevation: 1,
    });
  };

  const setDestination = (index: number | null): void => {
    if (!session) return;
    const currentIndex = session.destinationIndex;
    if (currentIndex === index) return;
    const previousSlot = session.destinationSlot;
    session.destinationIndex = index;
    session.destinationSlot = slotFor(index);
    publish({ destinationIndex: index });

    if (session.destinationSlot && index !== null && index !== session.startIndex) {
      const event = buildSwapEvent(session, session.destinationSlot);
      options.onDestination?.(event, previousSlot);
      options.onAnnounce?.(`${labelFor(session.id)} moved to position ${index + 1}`, "polite");
    } else {
      options.onDestination?.(null, previousSlot);
    }
  };

  const labelFor = (id: ItemId): string => options.getLabel?.(id) ?? `Item ${id}`;

  const buildSwapEvent = (active: Session, slot: Slot): SwapEvent => ({
    item: active.id,
    previousSlot: active.startSlot.slot,
    nextSlot: slot,
    position: active.pointer,
    velocity: tracker.value(),
    mode: active.mode,
    source: active.source,
  });

  /**
   * Where the item would land.
   *
   * Overlap and pointer strategies treat a slot as a *place*: the slot the item
   * currently occupies is exactly where it will land, so the dragged item is not
   * excluded — that is what keeps the destination stable instead of flickering to
   * a neighbour.
   *
   * Projection answers "which slot does this land in?" by counting the boundaries
   * between slots that lie behind the item, so the slot it is held over is a valid
   * answer and the destination does not flicker to a neighbour when a drag starts.
   */
  const resolveDestination = (active: Session): number | null => {
    const candidates = slotsNow();
    if (candidates.length === 0) return null;
    const axis = axisFor();
    const activeRect = translateRect(active.baseRect, active.visual.x, active.visual.y);
    const resolved: CollisionResult | null = resolveCollision(
      {
        activeRect,
        originRect: active.baseRect,
        pointer: active.source === "pointer" ? active.pointer : rectCenter(activeRect),
        candidates,
        origin: active.startSlot.slot,
        axis,
      },
      {
        strategy,
        axis,
        minScore: options.minScore,
        exclude: strategy === "projection" ? active.id : null,
      },
    );
    if (!resolved) return null;
    return resolved.index;
  };

  const physicsFrame = (): void => {
    const active = session;
    if (!active || !active.started) return;

    setDestination(resolveDestination(active));

    const desired = computeDesired(active);
    if (options.effects?.drag === "magnetic") {
      active.visual = {
        ...desired,
        x: damp(active.visual.x, desired.x, 0.0012, 1 / 60),
        y: damp(active.visual.y, desired.y, 0.0012, 1 / 60),
      };
    } else {
      active.visual = desired;
    }
    apply(active);

    if (active.moved) {
      const delta: Point = {
        x: active.pointer.x - active.grab.x,
        y: active.pointer.y - active.grab.y,
      };
      options.onMove?.({
        item: active.id,
        position: active.pointer,
        delta,
        velocity: tracker.value(),
        target: active.destinationSlot,
      });
    }
  };

  const ensureTicker = (): void => {
    if (unsubscribeTicker) return;
    unsubscribeTicker = activeTicker.subscribe(() => physicsFrame());
  };

  const releaseTicker = (): void => {
    unsubscribeTicker?.();
    unsubscribeTicker = null;
  };

  const begin = (input: BeginDragInput): boolean => {
    if (session) return false;
    const element = input.element;
    const baseRect = geometry.measure(element);
    if (baseRect.width === 0 && baseRect.height === 0) return false;

    invalidateSlots();
    const elementCenter = rectCenter(baseRect);
    const pointer = input.pointer ?? elementCenter;
    const source = input.source ?? "pointer";
    const order = options.getOrder();
    const startIndex = order.indexOf(input.id);
    if (startIndex === -1) return false;

    const startSlot = slotsNow().find((candidate) => candidate.id === input.id) ?? {
      id: input.id,
      index: startIndex,
      rect: baseRect,
      slot: { index: startIndex, column: 0, row: 0, rect: baseRect },
    };

    const active: Session = {
      id: input.id,
      source,
      mode,
      startIndex,
      startSlot,
      element,
      grab: pointer,
      grabOffset: { x: pointer.x - baseRect.x, y: pointer.y - baseRect.y },
      pointer,
      baseRect,
      origin: baseRect,
      visual: createVisualState(),
      desired: createVisualState(),
      applied: createVisualState(),
      destinationIndex: startIndex,
      destinationSlot: startSlot.slot,
      started: false,
      // Mouse, touch and pen are all pointer input, so they share the drag
      // threshold; keyboard and programmatic moves start immediately.
      passedThreshold: input.immediate === true || source === "keyboard" || source === "programmatic",
      moved: false,
      lastMoveAt: now(),
      plan: planFor(),
    };

    session = active;
    tracker.reset();
    tracker.add(pointer);

    if (active.passedThreshold) startSession(active);
    publish({
      status: active.started ? "dragging" : "idle",
      activeId: active.id,
      source: active.source,
      startIndex: active.startIndex,
      destinationIndex: active.destinationIndex,
      itemCount: order.length,
    });
    return true;
  };

  const startSession = (active: Session): void => {
    if (active.started) return;
    active.started = true;
    active.moved = true;
    invalidateSlots();
    publish({
      status: "dragging",
      activeId: active.id,
      source: active.source,
      startIndex: active.startIndex,
      destinationIndex: active.destinationIndex,
    });
    ensureTicker();
    const event: DragStartEvent = {
      item: active.id,
      index: active.startIndex,
      slot: active.startSlot.slot,
      position: active.pointer,
      source: active.source,
      mode,
    };
    options.onStart?.(event);
    options.onAnnounce?.(
      `${labelFor(active.id)} grabbed. Use arrow keys to move, Enter to drop, Escape to cancel.`,
      "assertive",
    );
  };

  const move = (pointer: Point, timestamp = now()): void => {
    const active = session;
    if (!active) return;
    active.pointer = pointer;
    tracker.add(pointer, timestamp);

    if (!active.started) {
      const travelled = Math.hypot(pointer.x - active.grab.x, pointer.y - active.grab.y);
      if (travelled >= threshold) {
        active.passedThreshold = true;
        startSession(active);
      } else {
        return;
      }
    }
    active.lastMoveAt = timestamp;
    ensureTicker();
  };

  const buildDropResult = (active: Session, toIndex: number): DropResult => {
    const order = options.getOrder();
    const ids = orderAfterDrop(
      order,
      active.id,
      active.startIndex,
      toIndex,
      active.mode === "swap" ? "swap" : "reorder",
    );
    const destinationSlot = slotFor(toIndex) ?? active.startSlot.slot;
    return {
      id: active.id,
      fromIndex: active.startIndex,
      toIndex,
      ids,
      changed: toIndex !== active.startIndex,
      event: buildSwapEvent(active, destinationSlot),
      pointer: active.source === "pointer" ? active.pointer : null,
    };
  };

  const finishSession = (reason: DropReason, commit: boolean): void => {
    const active = session;
    if (!active) return;
    const destinationIndex = active.destinationIndex;
    const toIndex = destinationIndex ?? active.startIndex;

    const endEvent: DragEndEvent = {
      item: active.id,
      from: active.startSlot.slot,
      to: slotFor(toIndex) ?? active.startSlot.slot,
      reason,
      cancelled: !commit || toIndex === active.startIndex,
      source: active.source,
      mode,
      position: active.pointer,
    };

    releaseTicker();
    if (commit && toIndex !== active.startIndex) {
      const result = buildDropResult(active, toIndex);
      options.onDrop?.(result);
      options.onAnnounce?.(`${labelFor(active.id)} dropped at position ${toIndex + 1}`, "polite");
    } else if (reason === "escape" || (commit && toIndex === active.startIndex)) {
      options.onAnnounce?.(`Drag cancelled`, "polite");
    }

    session = null;
    publish({ status: "idle", activeId: null, source: null, destinationIndex: null });
    options.onEnd?.(endEvent);
    settleElement(active);
  };

  /**
   * Animates the released element to its resting state.
   *
   * The element keeps its transform until the animation ends, so the handover to
   * the committed DOM order is seamless: whatever the layout does with the order,
   * the element travels from where the user released it to its new slot.
   */
  const settleElement = (active: Session): void => {
    settleHandle?.();
    settleHandle = null;

    const plan = active.plan;
    if (plan.kind === "instant") {
      writeState(active.element, createVisualState(), active.applied);
      return;
    }

    const from = { ...active.visual };
    const total = Math.hypot(from.x, from.y) + Math.abs(from.rotate);
    publish({ status: "settling" });
    let elapsed = 0;
    const duration =
      plan.kind === "tween" ? Math.max(0.12, plan.duration) : clamp(0.16 + total / 2600, 0.16, 0.45);
    const easing = plan.kind === "tween" ? plan.easing : (t: number) => 1 - Math.pow(1 - t, 3);

    settleHandle = activeTicker.subscribe((delta) => {
      elapsed += delta;
      const t = Math.min(1, elapsed / duration);
      const eased = easing(t);
      const current = createVisualState({
        x: from.x * (1 - eased),
        y: from.y * (1 - eased),
        scale: from.scale + (1 - from.scale) * eased,
        rotate: from.rotate * (1 - eased),
        elevation: from.elevation * (1 - eased),
        opacity: 1,
        blur: 0,
      });
      writeState(active.element, current, active.applied);
      active.applied = { ...current };
      if (t >= 1) {
        settleHandle?.();
        settleHandle = null;
        writeState(active.element, createVisualState(), active.applied);
        active.applied = createVisualState();
        publish({ status: "idle" });
      }
    });
  };

  const drop = (reason: DropReason = "drop"): void => {
    if (!session) return;
    finishSession(reason, true);
  };

  const cancel = (reason: DropReason = "cancel"): void => {
    if (!session) return;
    session.destinationIndex = session.startIndex;
    finishSession(reason, false);
  };

  const moveToIndex = (index: number, moveOptions: { source?: InputSource } = {}): boolean => {
    const active = session;
    if (!active) return false;
    const candidates = slotsNow();
    if (candidates.length === 0) return false;
    const bounded = Math.max(0, Math.min(candidates.length - 1, index));
    active.source = moveOptions.source ?? active.source;
    // Keyboard drags have no pointer: place the virtual pointer at the target slot.
    const target = candidates[bounded];
    if (target && active.source !== "pointer") {
      const center = rectCenter(target.rect);
      active.grabOffset = {
        x: target.rect.width / 2,
        y: target.rect.height / 2,
      };
      active.grab = center;
      active.pointer = center;
    }
    setDestination(bounded);
    if (active.source !== "pointer") {
      active.visual = computeDesired(active);
      apply(active);
      const pointer = active.pointer;
      if (active.started) {
        options.onMove?.({
          item: active.id,
          position: pointer,
          delta: { x: pointer.x - active.grab.x, y: pointer.y - active.grab.y },
          velocity: { x: 0, y: 0 },
          target: active.destinationSlot,
        });
      }
    }
    return true;
  };

  const moveInDirection = (
    direction: Direction,
    moveOptions: { large?: boolean; source?: InputSource } = {},
  ): boolean => {
    const active = session;
    if (!active) return false;
    const candidates = slotsNow();
    if (candidates.length === 0) return false;
    const current = active.destinationIndex ?? active.startIndex;
    const next = resolveTargetIndex(
      candidates,
      current,
      direction,
      { large: moveOptions.large },
      keyboardOptions,
    );
    if (next === current) return false;
    return moveToIndex(next, { source: moveOptions.source ?? "keyboard" });
  };

  const moveItemTo = (id: ItemId, index: number, source: InputSource = "programmatic"): DropResult | null => {
    const order = options.getOrder();
    const fromIndex = order.indexOf(id);
    if (fromIndex === -1) return null;
    invalidateSlots();
    const candidates = slotsNow();
    const bounded = Math.max(0, Math.min(Math.max(0, candidates.length - 1), index));
    if (bounded === fromIndex) return null;

    const ids = orderAfterDrop(order, id, fromIndex, bounded, mode === "swap" ? "swap" : "reorder");
    const fromRect = candidates[fromIndex]?.rect ?? { x: 0, y: 0, width: 0, height: 0 };
    const toRect = candidates[bounded]?.rect ?? fromRect;
    const event: SwapEvent = {
      item: id,
      previousSlot: candidates[fromIndex]?.slot ?? { index: fromIndex, column: 0, row: 0, rect: fromRect },
      nextSlot: candidates[bounded]?.slot ?? { index: bounded, column: 0, row: 0, rect: toRect },
      position: rectCenter(toRect),
      velocity: { x: 0, y: 0 },
      mode,
      source,
    };
    const result: DropResult = {
      id,
      fromIndex,
      toIndex: bounded,
      ids,
      changed: true,
      event,
      pointer: null,
    };
    options.onDrop?.(result);
    return result;
  };

  const rebase = (rects: Map<ItemId, Rect>): void => {
    const active = session;
    if (!active) return;
    const next = rects.get(active.id);
    if (!next) return;
    const dx = active.baseRect.x - next.x;
    const dy = active.baseRect.y - next.y;
    if (dx === 0 && dy === 0) return;
    active.baseRect = next;
    // Keep the element visually where it is: the transform is measured from its
    // own box, which just moved underneath it.
    active.visual = { ...active.visual, x: active.visual.x + dx, y: active.visual.y + dy };
    active.applied = { ...active.applied, x: active.applied.x + dx, y: active.applied.y + dy };
    active.desired = { ...active.desired, x: active.desired.x + dx, y: active.desired.y + dy };
    writeState(active.element, active.visual, active.applied);
    active.applied = { ...active.visual };
  };

  const destroy = (): void => {
    releaseTicker();
    settleHandle?.();
    settleHandle = null;
    session = null;
    tracker.reset();
  };

  return {
    subscribe: snapshotStore.subscribe,
    getSnapshot: () => snapshotStore.get(),
    begin,
    move,
    drop,
    cancel,
    moveInDirection,
    moveToIndex,
    moveItemTo,
    rebase,
    settle: () => {
      const active = session;
      if (!active) return;
      active.destinationIndex = active.startIndex;
      finishSession("drop", false);
    },
    isActive: () => session !== null,
    activeId: () => session?.id ?? null,
    activeOffset: () => {
      const active = session;
      if (!active) return { x: 0, y: 0 };
      return { x: active.visual.x, y: active.visual.y };
    },
    slots: () => slotsNow(),
    destroy,
  } satisfies DragController;
};

/** Convenience: the vector between two points, used by keyboards and tests. */
export const moveVector = (from: Point, to: Point): MoveVector => ({ x: to.x - from.x, y: to.y - from.y });
