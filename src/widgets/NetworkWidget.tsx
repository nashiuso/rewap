/**
 * `<NetworkWidget>` — online state and connection estimates.
 *
 * Fields the browser does not provide are rendered as "not available" rather than
 * as an approximation, so the widget never implies more precision than exists.
 */

import type { CSSProperties } from "react";

import { useNetworkInfo } from "../utilities/useNetworkInfo";
import {
  Widget,
  WidgetNote,
  WidgetRows,
  WidgetRow,
  WidgetState,
} from "./Widget";

export interface NetworkWidgetProps {
  title?: string;
  className?: string;
  style?: CSSProperties;
}

const toneFor = (
  quality: string,
): "positive" | "caution" | "negative" | "neutral" => {
  if (quality === "good") return "positive";
  if (quality === "fair") return "caution";
  if (quality === "poor" || quality === "offline") return "negative";
  return "neutral";
};

export const NetworkWidget = ({
  title = "Network",
  className,
  style,
}: NetworkWidgetProps) => {
  const info = useNetworkInfo();
  const unavailable = "not available in this browser";

  return (
    <Widget
      title={title}
      className={className}
      style={style}
      meta={info.saveData ? "data saver on" : (info.type ?? "")}
    >
      <WidgetState tone={toneFor(info.quality)}>
        {info.online ? `${info.quality} connection` : "offline"}
      </WidgetState>
      <WidgetRows>
        <WidgetRow label="Online" value={info.online ? "yes" : "no"} />
        <WidgetRow
          label="Effective type"
          value={
            info.supported.effectiveType
              ? (info.effectiveType ?? "—")
              : unavailable
          }
        />
        <WidgetRow
          label="Downlink"
          value={
            info.supported.downlink && info.downlink !== undefined
              ? `${info.downlink} Mbps`
              : unavailable
          }
        />
        <WidgetRow
          label="Round trip"
          value={
            info.supported.rtt && info.rtt !== undefined
              ? `${info.rtt} ms`
              : unavailable
          }
        />
        <WidgetRow
          label="Save data"
          value={
            info.supported.saveData && info.saveData !== undefined
              ? info.saveData
                ? "on"
                : "off"
              : unavailable
          }
        />
      </WidgetRows>
      {!info.supported.connection ? (
        <WidgetNote>
          The Network Information API is not implemented here, so only the
          online/offline flag is reported.
        </WidgetNote>
      ) : null}
    </Widget>
  );
};
