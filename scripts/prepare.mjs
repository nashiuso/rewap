#!/usr/bin/env node
/**
 * Runs on `npm install` with no arguments, and — this is the part that
 * matters — on every install of this package as a git or `file:` dependency
 * (npm always runs `prepare` for those, installing devDependencies first).
 * `dist/` is gitignored, so without this, installing
 * `github:nashiuso/rewap` would resolve `exports` to files that don't exist.
 *
 * Skips rebuilding `dist/` when it already looks current for this exact
 * commit, so repeated local `npm install` runs in this repo (and repeated
 * `npm install` runs of consumer projects that already resolved this
 * install once) don't eat a ~5s rebuild every time for nothing.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const marker = join(root, "dist", ".build-marker");

function currentFingerprint() {
  try {
    // Prefer the exact commit — this is exactly how the package will usually
    // be installed (a pinned git ref). Falls back to the package version for
    // a plain `npm pack`/tarball install, which has no `.git` directory.
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root })
      .toString()
      .trim();
  } catch {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return `version:${pkg.version}`;
  }
}

const fingerprint = currentFingerprint();

// Everything this script prints — including the build it runs below — goes
// to stderr, not stdout. `prepare` runs as part of `npm pack`/`npm install`
// lifecycle hooks, whose stdout callers sometimes capture and parse as JSON
// (`npm pack --json`, scripted consumers); mixing a log line into that
// stream breaks the parse. stderr is still visible in any normal terminal.
if (existsSync(marker) && readFileSync(marker, "utf8").trim() === fingerprint) {
  console.error("rewap: dist/ already built for this commit, skipping.");
  process.exit(0);
}

console.error("rewap: building dist/ (first install, or source changed)...");
// stdio[1] (the build's stdout) is redirected to fd 2 (this process's
// stderr) for the same reason — `npm run build`'s own progress output would
// otherwise inherit all the way up to whatever invoked `npm pack`/`npm
// install` and land back in a stdout a caller is trying to parse.
execFileSync("npm", ["run", "build"], { cwd: root, stdio: ["ignore", 2, 2] });
writeFileSync(marker, fingerprint);
