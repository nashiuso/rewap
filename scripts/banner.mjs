#!/usr/bin/env node
/**
 * Copies `assets/` into the public directory of each app that uses the brand.
 * The source assets stay in one place; generated copies are ignored by git.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "assets");

const targets = [
  { app: join(root, "docs"), publicDir: join(root, "docs", "public", "brand") },
  {
    app: join(root, "examples", "playground"),
    publicDir: join(root, "examples", "playground", "public", "brand"),
  },
];

for (const { app, publicDir } of targets) {
  if (!existsSync(app)) continue;
  rmSync(publicDir, { recursive: true, force: true });
  mkdirSync(dirname(publicDir), { recursive: true });
  cpSync(source, publicDir, { recursive: true });
  console.log(`synced assets/ -> ${publicDir.replace(root + "/", "")}`);
}
