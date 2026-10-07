import { Item, Layout } from "@nashiuso/rewap";

const panels = [
  { id: "revenue", title: "Revenue", body: "84,120 EUR this month" },
  { id: "traffic", title: "Traffic", body: "18,402 sessions" },
  { id: "orders", title: "Orders", body: "312 open" },
  { id: "notes", title: "Notes", body: "Four items, one layout." },
];

export const App = () => (
  <main className="page">
    <header className="page__head">
      <h1>__NAME__</h1>
      <p>Drag a panel, or tab to one and press Space. The order is kept locally.</p>
    </header>

    <Layout
      mode="swap"
      gap={12}
      persistence={{ key: "starter-layout", storage: "localStorage" }}
      label="Dashboard panels"
    >
      {panels.map((panel) => (
        <Item key={panel.id} id={panel.id} className="panel">
          <h2>{panel.title}</h2>
          <p>{panel.body}</p>
        </Item>
      ))}
    </Layout>
  </main>
);
