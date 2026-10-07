# Accessibility

Dragging is a pointer gesture by nature, and a library that only implements the
pointer path has not implemented dragging for everyone. Rewap ships the keyboard
path in the core, not in an add-on.

## What an item exposes

| Attribute              | Value                                                       |
| ---------------------- | ----------------------------------------------------------- |
| `role`                 | `listitem` (inherited from the layout's `list`)             |
| `aria-roledescription` | `draggable item`                                            |
| `aria-keyshortcuts`    | `Space Enter Escape ArrowUp … Home End Control+Z Meta+Z`    |
| `aria-describedby`     | hidden instructions, plus whatever you passed               |
| `tabindex`             | `0` for draggable items, absent for disabled or static ones |
| `aria-label`           | your `label`, or the item's text as a fallback              |

The instructions element is a hidden `<span>` inside the item. It changes while the
item is grabbed, so the same element describes both "Press Space to grab" and
"Grabbed. Use the arrow keys to move".

## Announcements

| Event              | Priority  | Message                                                                     |
| ------------------ | --------- | --------------------------------------------------------------------------- |
| Grab               | assertive | `Weather grabbed. Use arrow keys to move, Enter to drop, Escape to cancel.` |
| Destination change | polite    | `Weather moved to position 2`                                               |
| Cancel             | polite    | `Drag cancelled`                                                            |
| Undo / redo        | polite    | `Undo. 4 items.`                                                            |

Two live regions, one per priority, created lazily on first use. Polite
announcements go to a `role="status"` node and assertive ones to a `role="alert"`
node, so a polite message is not swallowed by an assertive one arriving right after.

```tsx
const api = useLayout();
api.announce("Saved", "polite");
```

## Focus

- Grabbing focuses the item, so the focus ring shows what is moving.
- Moving with the keyboard keeps focus on the item.
- Dropping leaves focus on the item in its new position.
- Arrows move focus between items when nothing is grabbed — with `Home` and `End`
  jumping to the ends — so the list is navigable without a grab at all.

## Reduced motion

`prefers-reduced-motion: reduce` resolves every motion plan to a single instant
step. Layout changes still happen; they just do not travel. See
[Motion](motion.html) for the one opt-out and why to use it rarely.

## Colour and contrast

The stylesheet uses CSS custom properties and no colours of its own beyond the
tokens, so contrast is yours to control. The default dark tokens keep text above
4.5:1 against their backgrounds, and the placeholder uses a dashed outline rather
than a translucent fill precisely so it is visible on any background.

## Charts and data

`<Chart>` renders `role="img"` with a generated (or given) label, marks the SVG
`aria-hidden`, and renders a visually hidden table of the underlying values. Screen
reader users get the numbers, not a description of the shape. The table covers the
first series; the label summarises the series count.

```tsx
<Chart type="line" data={values} ariaLabel="Revenue by week, 8 points" />
<Chart type="line" data={values} accessibleTable={false} />   // opt out
```

## Sharing responsibility

The library covers the parts it owns: slots, keys, announcements, focus, ARIA. It
cannot know that a card contains a chart with a label missing, or that your
placeholder colour is invisible against a brand background. The usual checklist
applies to the content you put inside an item.
