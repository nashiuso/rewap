/**
 * `useBattery()` — the Battery Status API, where it exists.
 *
 * The API is unavailable in Safari and Firefox, and some browsers round the
 * level to the nearest 5% for fingerprinting reasons. Both facts are reported
 * instead of being hidden behind a fake value.
 */

import { useEffect, useState } from "react";

export interface BatteryState {
  supported: boolean;
  /** `navigator.getBattery()` is still pending. */
  loading: boolean;
  charging: boolean;
  /** `0..1`, or `null` when the browser does not report it. */
  level: number | null;
  /** Seconds until full, `Infinity` while plugged in and full, `null` if unknown. */
  chargingTime: number | null;
  /** Seconds until empty, `Infinity` when charging, `null` if unknown. */
  dischargingTime: number | null;
  /** Reason the API is unavailable, when `supported` is `false`. */
  unsupportedReason?: string;
}

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  level: number;
  chargingTime: number;
  dischargingTime: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

const unsupported = (reason: string): BatteryState => ({
  supported: false,
  loading: false,
  charging: false,
  level: null,
  chargingTime: null,
  dischargingTime: null,
  unsupportedReason: reason,
});

export const useBattery = (): BatteryState => {
  const [state, setState] = useState<BatteryState>(() => {
    if (typeof navigator === "undefined") return unsupported("No browser environment.");
    if (typeof (navigator as Navigator & { getBattery?: unknown }).getBattery !== "function") {
      return unsupported("navigator.getBattery() is not implemented in this browser.");
    }
    return {
      supported: true,
      loading: true,
      charging: false,
      level: null,
      chargingTime: null,
      dischargingTime: null,
    };
  });

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> })
      .getBattery;
    if (typeof getBattery !== "function") return;

    let cancelled = false;
    let manager: BatteryManagerLike | null = null;

    const read = () => {
      if (cancelled || !manager) return;
      setState({
        supported: true,
        loading: false,
        charging: manager.charging,
        level: Number.isFinite(manager.level) ? manager.level : null,
        chargingTime: Number.isFinite(manager.chargingTime) ? manager.chargingTime : null,
        dischargingTime: Number.isFinite(manager.dischargingTime) ? manager.dischargingTime : null,
      });
    };

    getBattery
      .call(navigator)
      .then((battery) => {
        if (cancelled) return;
        manager = battery;
        battery.addEventListener("levelchange", read);
        battery.addEventListener("chargingchange", read);
        battery.addEventListener("chargingtimechange", read);
        battery.addEventListener("dischargingtimechange", read);
        read();
      })
      .catch(() => {
        if (cancelled) return;
        setState(unsupported("The battery information could not be read."));
      });

    return () => {
      cancelled = true;
      manager?.removeEventListener("levelchange", read);
      manager?.removeEventListener("chargingchange", read);
      manager?.removeEventListener("chargingtimechange", read);
      manager?.removeEventListener("dischargingtimechange", read);
    };
  }, []);

  return state;
};
