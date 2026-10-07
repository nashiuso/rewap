# Keyboard

Everything a pointer can do, a keyboard can do, with the same results. The keyboard
path drives the same drag controller, so a keyboard reorder produces the same
`onSwap` payloads as a mouse drag.

| Key                                      | Action                                          |
| ---------------------------------------- | ----------------------------------------------- |
| `Tab`                                    | Move focus between items                        |
| `Space` / `Enter`                        | Grab the focused item, or drop a grabbed one    |
| Arrow keys                               | Move a grabbed item; without a grab, move focus |
| `Shift` + Arrow                          | Move three slots at once (`largeStep`)          |
| `Home` / `End`                           | Jump to the first or last slot                  |
| `Escape`                                 | Cancel and return the item                      |
| `Cmd/Ctrl + Z`                           | Undo                                            |
| `Cmd/Ctrl + Shift + Z`, `Ctrl + Y`       | Redo                                            |
| `ArrowUp` / `ArrowDown` when not grabbed | Move focus, so the list stays navigable         |

```tsx
<Layout keyboard={{ step: 1, largeStep: 3 }}>   // the defaults
<Layout keyboard={false}>                        // disable entirely
```

Items that are `disabled` or `draggable={false}` are not focusable and do not
advertise shortcuts.

## What moving does per mode

- **`reorder`**: an arrow moves the item one slot; `Shift` + arrow moves three.
  `Home` and `End` are absolute — the item goes to the first or last position and the
  items in between shift.
- **`swap`**: an arrow exchanges the item with its neighbour; `Shift` + arrow
  exchanges it with the item three slots away. `Home` and `End` exchange with the
  first or last item.

These two are not the same gesture in different clothing, and the difference is
worth testing in your own application before shipping a keyboard-first screen.

> **Why is `Shift` three slots?**
> Because one slot at a time is slow on a long board and there is no modifier that
> means "faster" more obviously. It is configurable (`largeStep`), and the number is
> documented rather than internal for exactly this reason — someone will want five.

## Focus and announcements

- Grabbing focuses the item, so the browser's focus ring shows what is being moved.
- After a drop, focus stays on the item in its new position.
- A grab is announced assertively ("Weather grabbed. Use arrow keys to move, Enter to
  drop, Escape to cancel.") because it is a state change the user triggered.
- Moves are announced politely ("Weather moved to position 2"), so a screen reader
  does not interrupt itself while an item travels several slots.
- Cancelling announces "Drag cancelled."

The live region is created when the first announcement happens and removed when the
layout unmounts, so a page that never drags anything does not grow an extra node.

## Programmatic equivalent

```tsx
const api = useLayout();
api.grab("weather"); // starts a keyboard-style drag and focuses the item
api.move("weather", 2);
api.release(); // commits
api.cancel(); // returns it
```

`grab` exists so a custom control — a "move up" button in a toolbar, a command
palette — can start a drag without synthesising key events.
