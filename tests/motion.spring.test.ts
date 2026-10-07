import { describe, expect, it } from "vitest";

import {
  angularFrequency,
  criticalDamping,
  dampingRatio,
  sampleSpring,
  springAcceleration,
  springAtRest,
  springDuration,
  stepSpring,
  type SpringConfig,
} from "../src/motion/spring";

const config: SpringConfig = { stiffness: 320, damping: 32, mass: 1 };

const simulate = (target: number, steps: number, delta = 1 / 60, from = 0, cfg = config) => {
  let state = { value: from, velocity: 0 };
  for (let i = 0; i < steps; i += 1) state = stepSpring(state, target, cfg, delta);
  return state;
};

describe("motion/spring", () => {
  it("computes derived spring properties", () => {
    expect(criticalDamping(400, 1)).toBe(40);
    expect(criticalDamping(0, 0)).toBeCloseTo(0, 6);
    expect(dampingRatio({ stiffness: 400, damping: 40, mass: 1 })).toBeCloseTo(1, 6);
    expect(dampingRatio({ stiffness: 400, damping: 20, mass: 1 })).toBeCloseTo(0.5, 6);
    expect(angularFrequency({ stiffness: 400, damping: 40, mass: 1 })).toBeCloseTo(20, 6);
  });

  it("computes acceleration from displacement and velocity", () => {
    expect(springAcceleration(1, 0, { stiffness: 100, damping: 10, mass: 1 })).toBe(-100);
    expect(springAcceleration(0, 10, { stiffness: 100, damping: 10, mass: 1 })).toBe(-100);
    expect(springAcceleration(1, 0, { stiffness: 100, damping: 10, mass: 2 })).toBe(-50);
  });

  it("converges on the target", () => {
    const settled = simulate(100, 120);
    expect(settled.value).toBeCloseTo(100, 1);
    expect(Math.abs(settled.velocity)).toBeLessThan(1);
  });

  it("is frame-rate independent within a small tolerance", () => {
    const sixty = simulate(100, 60, 1 / 60);
    const oneTwenty = simulate(100, 120, 1 / 120);
    const thirty = simulate(100, 30, 1 / 30);
    expect(Math.abs(sixty.value - oneTwenty.value)).toBeLessThan(0.05);
    expect(Math.abs(sixty.value - thirty.value)).toBeLessThan(0.5);
  });

  it("overshoots less as damping increases", () => {
    const peak = (damping: number) => {
      let state = { value: 0, velocity: 0 };
      let max = 0;
      for (let i = 0; i < 200; i += 1) {
        state = stepSpring(state, 100, { stiffness: 400, damping, mass: 1 }, 1 / 120);
        max = Math.max(max, state.value);
      }
      return max;
    };
    expect(peak(20)).toBeGreaterThan(100);
    expect(peak(40)).toBeCloseTo(100, 0);
    expect(peak(80)).toBeLessThanOrEqual(100.001);
  });

  it("settles faster as stiffness increases", () => {
    const stepsToRest = (stiffness: number) => {
      let state = { value: 0, velocity: 0 };
      for (let i = 0; i < 600; i += 1) {
        state = stepSpring(state, 100, { stiffness, damping: 2 * Math.sqrt(stiffness), mass: 1 }, 1 / 60);
        if (springAtRest(state, 100)) return i;
      }
      return 600;
    };
    expect(stepsToRest(600)).toBeLessThan(stepsToRest(200));
  });

  it("respects mass: a heavy body lags behind a light one", () => {
    // Measured early, while both springs are still accelerating towards the
    // target: the lighter body has travelled further.
    const light = simulate(100, 6, 1 / 60, 0, { stiffness: 320, damping: 32, mass: 0.5 });
    const heavy = simulate(100, 6, 1 / 60, 0, { stiffness: 320, damping: 32, mass: 2 });
    expect(light.value).toBeGreaterThan(heavy.value);
    expect(light.value).toBeGreaterThan(0);
  });

  it("reports rest state", () => {
    expect(springAtRest({ value: 100, velocity: 0 }, 100)).toBe(true);
    expect(springAtRest({ value: 100.5, velocity: 0 }, 100)).toBe(false);
    expect(springAtRest({ value: 100, velocity: 5 }, 100)).toBe(false);
    expect(springAtRest({ value: 100.05, velocity: 0 }, 100, config, { restDistance: 0.5 })).toBe(true);
  });

  it("clamps absurd frame deltas so a background tab cannot explode", () => {
    const huge = simulate(100, 1, 5);
    expect(Math.abs(huge.value)).toBeLessThan(200);
  });

  it("estimates duration analytically", () => {
    const fast = springDuration({ stiffness: 600, damping: 40, mass: 1 });
    const slow = springDuration({ stiffness: 120, damping: 20, mass: 1 });
    expect(fast).toBeGreaterThan(0);
    expect(fast).toBeLessThan(slow);
    expect(springDuration(config, 0)).toBe(0);
    expect(springDuration(config, 1, 0.001, 0.05)).toBe(0.05);
  });

  it("samples trajectories", () => {
    const samples = sampleSpring(0, 100, config, 0.5, 120);
    expect(samples).toHaveLength(60);
    expect(samples[59]).toBeGreaterThan(90);
    expect(samples[0]).toBeGreaterThan(0);
  });
});
