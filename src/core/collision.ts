/**
 * Collision detection strategies.
 *
 * A strategy receives the dragged item's rectangle (or pointer position) and the
 * measured slots, and answers a single question: *which slot would the item land
 * on?* Each strategy is independent and testable, and the resolver falls back to
 * "no destination" instead of guessing when nothing is close enough.
 */

import {
  distanceSquared,
  metrics,
  projectRatio,
  type Axis,
  type DistanceMetric,
} from "../math/geometry";
import { clamp01 } from "../math/interpolate";
import {
  rectCenter,
  rectContainsPoint,
  rectOverlapRatio,
  type Point,
  type Rect,
} from "../math/rect";
import type { ItemId, Slot, SlotCandidate } from "./types";

export const collisionStrategyNames = [
  "pointer",
  "center",
  "intersection",
  "nearest",
  "projection",
] as const;

export type CollisionStrategy = (typeof collisionStrategyNames)[number];

export interface CollisionInput {
  /** Rectangle of the item being dragged, in current (translated) coordinates. */
  activeRect: Rect;
  /** Rect of the dragged item at rest, when available. */
  originRect?: Rect | null;
  /** Latest pointer position; absent for keyboard drags. */
  pointer?: Point | null;
  candidates: readonly SlotCandidate[];
  /** Slot the drag started from. */
  origin?: Slot | null;
  /** Axis along which projection and distance are measured. */
  axis?: Axis;
}

export interface CollisionResult {
  id: ItemId;
  index: number;
  slot: Slot;
  /** Strategy-specific score in `0..1`; higher is a better match. */
  score: number;
  strategy: CollisionStrategy;
}

export type CollisionFn = (input: CollisionInput) => CollisionResult | null;

const result = (
  candidate: SlotCandidate,
  strategy: CollisionStrategy,
  score: number,
): CollisionResult => ({
  id: candidate.id,
  index: candidate.index,
  slot: candidate.slot,
  score,
  strategy,
});

const axisOf = (input: CollisionInput): Axis => input.axis ?? "y";

const axisDistance = (a: Point, b: Point, axis: Axis): number =>
  axis === "x" ? Math.abs(a.x - b.x) : Math.abs(a.y - b.y);

const byIndex = (a: SlotCandidate, b: SlotCandidate): number =>
  a.index - b.index;

/**
 * `pointer`: the slot under the pointer, falling back to the slot whose
 * projection band contains the pointer along the layout axis.
 */
export const pointerCollision: CollisionFn = (input) => {
  const { pointer, candidates } = input;
  if (!pointer) return null;
  const axis = axisOf(input);

  const direct = [...candidates]
    .sort(byIndex)
    .find((candidate) => rectContainsPoint(candidate.rect, pointer));
  if (direct) return result(direct, "pointer", 1);

  let best: SlotCandidate | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const center = rectCenter(candidate.rect);
    const along = axisDistance(pointer, center, axis);
    const score = clamp01(
      1 - along / Math.max(1, candidate.rect.width + candidate.rect.height),
    );
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best ? result(best, "pointer", bestScore) : null;
};

/** `center`: the slot whose center is closest to the dragged rectangle's center. */
export const centerCollision: CollisionFn = (input) => {
  const activeCenter = rectCenter(input.activeRect);
  let best: SlotCandidate | null = null;
  let bestScore = 0;
  for (const candidate of input.candidates) {
    const candidateCenter = rectCenter(candidate.rect);
    const distance = Math.hypot(
      activeCenter.x - candidateCenter.x,
      activeCenter.y - candidateCenter.y,
    );
    const reach = Math.hypot(candidate.rect.width, candidate.rect.height);
    const score = reach === 0 ? 1 : clamp01(1 - distance / (reach * 1.5));
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best ? result(best, "center", bestScore) : null;
};

/** `nearest`: the slot whose center is closest to the pointer. */
export const nearestCollision: CollisionFn = (input) => {
  const reference = input.pointer ?? rectCenter(input.activeRect);
  let best: SlotCandidate | null = null;
  let bestSquared = Number.POSITIVE_INFINITY;
  for (const candidate of input.candidates) {
    const squared = distanceSquared(reference, rectCenter(candidate.rect));
    if (squared < bestSquared) {
      bestSquared = squared;
      best = candidate;
    }
  }
  if (!best) return null;
  const distance = Math.sqrt(bestSquared);
  const reach = Math.hypot(best.rect.width, best.rect.height) * 1.5;
  return result(
    best,
    "nearest",
    reach === 0 ? 1 : clamp01(1 - distance / reach),
  );
};

/**
 * `intersection`: the slot with the largest overlap relative to the smaller of
 * the two rectangles. Requires real (non-zero) overlap, which makes it the
 * strictest strategy and the safest default for dense grids.
 */
export const intersectionCollision: CollisionFn = (input) => {
  let best: SlotCandidate | null = null;
  let bestScore = 0;
  for (const candidate of input.candidates) {
    const ratio = rectOverlapRatio(input.activeRect, candidate.rect);
    if (ratio > bestScore) {
      bestScore = ratio;
      best = candidate;
    }
  }
  if (!best || bestScore <= 0) return null;
  return result(best, "intersection", bestScore);
};

/**
 * `projection`: reading-order insertion along the layout axis.
 *
 * Rather than comparing rectangles, this measures where the pointer falls
 * relative to each slot's center along one axis, which is what list reordering
 * needs: the answer is an insertion point, not an overlap.
 */
const axisValueOf = (point: Point, axis: Axis): number =>
  axis === "x" ? point.x : point.y;
const axisStart = (rect: Rect, axis: Axis): number =>
  axis === "x" ? rect.x : rect.y;
const axisEnd = (rect: Rect, axis: Axis): number =>
  axis === "x" ? rect.x + rect.width : rect.y + rect.height;

/** Candidates in physical order along the axis (reading order for `y`). */
const sortByAxis = (
  candidates: readonly SlotCandidate[],
  axis: Axis,
): SlotCandidate[] =>
  [...candidates].sort((a, b) =>
    axis === "x"
      ? a.rect.x - b.rect.x || a.rect.y - b.rect.y
      : a.rect.y - b.rect.y || a.rect.x - b.rect.x,
  );

/**
 * The lines an item has to cross to change slot, in physical order.
 *
 * A boundary sits in the middle of the space between two neighbouring slots, so
 * it is the gap midpoint when they are separated and the middle of the overlap
 * when they touch. Counting how many boundaries lie before a position answers
 * "which slot would the item land in?" without ever having to look at the dragged
 * item itself — which is what keeps the answer stable while it is being held.
 */
const slotBoundaries = (
  ordered: readonly SlotCandidate[],
  axis: Axis,
): number[] => {
  const boundaries: number[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!previous || !current) continue;
    const separated =
      axisStart(current.rect, axis) >= axisEnd(previous.rect, axis);
    boundaries.push(
      separated
        ? (axisEnd(previous.rect, axis) + axisStart(current.rect, axis)) / 2
        : (axisValueOf(rectCenter(previous.rect), axis) +
            axisValueOf(rectCenter(current.rect), axis)) /
            2,
    );
  }
  return boundaries;
};

/** How closely a position matches the slot it lands in, in `0..1`. */
const insertionScore = (value: number, rect: Rect, axis: Axis): number =>
  clamp01(
    1 -
      Math.abs(value - axisValueOf(rectCenter(rect), axis)) /
        Math.max(1, rect.width + rect.height),
  );

/**
 * `projection`: the slot the item lands in when it moves along one axis.
 *
 * Used by list-like layouts, where the answer has to be a *position* rather than
 * "the rectangle under the pointer": each boundary between two slots is crossed
 * as the item moves, and the number of boundaries behind it is its new slot.
 * Positions before the first slot land on the first one, positions past the last
 * land on the last one.
 */
export const projectionCollision: CollisionFn = (input) => {
  const axis = axisOf(input);
  const ordered = sortByAxis(input.candidates, axis);
  if (ordered.length === 0) return null;

  const reference = input.pointer ?? rectCenter(input.activeRect);
  const value = axisValueOf(reference, axis);
  let position = 0;
  for (const boundary of slotBoundaries(ordered, axis)) {
    if (value > boundary) position += 1;
    else break;
  }
  const bounded = Math.max(0, Math.min(ordered.length - 1, position));
  const chosen = ordered[bounded];
  if (!chosen) return null;
  return result(chosen, "projection", insertionScore(value, chosen.rect, axis));
};

/**
 * How far the pointer has travelled between two slots, `0..1`.
 *
 * Used by the placeholder to interpolate between two candidate destinations
 * instead of snapping between them.
 */
export const slotProgress = (pointer: Point, from: Rect, to: Rect): number =>
  projectRatio(pointer, rectCenter(from), rectCenter(to));

export const strategies: Record<CollisionStrategy, CollisionFn> = {
  pointer: pointerCollision,
  center: centerCollision,
  intersection: intersectionCollision,
  nearest: nearestCollision,
  projection: projectionCollision,
};

export interface ResolveOptions {
  strategy: CollisionStrategy;
  axis?: Axis;
  /** Minimum score required to accept a destination. */
  minScore?: number;
  /** Ignores this id (usually the dragged item) in `swap` mode. */
  exclude?: ItemId | null;
}

/**
 * Runs a collision strategy and returns the destination slot, or `null`.
 *
 * `exclude` is applied *after* the strategy runs so that strategies stay pure
 * comparisons; when the strategy picks the excluded slot the next best is used.
 * Only `projection` keeps the full list: it answers "which slot does this land
 * in?" by counting the boundaries it has crossed, and the slot the item is
 * currently held over is one of them.
 */
export const resolveCollision = (
  input: CollisionInput,
  options: ResolveOptions,
): CollisionResult | null => {
  const strategy = strategies[options.strategy] ?? intersectionCollision;
  const candidates =
    options.exclude == null || strategy === projectionCollision
      ? input.candidates
      : input.candidates.filter(
          (candidate) => candidate.id !== options.exclude,
        );

  const resolved = strategy({
    ...input,
    candidates,
    axis: options.axis ?? input.axis,
  });
  if (!resolved) return null;
  if (options.minScore !== undefined && resolved.score < options.minScore)
    return null;
  return resolved;
};

export interface NearestByMetricsOptions {
  metric?: DistanceMetric;
  maxDistance?: number;
}

/** Convenience wrapper around `metrics` for code that only needs a distance. */
export const nearestSlot = (
  candidates: readonly SlotCandidate[],
  point: Point,
  options: NearestByMetricsOptions = {},
): SlotCandidate | null => {
  const metric = options.metric ?? metrics.center;
  let best: SlotCandidate | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = metric(point, candidate.rect);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  if (!best) return null;
  if (options.maxDistance !== undefined && bestDistance > options.maxDistance)
    return null;
  return best;
};
