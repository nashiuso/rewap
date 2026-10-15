#!/usr/bin/env node
/**
 * Install docs dependencies if `docs/node_modules` is absent.
 * Run before any command that needs the docs toolchain (Astro, Starlight, etc.).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ok, command } from "./lib/log.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const docsNodeModules = join(root, "docs", "node_modules");

if (existsSync(docsNodeModules)) {
  ok("docs/node_modules already present, skipping");
  process.exit(0);
}

command("npm", ["install", "--prefix", "docs", "--legacy-peer-deps"]);
const result = spawnSync(
  "npm",
  ["install", "--prefix", "docs", "--legacy-peer-deps"],
  {
    cwd: root,
    stdio: "inherit",
  },
);
process.exit(result.status ?? 1);
