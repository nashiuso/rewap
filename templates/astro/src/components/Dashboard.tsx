import { Item, Layout } from "@nashiuso/rewap";

const panels = [
  { id: "revenue", title: "Revenue", value: "84,120 EUR" },
  { id: "traffic", title: "Traffic", value: "18,402 sessions" },
  { id: "orders", title: "Orders", value: "312 open" },
];

export const Dashboard = () => (
  <Layout mode="swap" gap={12} label="Dashboard panels">
    {panels.map((panel) => (
      <Item key={panel.id} id={panel.id} className="panel">
        <h2>{panel.title}</h2>
        <p>{panel.value}</p>
      </Item>
    ))}
  </Layout>
);
