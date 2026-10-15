#!/usr/bin/env node
/**
 * Serves `site-dist/` the way GitHub Pages will: under the `/rewap/` path
 * prefix. Run `npm run site:build` first.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { realpathSync } from "node:fs";
import { warn } from "../lib/log.mjs";

const root = resolve(new URL("../../", import.meta.url).pathname);
const siteDist = resolve(root, "site-dist");

if (!existsSync(siteDist)) {
  warn("site-dist/ missing. Run `npm run site:build` first.");
  process.exit(1);
}

// Canonical real path for containment checks. Resolve the directory once so
// every incoming request is compared against a stable, symlink-free base.
let siteDistReal;
try {
  siteDistReal = realpathSync(siteDist);
} catch {
  siteDistReal = siteDist;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

const PREFIX = "/rewap";
const port = Number(process.env.PORT) || 4322;

/**
 * Canonicalise a candidate file path and verify it is inside siteDist.
 * Returns the resolved real path on success, or null if the path escapes
 * the intended directory or cannot be safely resolved.
 */
function safeResolve(candidate) {
  try {
    const real = realpathSync(candidate);
    if (real === siteDistReal || real.startsWith(siteDistReal + "/")) {
      return real;
    }
  } catch {
    // File does not exist or contains an unresolvable segment. Walk the path
    // upward until we find an existing ancestor so we can still check whether
    // the intended location is inside siteDist.
    let dir = candidate;
    while (dir !== siteDist && dir !== root && dir !== "/") {
      try {
        const real = realpathSync(dir);
        if (real === siteDistReal || real.startsWith(siteDistReal + "/")) {
          return null; // path is inside the tree even though the leaf is missing
        }
        break;
      } catch {
        dir = resolve(dir, "..");
      }
    }
  }
  return null;
}

const server = createServer((req, res) => {
  // Strip query and fragment, then decode once.
  const rawUrl = req.url.split("?")[0].split("#")[0];
  let reqUrl;
  try {
    reqUrl = decodeURIComponent(rawUrl);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request: malformed URL encoding.");
    return;
  }

  if (reqUrl === "/") {
    res.writeHead(302, { Location: `${PREFIX}/` });
    res.end();
    return;
  }

  if (!reqUrl.startsWith(PREFIX)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<h1>404</h1><p>This preview mirrors GitHub Pages: everything is served under <code>${PREFIX}/</code>, matching the production base path. Try <a href="${PREFIX}/">${PREFIX}/</a>.</p>`,
    );
    return;
  }

  let relative = reqUrl.slice(PREFIX.length) || "/";
  if (relative === "/") relative = "/index.html";

  // Normalise the relative portion — collapse sequences like `..` or `//`
  // that survived the URL decode.
  const filePath = resolve(siteDist, `.${relative}`);

  // Canonical containment check against the real filesystem path. This is
  // immune to symlink escapes and `..` traversal.
  const safePath = safeResolve(filePath);
  if (safePath === null) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  let finalPath = safePath;

  try {
    if (statSync(finalPath).isDirectory()) {
      finalPath = join(finalPath, "index.html");
    }
  } catch {
    // statSync failed — handled by the existsSync check below.
  }

  if (!existsSync(finalPath)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1><p>Not found in site-dist/.</p>");
    return;
  }

  res.writeHead(200, {
    "Content-Type": MIME[extname(finalPath)] || "application/octet-stream",
  });
  res.end(readFileSync(finalPath));
});

// Bind to the loopback interface only. The server is for local preview and
// Playwright tests, not for LAN access.
server.listen(port, "127.0.0.1", () => {
  console.log(
    `site preview (mirrors GitHub Pages base ${PREFIX}/): http://localhost:${port}${PREFIX}/`,
  );
});
