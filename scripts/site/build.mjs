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
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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
run("npm", ["ci", "--prefix", "docs"]);
run("npm", ["run", "build", "--prefix", "docs"], { env: { GH_PAGES: "1" } });

console.log("3/4 installing + building playground (base = /rewap/playground/)");
run("npm", ["ci", "--prefix", "examples/playground"]);
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

const requiredFiles = [
  "index.html",
  "docs/index.html",
  "docs/installation/index.html",
  "docs/quick-start/index.html",
  "docs/api-and-layout-modes/index.html",
  "docs/motion-and-customization/index.html",
  "docs/accessibility-and-ssr/index.html",
  "docs/known-limitations/index.html",
  "api/search",
  "playground/index.html",
  "brand/buttons/logo.svg",
  "brand/buttons/mark.svg",
];
const missingFiles = requiredFiles.filter(
  (path) => !existsSync(join(siteDist, path)),
);
if (missingFiles.length > 0) {
  throw new Error(
    `site artifact is missing required files:\n  ${missingFiles.join("\n  ")}`,
  );
}

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
  throw new Error(
    `site artifact has invalid local links:\n  ${brokenLinks.join("\n  ")}`,
  );
}
console.log(
  `  verified ${htmlFiles.length} pages, local assets and /rewap/ links`,
);

console.log(`\nsite:build done -> ${siteDist.replace(root + "/", "")}`);
console.log("  /              -> docs (from docs/out)");
console.log(
  "  /playground/   -> playground (from examples/playground/dist, base /rewap/playground/)",
);
