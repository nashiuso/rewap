#!/usr/bin/env node
/**
 * Assembles the GitHub Pages artifact: the Astro docs site (which includes the
 * playground as a React island) served under /rewap/.
 *
 * Output: `site-dist/` at the repo root. Nothing here touches git, tags, or
 * publishes anything; it only builds static files.
 *
 * Build-time check: the script runs `astro build` (which uses Node ≥22.12),
 * copies the result into site-dist/, verifies that every required file is
 * present, and scans the HTML for links that escape the `/rewap/` prefix.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ok, error, heading, command } from "../lib/log.mjs";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const siteDist = join(root, "site-dist");

// Astro 7 requires Node ≥22.12.0. Check early so the error is clear.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  error(
    `Node ${process.versions.node} is too old for the docs site — Astro 7 requires ≥22.12.0. ` +
      `Install Node 22+ and ensure it is on PATH, or use a version manager (nvm, fnm, volta).`,
  );
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  command(cmd, args);
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd ?? root,
    stdio: "inherit",
    env: { ...process.env, ...(opts.env ?? {}) },
  });
  if (result.status !== 0) {
    error(`${cmd} ${args.join(" ")} exited with code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

heading("site:build");

// 1/4 — Sync brand assets.
heading("1/4 syncing brand assets");
run("node", ["scripts/banner.mjs"]);

// 2/4 — Install docs dependencies if missing.
heading("2/4 installing docs dependencies (if needed)");
const docsNodeModules = join(root, "docs", "node_modules");
if (!existsSync(docsNodeModules)) {
  run("npm", ["ci", "--prefix", "docs", "--legacy-peer-deps"]);
} else {
  ok("docs/node_modules already present, skipping install");
}

// 3/4 — Build the docs site.
heading("3/4 building docs (Astro → docs/dist)");
run("node", [join("node_modules", ".bin", "astro"), "build"], {
  cwd: join(root, "docs"),
});

// 4/4 — Assemble site-dist/.
heading("4/4 assembling site-dist/");
const docsDist = join(root, "docs", "dist");

if (!existsSync(docsDist)) {
  error(`expected ${docsDist} to exist after the docs build — aborting`);
  process.exit(1);
}

rmSync(siteDist, { recursive: true, force: true });
mkdirSync(siteDist, { recursive: true });
cpSync(docsDist, siteDist, { recursive: true });

// GitHub Pages runs Jekyll by default, which ignores files/folders starting
// with `_`. `_astro/` is how Astro names its hashed asset chunks.
writeFileSync(join(siteDist, ".nojekyll"), "");

// Required files — covers every route plus key assets.
const requiredFiles = [
  "index.html",
  "installation/index.html",
  "quick-start/index.html",
  "api-and-layout-modes/index.html",
  "motion-and-customization/index.html",
  "accessibility-and-ssr/index.html",
  "known-limitations/index.html",
  "playground/index.html",
  "brand/buttons/mark.svg",
  ".nojekyll",
];

const missingFiles = requiredFiles.filter(
  (path) => !existsSync(join(siteDist, path)),
);
if (missingFiles.length > 0) {
  error(`site artifact is missing required files:`);
  for (const file of missingFiles) error(`  ${file}`);
  process.exit(1);
}
ok(`all ${requiredFiles.length} required files present`);

// Scan HTML for links that escape the /rewap/ prefix.
const htmlFiles = [];
const collectHtml = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectHtml(path);
    else if (entry.isFile() && entry.name.endsWith(".html"))
      htmlFiles.push(path);
  }
};
collectHtml(siteDist);

const basePath = "/rewap";
const brokenLinks = [];
for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, "utf8");
  for (const [, href] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (
      href.startsWith("#") ||
      href.startsWith("//") ||
      /^[a-z][a-z0-9+.-]*:/i.test(href)
    ) {
      continue;
    }

    const pathname = new URL(href, "https://rewap.invalid").pathname;
    if (!pathname.startsWith(`${basePath}/`)) {
      brokenLinks.push(
        `${htmlFile.replace(siteDist + "/", "")}: ${href} (outside ${basePath}/)`,
      );
      continue;
    }

    const localPath = decodeURIComponent(pathname.slice(basePath.length));
    const relativePath = localPath.replace(/^\/+/, "");
    const candidates = localPath.endsWith("/")
      ? [join(siteDist, relativePath, "index.html")]
      : [
          join(siteDist, relativePath),
          join(siteDist, `${relativePath}.html`),
          join(siteDist, relativePath, "index.html"),
        ];
    const resolved = candidates.some((candidate) => {
      try {
        return statSync(candidate).isFile();
      } catch {
        return false;
      }
    });
    if (!resolved) {
      brokenLinks.push(
        `${htmlFile.replace(siteDist + "/", "")}: ${href} (missing)`,
      );
    }
  }
}
if (brokenLinks.length > 0) {
  error(`site artifact has invalid local links:`);
  for (const link of brokenLinks) error(`  ${link}`);
  process.exit(1);
}

ok(`verified ${htmlFiles.length} pages, assets and /rewap/ links`);

console.log(`\nsite:build done -> ${siteDist.replace(root + "/", "")}`);
console.log("  /            -> docs (from docs/dist, built by Astro)");
