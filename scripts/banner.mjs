#!/usr/bin/env node
/**
 * Copies `assets/` into the documentation site. `assets/` stays the single
 * source of truth; everything this script writes is generated and gitignored.
 *
 * Two destinations, for two different reasons:
 *   docs/src/assets/brand/  imported by .astro components, so Astro can apply
 *                           the `/rewap/` base prefix and hash the file name.
 *   docs/public/brand/      Stable URLs for the README screenshot reference
 *                           and any Markdown that needs a direct path.
 *   docs/public/favicon.svg Stable path for the site icon.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ok, warn } from "./lib/log.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "assets");
const docs = join(root, "docs");

if (!existsSync(source)) {
  warn("assets/ is missing; nothing to sync.");
  process.exit(0);
}

if (!existsSync(docs)) {
  warn("docs/ is missing; nothing to sync.");
  process.exit(0);
}

// src/assets/brand/ — used by .astro components (base-aware imports).
const srcBrand = join(docs, "src", "assets", "brand");
rmSync(srcBrand, { recursive: true, force: true });
mkdirSync(srcBrand, { recursive: true });
cpSync(source, srcBrand, { recursive: true });
ok(`synced assets/ -> ${srcBrand.replace(`${root}/`, "")}`);

// public/brand/ — stable public URLs served as-is.
const publicBrand = join(docs, "public", "brand");
rmSync(publicBrand, { recursive: true, force: true });
mkdirSync(publicBrand, { recursive: true });
cpSync(source, publicBrand, { recursive: true });
ok(`synced assets/ -> ${publicBrand.replace(`${root}/`, "")}`);

// public/favicon.svg — site icon, a stable path.
const publicDir = join(docs, "public");
mkdirSync(publicDir, { recursive: true });
const favicon = join(publicDir, "favicon.svg");
cpSync(join(source, "buttons", "mark.svg"), favicon);
ok(`synced assets/buttons/mark.svg -> ${favicon.replace(`${root}/`, "")}`);
