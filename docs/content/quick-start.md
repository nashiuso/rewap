# Quick start

A reorderable list in one file.

```tsx
import { Item, Layout } from "@nashiuso/rewap";
import "@nashiuso/rewap/styles.css";

const panels = [
  { id: "weather", title: "Weather" },
  { id: "traffic", title: "Traffic" },
  { id: "notes", title: "Notes" },
];

export const Dashboard = () => (
  <Layout mode="reorder" placeholder="outline" label="Dashboard panels">
    {panels.map((panel) => (
      <Item key={panel.id} id={panel.id} label={panel.title}>
        <article className="panel">
          <h2>{panel.title}</h2>
          <p>Drag me with a pointer, or focus me and press Space.</p>
        </article>
      </Item>
    ))}
  </Layout>
);
```

Try it: drag a panel, press `Space` then `ArrowDown` then `Enter`, undo with
`Cmd/Ctrl+Z`.

## Reacting to a drop

```tsx
const [order, setOrder] = useState(panels);

<Layout mode="reorder" items={order} onChange={(next) => setOrder(next)}>
  {order.map((panel) => (
    <Item key={panel.id} id={panel.id} label={panel.title}>
      {panel.title}
    </Item>
  ))}
</Layout>;
```

`items` plus `onChange` makes the application the owner of the order: rewap stops
writing persistence in that case, and stops assuming it can change the order on its
own. If you would rather keep the order internal and only be told about changes,
use `defaultItems` and read `onChange` without writing back.

## Remembering the order

```tsx
<Layout mode="reorder" persistence={{ key: "dashboard", storage: "localStorage" }}>
```

There is no sync service and no account. The adapter is `localStorage`,
`sessionStorage`, or any object with `getItem`/`setItem`/`removeItem` — so a test or
a desktop shell can supply its own.

## Using a grip

```tsx
<Item id="card" handleOnly>
  <Item.Handle label="Move this card" />
  <div className="card-body">
    <input placeholder="Typing here does not start a drag" />
  </div>
</Item>
```

`handleOnly` restricts dragging to the grip, and the rest of the item keeps its
normal behaviour: text stays selectable, inputs stay typeable, links stay clickable.

## Programmatic moves

```tsx
const api = useLayout();

api.move("notes", 0); // to the first slot, using the current mode
api.undo(); // one step back
api.canRedo; // boolean
```

The hook is meant for event handlers and effects; it re-reads the layout on every
render, so it does not need memoising.
