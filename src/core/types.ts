/**
 * Core (framework-agnostic) types for layouts, slots, drag sessions and events.
 *
 * Nothing in this file imports React: the same model powers the React bindings,
 * the tests and any future binding.
 */

import type { MotionValue } from "../motion/presets";
import type { Point, Rect } from "../math/rect";

/** Identifies an item inside a layout. Must be unique within that layout. */
export type ItemId = string;

export type LayoutMode = "swap" | "reorder" | "grid";

export type PlaceholderStyle = "auto" | "outline" | "ghost" | "none";

/** How the drag input was produced. */
export type InputSource =
  "pointer" | "mouse" | "touch" | "keyboard" | "programmatic";

/** Why a drag session ended. */
export type DropReason = "drop" | "cancel" | "escape" | "outside";

/** A position inside the layout grid, in flow coordinates. */
export interface Slot {
  /** Position in reading order (row-major). */
  index: number;
  /** Zero-based column, derived from the measured layout. */
  column: number;
  /** Zero-based row, derived from the measured layout. */
  row: number;
  /** Measured rectangle of the slot in viewport coordinates. */
  rect: Rect;
}

export interface DragStartEvent {
  item: ItemId;
  index: number;
  slot: Slot;
  position: Point;
  source: InputSource;
  mode: LayoutMode;
}

export interface DragMoveEvent {
  item: ItemId;
  position: Point;
  /** Movement since the drag started, in pixels. */
  delta: Point;
  /** Smoothed pointer velocity in pixels per second. */
  velocity: Point;
  /** Slot the drop would currently land on, or `null` when nothing is close. */
  target: Slot | null;
  mode: LayoutMode;
}

export interface DragEndEvent {
  item: ItemId;
  /** Slot the item started from. */
  from: Slot;
  /** Slot the item was dropped on; equal to `from` when the drop was a no-op. */
  to: Slot;
  reason: DropReason;
  cancelled: boolean;
  source: InputSource;
  mode: LayoutMode;
  /** Pointer position at the end of the session. */
  position: Point;
}

/** Emitted whenever the drop destination changes during a drag. */
export interface SwapEvent {
  item: ItemId;
  previousSlot: Slot;
  nextSlot: Slot;
  /** Pointer (or active element center, for keyboard drags) position. */
  position: Point;
  /** Pointer velocity in pixels per second at the moment of the event. */
  velocity: Point;
  mode: LayoutMode;
  source: InputSource;
}

/** Emitted after a completed drag that changed the order. */
export interface LayoutChangeEvent {
  /** Order after the change. */
  ids: ItemId[];
  /** The swap details; `undefined` for programmatic resets. */
  swap?: SwapEvent;
  source: InputSource | "history";
}

/** Slot descriptor used by collision detection. */
export interface SlotCandidate {
  id: ItemId;
  index: number;
  rect: Rect;
  slot: Slot;
}

/** Relative movement used by keyboard and programmatic drags. */
export interface MoveVector {
  x: number;
  y: number;
}

export interface PhysicsOptions {
  /** Smoothing factor for the velocity tracker (`0..1`, smaller is smoother). */
  smoothing?: number;
}

// NOTE(nashiuso): there used to be an `inertiaThreshold` here. It was documented as
// "speed above which inertia engages" and nothing ever read it — the drop settles
// with a fixed curve rather than a fling, so there was no threshold to apply.
// Removed in 1.1.1 rather than kept as a knob that does nothing.

export interface SnapOptions {
  /** Snaps the dragged element's origin to the slot, not just its center. */
  enabled?: boolean;
  /** Distance in pixels within which snapping applies. */
  threshold?: number;
}

/** Motion accepted by layouts and items. `null`/`false` disables animation. */
export type ItemMotion = MotionValue;

export interface DragEffects {
  /** Lift on hover. */
  hover?: "none" | "lift" | "raise";
  /** Drag visual mode: magnetic follows the pointer with a slight lag. */
  drag?: "none" | "magnetic" | "tilt";
  /** Rotate slightly based on horizontal velocity. */
  velocityRotation?: boolean | number;
  /** Scale applied while dragging. */
  dragScale?: number;
  /** Opacity applied to the original slot's item while dragging. */
  dragOpacity?: number;
  /** Blur applied to the rest of the layout while dragging. */
  backdropBlur?: number;
}

export interface EffectsOptions extends DragEffects {
  /** Shadow ramp used by `lift` and `raise`. */
  elevation?: number;
}
