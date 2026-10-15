/**
 * The playground's example language.
 *
 * Rewap's playground lets a visitor edit the example and watch the preview
 * change. Evaluating arbitrary TSX in the browser would mean shipping a
 * transpiler and then handing `new Function` a string built from user input —
 * a large dependency and a component that can run anything, on a documentation
 * page. Neither is worth it for an example whose whole job is to demonstrate
 * three modes and a handful of props.
 *
 * So the playground understands a small, deliberately narrow subset of JSX —
 * exactly the shape of the example it shows — and nothing else:
 *
 *   <Layout mode="reorder" gap={14} keyboard={false}>
 *     <Item id="one">One</Item>
 *     <Item id="two" columnSpan={2}>Two</Item>
 *   </Layout>
 *
 * Supported:
 *   - one root `<Layout>` element, optionally with `<Item>` children;
 *   - `name="quoted string"` attributes (backslash escapes `\"` and `\\`);
 *   - `name={123}` numeric attributes;
 *   - `name` and `name={true}` / `name={false}` boolean attributes;
 *   - whitespace anywhere between tokens, text content inside `<Item>`.
 *
 * Everything else is rejected with a message naming the offending token, and
 * the preview keeps the last example that did parse. This module is pure — no
 * DOM, no React — so it is unit tested directly.
 */

export const LAYOUT_MODES = ["swap", "reorder", "grid"] as const;
export const MOTION_PRESETS = ["smooth", "snappy", "soft", "instant"] as const;
export const PLACEHOLDER_STYLES = ["auto", "outline", "ghost", "none"] as const;
export const COLLISION_STRATEGIES = [
  "pointer",
  "center",
  "intersection",
  "nearest",
  "projection",
] as const;

export type PlaygroundMode = (typeof LAYOUT_MODES)[number];
export type PlaygroundMotion = (typeof MOTION_PRESETS)[number];
export type PlaygroundPlaceholder = (typeof PLACEHOLDER_STYLES)[number];
export type PlaygroundCollision = (typeof COLLISION_STRATEGIES)[number];

export interface PlaygroundTile {
  id: string;
  /** Visible text, and therefore the item's accessible name. */
  text: string;
  columnSpan?: number;
  rowSpan?: number;
}

export interface PlaygroundConfig {
  mode: PlaygroundMode;
  motion: PlaygroundMotion;
  placeholder: PlaygroundPlaceholder;
  collision?: PlaygroundCollision;
  gap?: number;
  columns?: number;
  minColumnWidth?: number;
  keyboard: boolean;
  tiles: PlaygroundTile[];
}

export type ParseResult =
  | { ok: true; config: PlaygroundConfig }
  | { ok: false; message: string; line: number; column: number };

export const defaultConfig: PlaygroundConfig = {
  mode: "swap",
  motion: "smooth",
  placeholder: "outline",
  gap: 14,
  minColumnWidth: 160,
  keyboard: true,
  tiles: [
    { id: "one", text: "One" },
    { id: "two", text: "Two" },
    { id: "three", text: "Three" },
    { id: "four", text: "Four" },
    { id: "five", text: "Five" },
    { id: "six", text: "Six" },
  ],
};

/** Attribute names the example grammar accepts, and what each one expects. */
type AttributeKind =
  | { type: "enum"; values: readonly string[] }
  | { type: "number" }
  | { type: "boolean" };

const layoutAttributes: Record<string, AttributeKind> = {
  mode: { type: "enum", values: LAYOUT_MODES },
  motion: { type: "enum", values: MOTION_PRESETS },
  placeholder: { type: "enum", values: PLACEHOLDER_STYLES },
  collision: { type: "enum", values: COLLISION_STRATEGIES },
  gap: { type: "number" },
  columns: { type: "number" },
  minColumnWidth: { type: "number" },
  keyboard: { type: "boolean" },
};

const itemAttributes: Record<string, AttributeKind> = {
  id: { type: "enum", values: [] },
  columnSpan: { type: "number" },
  rowSpan: { type: "number" },
};

class ExampleError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message);
    this.name = "ExampleError";
  }
}

interface Element {
  name: string;
  attributes: Map<string, string | number | boolean>;
  /** Text content, or `null` for a self-closing element. */
  text: string | null;
  children: Element[];
  /** Index of the element's `<`, for error positions. */
  index: number;
}

const nameStart = /[A-Za-z_$]/;
const nameBody = /[\w$.-]/;

class Reader {
  startsWith(value: string, position = this.index): boolean {
    return this.source.startsWith(value, position);
  }

  index = 0;

  constructor(private readonly source: string) {}

  get done(): boolean {
    return this.index >= this.source.length;
  }

  peek(): string {
    return this.source[this.index] ?? "";
  }

  /** Skips whitespace, including newlines and JSX-style blank lines. */
  skipWhitespace(): void {
    while (!this.done && /\s/.test(this.peek())) this.index += 1;
  }

  expect(literal: string): void {
    if (!this.source.startsWith(literal, this.index)) {
      throw new ExampleError(`Expected \`${literal}\`.`, this.index);
    }
    this.index += literal.length;
  }

  readName(): string {
    const start = this.index;
    if (this.done || !nameStart.test(this.peek())) {
      throw new ExampleError("Expected a tag or attribute name here.", start);
    }
    this.index += 1;
    while (!this.done && nameBody.test(this.peek())) this.index += 1;
    return this.source.slice(start, this.index);
  }

  readQuoted(): string {
    const start = this.index;
    this.expect('"');
    let value = "";
    for (;;) {
      if (this.done) {
        throw new ExampleError("Unterminated string.", start);
      }
      const character = this.peek();
      if (character === "\\") {
        const escaped = this.source[this.index + 1];
        if (escaped !== '"' && escaped !== "\\") {
          throw new ExampleError(
            'Only \\" and \\\\ can be escaped inside a string.',
            this.index,
          );
        }
        value += escaped;
        this.index += 2;
        continue;
      }
      this.index += 1;
      if (character === '"') return value;
      value += character;
    }
  }

  /** Reads a `{…}` expression. Numbers and booleans only. */
  readExpression(): number | boolean {
    const start = this.index;
    this.expect("{");
    const close = this.source.indexOf("}", this.index);
    if (close === -1) {
      throw new ExampleError("Unclosed `{`.", start);
    }
    const raw = this.source.slice(this.index, close).trim();
    this.index = close + 1;

    if (raw === "true") return true;
    if (raw === "false") return false;
    if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);

    throw new ExampleError(
      `Expected a number or true/false inside \`{…}\`, got \`${raw || "nothing"}\`.`,
      start,
    );
  }

  readText(): string {
    // Item content stops at the next `<`.
    const start = this.index;
    const next = this.source.indexOf("<", this.index);
    const end = next === -1 ? this.source.length : next;
    const value = this.source.slice(start, end);
    this.index = end;
    return value;
  }
}

function readAttributes(
  reader: Reader,
  allowed: Record<string, AttributeKind>,
  elementName: string,
): Map<string, string | number | boolean> {
  const attributes = new Map<string, string | number | boolean>();

  for (;;) {
    reader.skipWhitespace();
    if (reader.done) {
      throw new ExampleError(
        `Unclosed <${elementName}> element.`,
        reader.index,
      );
    }
    const next = reader.peek();
    if (next === ">" || next === "/") return attributes;

    const nameIndex = reader.index;
    const name = reader.readName();
    const kind = allowed[name];
    if (!kind) {
      const known = Object.keys(allowed).join(", ");
      throw new ExampleError(
        `\`${name}\` is not a prop of <${elementName}>. Available: ${known}.`,
        nameIndex,
      );
    }
    if (attributes.has(name)) {
      throw new ExampleError(
        `\`${name}\` is set twice on <${elementName}>.`,
        nameIndex,
      );
    }

    reader.skipWhitespace();
    if (reader.peek() !== "=") {
      // Shorthand boolean: `<Layout keyboard>`.
      if (kind.type !== "boolean") {
        throw new ExampleError(
          `\`${name}\` needs a value, for example ${name}="${kind.type === "number" ? "16" : "…"}".`,
          reader.index,
        );
      }
      attributes.set(name, true);
      continue;
    }

    reader.index += 1;
    reader.skipWhitespace();
    const valueIndex = reader.index;
    const value =
      reader.peek() === '"' ? reader.readQuoted() : reader.readExpression();

    if (kind.type === "number" && typeof value !== "number") {
      throw new ExampleError(
        `\`${name}\` expects a number, written \`${name}={4}\`.`,
        valueIndex,
      );
    }
    if (kind.type === "boolean" && typeof value !== "boolean") {
      throw new ExampleError(
        `\`${name}\` expects true or false, written \`${name}={false}\`.`,
        valueIndex,
      );
    }
    if (kind.type === "enum") {
      if (typeof value !== "string") {
        throw new ExampleError(
          `\`${name}\` expects a quoted string.`,
          valueIndex,
        );
      }
      if (kind.values.length > 0 && !kind.values.includes(value)) {
        throw new ExampleError(
          `\`${name}="${value}"\` is not recognised. Use one of: ${kind.values.join(", ")}.`,
          valueIndex,
        );
      }
    }

    attributes.set(name, value);
  }
}

function parseElement(reader: Reader, allowedItems: boolean): Element {
  const index = reader.index;
  reader.expect("<");
  const name = reader.readName();

  if (name === "Layout" && allowedItems === false) {
    throw new ExampleError("There can only be one <Layout> element.", index);
  }
  if (name !== "Layout" && name !== "Item") {
    throw new ExampleError(
      `Unknown element <${name}>. The example uses <Layout> and <Item>.`,
      index,
    );
  }
  if (name === "Item" && !allowedItems) {
    throw new ExampleError("<Item> must be a child of <Layout>.", index);
  }

  const attributes = readAttributes(
    reader,
    name === "Layout" ? layoutAttributes : itemAttributes,
    name,
  );

  reader.skipWhitespace();
  if (reader.peek() === "/") {
    reader.index += 1;
    reader.expect(">");
    return { name, attributes, text: null, children: [], index };
  }
  reader.expect(">");

  if (name === "Layout") {
    const children: Element[] = [];
    for (;;) {
      reader.skipWhitespace();
      if (reader.peek() === "<" && reader.startsWith("</", reader.index)) {
        reader.index += 2;
        const closing = reader.readName();
        if (closing !== "Layout") {
          throw new ExampleError(
            `Expected </Layout>, found </${closing}>.`,
            reader.index,
          );
        }
        reader.skipWhitespace();
        reader.expect(">");
        return { name, attributes, text: null, children, index };
      }
      if (reader.done) {
        throw new ExampleError("Unclosed <Layout> element.", index);
      }
      if (reader.peek() !== "<") {
        throw new ExampleError(
          "<Layout> can only contain <Item> elements — text goes inside an item.",
          reader.index,
        );
      }
      children.push(parseElement(reader, true));
    }
  }

  // <Item> content: text until `</Item>`.
  const text = reader.readText().replace(/\s+/g, " ").trim();
  reader.skipWhitespace();
  if (!reader.startsWith("</", reader.index)) {
    throw new ExampleError(
      "<Item> can contain text, but no other elements.",
      reader.index,
    );
  }
  reader.index += 2;
  const closing = reader.readName();
  if (closing !== "Item") {
    throw new ExampleError(
      `Expected </Item>, found </${closing}>.`,
      reader.index,
    );
  }
  reader.skipWhitespace();
  reader.expect(">");
  return { name, attributes, text, children: [], index };
}

const toConfig = (element: Element): PlaygroundConfig => {
  const attributes = element.attributes;
  const string = (name: string, fallback: string): string =>
    typeof attributes.get(name) === "string"
      ? (attributes.get(name) as string)
      : fallback;
  const number = (name: string): number | undefined =>
    typeof attributes.get(name) === "number"
      ? (attributes.get(name) as number)
      : undefined;

  const tiles: PlaygroundTile[] = [];
  const seen = new Set<string>();
  for (const child of element.children) {
    const id = child.attributes.get("id");
    if (typeof id !== "string" || id.trim() === "") {
      throw new ExampleError("Every <Item> needs an `id`.", child.index);
    }
    if (/\s/.test(id)) {
      throw new ExampleError(
        `\`id="${id}"\` cannot contain spaces.`,
        child.index,
      );
    }
    if (seen.has(id)) {
      throw new ExampleError(`Two items share the id \`${id}\`.`, child.index);
    }
    seen.add(id);

    const columnSpan = child.attributes.get("columnSpan");
    if (typeof columnSpan === "number" && columnSpan < 1) {
      throw new ExampleError("`columnSpan` starts at 1.", child.index);
    }
    const rowSpan = child.attributes.get("rowSpan");
    if (typeof rowSpan === "number" && rowSpan < 1) {
      throw new ExampleError("`rowSpan` starts at 1.", child.index);
    }

    tiles.push({
      id,
      text: child.text && child.text.length > 0 ? child.text : id,
      ...(typeof columnSpan === "number" ? { columnSpan } : {}),
      ...(typeof rowSpan === "number" ? { rowSpan } : {}),
    });
  }

  if (tiles.length === 0) {
    throw new ExampleError(
      "The example needs at least one <Item>.",
      element.index,
    );
  }

  return {
    mode: string("mode", "swap") as PlaygroundMode,
    motion: string("motion", "smooth") as PlaygroundMotion,
    placeholder: string("placeholder", "outline") as PlaygroundPlaceholder,
    ...(typeof attributes.get("collision") === "string"
      ? { collision: attributes.get("collision") as PlaygroundCollision }
      : {}),
    ...(number("gap") !== undefined ? { gap: number("gap") } : {}),
    ...(number("columns") !== undefined ? { columns: number("columns") } : {}),
    ...(number("minColumnWidth") !== undefined
      ? { minColumnWidth: number("minColumnWidth") }
      : {}),
    keyboard: attributes.get("keyboard") !== false,
    tiles,
  };
};

const positionAt = (source: string, index: number) => {
  const before = source.slice(0, index);
  const line = before.split("\n").length;
  const column = index - before.lastIndexOf("\n");
  return { line, column };
};

/** Parses an edited example. Never throws; failures come back as a message. */
export function parse(source: string): ParseResult {
  if (source.trim() === "") {
    return { ok: false, message: "The example is empty.", line: 1, column: 1 };
  }
  try {
    const reader = new Reader(source);
    reader.skipWhitespace();
    const element = parseElement(reader, false);
    reader.skipWhitespace();
    if (!reader.done) {
      throw new ExampleError(
        "Unexpected content after the closing </Layout>.",
        reader.index,
      );
    }
    return { ok: true, config: toConfig(element) };
  } catch (caught) {
    if (!(caught instanceof ExampleError)) throw caught;
    return {
      ok: false,
      message: caught.message,
      ...positionAt(source, caught.index),
    };
  }
}

/** Renders a configuration back to the example source the editor shows. */
export function serialize(config: PlaygroundConfig): string {
  const layout = [
    `mode="${config.mode}"`,
    `motion="${config.motion}"`,
    `placeholder="${config.placeholder}"`,
    ...(config.collision ? [`collision="${config.collision}"`] : []),
    ...(config.gap !== undefined ? [`gap={${config.gap}}`] : []),
    ...(config.columns !== undefined ? [`columns={${config.columns}}`] : []),
    ...(config.minColumnWidth !== undefined
      ? [`minColumnWidth={${config.minColumnWidth}}`]
      : []),
    ...(config.keyboard ? [] : ["keyboard={false}"]),
  ].join(" ");

  const items = config.tiles.map((tile) => {
    const spans = [
      ...(tile.columnSpan !== undefined
        ? [`columnSpan={${tile.columnSpan}}`]
        : []),
      ...(tile.rowSpan !== undefined ? [`rowSpan={${tile.rowSpan}}`] : []),
    ].join(" ");
    const attributes = [`id="${tile.id}"`, ...(spans ? [spans] : [])].join(" ");
    return `  <Item ${attributes}>${tile.text}</Item>`;
  });

  return [`<Layout ${layout}>`, ...items, "</Layout>"].join("\n");
}

/** Identity of the authored item list, used to remount the preview on edits. */
export const structureKey = (config: PlaygroundConfig): string =>
  config.tiles
    .map((tile) => `${tile.id}:${tile.columnSpan ?? ""}:${tile.rowSpan ?? ""}`)
    .join("|");
