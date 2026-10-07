/**
 * Keyboard navigation helpers.
 *
 * Directional movement is computed from the measured slot geometry rather than
 * from index arithmetic, so arrow keys behave correctly in rows, columns and
 * grids without the layout having to declare which is which.
 */

import { rectCenter } from "../math/rect";
import type { SlotCandidate } from "./types";

export type Direction = "left" | "right" | "up" | "down" | "first" | "last";

export interface KeyboardOptions {
  /** Slots travelled per arrow press. */
  step?: number;
  /** Slots travelled per arrow press while Shift is held. */
  largeStep?: number;
}

// NOTE(nashiuso): `largeStep` is a bad name. It is "how far Shift jumps", which in
// `reorder` mode is a number of slots and in `swap` mode is a distance between
// items. Renaming it would be a breaking change for a cosmetic win, so it waits
// for 2.0 rather than shipping a second alias for the same field.
export const defaultKeyboardOptions: Required<KeyboardOptions> = {
  step: 1,
  largeStep: 3,
};

/**
 * Candidates in the given direction, ordered by how directly they lie that way.
 *
 * A candidate qualifies when it sits forwards along the requested axis and its
 * centre is within the perpendicular extent of the current slot (extended by
 * half a slot, so diagonal neighbours are reachable in dense grids).
 */
export const candidatesInDirection = (
  candidates: readonly SlotCandidate[],
  currentIndex: number,
  direction: "left" | "right" | "up" | "down",
): SlotCandidate[] => {
  const current = candidates.find((candidate) => candidate.index === currentIndex);
  if (!current) return [];
  const from = rectCenter(current.rect);
  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const sign = direction === "left" || direction === "up" ? -1 : 1;

  const forward = candidates.filter((candidate) => {
    if (candidate.index === currentIndex) return false;
    const center = rectCenter(candidate.rect);
    const along = (axis === "x" ? center.x - from.x : center.y - from.y) * sign;
    if (along <= 1) return false;
    const perpendicular = axis === "x" ? Math.abs(center.y - from.y) : Math.abs(center.x - from.x);
    const tolerance =
      (axis === "x" ? current.rect.height : current.rect.width) / 2 +
      (axis === "x" ? candidate.rect.height : candidate.rect.width) / 2;
    return perpendicular <= Math.max(tolerance, 1);
  });

  return forward.sort((a, b) => {
    const aCenter = rectCenter(a.rect);
    const bCenter = rectCenter(b.rect);
    const aAlong = axis === "x" ? Math.abs(aCenter.x - from.x) : Math.abs(aCenter.y - from.y);
    const bAlong = axis === "x" ? Math.abs(bCenter.x - from.x) : Math.abs(bCenter.y - from.y);
    if (Math.abs(aAlong - bAlong) > 0.5) return aAlong - bAlong;
    const aPerp = axis === "x" ? Math.abs(aCenter.y - from.y) : Math.abs(aCenter.x - from.x);
    const bPerp = axis === "x" ? Math.abs(bCenter.y - from.y) : Math.abs(bCenter.x - from.x);
    if (Math.abs(aPerp - bPerp) > 0.5) return aPerp - bPerp;
    return a.index - b.index;
  });
};

/**
 * Index reached by stepping `count` slots in `direction`.
 * Stays put when there is nothing further in that direction.
 */
export const stepIndex = (
  candidates: readonly SlotCandidate[],
  currentIndex: number,
  direction: "left" | "right" | "up" | "down",
  count = 1,
): number => {
  let index = currentIndex;
  for (let i = 0; i < Math.max(1, count); i += 1) {
    const next = candidatesInDirection(candidates, index, direction)[0];
    if (!next) break;
    index = next.index;
  }
  return index;
};

/** `Home`/`End`/`PageUp`-style jumps to the first or last slot. */
export const boundaryIndex = (candidates: readonly SlotCandidate[], boundary: "first" | "last"): number => {
  if (candidates.length === 0) return 0;
  if (boundary === "first") return 0;
  return candidates.length - 1;
};

export const resolveTargetIndex = (
  candidates: readonly SlotCandidate[],
  currentIndex: number,
  direction: Direction,
  options: { large?: boolean } = {},
  keyboard: KeyboardOptions = {},
): number => {
  const config = { ...defaultKeyboardOptions, ...keyboard };
  if (direction === "first" || direction === "last") return boundaryIndex(candidates, direction);
  const count = options.large ? config.largeStep : config.step;
  return stepIndex(candidates, currentIndex, direction, count);
};

/** Human-readable announcement for a move, used by the live region. */
export const describeMove = (itemLabel: string, index: number, total: number): string =>
  `${itemLabel} moved to position ${index + 1} of ${total}`;
