# Examples

Two things live in `examples/`, both built from the package in this repository (not
a published release), with no CDN and no remote assets.

```bash
npm install
npm run examples:dev   # playground -> :5173
```

## Playground

`examples/playground` is one app, not a gallery: a dashboard of six widgets
(weather, stats, activity log, network, clock, viewport) you can switch between
`swap`, `reorder` and `grid` modes, try the four motion presets
(`smooth`/`snappy`/`soft`/`instant`), and watch a live code panel update to match
whatever you picked. Data is local fixtures — no network call happens, including
the weather panel, which reads from `createFixtureWeatherProvider` instead of a
real `createOpenMeteoProvider`.

```tsx
<Layout mode={mode} motion={motion} placeholder="outline">
  <Item id="weather">
    <WeatherWidget data={barcelonaWeather} />
  </Item>
  <Item id="activity" columnSpan={2}>
    <StatsWidget entries={activityLog} />
  </Item>
  {/* … */}
</Layout>
```

It is the fastest way to feel the difference between the three modes without
writing any code.

## Astro (SSR)

`examples/astro` is a minimal Astro site proving the React bindings hydrate
correctly under Astro's partial-hydration model — `client:visible` and
`client:load` both render the authored order on the server and become
interactive in the browser without a mismatch warning. See
[Astro and SSR](astro.html) for the integration itself; the example is the
smallest page that exercises it.

```bash
cd examples/astro
npm install
npm run build   # also proves it builds outside this repo's own tooling
```

## What the examples are not

They are not a component library, a design system or a gallery of starter
templates. If you are looking for more worked scenarios — kanban, analytics,
a statistics dashboard — the patterns are documented in
[Layout](layout.html), [Items](items.html), [Charts](charts.html) and
[Widgets](widgets.html); building eight separate example apps for them did not
make the library easier to use, so it was cut in favor of getting one example
right and keeping it honest about what actually runs in CI.
