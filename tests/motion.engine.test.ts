import { describe, expect, it, vi } from "vitest";

import { cubicBezier, easings, easeOutCubic, linear, resolveEasing } from "../src/motion/easing";
import {
  describeMotion,
  motionDuration,
  motionNames,
  motionPresets,
  resolveMotion,
  softTween,
} from "../src/motion/presets";
import { createTicker } from "../src/motion/ticker";
import { animateValue, animateVisualState } from "../src/motion/animator";
import {
  applyVisualState,
  createVisualState,
  identityVisualState,
  lerpVisualState,
  readTranslate,
  transformString,
  visualStateEquals,
} from "../src/motion/transform";

describe("motion/easing", () => {
  it("pins the endpoints of every easing", () => {
    for (const [name, easing] of Object.entries(easings)) {
      expect(easing(0), `${name}(0)`).toBeCloseTo(0, 6);
      expect(easing(1), `${name}(1)`).toBeCloseTo(1, 6);
    }
    expect(linear(0.5)).toBe(0.5);
  });

  it("solves cubic beziers monotonically", () => {
    const ease = cubicBezier(0.42, 0, 0.58, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let previous = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const value = ease(t);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-6);
      previous = value;
    }
    expect(cubicBezier(0, 0, 1, 1)(0.5)).toBeCloseTo(0.5, 2);
  });

  it("resolves easing inputs", () => {
    expect(resolveEasing("linear")).toBe(linear);
    expect(resolveEasing((t) => t * 2)(0.5)).toBe(1);
    expect(resolveEasing([0, 0, 1, 1])(0.5)).toBeCloseTo(0.5, 2);
    // Unknown names fall back to a sane default instead of throwing.
    expect(resolveEasing("nope" as never)(0.5)).toBeCloseTo(easeOutCubic(0.5), 6);
  });
});

describe("motion/presets", () => {
  it("resolves preset names", () => {
    expect(resolveMotion("smooth")).toMatchObject({ kind: "spring" });
    expect(resolveMotion("instant")).toEqual({ kind: "instant" });
    expect(motionNames).toEqual(["smooth", "snappy", "soft", "instant"]);
    expect(motionPresets.snappy).toMatchObject({ type: "spring" });
  });

  it("resolves custom springs and tweens", () => {
    const spring = resolveMotion({ type: "spring", stiffness: 420, damping: 32, mass: 0.8 });
    expect(spring).toMatchObject({ kind: "spring", config: { stiffness: 420, damping: 32, mass: 0.8 } });

    const tween = resolveMotion({ type: "tween", duration: 0.3, easing: "linear" });
    expect(tween).toMatchObject({ kind: "tween", duration: 0.3 });
    expect(resolveMotion({ type: "tween", duration: 0 })).toEqual({ kind: "instant" });
  });

  it("honours prefers-reduced-motion unless explicitly opted out", () => {
    expect(resolveMotion("smooth", { prefersReducedMotion: true })).toEqual({ kind: "instant" });
    expect(resolveMotion(undefined, { prefersReducedMotion: true })).toEqual({ kind: "instant" });
    expect(
      resolveMotion(
        { type: "spring", stiffness: 300, damping: 30, mass: 1, respectReducedMotion: false },
        {
          prefersReducedMotion: true,
        },
      ),
    ).toMatchObject({ kind: "spring" });
    expect(resolveMotion(null)).toEqual({ kind: "instant" });
    expect(resolveMotion(false)).toEqual({ kind: "instant" });
  });

  it("describes plans and durations", () => {
    expect(describeMotion({ kind: "instant" })).toBe("instant");
    expect(describeMotion({ kind: "tween", duration: 0.25, easing: linear })).toBe("tween(250ms)");
    expect(describeMotion({ kind: "spring", config: { stiffness: 300, damping: 30, mass: 1 } })).toContain(
      "spring",
    );
    expect(motionDuration({ kind: "instant" })).toBe(0);
    expect(motionDuration({ kind: "tween", duration: 0.3, easing: linear })).toBe(0.3);
    expect(softTween.kind).toBe("tween");
  });
});

describe("motion/ticker", () => {
  it("subscribes, ticks and stops when empty", () => {
    const ticker = createTicker();
    const seen: number[] = [];
    const unsubscribe = ticker.subscribe((delta) => seen.push(delta));
    expect(ticker.size).toBe(1);
    ticker.tick(1000);
    ticker.tick(1016);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(0);
    expect(seen[1]).toBeCloseTo(0.016, 6);
    unsubscribe();
    expect(ticker.size).toBe(0);
    expect(ticker.running).toBe(false);
  });

  it("skips a subscriber that unsubscribes during a tick", () => {
    const ticker = createTicker();
    const calls: string[] = [];
    const unsubscribeSecond = ticker.subscribe(() => calls.push("second"));
    ticker.subscribe(() => {
      calls.push("first");
      unsubscribeSecond();
    });
    // Subscribers run in registration order: "second" sees the first frame (it is
    // still subscribed), then "first" disposes it so it never sees another one.
    ticker.tick(0);
    ticker.tick(16);
    expect(calls).toEqual(["second", "first", "first"]);
    expect(ticker.size).toBe(1);
  });
});

describe("motion/animator", () => {
  it("applies the final value immediately for instant plans", async () => {
    const onUpdate = vi.fn();
    const handle = animateValue({ from: 0, to: 10, plan: { kind: "instant" }, onUpdate });
    await handle.done;
    expect(onUpdate).toHaveBeenCalledWith(10, 0);
    expect(handle.finished).toBe(true);
  });

  it("advances a tween through the ticker", () => {
    const ticker = createTicker();
    const values: number[] = [];
    animateValue({
      from: 0,
      to: 100,
      plan: { kind: "tween", duration: 0.1, easing: linear },
      ticker,
      onUpdate: (value) => values.push(value),
    });
    ticker.tick(1000);
    ticker.tick(1050);
    ticker.tick(1100);
    expect(values[values.length - 1]).toBe(100);
  });

  it("springs to the target and reports completion", () => {
    const ticker = createTicker();
    const values: number[] = [];
    const onComplete = vi.fn();
    animateValue({
      from: 0,
      to: 50,
      plan: { kind: "spring", config: { stiffness: 400, damping: 40, mass: 1 } },
      ticker,
      onUpdate: (value) => values.push(value),
      onComplete,
    });
    let time = 0;
    for (let i = 0; i < 300 && !onComplete.mock.calls.length; i += 1) {
      time += 16;
      ticker.tick(time);
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(values[values.length - 1]).toBe(50);
  });

  it("can be cancelled and finished early", async () => {
    const ticker = createTicker();
    const onUpdate = vi.fn();
    const cancelled = animateValue({
      from: 0,
      to: 100,
      plan: { kind: "spring", config: { stiffness: 300, damping: 30, mass: 1 } },
      ticker,
      onUpdate,
    });
    ticker.tick(16);
    cancelled.cancel();
    expect(await cancelled.done).toBe(false);

    const finished = animateValue({
      from: 0,
      to: 100,
      plan: { kind: "spring", config: { stiffness: 300, damping: 30, mass: 1 } },
      ticker,
      onUpdate,
    });
    finished.finish();
    expect(await finished.done).toBe(true);
  });

  it("animates whole visual states", () => {
    const ticker = createTicker();
    const states: number[] = [];
    const handle = animateVisualState({
      from: createVisualState({ x: 0, scale: 1, opacity: 1 }),
      to: createVisualState({ x: 40, scale: 1.1, opacity: 0.5 }),
      plan: { kind: "spring", config: { stiffness: 500, damping: 40, mass: 1 } },
      ticker,
      onUpdate: (state) => states.push(state.x),
    });
    let time = 0;
    for (let i = 0; i < 400; i += 1) {
      time += 16;
      ticker.tick(time);
    }
    expect(states[states.length - 1]).toBe(40);
    expect(handle.finished).toBe(true);
  });
});

describe("motion/transform", () => {
  it("composes transform strings", () => {
    expect(transformString(createVisualState({ x: 10, y: -5 }))).toBe("translate3d(10px, -5px, 0)");
    expect(transformString(createVisualState({ x: 1, y: 2, scale: 1.5, rotate: 12 }))).toBe(
      "translate3d(1px, 2px, 0) scale(1.5) rotate(12deg)",
    );
    expect(transformString(createVisualState({ x: 1.005, y: 0 }), false)).toBe(
      "translate3d(1.005px, 0px, 0)",
    );
  });

  it("writes only what changed", () => {
    const element = document.createElement("div");
    const first = createVisualState({ x: 10, y: 10 });
    applyVisualState(element, first);
    expect(element.style.transform).toBe("translate3d(10px, 10px, 0)");

    // Identical state: no rewrite (and no shadow, because elevation is 0).
    applyVisualState(element, first, first);
    expect(element.style.boxShadow).toBe("");

    applyVisualState(element, createVisualState({ x: 10, y: 10, elevation: 1 }), first);
    expect(element.style.boxShadow).not.toBe("");

    applyVisualState(element, createVisualState({ x: 10, y: 10, blur: 4 }), first);
    expect(element.style.filter).toBe("blur(4px)");
  });

  it("interpolates and compares visual states", () => {
    const a = createVisualState({ x: 0, opacity: 1 });
    const b = createVisualState({ x: 100, opacity: 0 });
    expect(lerpVisualState(a, b, 0.25).x).toBe(25);
    expect(lerpVisualState(a, b, 0.5).opacity).toBe(0.5);
    expect(visualStateEquals(a, { ...a })).toBe(true);
    expect(visualStateEquals(a, b)).toBe(false);
    expect(identityVisualState).toMatchObject({ x: 0, y: 0, scale: 1, opacity: 1 });
  });

  it("reads back its own translate values", () => {
    const element = document.createElement("div");
    applyVisualState(element, createVisualState({ x: 12, y: -34 }));
    expect(readTranslate(element)).toEqual({ x: 12, y: -34 });
    element.style.transform = "scale(2)";
    expect(readTranslate(element)).toEqual({ x: 0, y: 0 });
  });
});
