# Persistence

The order can be remembered locally, with nothing leaving the browser.

```tsx
<Layout persistence={{ key: "dashboard", storage: "localStorage" }}>
```

| Option    | Values                                                          | Notes                                             |
| --------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `key`     | `string`                                                        | Required. The storage key.                        |
| `storage` | `"localStorage" \| "sessionStorage" \| "memory" \| StorageLike` | Defaults to `localStorage`                        |
| `enabled` | `boolean`                                                       | Set to `false` to keep the config but turn it off |

A stored record looks like this:

```json
{
  "version": 1,
  "mode": "reorder",
  "ids": ["notes", "weather", "traffic"],
  "savedAt": 1791379200000
}
```

The version field is checked on read: a record from a different version is ignored
rather than half-applied. Ids that no longer exist in the layout are dropped, and
items the record does not know about are appended in their authored position, so a
panel added in a later release appears at the end instead of disappearing.

## When it hydrates and when it writes

- **On mount**, once, before the first animation frame. The stored order replaces the
  authored one, and the history is reset to it so the first undo does not resurrect
  something older.
- **On every committed order change** after that — a drop, a keyboard move, an undo.
- **Never while the order is controlled** (`items` + `onChange`). The application
  owns the state in that case, and writing would clobber whatever it decided to keep.
  A development warning says as much.

## Storage objects

Anything with `getItem`, `setItem` and `removeItem` works, which is how the tests
run without touching the DOM storage and how a desktop shell can back it with a file:

```tsx
const storage = memoryStorage();   // exported from the core

<Layout persistence={{ key: "board", storage }}>;
```

If storage is unavailable — private mode, cookies disabled, server rendering — the
helpers degrade to an in-memory no-op instead of throwing. Data is lost on reload and
nothing crashes.

## Security

The record contains item ids and nothing else. No tokens, no user data, no
timestamps beyond the write time, and no remote calls: an application using rewap
never transmits its layout anywhere.

Two things worth knowing anyway:

- Ids are stored as written. If your ids contain user input, escape them where you
  render them — the library does not render them at all.
- `localStorage` is shared by every script on the origin. That is a property of the
  web, not of this library.

## Using the module directly

```ts
// The pair lives in the framework-agnostic engine. The root re-exports both, since
// they are what you reach for when a layout is not the right tool.
import { createPersistence, applyStoredOrder } from "@nashiuso/rewap/core";

const store = createPersistence({
  key: "board",
  storage: "sessionStorage",
  mode: "reorder",
});
const stored = store.load(); // PersistedLayout | null
store.save(["a", "b"]); // writes
store.clear(); // removes

const next = applyStoredOrder(stored?.ids ?? [], ["a", "b", "c"]); // ["…", "c"]
```
