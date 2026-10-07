# Examples

Eight worked examples ship in `examples/`. They are ordinary Vite + React +
TypeScript applications — no CDN, no remote assets — and every one of them is built
in CI, so the code below is code that runs.

```bash
npm install
npm run examples:dev
```

## Dashboard

Panels of different sizes, `swap` mode, order remembered across reloads, and the
placeholder showing exactly where a panel will land.

```tsx
<Layout mode="swap" gap={16} persistence={{ key: "dashboard", storage: "localStorage" }}>
  <Item id="revenue">
    <RevenuePanel />
  </Item>
  <Item id="traffic">
    <TrafficPanel />
  </Item>
  <Item id="orders">
    <OrdersTable />
  </Item>
</Layout>
```

## Analytics

A metric with a `<Chart>` inside a draggable item, plus a range control. The chart
animates on data change and never renders during the drag itself.

```tsx
<Layout mode="swap" placeholder="outline">
  <Item id="latency" label="Latency chart">
    <div style={{ height: 160 }}>
      <Chart type="area" data={latencySeries} height="100%" ariaLabel="Latency, 24 hours" />
    </div>
  </Item>
</Layout>
```

## Kanban

Three columns, each a `reorder` layout, cards moving within a column. Items use
handles so a card's own controls stay clickable.

```tsx
{
  columns.map((column) => (
    <Layout key={column.id} mode="reorder">
      {column.cards.map((card) => (
        <Item key={card.id} id={card.id} handleOnly>
          <CardHeader {...card}>
            <Item.Handle aria-label="Move card" />
          </CardHeader>
          <CardBody {...card} />
        </Item>
      ))}
    </Layout>
  ));
}
```

## Widget board

The reason the widget module exists: a grid of live panels you can rearrange.

```tsx
<Layout mode="grid" columns={3} gap={12}>
  <Item id="weather">
    <WeatherWidget />
  </Item>
  <Item id="clock">
    <ClockWidget />
  </Item>
  <Item id="network">
    <NetworkWidget />
  </Item>
  <Item id="battery">
    <BatteryWidget />
  </Item>
</Layout>
```

## Statistics dashboard

Statistics and charts together: the module computes, the chart draws, an item holds
both.

```tsx
const stats = useMemo(
  () => ({
    mean: mean(samples),
    p95: percentile(samples, 95),
    deviation: standardDeviation(samples),
    fit: regression(hours, samples),
  }),
  [samples],
);
```

## Developer dashboard

Frames per second, memory, long tasks, viewport and connection — with the fields the
browser cannot provide shown as `unsupported` rather than blank.

## Mobile layout

Touch-first: `handleOnly` items, a taller drag threshold, magnetic dragging, and
`visualHeight` used so the layout follows the viewport when a keyboard opens.

```tsx
<Layout threshold={8} effects={{ drag: "magnetic", dragScale: 1.03 }}>
```

## Responsive grid

Column count from the measured width and a `ResizeObserver`, with `columnSpan` used
instead of a fixed grid, so the same board works on a phone and a wall display.

```tsx
<Layout mode="grid" columns={columns} minColumnWidth={220} gap={12}>
  <Item id="map" columnSpan={columns > 2 ? 2 : 1}>
    <MapPanel />
  </Item>
</Layout>
```

## What the examples are not

They are not a component library, a design system or a starter template. Each one is
a page that demonstrates one way to use the library, kept small enough to read in a
sitting — and each one is built and typechecked on every commit.
