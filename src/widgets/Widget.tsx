/**
 * Widget shell primitives.
 *
 * Every widget in this entry point is built from these three components, and they
 * are exported so an application can build its own widgets in the same visual
 * language without copying styles.
 */

import type { CSSProperties, ReactNode } from "react";

export interface WidgetProps {
  title: string;
  /** Right-aligned technical detail, usually a timestamp or a reason. */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Use a `<section>` (default) or render into an existing container. */
  as?: "section" | "div" | "article";
}

export const Widget = ({
  title,
  meta,
  children,
  className,
  style,
  as: Component = "section",
}: WidgetProps) => (
  <Component
    className={className ? `rw-widget ${className}` : "rw-widget"}
    data-rewap-widget=""
    style={style}
  >
    <header className="rw-widget__header">
      <h3 className="rw-widget__title">{title}</h3>
      {meta !== undefined ? <span className="rw-widget__meta">{meta}</span> : null}
    </header>
    {children}
  </Component>
);

export interface WidgetValueProps {
  children: ReactNode;
  /** Unit rendered after the value in a smaller size. */
  unit?: string;
  muted?: boolean;
}

export const WidgetValue = ({ children, unit, muted }: WidgetValueProps) => (
  <div className={muted ? "rw-widget__value rw-widget__value--muted" : "rw-widget__value"}>
    {children}
    {unit ? <span className="rw-widget__unit">{unit}</span> : null}
  </div>
);

export interface WidgetRowProps {
  label: string;
  value: ReactNode;
  title?: string;
}

export const WidgetRow = ({ label, value, title }: WidgetRowProps) => (
  <div className="rw-widget__row" title={title}>
    <span className="rw-widget__row-label">{label}</span>
    <span className="rw-widget__row-value">{value}</span>
  </div>
);

export interface WidgetRowsProps {
  children: ReactNode;
}

export const WidgetRows = ({ children }: WidgetRowsProps) => (
  <div className="rw-widget__rows">{children}</div>
);

export type WidgetTone = "accent" | "positive" | "caution" | "negative" | "neutral";

export interface WidgetStateProps {
  tone?: WidgetTone;
  children: ReactNode;
}

/** A dot plus a short status phrase, for loading/unsupported/error states. */
export const WidgetState = ({ tone = "neutral", children }: WidgetStateProps) => (
  <span className="rw-widget__state">
    <span className="rw-widget__dot" data-state={tone} />
    {children}
  </span>
);

export interface WidgetBarProps {
  /** `0..1` */
  value: number;
  tone?: WidgetTone;
  label?: string;
}

export const WidgetBar = ({ value, tone = "accent", label }: WidgetBarProps) => {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      className="rw-widget__bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <span
        className="rw-widget__bar-fill"
        style={{
          width: `${clamped * 100}%`,
          background: `var(--rw-${tone === "neutral" ? "text-faint" : tone})`,
        }}
      />
    </div>
  );
};

export const WidgetNote = ({ children }: { children: ReactNode }) => (
  <p className="rw-widget__note">{children}</p>
);

export const WidgetError = ({ children }: { children: ReactNode }) => (
  <p className="rw-widget__error">{children}</p>
);
