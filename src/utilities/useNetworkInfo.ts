/**
 * `useNetworkInfo()` — what the browser actually knows about the network.
 *
 * `navigator.connection` is not implemented everywhere (Firefox and Safari do not
 * ship it), so every derived field is optional and the `supported` map says
 * exactly which ones you can trust. Nothing is estimated and nothing is sent
 * anywhere: this hook only reads local browser state.
 */

import { useEffect, useState } from "react";

export type EffectiveType = "slow-2g" | "2g" | "3g" | "4g";
export type ConnectionQuality = "offline" | "poor" | "fair" | "good" | "unknown";

export interface NetworkInfo {
  /** `navigator.onLine`, or `true` before hydration. */
  online: boolean;
  effectiveType?: EffectiveType;
  /** `"wifi"`, `"cellular"`, `"ethernet"`, … where the browser reports it. */
  type?: string;
  /** Estimated downlink in megabits per second. */
  downlink?: number;
  /** Upper bound of the downlink estimate, where available. */
  downlinkMax?: number;
  /** Estimated round-trip time in milliseconds. */
  rtt?: number;
  saveData?: boolean;
  /** Which fields this browser actually provides. */
  supported: {
    connection: boolean;
    effectiveType: boolean;
    downlink: boolean;
    rtt: boolean;
    saveData: boolean;
    type: boolean;
  };
  quality: ConnectionQuality;
}

interface NetworkInformationLike extends EventTarget {
  effectiveType?: EffectiveType;
  type?: string;
  downlink?: number;
  downlinkMax?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export const qualityFrom = (info: {
  online: boolean;
  effectiveType?: EffectiveType;
  rtt?: number;
  downlink?: number;
}): ConnectionQuality => {
  if (!info.online) return "offline";
  const type = info.effectiveType;
  if (type === "slow-2g" || type === "2g") return "poor";
  if (type === "3g") return "fair";
  if (type === "4g") return "good";
  if (info.rtt !== undefined) {
    if (info.rtt > 600) return "poor";
    if (info.rtt > 300) return "fair";
    return "good";
  }
  if (info.downlink !== undefined) {
    if (info.downlink < 0.4) return "poor";
    if (info.downlink < 1.5) return "fair";
    return "good";
  }
  return "unknown";
};

const readNetwork = (): NetworkInfo => {
  const fallback = {
    online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
    supported: {
      connection: false,
      effectiveType: false,
      downlink: false,
      rtt: false,
      saveData: false,
      type: false,
    },
  };

  if (typeof navigator === "undefined") {
    return { ...fallback, quality: qualityFrom({ online: fallback.online }) };
  }

  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!connection) {
    return { ...fallback, quality: qualityFrom({ online: fallback.online }) };
  }

  const info: NetworkInfo = {
    online: fallback.online,
    supported: {
      connection: true,
      effectiveType: connection.effectiveType !== undefined,
      downlink: connection.downlink !== undefined,
      rtt: connection.rtt !== undefined,
      saveData: connection.saveData !== undefined,
      type: connection.type !== undefined,
    },
    quality: "unknown",
    ...(connection.effectiveType !== undefined ? { effectiveType: connection.effectiveType } : {}),
    ...(connection.type !== undefined ? { type: connection.type } : {}),
    ...(connection.downlink !== undefined ? { downlink: connection.downlink } : {}),
    ...(connection.downlinkMax !== undefined ? { downlinkMax: connection.downlinkMax } : {}),
    ...(connection.rtt !== undefined ? { rtt: connection.rtt } : {}),
    ...(connection.saveData !== undefined ? { saveData: connection.saveData } : {}),
  };
  info.quality = qualityFrom(info);
  return info;
};

export const useNetworkInfo = (): NetworkInfo => {
  const [info, setInfo] = useState<NetworkInfo>(readNetwork);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
    const update = () => setInfo(readNetwork());

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    connection?.addEventListener("change", update);
    update();

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      connection?.removeEventListener("change", update);
    };
  }, []);

  return info;
};

export interface ConnectionSummary {
  online: boolean;
  quality: ConnectionQuality;
  /** Short label suitable for a badge. */
  label: string;
  effectiveType?: EffectiveType;
  saveData?: boolean;
  /** True when the Network Information API is available at all. */
  detailed: boolean;
}

const qualityLabels: Record<ConnectionQuality, string> = {
  offline: "Offline",
  poor: "Poor",
  fair: "Fair",
  good: "Good",
  unknown: "Unknown",
};

/**
 * `useConnection()` — a compact summary for dashboards.
 *
 * Built on {@link useNetworkInfo}; it adds a human label and collapses the
 * optional fields into something a widget can render without conditionals.
 */
export const useConnection = (): ConnectionSummary => {
  const info = useNetworkInfo();
  return {
    online: info.online,
    quality: info.quality,
    label: qualityLabels[info.quality],
    ...(info.effectiveType !== undefined ? { effectiveType: info.effectiveType } : {}),
    ...(info.saveData !== undefined ? { saveData: info.saveData } : {}),
    detailed: info.supported.connection,
  };
};
