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

if (existsSync(marker) && readFileSync(marker, "utf8").trim() === fingerprint) {
  console.log("rewap: dist/ already built for this commit, skipping.");
  process.exit(0);
}

console.log("rewap: building dist/ (first install, or source changed)...");
execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
writeFileSync(marker, fingerprint);
