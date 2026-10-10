#!/usr/bin/env node
/**
 * Assembles the published stylesheets from `src/styles/*.css`.
 *
 * There is no PostCSS pipeline here on purpose: the source files are already
 * plain, valid CSS, custom properties and all. Concatenation is enough, and it
 * keeps the output byte-for-byte traceable back to a source file.
 *
 * Output (all published through `exports` in package.json):
 *   dist/styles/tokens.css   <- tokens only
 *   dist/styles/rewap.css    <- tokens + core (the default `styles.css`)
 *   dist/styles/charts.css   <- tokens + sparkline + charts
 *   dist/styles/widgets.css  <- tokens + sparkline + widgets
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, "src", "styles");
const outDir = join(root, "dist", "styles");

const read = (name) =>
  readFileSync(join(srcDir, name), "utf8").trimEnd() + "\n";

const bundles = {
  "tokens.css": ["tokens.css"],
  "rewap.css": ["tokens.css", "core.css"],
  "charts.css": ["tokens.css", "sparkline.css", "charts.css"],
  "widgets.css": ["tokens.css", "sparkline.css", "widgets.css"],
};

mkdirSync(outDir, { recursive: true });

for (const [outFile, parts] of Object.entries(bundles)) {
  const banner = `/* @nashiuso/rewap v${JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version} | MIT | generated from src/styles/${parts.join(" + ")} */\n\n`;
  const body = parts.map(read).join("\n");
  writeFileSync(join(outDir, outFile), banner + body);
  console.log(`built dist/styles/${outFile} (${parts.join(" + ")})`);
}
