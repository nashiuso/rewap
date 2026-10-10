/**
 * `<Item>` — a draggable element inside a `<Layout>`.
 *
 * The item registers itself with its layout on mount (id, element, label) and
 * forwards keyboard interaction to the shared engine, so a keyboard drag and a
 * pointer drag are the same drag as far as the rest of the system is concerned.
 *
 * `<Item.Handle />` is optional: drop one inside an item and the item switches to
 * handle-only dragging automatically, which is the right default when the item
 * contains buttons, inputs or links.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ElementType,
  type ForwardedRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect";

import {
  ariaKeyShortcuts,
  directionFromKey,
  grabInstructions,
  isCancelKey,
  isGrabKey,
} from "../accessibility";
import type { EffectsOptions, ItemId, LayoutMode } from "../core/types";
import { resolveMotion, type MotionValue } from "../motion/presets";

import { useLayoutContext } from "./context";
import { elementStateFor, type ElementStateController } from "./elementState";

export interface ItemProps extends Omit<HTMLAttributes<HTMLDivElement>, "id"> {
  id: ItemId;
  children?: ReactNode;
  /** Allows the item to be dragged. Defaults to `true`. */
  draggable?: boolean;
  disabled?: boolean;
  /**
   * Requires the pointer to start on an `<Item.Handle />`.
   * Detected automatically when a handle is present.
   */
  handleOnly?: boolean;
  /** Accessible name; derived from `aria-label` or the item's text when omitted. */
  label?: string;
  /** Per-item visual effects, merged over the layout's `effects`. */
  effects?: EffectsOptions;
  /** Per-item motion, overriding the layout's `motion`. */
  motion?: MotionValue;
  /** Spans for `grid` mode, applied as `grid-column`/`grid-row`. */
  columnSpan?: number;
  rowSpan?: number;
  as?: ElementType;
}

const fallbackLabel = (element: HTMLElement, index: number): string => {
  const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (text.length > 0) return text.length > 64 ? `${text.slice(0, 61)}…` : text;
  return `item ${index + 1}`;
};

const hasOwnHandle = (element: HTMLElement): boolean => {
  const handles = element.querySelectorAll<HTMLElement>("[data-rewap-handle]");
  for (const handle of handles) {
    if (handle.closest("[data-rewap-item]") === element) return true;
  }
  return false;
};

const ItemImpl = (
  props: ItemProps,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) => {
  const {
    id,
    children,
    draggable = true,
    disabled = false,
    handleOnly,
    label,
    effects,
    motion,
    columnSpan,
    rowSpan,
    as: Component = "div",
    className,
    style,
    onKeyDown,
    onFocus,
    onBlur,
    onPointerEnter,
    onPointerLeave,
    ...rest
  } = props;

  const context = useLayoutContext("<Item>");
  const elementRef = useRef<HTMLDivElement | null>(null);
  const index = context.renderIds.indexOf(id);
  const active = context.isActive(id);
  const nodeRef = useRef<ElementStateController | null>(null);
  const [detectedHandleOnly, setDetectedHandleOnly] = useState(false);

  const mergedEffects = useMemo<EffectsOptions>(
    () => ({ ...context.effects, ...effects }),
    [context.effects, effects],
  );
  const resolvedMotion = motion ?? context.motion;
  const plan = useMemo(
    () =>
      resolveMotion(resolvedMotion, {
        prefersReducedMotion: context.prefersReducedMotion,
      }),
    [resolvedMotion, context.prefersReducedMotion],
  );

  // ------------------------------------------------------------------ registry
  // `registerItem` comes from the layout context, whose identity changes on every
  // published snapshot (including while this very item is dragged). Reading it
  // through a ref keeps the registration effect keyed on the item's own props:
  // depending on the context object would re-register on every snapshot, which
  // schedules a state update from a layout effect and never settles.
  const registerItemRef = useRef(context.registerItem);
  registerItemRef.current = context.registerItem;

  useIsomorphicLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const ownsHandle = hasOwnHandle(element);
    setDetectedHandleOnly((previous) =>
      previous === ownsHandle ? previous : ownsHandle,
    );
    const resolvedHandleOnly = handleOnly ?? ownsHandle;
    const accessibleLabel =
      label ??
      element.getAttribute("aria-label") ??
      fallbackLabel(element, index);
    return registerItemRef.current(id, {
      label: accessibleLabel,
      element,
      handleOnly: resolvedHandleOnly,
      draggable,
      disabled,
    });
    // Re-registering keeps the meta in sync with the props that affect dragging.
  }, [draggable, disabled, handleOnly, id, index, label]);

  useEffect(() => {
    if (!active) return;
    const element = elementRef.current;
    const resolvedHandleOnly =
      handleOnly ?? (element ? hasOwnHandle(element) : false);
    if (!resolvedHandleOnly && !disabled && draggable) {
      element?.focus({ preventScroll: true });
    }
  }, [active, disabled, draggable, handleOnly]);

  // ------------------------------------------------------------------ effects
  const hoverLift =
    mergedEffects.hover === "lift" || mergedEffects.hover === "raise";
  const liftAmount = mergedEffects.hover === "raise" ? -8 : -4;
  const liftElevation = mergedEffects.hover === "raise" ? 0.6 : 0.35;

  const handlePointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      onPointerEnter?.(event);
      if (!hoverLift || disabled || active || event.pointerType === "touch")
        return;
      const element = elementRef.current;
      if (!element) return;
      const node = nodeRef.current ?? elementStateFor(element);
      nodeRef.current = node;
      node.animate({ y: liftAmount, elevation: liftElevation }, plan);
    },
    [
      active,
      disabled,
      hoverLift,
      liftAmount,
      liftElevation,
      onPointerEnter,
      plan,
    ],
  );

  const handlePointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(event);
      if (!hoverLift || active) return;
      const node = nodeRef.current;
      if (!node) return;
      node.animate({ y: 0, elevation: 0 }, plan);
    },
    [active, hoverLift, onPointerLeave, plan],
  );

  // ----------------------------------------------------------------- keyboard
  const focusSibling = useCallback(
    (delta: number) => {
      const order = context.renderIds;
      const current = order.indexOf(id);
      if (current === -1) return;
      const next = order[current + delta];
      if (!next) return;
      context.registry.get(next)?.element?.focus({ preventScroll: false });
    },
    [context, id],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || disabled || !draggable) return;
      if (context.disabled || !context.keyboardEnabled) return;

      const activeId = context.snapshot.activeId;
      const isGrabbed = activeId === id;

      if (isGrabKey(event.key)) {
        event.preventDefault();
        if (isGrabbed) context.controller.drop();
        else if (!activeId) context.grab(id);
        return;
      }

      if (isCancelKey(event.key)) {
        if (!isGrabbed) return;
        event.preventDefault();
        context.controller.cancel("escape");
        context.announce("Drag cancelled.", "polite");
        return;
      }

      const direction = directionFromKey(event.key);
      if (!direction) return;

      if (isGrabbed) {
        event.preventDefault();
        const moved = context.controller.moveInDirection(direction, {
          large: event.shiftKey,
          source: "keyboard",
        });
        if (!moved && (direction === "up" || direction === "down")) {
          // Nothing to move into: keep focus navigation useful instead.
          focusSibling(direction === "up" ? -1 : 1);
        }
        return;
      }

      // Not grabbed: arrows move focus, Home/End jump to the ends of the list.
      if (direction === "up" || direction === "down") {
        event.preventDefault();
        focusSibling(direction === "up" ? -1 : 1);
        return;
      }
      if (direction === "first" || direction === "last") {
        event.preventDefault();
        const target =
          direction === "first"
            ? context.renderIds[0]
            : context.renderIds[context.renderIds.length - 1];
        if (target)
          context.registry
            .get(target)
            ?.element?.focus({ preventScroll: false });
      }
    },
    [context, disabled, draggable, focusSibling, id, onKeyDown],
  );

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      onFocus?.(event);
      context.setFocusId(id);
    },
    [context, id, onFocus],
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      onBlur?.(event);
      if (context.focusId === id) context.setFocusId(null);
    },
    [context, id, onBlur],
  );

  const helpId = `${id.replace(/[^a-zA-Z0-9_-]/g, "-")}-rw-help`;

  const assignRef = useCallback(
    (node: HTMLDivElement | null) => {
      elementRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef)
        (
          forwardedRef as React.MutableRefObject<HTMLDivElement | null>
        ).current = node;
    },
    [forwardedRef],
  );

  // With a handle, the item itself stays scrollable on touch and only the handle
  // captures the gesture — which is what mobile users expect.
  const handleOnlyResolved = handleOnly ?? detectedHandleOnly;
  const touchAction = handleOnlyResolved
    ? "auto"
    : disabled || !draggable
      ? "auto"
      : "none";

  const gridStyle: CSSProperties = {
    ...(columnSpan ? { gridColumn: `span ${columnSpan}` } : {}),
    ...(rowSpan ? { gridRow: `span ${rowSpan}` } : {}),
  };

  return (
    <Component
      {...rest}
      ref={assignRef}
      className={className ? `rw-item ${className}` : "rw-item"}
      data-rewap-item={id}
      data-rewap-index={index}
      {...(active ? { "data-rewap-active": "" } : {})}
      {...(disabled ? { "data-rewap-disabled": "" } : {})}
      {...(!draggable ? { "data-rewap-static": "" } : {})}
      role={rest.role ?? "listitem"}
      tabIndex={disabled || !draggable ? undefined : (rest.tabIndex ?? 0)}
      aria-roledescription="draggable item"
      aria-keyshortcuts={disabled || !draggable ? undefined : ariaKeyShortcuts}
      // The item describes its own interaction, and switches to the "grabbed"
      // wording while it is being moved with the keyboard.
      aria-describedby={
        [rest["aria-describedby"], helpId]
          .filter((value) => typeof value === "string" && value.length > 0)
          .join(" ") || undefined
      }
      aria-label={label ?? rest["aria-label"]}
      style={{
        touchAction,
        ...gridStyle,
        ...style,
      }}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {children}
      <span className="rw-visually-hidden" id={helpId}>
        {grabInstructions(active)}
      </span>
    </Component>
  );
};

export const Item = forwardRef(ItemImpl) as unknown as ((
  props: ItemProps & { ref?: ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof ItemImpl>) & {
  Handle: typeof ItemHandle;
};

/** The default handle icon: six dots, drawn inline so nothing is fetched. */
const GripIcon = () => (
  <svg
    width="10"
    height="16"
    viewBox="0 0 10 16"
    aria-hidden="true"
    focusable="false"
  >
    <g fill="currentColor">
      <circle cx="2" cy="3" r="1.15" />
      <circle cx="8" cy="3" r="1.15" />
      <circle cx="2" cy="8" r="1.15" />
      <circle cx="8" cy="8" r="1.15" />
      <circle cx="2" cy="13" r="1.15" />
      <circle cx="8" cy="13" r="1.15" />
    </g>
  </svg>
);

export interface ItemHandleProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  children?: ReactNode;
  /** Accessible name for the handle; omit when rendering a decorative icon only. */
  label?: string;
  as?: ElementType;
}

const ItemHandleImpl = (
  props: ItemHandleProps,
  forwardedRef: ForwardedRef<HTMLButtonElement>,
) => {
  const {
    children,
    label,
    as: Component = "button",
    className,
    style,
    ...rest
  } = props;
  // `label` is the documented prop, but an `aria-label` passed straight through is
  // an easy thing to write and was previously swallowed by the line below. It is
  // honoured instead of dropped: silently ignoring an accessibility attribute is
  // the one kind of prop forwarding this component should not get wrong.
  const ariaLabel =
    label ??
    (typeof rest["aria-label"] === "string" ? rest["aria-label"] : undefined);
  delete rest["aria-label"];
  const decorative = children === undefined && !ariaLabel;
  return (
    <Component
      {...rest}
      ref={forwardedRef}
      type={Component === "button" ? "button" : undefined}
      data-rewap-handle=""
      tabIndex={-1}
      className={className ? `rw-handle ${className}` : "rw-handle"}
      aria-hidden={decorative ? true : undefined}
      aria-label={ariaLabel}
      style={{ touchAction: "none", ...style }}
    >
      {children ?? <GripIcon />}
    </Component>
  );
};

const ItemHandle = forwardRef(ItemHandleImpl) as (
  props: ItemHandleProps & { ref?: ForwardedRef<HTMLButtonElement> },
) => ReturnType<typeof ItemHandleImpl>;

Item.Handle = ItemHandle;

/** Re-exported so `Item.Handle` can be referenced before the assignment in types. */
export { ItemHandle };

export type { LayoutMode, ItemId };
export { grabInstructions };
