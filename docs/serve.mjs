#!/usr/bin/env node
/**
 * Tiny static file server for local preview of the built docs site
 * (`docs/dist`). No framework, no live-reload — run `npm run build` again
 * after editing content and refresh the browser. Builds automatically if
 * `dist/` doesn't exist yet.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, "dist");

if (!existsSync(distDir)) {
  console.log("docs/dist missing, building first...");
  execSync("node build.mjs", { cwd: here, stdio: "inherit" });
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

const port = Number(process.env.PORT) || 4321;

const server = createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split("?")[0]);
  if (reqPath === "/") reqPath = "/index.html";
  let filePath = join(distDir, reqPath);

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stats = statSync(filePath);
    if (stats.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    // fall through to 404 below if the file truly doesn't exist
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end('<h1>404</h1><p>Not found. <a href="/">Back to docs</a>.</p>');
    return;
  }

  const type = MIME[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  res.end(readFileSync(filePath));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`docs preview: http://localhost:${port}`);
});
