#!/usr/bin/env node
/**
 * Assembles the GitHub Pages artifact: docs at the site root, the playground
 * copied in under /playground/. Matches the base path
 * `examples/playground/vite.config.ts` already expects from `GH_PAGES=1`
 * (see the comment in that file — this script is what it's waiting for).
 *
 * Output: `site-dist/` at the repo root. Nothing here touches git, tags, or
 * publishes anything; it only builds static files.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const siteDist = join(root, "site-dist");

function run(command, args, opts = {}) {
  console.log(
    `$ ${command} ${args.join(" ")}${opts.env ? " (with env overrides)" : ""}`,
  );
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (result.status !== 0) {
    console.error(`\nsite:build failed at: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

console.log("== site:build ==");
console.log("1/4 syncing brand assets");
run("npm", ["run", "banner"]);

console.log(
  "2/4 installing + building docs (static export, docs/out, base /rewap/)",
);
run("npm", ["install", "--prefix", "docs"]);
run("npm", ["run", "build", "--prefix", "docs"], { env: { GH_PAGES: "1" } });

console.log("3/4 installing + building playground (base = /rewap/playground/)");
run("npm", ["install", "--prefix", "examples/playground"]);
run("npm", ["run", "build", "--prefix", "examples/playground"], {
  env: { GH_PAGES: "1" },
});

console.log("4/4 assembling site-dist/");
rmSync(siteDist, { recursive: true, force: true });
mkdirSync(siteDist, { recursive: true });

const docsDist = join(root, "docs", "out");
const playgroundDist = join(root, "examples", "playground", "dist");

if (!existsSync(docsDist)) {
  console.error(
    `expected ${docsDist} to exist after the docs build — aborting`,
  );
  process.exit(1);
}
if (!existsSync(playgroundDist)) {
  console.error(
    `expected ${playgroundDist} to exist after the playground build — aborting`,
  );
  process.exit(1);
}

cpSync(docsDist, siteDist, { recursive: true });
cpSync(playgroundDist, join(siteDist, "playground"), { recursive: true });

// GitHub Pages runs Jekyll by default, which ignores files/folders starting
// with `_`. Nothing here currently does, but this costs nothing and avoids a
// surprise the day a build tool adds one.
writeFileSync(join(siteDist, ".nojekyll"), "");

console.log(`\nsite:build done -> ${siteDist.replace(root + "/", "")}`);
console.log("  /              -> docs (from docs/out)");
console.log(
  "  /playground/   -> playground (from examples/playground/dist, base /rewap/playground/)",
);
