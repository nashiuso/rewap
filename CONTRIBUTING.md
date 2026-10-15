# Contributing

Issues and pull requests are welcome. Include a reproducible example with bug reports.

## Setup

- Node.js 20 or newer for the library; Node.js 22.12 or newer for the docs.
- npm and Git.

```bash
npm ci
```

## Checks

```bash
npm run ci
npm run verify:github-install
npm run site:build
```

`npm run ci` checks formatting, types, lint, unit and component tests, builds the
package, and verifies its exports. `npm run site:build` checks the docs and playground.

## Pull requests

Use a short-lived branch and open a pull request against `main`. Explain the reason
for the change and include the checks you ran. Keep unrelated changes separate.

## Code style

Use Prettier and ESLint. Add tests for changed behavior. Keep the core independent
of React and avoid adding runtime dependencies to it.
