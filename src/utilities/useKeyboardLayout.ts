/**
 * `useKeyboardLayout()` — platform, modifier conventions and live modifier state.
 *
 * Deliberately honest about its limits: browsers do not expose the physical
 * keyboard layout, so this hook never guesses one. It reports the platform
 * (with a `confidence` value), the language preferences, the time zone, and the
 * live state of the modifier keys — all of which are genuinely observable.
 */

import { useEffect, useState } from "react";

export type Platform = "macos" | "windows" | "linux" | "ios" | "android" | "unknown";

export interface ModifierState {
  shift: boolean;
  control: boolean;
  alt: boolean;
  meta: boolean;
}

export interface KeyboardLayoutInfo {
  platform: Platform;
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  /** The modifier used for shortcuts on this platform: `Meta` on Apple, `Control` elsewhere. */
  modifierKey: "Meta" | "Control";
  /** Symbol shown in shortcut hints, e.g. `⌘` or `Ctrl`. */
  modifierSymbol: string;
  language: string;
  languages: string[];
  timeZone: string;
  timeZoneOffset: number;
  /**
   * Live modifier state. Only meaningful while a key event is in flight; the
   * values reset on blur so nothing gets stuck down.
   */
  modifiers: ModifierState;
  /**
   * How much of the platform guess is based on modern signals rather than the
   * deprecated `navigator.platform` string.
   */
  confidence: "high" | "medium" | "low";
  /**
   * Always `null`: no browser API exposes the physical keyboard layout.
   * Kept explicit so consumers never assume the field is merely missing.
   */
  layout: null;
}

const detectPlatform = (): { platform: Platform; confidence: KeyboardLayoutInfo["confidence"] } => {
  if (typeof navigator === "undefined") return { platform: "unknown", confidence: "low" };

  const userAgentData = (
    navigator as Navigator & {
      userAgentData?: { platform?: string };
    }
  ).userAgentData;
  const uaDataPlatform = userAgentData?.platform?.toLowerCase();

  const ua = navigator.userAgent.toLowerCase();
  const legacy = (navigator.platform ?? "").toLowerCase();

  const decide = (value: string): Platform | null => {
    if (!value) return null;
    if (
      value.includes("mac") ||
      value.includes("iphone") ||
      value.includes("ipad") ||
      value.includes("ipod")
    ) {
      return value.includes("iphone") || value.includes("ipad") || value.includes("ipod") ? "ios" : "macos";
    }
    if (value.includes("win")) return "windows";
    if (value.includes("android")) return "android";
    if (value.includes("linux") || value.includes("x11")) return "linux";
    return null;
  };

  const fromUaData = decide(uaDataPlatform ?? "");
  if (fromUaData) return { platform: fromUaData, confidence: "high" };

  const fromUa = decide(ua);
  if (fromUa) return { platform: fromUa, confidence: "medium" };

  const fromLegacy = decide(legacy);
  if (fromLegacy) return { platform: fromLegacy, confidence: "low" };

  return { platform: "unknown", confidence: "low" };
};

const emptyModifiers: ModifierState = { shift: false, control: false, alt: false, meta: false };

export const useKeyboardLayout = (): KeyboardLayoutInfo => {
  const [{ platform, confidence }] = useState(detectPlatform);
  const [modifiers, setModifiers] = useState<ModifierState>(emptyModifiers);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      setModifiers({
        shift: event.shiftKey,
        control: event.ctrlKey,
        alt: event.altKey,
        meta: event.metaKey,
      });
    };
    const reset = () => setModifiers(emptyModifiers);

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", reset);
    };
  }, []);

  const isMac = platform === "macos" || platform === "ios";
  const timeZone =
    typeof Intl !== "undefined" ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC") : "UTC";

  return {
    platform,
    isMac,
    isWindows: platform === "windows",
    isLinux: platform === "linux",
    isIOS: platform === "ios",
    isAndroid: platform === "android",
    modifierKey: isMac ? "Meta" : "Control",
    modifierSymbol: isMac ? "⌘" : "Ctrl",
    language: typeof navigator !== "undefined" ? navigator.language : "en",
    languages: typeof navigator !== "undefined" && navigator.languages ? [...navigator.languages] : [],
    timeZone,
    timeZoneOffset: -new Date().getTimezoneOffset() / 60,
    modifiers,
    confidence,
    layout: null,
  };
};
