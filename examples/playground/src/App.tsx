import { useMemo, useState } from "react";
import { Item, Layout, type LayoutMode } from "@nashiuso/rewap";
import "@nashiuso/rewap/styles.css";
import "@nashiuso/rewap/widgets.css";
import {
  StatsWidget,
  NetworkWidget,
  WeatherWidget,
  ClockWidget,
  ViewportWidget,
} from "@nashiuso/rewap/widgets";
import {
  activityLog,
  barcelonaWeather,
  createFixtureWeatherProvider,
  latencySeries,
} from "./fixtures";
import { CodePanel } from "./CodePanel";
import "./app.css";

type MotionName = "smooth" | "snappy" | "soft" | "instant";

const MODES: { value: LayoutMode; label: string; hint: string }[] = [
  {
    value: "swap",
    label: "Swap",
    hint: "dragging one tile exchanges it with another",
  },
  { value: "reorder", label: "Reorder", hint: "dragging shifts a whole range" },
  { value: "grid", label: "Grid", hint: "tiles can span multiple columns" },
];

const MOTIONS: MotionName[] = ["smooth", "snappy", "soft", "instant"];

const weatherProvider = createFixtureWeatherProvider(barcelonaWeather);

const PANELS = [
  "weather",
  "stats",
  "activity",
  "network",
  "clock",
  "viewport",
] as const;
type PanelId = (typeof PANELS)[number];

const PANEL_SPAN: Partial<Record<PanelId, number>> = {
  activity: 2,
};

export default function App() {
  const [mode, setMode] = useState<LayoutMode>("swap");
  const [motion, setMotion] = useState<MotionName>("smooth");
  const [lastSwap, setLastSwap] = useState<string | null>(null);

  const code = useMemo(
    () =>
      `<Layout\n  mode="${mode}"\n  motion="${motion}"\n  placeholder="outline"\n>`,
    [mode, motion],
  );

  return (
    <div className="pg rw-scope">
      <header className="pg-header">
        <div>
          <p className="pg-eyebrow">Rewap · playground</p>
          <h1>Drag anything below.</h1>
          <p className="pg-sub">
            Local fixture data, no network calls. Built from the package in this
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
        label="Playground panels"
        minColumnWidth={260}
        gap={14}
        onSwap={(event) =>
          setLastSwap(`${event.item} -> slot ${event.nextSlot}`)
        }
        className="pg-board"
      >
        {PANELS.map((id) => (
          <Item
            key={id}
            id={id}
            columnSpan={mode === "grid" ? PANEL_SPAN[id] : undefined}
          >
            {renderPanel(id)}
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

function renderPanel(id: PanelId) {
  switch (id) {
    case "weather":
      return (
        <WeatherWidget
          provider={weatherProvider}
          coordinates={{ latitude: 41.39, longitude: 2.17 }}
        />
      );
    case "stats":
      return (
        <StatsWidget
          title="Request latency"
          values={latencySeries}
          unit="ms"
          precision={0}
        />
      );
    case "activity":
      return (
        <section className="rw-widget pg-activity">
          <header className="rw-widget__header">
            <h3 className="rw-widget__title">Activity</h3>
          </header>
          <ul className="pg-activity__list">
            {activityLog.map((entry) => (
              <li key={entry.id}>
                <span className="pg-activity__label">{entry.label}</span>
                <span className="pg-activity__detail">{entry.detail}</span>
                <span className="pg-activity__time">{entry.time}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    case "network":
      return <NetworkWidget />;
    case "clock":
      return <ClockWidget />;
    case "viewport":
      return <ViewportWidget />;
    default:
      return null;
  }
}
