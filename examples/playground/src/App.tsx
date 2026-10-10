import { useMemo, useState } from "react";
import { Item, Layout, type LayoutMode } from "@nashiuso/rewap";
import "@nashiuso/rewap/styles.css";
import { CodePanel } from "./CodePanel";
import "./app.css";

type MotionName = "smooth" | "snappy";

const MODES: { value: LayoutMode; label: string; hint: string }[] = [
  {
    value: "swap",
    label: "Swap",
    hint: "dragging one tile exchanges it with another",
  },
  { value: "reorder", label: "Reorder", hint: "dragging shifts a whole range" },
  { value: "grid", label: "Grid", hint: "tiles can span multiple columns" },
];

const MOTIONS: MotionName[] = ["smooth", "snappy"];

// Local, deterministic data — no fetches, no timers tied to the real clock.
const TILES = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
  { id: "three", label: "Three" },
  { id: "four", label: "Four" },
  { id: "five", label: "Five" },
  { id: "six", label: "Six" },
] as const;

// Grid mode is the only one with a second axis, so only it uses this.
const GRID_SPAN: Partial<Record<(typeof TILES)[number]["id"], number>> = {
  one: 2,
};

export default function App() {
  const [mode, setMode] = useState<LayoutMode>("swap");
  const [motion, setMotion] = useState<MotionName>("smooth");
  const [lastSwap, setLastSwap] = useState<string | null>(null);

  const code = useMemo(
    () => `<Layout mode="${mode}" motion="${motion}">`,
    [mode, motion],
  );

  return (
    <div className="pg rw-scope">
      <header className="pg-header">
        <div>
          <p className="pg-eyebrow">rewap · playground</p>
          <h1>Drag anything below.</h1>
          <p className="pg-sub">
            Local data, no network calls. Built from the package in this
            repository, not a published release.
          </p>
        </div>
        <a
          className="pg-github"
          href="https://github.com/nashiuso/rewap"
          target="_blank"
          rel="noreferrer"
        >
          View source
        </a>
      </header>

      <div className="pg-controls" role="group" aria-label="Layout mode">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            className={mode === m.value ? "pg-pill pg-pill--active" : "pg-pill"}
            onClick={() => setMode(m.value)}
            title={m.hint}
          >
            {m.label}
          </button>
        ))}
        <span className="pg-divider" aria-hidden="true" />
        {MOTIONS.map((m) => (
          <button
            key={m}
            type="button"
            className={motion === m ? "pg-pill pg-pill--active" : "pg-pill"}
            onClick={() => setMotion(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <Layout
        mode={mode}
        motion={motion}
        placeholder="outline"
        label="Playground tiles"
        minColumnWidth={160}
        gap={14}
        onSwap={(event) => setLastSwap(event.item)}
        className="pg-board"
      >
        {TILES.map((tile) => (
          <Item
            key={tile.id}
            id={tile.id}
            columnSpan={mode === "grid" ? GRID_SPAN[tile.id] : undefined}
          >
            <div className="pg-tile">{tile.label}</div>
          </Item>
        ))}
      </Layout>

      <div className="pg-footer">
        <CodePanel code={code} />
        <p className="pg-status">
          {lastSwap
            ? `last swap: ${lastSwap}`
            : "drag a tile to see the swap event here"}
        </p>
      </div>
    </div>
  );
}
