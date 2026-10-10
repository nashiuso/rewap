#!/usr/bin/env node
/**
 * Prints the on-disk and gzipped size of every built entry point.
 *
 * This is deliberately not a benchmark and it is not wired into CI as a budget
 * check — thresholds like that tend to rot the moment a dependency changes.
 * It exists so a size claim in the README or a PR description can be checked
 * in ten seconds instead of trusted.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");

if (!existsSync(distDir)) {
  console.error("dist/ does not exist — run `npm run build` first.");
  process.exit(1);
}

const entries = [
  "index.js",
  "react/index.js",
  "core/index.js",
  "math/index.js",
  "motion/index.js",
  "accessibility/index.js",
  "utilities/index.js",
  "providers/index.js",
  "charts/index.js",
  "widgets/index.js",
];

const styles = [
  "styles/tokens.css",
  "styles/rewap.css",
  "styles/charts.css",
  "styles/widgets.css",
];

const fmt = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

function row(label, bytes, gzip) {
  const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));
  console.log(
    `${pad(label, 28)} ${pad(fmt(bytes), 10)} ${gzip != null ? fmt(gzip) + " gz" : ""}`,
  );
}

console.log("JavaScript entry points\n");
for (const entry of entries) {
  const file = join(distDir, entry);
  if (!existsSync(file)) continue;
  const buf = readFileSync(file);
  row(entry, buf.length, gzipSync(buf).length);
}

console.log("\nStylesheets\n");
for (const entry of styles) {
  const file = join(distDir, entry);
  if (!existsSync(file)) continue;
  row(entry, statSync(file).size, null);
}
