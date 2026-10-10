#!/usr/bin/env node
/**
 * Serves `site-dist/` the way GitHub Pages will: under the `/rewap/` path
 * prefix, since the playground build inside it was built with
 * `base: "/rewap/playground/"`. Run `npm run site:build` first.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const siteDist = join(root, "site-dist");

if (!existsSync(siteDist)) {
  console.error("site-dist/ missing. Run `npm run site:build` first.");
  process.exit(1);
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
};

const PREFIX = "/rewap";
const port = Number(process.env.PORT) || 4322;

const server = createServer((req, res) => {
  const reqUrl = decodeURIComponent(req.url.split("?")[0]);

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
  let filePath = join(siteDist, relative);

  if (!filePath.startsWith(siteDist)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    if (statSync(filePath).isDirectory())
      filePath = join(filePath, "index.html");
  } catch {
    // handled by the existsSync check below
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1><p>Not found in site-dist/.</p>");
    return;
  }

  res.writeHead(200, {
    "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
  });
  res.end(readFileSync(filePath));
});

server.listen(port, "0.0.0.0", () => {
  console.log(
    `site preview (mirrors GitHub Pages base /rewap/): http://localhost:${port}${PREFIX}/`,
  );
});
