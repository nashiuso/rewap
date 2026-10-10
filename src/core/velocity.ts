/**
 * Pointer velocity tracking.
 *
 * Velocity is measured from pointer samples, smoothed with an exponential moving
 * average and converted to pixels per second. A drag that pauses produces a
 * velocity of zero instead of a stale reading, which matters because swap events
 * report velocity to consumers.
 */

import { now } from "../math/interpolate";
import type { Point } from "../math/rect";

export interface VelocitySample {
  x: number;
  y: number;
  timestamp: number;
}

export interface VelocityTrackerOptions {
  /** EMA weight for the newest sample, `0..1`. Lower values are smoother. */
  smoothing?: number;
  /** Samples older than this (ms) are ignored when computing velocity. */
  staleAfter?: number;
  /** Velocity magnitude cap in pixels per second. */
  maxSpeed?: number;
}

export interface VelocityTracker {
  /** Records a pointer sample and returns the updated velocity. */
  add(point: Point, timestamp?: number): Point;
  /** Current velocity in pixels per second. */
  value(): Point;
  /** Velocity magnitude in pixels per second. */
  speed(): number;
  /** Direction of travel in radians, or `undefined` at rest. */
  direction(): number | undefined;
  /** Clears history; the next sample restarts from rest. */
  reset(): void;
  /** Number of samples currently held. */
  readonly sampleCount: number;
}

const DEFAULTS: Required<VelocityTrackerOptions> = {
  smoothing: 0.35,
  staleAfter: 120,
  maxSpeed: 8000,
};

export const createVelocityTracker = (
  options: VelocityTrackerOptions = {},
): VelocityTracker => {
  const smoothing = Math.min(
    1,
    Math.max(0.01, options.smoothing ?? DEFAULTS.smoothing),
  );
  const staleAfter = options.staleAfter ?? DEFAULTS.staleAfter;
  const maxSpeed = options.maxSpeed ?? DEFAULTS.maxSpeed;

  let previous: VelocitySample | null = null;
  let velocity: Point = { x: 0, y: 0 };
  let samples = 0;

  const clampSpeed = (point: Point): Point => {
    const speed = Math.hypot(point.x, point.y);
    if (speed <= maxSpeed || speed === 0) return point;
    const scale = maxSpeed / speed;
    return { x: point.x * scale, y: point.y * scale };
  };

  return {
    add(point, timestamp = now()) {
      if (!previous) {
        previous = { x: point.x, y: point.y, timestamp };
        samples = 1;
        velocity = { x: 0, y: 0 };
        return velocity;
      }

      const deltaTime = (timestamp - previous.timestamp) / 1000;
      if (deltaTime <= 0) {
        previous = { x: point.x, y: point.y, timestamp: previous.timestamp };
        return velocity;
      }

      // A long gap (background tab, finger lift) must not be read as a huge jump.
      if (deltaTime * 1000 > staleAfter) {
        previous = { x: point.x, y: point.y, timestamp };
        velocity = { x: 0, y: 0 };
        return velocity;
      }

      const instantaneous: Point = {
        x: (point.x - previous.x) / deltaTime,
        y: (point.y - previous.y) / deltaTime,
      };
      const blended: Point = {
        x: velocity.x + (instantaneous.x - velocity.x) * smoothing,
        y: velocity.y + (instantaneous.y - velocity.y) * smoothing,
      };
      velocity = clampSpeed(blended);
      previous = { x: point.x, y: point.y, timestamp };
      samples += 1;
      return velocity;
    },
    value() {
      return velocity;
    },
    speed() {
      return Math.hypot(velocity.x, velocity.y);
    },
    direction() {
      if (velocity.x === 0 && velocity.y === 0) return undefined;
      return Math.atan2(velocity.y, velocity.x);
    },
    reset() {
      previous = null;
      velocity = { x: 0, y: 0 };
      samples = 0;
    },
    get sampleCount() {
      return samples;
    },
  };
};
