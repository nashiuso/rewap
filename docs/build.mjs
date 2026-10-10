#!/usr/bin/env node
/**
 * Static docs site generator. Plain Node, no framework: reads markdown,
 * renders it with `marked`, wraps it in a hand-written template, and copies
 * self-hosted fonts and brand assets alongside it. No CDN, no server-side
 * search — search is a small client-side script over a generated JSON index.
 *
 * Why not Next.js / Fumadocs here: the content in docs/content/*.md was
 * already written around a flat site with relative `.html` cross-links
 * (see NOTES.md). This script honors that contract instead of rewriting the
 * content around a framework.
 */
import { marked } from "marked";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, "content");
const outDir = join(here, "dist");
// npm workspaces hoist devDependencies to the repo root, so look there first
// and fall back to a local install (e.g. if docs/ is ever used standalone).
const fontsourceDir = existsSync(join(here, "node_modules", "@fontsource"))
  ? join(here, "node_modules", "@fontsource")
  : join(here, "..", "node_modules", "@fontsource");

const BRAND = {
  bg: "#020204",
  accent: "#49a1a8",
  fg: "#d9dbdf",
};

// Sidebar structure. Order here is the order in the rendered nav, grouped by
// topic rather than alphabetically.
const NAV = [
  {
    group: "Start here",
    pages: ["introduction", "quick-start", "installation"],
  },
  {
    group: "Core concepts",
    pages: [
      "layout",
      "items",
      "dragging",
      "swapping",
      "reorder",
      "collision",
      "motion",
      "physics",
    ],
  },
  {
    group: "Platform",
    pages: [
      "accessibility",
      "keyboard",
      "persistence",
      "providers",
      "performance",
    ],
  },
  {
    group: "Extras",
    pages: ["charts", "widgets", "utilities", "api"],
  },
  {
    group: "Frameworks",
    pages: ["astro"],
  },
  {
    group: "Project",
    pages: ["examples", "faq", "known-limitations"],
  },
];

function titleFromMarkdown(md) {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function excerptFromMarkdown(md, title) {
  const withoutTitle = md.replace(/^#\s+.+$/m, "");
  const firstParagraph = withoutTitle
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find(
      (block) => block && !block.startsWith("#") && !block.startsWith("```"),
    );
  if (!firstParagraph) return title;
  return firstParagraph
    .replace(/[`*_]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .slice(0, 180);
}

function renderShell({ title, bodyHtml, slug, headings }) {
  const navHtml = NAV.map((section) => {
    const items = section.pages
      .map((slug2) => {
        const active = slug2 === slug ? ' aria-current="page"' : "";
        return `<li><a href="${slug2}.html"${active}>${navLabel(slug2)}</a></li>`;
      })
      .join("");
    return `<div class="nav-group"><h2>${section.group}</h2><ul>${items}</ul></div>`;
  }).join("");

  const tocHtml =
    headings.length > 1
      ? `<nav class="toc" aria-label="On this page"><h2>On this page</h2><ul>${headings
          .map(
            (h) =>
              `<li class="toc-${h.level}"><a href="#${h.id}">${h.text}</a></li>`,
          )
          .join("")}</ul></nav>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · rewap docs</title>
<meta name="description" content="Documentation for @nashiuso/rewap, an unreleased alpha drag/reorder/swap layout library for React." />
<link rel="icon" href="brand/buttons/mark.svg" />
<link rel="stylesheet" href="fonts/fonts.css" />
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="introduction.html">
    <img src="brand/buttons/mark.svg" alt="" width="24" height="24" />
    <span>rewap</span>
    <span class="alpha-pill">1.1.1 · alpha</span>
  </a>
  <div class="search" role="search">
    <input id="search-input" type="search" placeholder="Search docs…" aria-label="Search docs" autocomplete="off" />
    <ul id="search-results" hidden></ul>
  </div>
  <a class="gh-link" href="https://github.com/nashiuso/rewap" target="_blank" rel="noreferrer">GitHub</a>
</header>
<div class="layout">
  <nav class="sidebar" aria-label="Documentation sections">${navHtml}</nav>
  <main id="main">
    <article class="content">${bodyHtml}</article>
  </main>
  ${tocHtml ? `<aside class="toc-rail">${tocHtml}</aside>` : ""}
</div>
<footer class="site-footer">
  <p>Unreleased alpha, version 1.1.1. Built from <a href="https://github.com/nashiuso/rewap">github.com/nashiuso/rewap</a>, not a published release. No analytics, no CDN scripts.</p>
</footer>
<script src="search.js"></script>
</body>
</html>`;
}

function navLabel(slug) {
  return slug
    .split("-")
    .map((w) =>
      w === "faq" || w === "api"
        ? w.toUpperCase()
        : w[0].toUpperCase() + w.slice(1),
    )
    .join(" ");
}

function extractHeadings(html) {
  const headings = [];
  const re = /<h([23])\s+id="([^"]+)">(.*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(html))) {
    headings.push({
      level: m[1],
      id: m[2],
      text: m[3].replace(/<[^>]+>/g, ""),
    });
  }
  return headings;
}

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function addHeadingIds(html) {
  return html.replace(/<h([23])>(.*?)<\/h\1>/g, (_m, level, text) => {
    const plain = text.replace(/<[^>]+>/g, "");
    const id = slugifyHeading(plain);
    return `<h${level} id="${id}">${text}</h${level}>`;
  });
}

function copyFonts() {
  const fontsOut = join(outDir, "fonts");
  mkdirSync(join(fontsOut, "files"), { recursive: true });
  const specs = [
    { family: "montserrat", weights: ["400", "500", "600", "700"] },
    { family: "roboto-mono", weights: ["400", "500"] },
  ];
  let css = "";
  for (const spec of specs) {
    for (const weight of spec.weights) {
      const cssPath = join(fontsourceDir, spec.family, `latin-${weight}.css`);
      if (!existsSync(cssPath)) continue;
      const rule = readFileSync(cssPath, "utf8");
      css += rule.replace(/url\(\.\/files\//g, "url(./files/") + "\n";
      for (const ext of ["woff2", "woff"]) {
        const file = `${spec.family}-latin-${weight}-normal.${ext}`;
        const src = join(fontsourceDir, spec.family, "files", file);
        if (existsSync(src)) cpSync(src, join(fontsOut, "files", file));
      }
    }
  }
  writeFileSync(join(fontsOut, "fonts.css"), css);
}

function copyBrand() {
  const brandSrc = join(here, "public", "brand");
  if (!existsSync(brandSrc)) {
    console.warn(
      "docs/public/brand is missing — run `npm run banner` first (docs:build does this already).",
    );
    return;
  }
  cpSync(brandSrc, join(outDir, "brand"), { recursive: true });
}

function writeStyles() {
  writeFileSync(
    join(outDir, "styles.css"),
    `:root {
  --bg: ${BRAND.bg};
  --bg-raised: #0b0b10;
  --accent: ${BRAND.accent};
  --fg: ${BRAND.fg};
  --fg-dim: #8c9096;
  --border: #22262c;
  --font-ui: "Montserrat", system-ui, sans-serif;
  --font-mono: "Roboto Mono", ui-monospace, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-ui);
  line-height: 1.6;
}
.skip-link {
  position: absolute; left: -9999px; top: 0; background: var(--accent); color: var(--bg);
  padding: 0.5rem 1rem; z-index: 100;
}
.skip-link:focus { left: 0.5rem; top: 0.5rem; }
a { color: var(--accent); }
code, pre, kbd { font-family: var(--font-mono); }
pre {
  background: var(--bg-raised); border: 1px solid var(--border); border-radius: 8px;
  padding: 1rem; overflow-x: auto;
}
code { background: var(--bg-raised); padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
pre code { background: none; padding: 0; }
.site-header {
  display: flex; align-items: center; gap: 1.5rem; padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg);
  z-index: 10;
}
.brand { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; text-decoration: none; color: var(--fg); }
.alpha-pill {
  font-family: var(--font-mono); font-size: 0.7rem; color: var(--bg); background: var(--accent);
  padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 600;
}
.search { position: relative; flex: 1; max-width: 360px; }
.search input {
  width: 100%; background: var(--bg-raised); border: 1px solid var(--border); color: var(--fg);
  padding: 0.5rem 0.75rem; border-radius: 6px; font-family: var(--font-ui);
}
.search input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
#search-results {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-raised);
  border: 1px solid var(--border); border-radius: 8px; list-style: none; margin: 0; padding: 0.25rem;
  max-height: 60vh; overflow-y: auto;
}
#search-results li a { display: block; padding: 0.5rem 0.6rem; border-radius: 6px; text-decoration: none; color: var(--fg); }
#search-results li a:hover, #search-results li a:focus { background: rgba(73, 161, 168, 0.15); }
#search-results .result-title { font-weight: 600; color: var(--fg); }
#search-results .result-excerpt { display: block; font-size: 0.8rem; color: var(--fg-dim); }
.gh-link { color: var(--fg); text-decoration: none; font-size: 0.9rem; white-space: nowrap; }
.gh-link:hover { color: var(--accent); }
.layout { display: grid; grid-template-columns: 240px minmax(0, 1fr) 220px; gap: 2rem; max-width: 1200px; margin: 0 auto; padding: 2rem 1.25rem; }
.sidebar { font-size: 0.9rem; }
.nav-group h2 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-dim); margin: 1.25rem 0 0.4rem; }
.nav-group:first-child h2 { margin-top: 0; }
.nav-group ul { list-style: none; margin: 0; padding: 0; }
.nav-group li a { display: block; padding: 0.3rem 0.5rem; border-radius: 6px; text-decoration: none; color: var(--fg); }
.nav-group li a:hover { background: rgba(73, 161, 168, 0.12); }
.nav-group li a[aria-current="page"] { background: var(--accent); color: var(--bg); font-weight: 600; }
.content { max-width: 70ch; }
.content h1 { font-size: 2rem; margin-top: 0; }
.content h2 { font-size: 1.4rem; border-top: 1px solid var(--border); padding-top: 1.5rem; margin-top: 2rem; }
.content table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
.content th, .content td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; }
.content blockquote { border-left: 3px solid var(--accent); margin: 1rem 0; padding: 0.1rem 1rem; color: var(--fg-dim); }
.toc-rail { font-size: 0.85rem; }
.toc h2 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-dim); }
.toc ul { list-style: none; margin: 0; padding: 0; }
.toc li a { color: var(--fg-dim); text-decoration: none; display: block; padding: 0.2rem 0; }
.toc li a:hover { color: var(--accent); }
.toc-3 { padding-left: 0.75rem; }
.site-footer { border-top: 1px solid var(--border); padding: 1.5rem 1.25rem; text-align: center; font-size: 0.8rem; color: var(--fg-dim); }
@media (max-width: 960px) {
  .layout { grid-template-columns: 1fr; }
  .toc-rail { display: none; }
}
`,
  );
}

function build() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const files = readdirSync(contentDir).filter((f) => f.endsWith(".md"));
  const searchIndex = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const md = readFileSync(join(contentDir, file), "utf8");
    const title = titleFromMarkdown(md);
    const excerpt = excerptFromMarkdown(md, title);
    let bodyHtml = marked.parse(md);
    bodyHtml = addHeadingIds(bodyHtml);
    const headings = extractHeadings(bodyHtml);

    const page = renderShell({ title, bodyHtml, slug, headings });
    writeFileSync(join(outDir, `${slug}.html`), page);

    searchIndex.push({ title, url: `${slug}.html`, excerpt });
  }

  // introduction.html is the canonical home page; index.html mirrors it so
  // both `/` and `/introduction.html` work when served statically.
  if (existsSync(join(outDir, "introduction.html"))) {
    cpSync(join(outDir, "introduction.html"), join(outDir, "index.html"));
  }

  writeFileSync(join(outDir, "search-index.json"), JSON.stringify(searchIndex));
  writeFileSync(
    join(outDir, "search.js"),
    `(function () {
  var input = document.getElementById("search-input");
  var results = document.getElementById("search-results");
  if (!input || !results) return;
  var index = null;
  function load() {
    if (index) return Promise.resolve(index);
    return fetch("search-index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; return data; });
  }
  function render(matches) {
    results.innerHTML = "";
    if (!matches.length) { results.hidden = true; return; }
    matches.slice(0, 8).forEach(function (m) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = m.url;
      a.innerHTML = '<span class="result-title">' + m.title + '</span><span class="result-excerpt">' + m.excerpt + "</span>";
      li.appendChild(a);
      results.appendChild(li);
    });
    results.hidden = false;
  }
  input.addEventListener("input", function () {
    var q = input.value.trim().toLowerCase();
    if (!q) { results.hidden = true; return; }
    load().then(function (data) {
      var matches = data.filter(function (p) {
        return p.title.toLowerCase().indexOf(q) !== -1 || p.excerpt.toLowerCase().indexOf(q) !== -1;
      });
      render(matches);
    });
  });
  document.addEventListener("click", function (e) {
    if (!results.contains(e.target) && e.target !== input) results.hidden = true;
  });
})();
`,
  );

  writeStyles();
  copyFonts();
  copyBrand();

  console.log(`docs: wrote ${files.length} pages to docs/dist`);
}

build();
