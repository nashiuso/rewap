import { createMDX } from "fumadocs-mdx/next";

// Set by scripts/site/build.mjs when this build is being assembled into the
// GitHub Pages artifact under /rewap/ (see examples/playground/vite.config.ts
// for the same pattern on the playground side). A plain `npm run build` keeps
// the default root base, so the docs site also works as a standalone app.
const basePath = process.env.GH_PAGES ? "/rewap" : "";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // GitHub Pages serves static files only — no Node server, no image
  // optimization endpoint, no dynamic routes.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

const withMDX = createMDX();

export default withMDX(config);
