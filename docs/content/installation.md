# Installation

```bash
npm install @nashiuso/rewap
```

React 18 or newer is a peer dependency. That is the entire runtime requirement:
no animation library, no utility belt, no icon package.

## Imports

Everything ships in one package behind separate entry points, so an application
that only needs drag and swap does not load a chart renderer.

```tsx
import { Item, Layout, useLayout } from "@nashiuso/rewap";
import { clampPoints, movingAverage } from "@nashiuso/rewap/math";
import { stepSpring } from "@nashiuso/rewap/motion";
import { useNetworkInfo } from "@nashiuso/rewap/utilities";
import { createOpenMeteoProvider } from "@nashiuso/rewap/providers";
import { Chart } from "@nashiuso/rewap/charts";
import { StatsWidget } from "@nashiuso/rewap/widgets";

import "@nashiuso/rewap/styles.css";
```

## Styles

The stylesheet is optional. Without it, everything still works — items move, the
placeholder exists, the drag preview is positioned — but the visual polish (cursor,
touch handling, the outline placeholder, the widget frame) is missing.

```tsx
import "@nashiuso/rewap/styles.css"; // core: tokens + layout + placeholder
import "@nashiuso/rewap/tokens.css"; // just the custom properties
import "@nashiuso/rewap/charts.css"; // only if you use charts
import "@nashiuso/rewap/widgets.css"; // only if you use widgets
```

There is no global reset. The rules are scoped to `rw-*` classes; the tokens are
custom properties on `:root`, and everything reads them with a fallback, so a page
can override any of them without knowing the library's internals.

## Frameworks and bundlers

Anything that understands `exports` in `package.json` works: Vite, Next.js,
Remix, Parcel, esbuild, webpack 5. Both ESM and CJS builds are shipped, with type
declarations for each.

```tsx
// Next.js App Router: the layout needs a browser, so keep it in a client component.
"use client";
import { Item, Layout } from "@nashiuso/rewap";
```

Server rendering is supported. Nothing touches the DOM during render; measurement
happens in effects, and the first client render matches the server output.

## No network at runtime

The library never fetches its own code, fonts, icons or configuration. Internal
imports are relative, the styles are plain CSS, and the default entry point has no
dynamic `import()`. Two consequences worth knowing:

- Nothing breaks offline, in an air-gapped environment, or behind a strict
  Content-Security-Policy.
- If a page using rewap talks to the network, it is because the application created
  a provider and called it. The library itself will not.
