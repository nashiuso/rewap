/**
 * The playground: a live Rewap board next to the example that configures it.
 *
 * Both directions stay in sync. Editing the example re-parses it and drives the
 * board; pressing a control writes the new value back into the example. If the
 * edited text does not parse, the board keeps the last configuration that did
 * and the reason is shown underneath the editor.
 *
 * The component renders entirely on the client and reaches no network. The
 * board is a real `<Layout>` from the package built in this repository, not a
 * mock, and it doubles as the browser test's subject.
 */
import { useCallback, useId, useMemo, useState } from "react";
import { Item, Layout } from "@nashiuso/rewap";
import "@nashiuso/rewap/styles.css";
import {
  COLLISION_STRATEGIES,
  defaultConfig,
  LAYOUT_MODES,
  MOTION_PRESETS,
  PLACEHOLDER_STYLES,
  serialize,
  parse,
  structureKey,
  type PlaygroundConfig,
} from "./playground/config";
import "../styles/playground.css";

const CONTROL_GROUPS = [
  { key: "mode", label: "Mode", values: LAYOUT_MODES },
  { key: "motion", label: "Motion", values: MOTION_PRESETS },
  { key: "placeholder", label: "Placeholder", values: PLACEHOLDER_STYLES },
  { key: "collision", label: "Collision", values: COLLISION_STRATEGIES },
] as const;

export default function Playground() {
  const [source, setSource] = useState(() => serialize(defaultConfig));
  const [config, setConfig] = useState<PlaygroundConfig>(defaultConfig);
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [moved, setMoved] = useState<string | null>(null);

  const exampleId = useId();
  const problemId = `${exampleId}-problem`;
  const hintId = `${exampleId}-hint`;

  const update = useCallback(
    (next: string) => {
      setSource(next);
      setMessage(null);
      const result = parse(next);
      if (result.ok) {
        setConfig(result.config);
        setProblem(null);
      } else {
        setProblem(`Line ${result.line}: ${result.message}`);
      }
    },
    [setSource],
  );

  const apply = useCallback(
    (patch: Partial<PlaygroundConfig>) => {
      const next = { ...config, ...patch };
      setConfig(next);
      setSource(serialize(next));
      setProblem(null);
      setMessage(null);
    },
    [config, setSource],
  );

  const copy = useCallback(async () => {
    const text = problem ? serialize(config) : source;
    try {
      await navigator.clipboard.writeText(text);
      setMessage(
        problem
          ? "Copied the last example that runs. Fix the editor to copy your version."
          : "Copied the example to the clipboard.",
      );
    } catch {
      setMessage(
        "The browser refused clipboard access. Select the text and copy it manually.",
      );
    }
  }, [config, problem, source]);

  const reset = useCallback(() => {
    setConfig(defaultConfig);
    setSource(serialize(defaultConfig));
    setProblem(null);
    setMessage("Reset to the starting example.");
    setMoved(null);
  }, [setConfig, setSource]);

  // Editing the item list restarts the board so the authored order is what you
  // see. Dragging inside the preview is not preserved across an edit.
  const previewKey = useMemo(() => structureKey(config), [config]);

  return (
    <div className="pg">
      <div className="pg-controls" role="group" aria-label="Layout controls">
        {CONTROL_GROUPS.map((group) => (
          <div className="pg-controls__group" key={group.key}>
            <span className="pg-controls__label">{group.label}</span>
            <div className="pg-controls__buttons">
              {group.values.map((value) => {
                const active = config[group.key] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={active ? "pg-pill pg-pill--active" : "pg-pill"}
                    aria-pressed={active}
                    data-pg={`${group.key}-${value}`}
                    onClick={() =>
                      apply({ [group.key]: value } as Partial<PlaygroundConfig>)
                    }
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="pg-columns">
        <section className="pg-panel" aria-labelledby={`${exampleId}-preview`}>
          <div className="pg-panel__head">
            <h2 className="pg-panel__title" id={`${exampleId}-preview`}>
              Preview
            </h2>
            <p className="pg-panel__note">
              Drag with a pointer, or focus a tile and press <kbd>Space</kbd>.
            </p>
          </div>

          <div data-pg="board">
            <Layout
              key={previewKey}
              mode={config.mode}
              motion={config.motion}
              placeholder={config.placeholder}
              collision={config.collision}
              gap={config.gap}
              columns={config.columns}
              minColumnWidth={config.minColumnWidth}
              keyboard={config.keyboard}
              label="Playground tiles"
              className="rw-playground__board"
              onSwap={(event) => setMoved(event.item)}
            >
              {config.tiles.map((tile) => (
                <Item
                  key={tile.id}
                  id={tile.id}
                  columnSpan={tile.columnSpan}
                  rowSpan={tile.rowSpan}
                >
                  <span className="rw-playground__tile">{tile.text}</span>
                </Item>
              ))}
            </Layout>
          </div>

          <p className="pg-status" data-pg="status">
            {moved
              ? `last moved item: ${moved}`
              : "Drag a tile to see the destination event reported here."}
          </p>
        </section>

        <section className="pg-panel" aria-labelledby={`${exampleId}-example`}>
          <div className="pg-panel__head">
            <h2 className="pg-panel__title" id={`${exampleId}-example`}>
              Example
            </h2>
            <p className="pg-panel__note">
              Edit the props. Valid edits render immediately.
            </p>
          </div>

          <label className="pg-visually-hidden" htmlFor={exampleId}>
            Editable Rewap example
          </label>
          <textarea
            id={exampleId}
            className="pg-editor"
            data-pg="editor"
            value={source}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={12}
            aria-describedby={problem ? problemId : hintId}
            aria-invalid={problem ? true : undefined}
            onChange={(event) => update(event.target.value)}
          />

          <div className="pg-actions">
            <button
              type="button"
              className="pg-action"
              data-pg="copy"
              onClick={copy}
            >
              {problem ? "Copy last working example" : "Copy example"}
            </button>
            <button
              type="button"
              className="pg-action"
              data-pg="reset"
              onClick={reset}
            >
              Reset
            </button>
          </div>

          <p
            className="pg-problem"
            id={problemId}
            data-pg="problem"
            role="status"
          >
            {problem ?? ""}
          </p>
          <p className="pg-message" data-pg="message" role="status">
            {message ?? ""}
          </p>

          <details className="pg-syntax" id={hintId}>
            <summary>What this editor accepts</summary>
            <p>
              A small JSX subset: one <code>&lt;Layout&gt;</code> root,{" "}
              <code>&lt;Item&gt;</code> children,{" "}
              <code>name=&quot;text&quot;</code> strings,{" "}
              <code>name=&#123;14&#125;</code> numbers and{" "}
              <code>keyboard=&#123;false&#125;</code>. Props: <code>mode</code>,{" "}
              <code>motion</code>, <code>placeholder</code>,{" "}
              <code>collision</code>, <code>gap</code>, <code>columns</code>,{" "}
              <code>minColumnWidth</code>, <code>keyboard</code> on{" "}
              <code>&lt;Layout&gt;</code>; <code>id</code>,{" "}
              <code>columnSpan</code>, <code>rowSpan</code> on{" "}
              <code>&lt;Item&gt;</code>. The text inside an{" "}
              <code>&lt;Item&gt;</code> is its visible label. Nothing else is
              evaluated — no imports, no expressions, no function calls — so
              this editor cannot run arbitrary code. <code>columnSpan</code> and{" "}
              <code>rowSpan</code> only take effect in <code>grid</code> mode,
              exactly as in the library.
            </p>
          </details>
        </section>
      </div>
    </div>
  );
}
