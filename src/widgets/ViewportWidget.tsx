/**
 * `<ViewportWidget>` — live viewport geometry.
 *
 * Useful while building responsive layouts: it reports exactly what the layout
 * engine measures, including the visual viewport height that mobile keyboards
 * change.
 */

import type { CSSProperties } from "react";

import { useViewport } from "../utilities/useViewport";
import { Widget, WidgetRows, WidgetRow, WidgetValue } from "./Widget";

export interface ViewportWidgetProps {
  title?: string;
  /** Also report scroll position. Defaults to `true`. */
  showScroll?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const ViewportWidget = ({
  title = "Viewport",
  showScroll = true,
  className,
  style,
}: ViewportWidgetProps) => {
  const viewport = useViewport();
  const keyboardInset = Math.max(0, viewport.height - viewport.visualHeight);

  return (
    <Widget
      title={title}
      className={className}
      style={style}
      meta={viewport.breakpoint}
    >
      <WidgetValue unit="px">{viewport.width}</WidgetValue>
      <WidgetRows>
        <WidgetRow label="Height" value={`${viewport.height} px`} />
        <WidgetRow
          label="Visual height"
          value={`${Math.round(viewport.visualHeight)} px`}
        />
        <WidgetRow label="Orientation" value={viewport.orientation} />
        <WidgetRow label="Device pixel ratio" value={`${viewport.dpr}×`} />
        {keyboardInset > 0 ? (
          <WidgetRow
            label="Viewport inset"
            value={`${Math.round(keyboardInset)} px`}
          />
        ) : null}
        {showScroll ? (
          <WidgetRow
            label="Scroll"
            value={`${Math.round(viewport.scrollX)}, ${Math.round(viewport.scrollY)}`}
          />
        ) : null}
      </WidgetRows>
    </Widget>
  );
};
