#!/usr/bin/env node
/**
 * Syncs the brand assets in `assets/` into the two apps that need their own
 * copy at build time (Next.js and Vite both want assets inside their own
 * `public/` directory, not symlinked from the repo root).
 *
 * `assets/` stays the single source of truth. Run this before `docs:build` or
 * `examples:build` picks up a stale copy — `npm run site:build` already does.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "assets");

const targets = [
  join(root, "docs", "public", "brand"),
  join(root, "examples", "playground", "public", "brand"),
];

for (const target of targets) {
  if (!existsSync(dirname(target))) continue; // the app may not exist yet / isn't part of this checkout
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`synced assets/ -> ${target.replace(root + "/", "")}`);
}
