# FAQ

**Is this Swapy?**

No. Rewap is a React library written from scratch, with its own engine, its own
accessibility work and its own utilities. The concept — give items ids, let the user
drag them, get the new order back — is the same idea, and that idea is not
copyrightable. No Swapy code, class names, naming conventions or branding ended up in
this repository, and the architecture here is deliberately different: React bindings
over a framework-agnostic core, slots rather than indices, and a keyboard path in the
core rather than on top.

**Why is the version 1.1.1?**

Because that is where it is. 1.0.0 was the first published engine, 1.1.0 added the
motion layer and the projection rewrite, 1.1.1 is the current stabilisation release.
The version moves when the code moves, not to signal ambition.

**Does anything leave the browser?**

Only what you write. The library makes no network requests of its own: no update
check, no telemetry, no font fetch, no remote configuration, no CDN at runtime. The
CSS is a local file and the fonts used by the documentation site are shipped in this
repository.

Anything that does reach the network — a weather API, an email verifier — lives in
`@nashiuso/rewap/providers`, and every one of those requires an endpoint or an action
from you before it can do anything.

**Why do slots instead of indices?**

Because an index is a number and a slot is a description. A slot knows its row, its
column, its measured rectangle and its place in reading order, which is everything
the engine needs to decide where a dragged item will land. Indices are a projection of
that, computed at the edge and only when an event needs one.

In practice the difference shows up in `grid` mode, where index arithmetic stops
working the moment the column count changes.

**Can I drag an item between two different `<Layout>`s?**

Not in 1.1.1, and not by accident. Cross-layout dragging needs a shared session, a
shared measurement pass and a decision about ownership of the order — a feature worth
designing properly rather than bolting on. `docs/known-limitations.md` says what the
current behaviour is (the drag stays inside its layout).

**Does it work with server rendering?**

The modules import nothing that touches `window` at import time, and the components
render on the server. Measurement and drag can only start in the browser, so a
server-rendered page paints the authored order and hydrates from there. Persistence
is read in an effect, which means the first paint can differ from the hydrated one —
if that matters to your page, render skeletons until mount.

React 18 and newer are supported (`>=18.0.0` in `peerDependencies`).

**StrictMode?**

Yes. Double-invoked effects are handled: measurement is idempotent, persistence
hydrates once per key, and the drag is a subscription that unsubscripts cleanly.

**Do I need TypeScript?**

No, but you get it either way. Types ship with the package and every public option is
documented on its type.

**Do I need Tailwind, styled-components or a CSS framework?**

No, and the library does not include one. `<Layout>` and `<Item>` render plain
divs with stable class names (`rw-layout`, `rw-item`, `rw-placeholder`) and CSS custom
properties, so plain CSS, CSS Modules, SCSS, Tailwind or CSS-in-JS all work. There is
no global reset and nothing is applied to elements outside the components.

**How do I save the order to my own backend?**

Turn `persistence` off and control the order yourself:

```tsx
const [items, setItems] = useState(initial);
// …
<Layout
  items={items}
  onChange={(next) => {
    setItems(next);
    save(next);
  }}
/>;
```

The library never writes to storage for a controlled layout — that is enforced, with a
development warning if the two are combined.

**Can I drag with my own toolbar buttons?**

Yes. `api.grab(id)`, `api.move(id, index)`, `api.release()` and `api.cancel()` are the
same path the keyboard uses, so buttons, a command palette, or an "arrange" mode all
work without synthesising pointer events.

**Why is `layout` always `null` in `useKeyboardLayout()`?**

Because a page cannot read the keyboard layout. The Web Keyboard API exposes
`getLayoutMap()` only inside a keyboard-locked element, and nothing else comes close.
Reporting a guess would be worse than reporting nothing, so the field is explicitly
`null` and the rest of the hook (platform, modifiers, language) reports only what is
genuinely available.

**Why is there no CPU temperature?**

No browser exposes CPU temperature to a web page. `usePerformance()` returns
`cpuTemperature: { supported: false, reason }` instead of a plausible-looking number.

**Why does the battery widget say "unsupported"?**

Because the Battery Status API is Chromium-only, and only in some contexts. The widget
renders the reason rather than an empty bar.

**Is there a `theme` prop?**

No, and there will not be. Theming is CSS custom properties — `--rw-accent`,
`--rw-radius`, `--rw-gap`, and so on — which work with every styling approach and do
not require the library to know about your design system. See
[the design notes](design/api.html).

**Why 40 pixels of snap, and 4 pixels of drag threshold?**

Both are guesses that turned out to feel right: 4 px is below the wobble of a click
but above the jitter of a shaky hand, and 40 px keeps the "it is going to land here"
promise without tugging the item around. Both are props (`snap.threshold`,
`threshold`) precisely because taste varies.

**Can I disable motion entirely?**

Yes: `motion="instant"` on the layout or an item, or `motion={false}`. A user with
`prefers-reduced-motion: reduce` gets instant transitions automatically.

**Is there a React Native version?**

No. The core is framework-agnostic and does not depend on the DOM for its maths, but
the gestures, measurement and accessibility work are web work. A native binding would
be a separate project, not a flag on this one.

**How do I report a bug?**

Open an issue on GitHub with the smallest reproduction you can manage. See
[CONTRIBUTING.md](https://github.com/nashiuso/rewap/blob/main/CONTRIBUTING.md) for
what helps most (a failing test is ideal) and [SECURITY.md](https://github.com/nashiuso/rewap/blob/main/SECURITY.md)
for anything sensitive.
