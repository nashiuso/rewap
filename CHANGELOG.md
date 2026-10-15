# Changelog

## 1.1.1

### Interaction and layout

- Corrected live pointer tracking for mouse and touch input, and resolve the final drop destination synchronously on release.
- Fixed reorder and grid projection boundaries, responsive grid auto-fit columns, and undo/redo history initialization.
- Kept persistence from writing when item order is controlled.
- Preserved accessible names on `Item.Handle` and documented keyboard movement behavior.

### Charts and utilities

- Fixed histogram rendering and chart height handling for CSS lengths.
- Kept charts usable when their container temporarily measures zero and respected reduced-motion preferences.
- Stabilized weather caching when inline options are supplied.

### Tests and tooling

- Expanded keyboard, touch, persistence, accessibility and server-rendering coverage.
- Added Playwright browser tests for pointer, keyboard, reorder, reduced motion and mobile layouts.
- Consolidated documentation and playground into Astro and Starlight with client-side search.
- Verified the GitHub installation path, public module entry points, declarations and CSS exports.
- Removed the unused scaffold CLI and its templates.
